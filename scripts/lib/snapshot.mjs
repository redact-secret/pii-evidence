// Snapshot assembly and verification. Pure functions plus thin file I/O.
// Contract: docs/methodology/consumer-contract.md. Policy: docs/governance/snapshot-policy.md.
//
// A snapshot is a directory of canonical-JSON files that a consumer can load, verify and use
// without any knowledge of the source tree. The builder selects the public-safe subset of the
// evidence, copies records verbatim (no record is edited), projects fixtures only for included
// cases, runs every gate over exactly the included set, and binds everything in manifest.json.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { forbiddenIdViolations } from "../id-rules.mjs";
import { evaluateRecord, lintSources } from "../lint-provenance.mjs";
import { loadAllowlist, scanRepo } from "../lint-safe-data.mjs";
import { bannedKeyErrors } from "./fixture-checks.mjs";
import {
  GENERATOR as PROJECTOR,
  ProjectionRefusal,
  canonicalJson,
  inlinePersonContentErrors,
  materializeTwice,
  populationErrors,
  projectAll,
} from "./projector.mjs";
import { REPO_ROOT, loadTree, readRecordFile, validateRecords, validateTree } from "./validator.mjs";

export const BUILDER = { name: "pii-evidence-snapshot-builder", version: "1.2.0" };
export const CONTRACT_NAME = "pii-evidence-consumer-contract";
export const CONTRACT_VERSION = "1";
export const DIGEST_SPEC = "files-v1";
export const ID_PREFIX = "public-pii-phi";
export const REPO_SLUG = "redact-secret/pii-evidence";
export const REGISTRY_FILE = "snapshots/released.json";
export const SNAPSHOT_DIR = "snapshots";
export const ALLOWLIST_PATH = "docs/governance/safe-data-allowlist.json";

export const FILES = {
  sources: "sources.jsonl",
  claims: "claims.jsonl",
  cases: "cases.jsonl",
  fixtures: "fixtures.jsonl",
  skipped: "skipped.jsonl",
  rules: "fixture-rules.jsonl",
  reviewEvents: "review-events.jsonl",
  kinds: "taxonomy/privacy-kinds.json",
  jurisdictions: "taxonomy/jurisdictions.json",
  contexts: "taxonomy/contexts.json",
  manifest: "manifest.json",
};

export const EXCLUSION_RULE = [
  "A source is included only if scripts/lint-provenance.mjs derives public-safe for it (the --public-release condition); otherwise it is excluded with the lint reasons.",
  "A claim is included only if its source is included and its review state is not rejected.",
  "A case is excluded if any source or claim it cites is excluded or its review state is rejected.",
  "Existing authored cases explicitly deferred or rejected by the project research adjudication are excluded, with the disposition and ledger identity recorded as reasons. Deferred role proposals do not exclude accepted ambiguity or collision controls.",
  "Exclusion propagates across case relationships to a fixed point: a case that relates to an excluded case is excluded, so no included case points at a missing case. Relationships carry no direction, so this is deliberately conservative.",
  "A fixture rule is excluded if any case in its justifiedBy is excluded or its review state is rejected; fixtures exist only for included cases projected through included rules.",
  "Taxonomy entries are copied as taxonomy, not corpus. The only change is removing references to excluded claims, each recorded under taxonomyClaimRefsRemoved.",
  "Cases that cite no source are not gated by sources. They are included with their evidenceClass (including research-needed) and authored expectation unchanged; research-needed cases assert only not-established.",
  "No record is edited. Excluded records are not copied; their ids and reasons are listed in the manifest.",
];

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export const sha256Hex = (buf) => createHash("sha256").update(buf).digest("hex");
const byId = (a, b) => cmp(a.id, b.id);

/** Deep key-sorted copy so that serialization never depends on authoring key order. */
export function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}
export const pretty = (v) => `${JSON.stringify(sortKeys(v), null, 2)}\n`;
const jsonl = (records) => [...records].sort(byId).map((r) => `${canonicalJson(r)}\n`).join("");

export class SnapshotRefusal extends Error {
  constructor(errors) {
    super(errors.join("\n"));
    this.errors = errors;
  }
}

// ---------- ids and digests ----------

/** Content digest "files-v1": sha256 over the lines "<sha256> <path>\n", sorted by path, for every file except manifest.json. */
export function contentDigestOf(files) {
  const lines = Object.keys(files).filter((p) => p !== FILES.manifest).sort().map((p) => `${sha256Hex(Buffer.from(files[p]))} ${p}\n`);
  return sha256Hex(Buffer.from(lines.join(""), "utf8"));
}
export const snapshotIdOf = (date, contentDigest) => `${ID_PREFIX}/${date}/${contentDigest.slice(0, 12)}`;
export const flatId = (id) => id.replaceAll("/", "-");
export const tagOf = (id) => `snapshot-${flatId(id)}`;
export const releaseUrlOf = (id) => `https://github.com/${REPO_SLUG}/releases/tag/${tagOf(id)}`;
export const archiveNameOf = (id) => `pii-evidence-${flatId(id)}.tar.gz`;

// ---------- deterministic tar (ustar) ----------

function tarHeader(name, size) {
  if (Buffer.byteLength(name) > 100) throw new Error(`tar path too long: ${name}`);
  const h = Buffer.alloc(512, 0);
  const put = (off, s) => h.write(s, off, "ascii");
  put(0, name);
  put(100, "0000644\0");
  put(108, "0000000\0");
  put(116, "0000000\0");
  put(124, `${size.toString(8).padStart(11, "0")}\0`);
  put(136, "00000000000\0"); // mtime fixed at the epoch
  put(148, "        ");
  put(156, "0");
  put(257, "ustar\0");
  put(263, "00");
  let sum = 0;
  for (const b of h) sum += b;
  put(148, `${sum.toString(8).padStart(6, "0")}\0 `);
  return h;
}

/** Deterministic tar of a snapshot: sorted names, mode 0644, uid/gid 0, mtime 0, top directory = flat id. */
export function tarOf(id, files) {
  const parts = [];
  for (const p of Object.keys(files).sort()) {
    const body = Buffer.from(files[p]);
    parts.push(tarHeader(`${flatId(id)}/${p}`, body.length), body, Buffer.alloc((512 - (body.length % 512)) % 512, 0));
  }
  parts.push(Buffer.alloc(1024, 0));
  return Buffer.concat(parts);
}
export const gzipOf = (tar) => gzipSync(tar, { level: 9 });

// ---------- reading a snapshot directory (no source-tree knowledge) ----------

export function readSnapshotFiles(dir) {
  const files = {};
  const problems = [];
  const walk = (rel) => {
    for (const ent of readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => cmp(a.name, b.name))) {
      const p = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isSymbolicLink()) problems.push(`${p}: symbolic links are not allowed in a snapshot`);
      else if (ent.isDirectory()) walk(p);
      else if (ent.isFile()) files[p] = readFileSync(path.join(dir, p));
      else problems.push(`${p}: not a regular file`);
    }
  };
  walk("");
  return { files, problems };
}

const parseJsonl = (buf) => buf.toString("utf8").split("\n").filter((l) => l.trim() !== "").map((l) => JSON.parse(l));
const recordCount = (buf) => buf.toString("utf8").split("\n").filter((l) => l.trim() !== "").length;

// ---------- selection ----------

const typeOf = (records, kind) => records.filter((r) => r.data.kind === kind).map((r) => r.data);

/**
 * Decide what is public. `records` are validated tree records (taxonomy, sources, claims, cases,
 * rules, review events). Returns included lists and exclusion entries with reasons.
 */
// Dispositions govern promotion, while research records stay inspectable in the source tree.
export function adjudicationExclusionsOf(root, records) {
  const knownCases = new Map(typeOf(records, "case").map((c) => [c.id, c]));
  const exclusions = new Map();
  for (const name of ["case-strengthening", "coverage-expansion"]) {
    const file = path.join(root, "docs/research", `${name}-adjudication.json`);
    if (!existsSync(file)) continue; // Isolated historical/test corpora have no promotion ledger.
    let ledger;
    try { ledger = JSON.parse(readFileSync(file, "utf8")); }
    catch { throw new SnapshotRefusal([`${name} adjudication ledger is not valid JSON`]); }
    if (ledger?.schemaVersion !== "1" || !/^[a-z0-9-]+$/.test(ledger.id ?? "") || !Array.isArray(ledger.candidates)) throw new SnapshotRefusal([`${name} adjudication ledger has an unknown schema`]);
    const seen = new Set();
    for (const row of ledger.candidates) {
      if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id || seen.has(row.id) || !["add", "context-only", "defer", "reject"].includes(row.disposition)) throw new SnapshotRefusal([`${name} adjudication has a duplicate/invalid candidate or disposition`]);
      seen.add(row.id);
      // A role proposal can be deferred while its relative-kind negative Case is accepted.
      if (row.canonicalCaseDisposition !== undefined && !["add", "context-only", "defer", "reject", "retain-bounded-existing-cases", "no-new-case"].includes(row.canonicalCaseDisposition)) throw new SnapshotRefusal([`${name}: invalid canonical Case disposition for ${row.id}`]);
      if (!knownCases.has(row.id)) continue;
      if (row.canonicalCaseDisposition === "retain-bounded-existing-cases" || row.canonicalCaseDisposition === "no-new-case") throw new SnapshotRefusal([`${name}: role-only disposition used for an authored Case ${row.id}`]);
      const disposition = row.canonicalCaseDisposition ?? row.disposition;
      if (!["add", "context-only", "defer", "reject"].includes(disposition)) throw new SnapshotRefusal([`${name}: invalid canonical Case disposition for ${row.id}`]);
      if (disposition === "defer" || disposition === "reject") exclusions.set(row.id, [`adjudication: ${disposition} in ${ledger.id}`]);
    }
  }
  return exclusions;
}

// Compare with a strictly earlier release so registering this candidate never
// changes its rebuild bytes. Detailed reasoning stays in the hash-bound ledgers.
export function promotionDeltaOf(root, date, manifest, files) {
  const baseline = readRegistry(root).snapshots.filter(s => s.snapshotDate < date)
    .sort((a, b) => cmp(a.snapshotDate, b.snapshotDate) || cmp(a.id, b.id)).at(-1);
  if (!baseline) return undefined;
  const { files: old, problems } = readSnapshotFiles(path.join(root, SNAPSHOT_DIR, baseline.id));
  if (problems.length) throw new SnapshotRefusal(problems);
  if (canonicalJson(Object.keys(old).sort(cmp)) !== canonicalJson(Object.keys(baseline.files).sort(cmp))) throw new SnapshotRefusal(["promotion baseline file set differs from its released pin"]);
  for (const [file, expected] of Object.entries(baseline.files)) {
    if (!old[file] || sha256Hex(old[file]) !== expected) throw new SnapshotRefusal([`promotion baseline file differs from its released pin: ${file}`]);
  }
  if (sha256Hex(old[FILES.manifest]) !== baseline.manifestSha256) throw new SnapshotRefusal(["promotion baseline manifest differs from its released pin"]);
  const prior = JSON.parse(old[FILES.manifest]);
  const diff = (before, after) => {
    const a = new Map(before.map(r => [r.id, r]));
    const b = new Map(after.map(r => [r.id, r]));
    return {
      added: [...b.keys()].filter(id => !a.has(id)).sort(cmp),
      removed: [...a.keys()].filter(id => !b.has(id)).sort(cmp),
      changed: [...b.keys()].filter(id => a.has(id) && canonicalJson(a.get(id)) !== canonicalJson(b.get(id))).sort(cmp),
    };
  };
  const ledgers = [];
  const decisions = [];
  for (const name of ["case-strengthening", "coverage-expansion"]) {
    const relative = `docs/research/${name}-adjudication.json`;
    if (!existsSync(path.join(root, relative))) continue;
    const bytes = readFileSync(path.join(root, relative));
    const ledger = JSON.parse(bytes);
    ledgers.push({ id: ledger.id, sha256: sha256Hex(bytes) });
    for (const row of ledger.candidates) decisions.push({ id: row.id, ledger: ledger.id, disposition: row.disposition });
  }
  return {
    baseline: { id: baseline.id, manifestSha256: baseline.manifestSha256 },
    kinds: diff(JSON.parse(old[FILES.kinds]).kinds, JSON.parse(files[FILES.kinds]).kinds),
    cases: diff(parseJsonl(old[FILES.cases]), parseJsonl(Buffer.from(files[FILES.cases]))),
    counts: Object.fromEntries(["cases", "fixtures"].map(key => [key, { previous: prior.counts[key], candidate: manifest.counts[key], delta: manifest.counts[key] - prior.counts[key] }])),
    ledgers,
    decisions: decisions.sort((a, b) => cmp(`${a.ledger}/${a.id}`, `${b.ledger}/${b.id}`)),
  };
}

export function selectEvidence(records, adjudicationExclusions = new Map()) {
  const sources = typeOf(records, "source");
  const claims = typeOf(records, "claim");
  const cases = typeOf(records, "case");
  const rules = typeOf(records, "fixture-rule");
  const events = typeOf(records, "review-event");

  const ex = { sources: new Map(), claims: new Map(), cases: new Map(), rules: new Map() };
  const note = (map, id, reason) => map.set(id, [...(map.get(id) ?? []), reason]);

  for (const s of sources) {
    const ev = evaluateRecord(s);
    if (ev.readiness !== "public-safe") for (const r of [...ev.blocked, ...ev.unresolved, ...ev.errors]) note(ex.sources, s.id, `provenance: ${r}`);
  }
  for (const c of claims) {
    if (ex.sources.has(c.source)) note(ex.claims, c.id, `depends on excluded source ${c.source}`);
    if (c.review.state === "rejected") note(ex.claims, c.id, "review state is rejected");
  }
  for (const c of cases) {
    for (const s of c.provenance.sources) if (ex.sources.has(s)) note(ex.cases, c.id, `cites excluded source ${s}`);
    for (const cl of c.provenance.claims) if (ex.claims.has(cl)) note(ex.cases, c.id, `cites excluded claim ${cl}`);
    if (c.review.state === "rejected") note(ex.cases, c.id, "review state is rejected");
    for (const reason of adjudicationExclusions.get(c.id) ?? []) note(ex.cases, c.id, reason);
  }
  for (let changed = true; changed; ) {
    changed = false;
    for (const c of cases) {
      if (ex.cases.has(c.id)) continue;
      for (const rel of c.relationships) {
        if (ex.cases.has(rel.case)) {
          note(ex.cases, c.id, `relates to excluded case ${rel.case}`);
          changed = true;
        }
      }
    }
  }
  for (const r of rules) {
    for (const cid of r.justifiedBy ?? []) if (ex.cases.has(cid)) note(ex.rules, r.id, `justified by excluded case ${cid}`);
    if (r.review.state === "rejected") note(ex.rules, r.id, "review state is rejected");
  }

  const keep = (list, map) => list.filter((x) => !map.has(x.id));
  const included = {
    sources: keep(sources, ex.sources),
    claims: keep(claims, ex.claims),
    cases: keep(cases, ex.cases),
    rules: keep(rules, ex.rules),
  };
  const used = new Set();
  for (const list of Object.values(included)) for (const r of list) for (const e of r.review.events) used.add(e);
  included.reviewEvents = events.filter((e) => used.has(e.id));

  // Taxonomy: copy, minus references to excluded claims.
  const removed = [];
  const dropClaims = (entry, ids) => (ids ?? []).filter((c) => {
    if (!ex.claims.has(c)) return true;
    removed.push({ entry, claim: c });
    return false;
  });
  const wrappers = {};
  for (const [key, listKey] of [["kinds", "kinds"], ["jurisdictions", "jurisdictions"], ["contexts", "contexts"]]) {
    const kindName = { kinds: "privacy-kinds", jurisdictions: "jurisdictions", contexts: "contexts" }[key];
    const w = structuredClone(records.find((r) => r.data.kind === kindName)?.data);
    if (!w) throw new SnapshotRefusal([`taxonomy wrapper "${kindName}" is missing`]);
    for (const item of w[listKey]) {
      if (key === "kinds") {
        item.formatClaims = dropClaims(item.id, item.formatClaims);
        for (const cc of item.contextClaims ?? []) if (cc.claims) cc.claims = dropClaims(item.id, cc.claims);
      } else if (key === "contexts" && item.claims) item.claims = dropClaims(item.id, item.claims);
    }
    wrappers[key] = w;
  }
  removed.sort((a, b) => cmp(a.entry + a.claim, b.entry + b.claim));

  const flat = (map) => [...map.entries()].map(([id, reasons]) => ({ id, reasons })).sort(byId);
  return {
    included,
    wrappers,
    exclusions: { sources: flat(ex.sources), claims: flat(ex.claims), cases: flat(ex.cases), rules: flat(ex.rules), taxonomyClaimRefsRemoved: removed },
    excludedCaseIds: new Set(ex.cases.keys()),
  };
}

// ---------- coverage ----------

const tally = (arr) => Object.fromEntries([...arr.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map())].sort((a, b) => cmp(a[0], b[0])));

export function coverageOf({ cases, fixtures, kindIds }) {
  const uniq = (xs) => [...new Set(xs)].sort();
  const perKind = {};
  for (const c of cases) perKind[c.privacyKind] ??= { cases: 0, fixtures: 0 };
  for (const c of cases) perKind[c.privacyKind].cases++;
  const caseKind = new Map(cases.map((c) => [c.id, c.privacyKind]));
  for (const f of fixtures) if (caseKind.has(f.case)) perKind[caseKind.get(f.case)].fixtures++;
  const kinds = uniq(cases.map((c) => c.privacyKind));
  return {
    kinds,
    jurisdictions: uniq(cases.map((c) => c.jurisdiction)),
    contexts: uniq(cases.flatMap((c) => c.contexts)),
    domains: uniq(cases.flatMap((c) => c.expectation.domains)),
    perKind: Object.fromEntries(Object.keys(perKind).sort().map((k) => [k, perKind[k]])),
    roles: tally(cases.map((c) => c.role)),
    identityStates: tally(cases.map((c) => c.expectation.identity)),
    evidenceClasses: tally(cases.map((c) => c.provenance.evidenceClass)),
    kindsWithoutCases: uniq(kindIds.filter((k) => !kinds.includes(k))),
  };
}

// ---------- the build ----------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function writeStage(stage, files) {
  for (const [p, text] of Object.entries(files)) {
    const abs = path.join(stage, p);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
}

function check(checks, name, errors, detail) {
  checks.push({ name, status: errors.length ? "failed" : "passed", ...(detail ? { detail } : {}) });
  return errors;
}

/**
 * Assemble a snapshot in memory. Throws SnapshotRefusal when any gate fails. `date` is an explicit
 * input recorded in the manifest; the clock is never read.
 */
export function buildSnapshot({ root = REPO_ROOT, date } = {}) {
  if (typeof date !== "string" || !DATE_RE.test(date) || Number.isNaN(Date.parse(date))) throw new SnapshotRefusal(["--date YYYY-MM-DD is required (an explicit input recorded in the manifest)"]);
  const loaded = loadTree(root);
  const records = loaded.records.filter((r) => r.corpus === "tree" && !r.file.startsWith("snapshots/") && !r.file.startsWith("fixtures/materialized/"));
  const checks = [];
  const refuse = (errs) => {
    if (errs.length) throw new SnapshotRefusal(errs);
  };
  refuse(loaded.errors);
  refuse(populationErrors(records, "public"));
  refuse(inlinePersonContentErrors(records));
  refuse(check(checks, "population: every record is public; no protected or mixed population", []));
  refuse(validateRecords(records).errors.map((e) => `source tree invalid: ${e}`));

  const sel = selectEvidence(records, adjudicationExclusionsOf(root, records));
  const { included } = sel;
  if (included.cases.length === 0) refuse(["no public-safe case remains; nothing to snapshot"]);
  const allCases = typeOf(records, "case");
  const allRules = typeOf(records, "fixture-rule");
  const excludedFixtures = projectAll(allCases, allRules).fixtures.filter((f) => sel.excludedCaseIds.has(f.case)).length;

  // Stage the included set as an ordinary tree so the same tools run over exactly what is published.
  const stage = mkdtempSync(path.join(tmpdir(), "pii-evidence-snapshot-"));
  try {
    const treeFiles = {
      "taxonomy/privacy-kinds.json": pretty(sel.wrappers.kinds),
      "taxonomy/jurisdictions.json": pretty(sel.wrappers.jurisdictions),
      "taxonomy/contexts.json": pretty(sel.wrappers.contexts),
      "evidence/sources/included.jsonl": jsonl(included.sources),
      "evidence/claims/included.jsonl": jsonl(included.claims),
      "evidence/cases/included.jsonl": jsonl(included.cases),
      "fixtures/rules/included.jsonl": jsonl(included.rules),
    };
    if (included.reviewEvents.length) treeFiles["evidence/review-events/included.jsonl"] = jsonl(included.reviewEvents);
    writeStage(stage, treeFiles);

    refuse(check(checks, "validate: schema, references, ids and lineage over the included set (npm run validate semantics)", validateTree(stage).errors.map((e) => `included set invalid: ${e}`)));

    // Provenance gate: lint-provenance --public-release over the included sources.
    const lint = lintSources(stage);
    const provErrors = [
      ...lint.fileProblems.map((p) => `${p.path}: ${p.message}`),
      ...lint.results.flatMap((r) => [...r.errors, ...r.blocked, ...r.unresolved].map((m) => `${r.id}: ${m}`)),
    ];
    refuse(check(checks, "lint-provenance --public-release over the included sources", provErrors.map((e) => `provenance gate: ${e}`), `${lint.results.length} sources, all public-safe`));

    // Projection: only included cases through included rules; twice, second over reversed input.
    let twice;
    try {
      twice = materializeTwice({ root: stage });
    } catch (e) {
      if (e instanceof ProjectionRefusal) throw new SnapshotRefusal(e.errors.map((x) => `projection: ${x}`));
      throw e;
    }
    refuse(check(checks, "fixtures:materialize:check semantics: two projections byte-identical and valid against cases and rules", twice.diffs.map((d) => `projection is nondeterministic: ${d}`)));
    const { fixtures, skipped } = twice.first;

    const out = {
      [FILES.sources]: jsonl(included.sources),
      [FILES.claims]: jsonl(included.claims),
      [FILES.cases]: jsonl(included.cases),
      [FILES.fixtures]: jsonl(fixtures),
      [FILES.skipped]: jsonl(skipped),
      [FILES.rules]: jsonl(included.rules),
      [FILES.kinds]: treeFiles["taxonomy/privacy-kinds.json"],
      [FILES.jurisdictions]: treeFiles["taxonomy/jurisdictions.json"],
      [FILES.contexts]: treeFiles["taxonomy/contexts.json"],
    };
    if (included.reviewEvents.length) out[FILES.reviewEvents] = jsonl(included.reviewEvents);

    // Privacy gate over the published bytes plus the staged evidence.
    const allow = loadAllowlist(path.join(REPO_ROOT, ALLOWLIST_PATH));
    refuse(allow.errors.map((e) => `allowlist: ${e}`));
    const draft = Object.fromEntries(Object.entries(out).map(([p, t]) => [`snapshot-files/${p}`, t]));
    writeStage(stage, draft);
    const scan = scanRepo(stage, { allowlist: allow.entries });
    refuse(check(checks, "lint-safe-data over the included evidence and the published snapshot bytes", scan.findings.map((f) => `safe-data gate: ${f.path}:${f.line} ${f.rule} (value not printed)`), `${scan.scanned} files scanned`));
    rmSync(path.join(stage, "snapshot-files"), { recursive: true, force: true });

    const neutral = Object.entries(out).filter(([p]) => !p.startsWith("taxonomy/")).flatMap(([p, t]) => parseJsonl(Buffer.from(t)).flatMap((r) => bannedKeyErrors(r).map((e) => `${p} ${r.id}${e}`)));
    refuse(check(checks, "neutrality: no scanner, detector, support-state, threshold or score field in any record", neutral));

    const taxonomyVersions = new Set(Object.values(sel.wrappers).map((w) => w.taxonomyVersion));
    if (taxonomyVersions.size !== 1) refuse([`taxonomy files disagree on taxonomyVersion: ${[...taxonomyVersions].join(", ")}`]);
    const [taxonomyVersion] = taxonomyVersions;

    const contentDigest = contentDigestOf(out);
    const id = snapshotIdOf(date, contentDigest);
    refuse(forbiddenIdViolations(id).map((v) => `snapshot id "${id}" violates identity rule ${v.rule}: ${v.why}`));

    const kindIds = sel.wrappers.kinds.kinds.map((k) => k.id);
    const schemaVersions = { "privacy-kinds": "1", jurisdictions: "1", contexts: "1", source: "1", claim: "1", case: "1", "fixture-projection": "1", "fixture-rule": "1", "snapshot-manifest": "1" };
    if (skipped.length) schemaVersions["fixture-skip"] = "1";
    if (included.reviewEvents.length) schemaVersions["review-event"] = "1";
    const fileList = Object.keys(out).sort().map((p) => ({
      path: p,
      ...(p.endsWith(".jsonl") ? { records: recordCount(Buffer.from(out[p])) } : {}),
      bytes: Buffer.byteLength(out[p]),
      sha256: sha256Hex(Buffer.from(out[p])),
    }));
    const manifest = {
      kind: "snapshot-manifest",
      schemaVersion: "1",
      id,
      population: "public",
      snapshotDate: date,
      schemaVersions,
      taxonomyVersion,
      sourceManifestDigest: sha256Hex(Buffer.from(out[FILES.sources])),
      contentDigest,
      contentDigestSpec: DIGEST_SPEC,
      generator: BUILDER,
      fixtureGenerator: PROJECTOR,
      consumerContract: CONTRACT_NAME,
      consumerContractVersion: CONTRACT_VERSION,
      counts: {
        cases: included.cases.length,
        fixtures: fixtures.length,
        sources: included.sources.length,
        claims: included.claims.length,
        skipped: skipped.length,
        rules: included.rules.length,
        reviewEvents: included.reviewEvents.length,
        excludedSources: sel.exclusions.sources.length,
        excludedClaims: sel.exclusions.claims.length,
        excludedCases: sel.exclusions.cases.length,
        excludedFixtures: excludedFixtures,
      },
      coverage: coverageOf({ cases: included.cases, fixtures, kindIds }),
      validation: { schema: "passed", provenance: "passed", privacy: "passed", checks: [...checks, { name: "snapshot:verify standalone checks over the assembled directory", status: "passed" }] },
      files: fileList,
      exclusions: { rule: EXCLUSION_RULE, ...sel.exclusions, fixtureCount: excludedFixtures },
    };
    const promotion = promotionDeltaOf(root, date, manifest, out);
    if (promotion) manifest.coverageDelta = promotion;
    const files = { ...out, [FILES.manifest]: pretty(manifest) };

    // The assembled directory must pass the same verification a consumer runs.
    const v = verifySnapshotFiles(Object.fromEntries(Object.entries(files).map(([p, t]) => [p, Buffer.from(t)])), { expectedId: id });
    refuse(v.errors.map((e) => `assembled snapshot fails verification: ${e}`));
    writeStage(stage, Object.fromEntries(Object.entries(files).map(([p, t]) => [`snapshots/${id}/${p}`, t])));
    refuse(validateTree(stage).errors.map((e) => `assembled snapshot fails validate: ${e}`));
    return { id, manifest, files };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

// ---------- verification (standalone: reads only the snapshot files) ----------

/**
 * Verify a snapshot from its files alone. `files` maps relative path -> Buffer.
 * Returns { errors, manifest }. Options: expectedId (the directory id), allowlist (entries) for
 * the safe-data scan, which is skipped when not supplied.
 */
export function verifySnapshotFiles(files, { expectedId, allowlist } = {}) {
  const errors = [];
  const text = (p) => files[p]?.toString("utf8");
  if (!files[FILES.manifest]) return { errors: ["manifest.json is missing"], manifest: null };
  let manifest;
  try {
    manifest = JSON.parse(text(FILES.manifest));
  } catch (e) {
    return { errors: [`manifest.json is not valid JSON: ${e.message}`], manifest: null };
  }

  // schema, references and lineage: every file is validated as its own corpus.
  const corpus = `snapshot:${manifest.id}`;
  const recs = [];
  for (const [p, buf] of Object.entries(files)) {
    if (!/\.jsonl?$/.test(p)) continue;
    const tmp = parseRecordBuffer(p, buf, corpus);
    errors.push(...tmp.errors);
    recs.push(...tmp.records);
  }
  errors.push(...validateRecords(recs).errors);
  if (errors.length) return { errors, manifest };

  if (expectedId !== undefined && manifest.id !== expectedId) errors.push(`manifest id "${manifest.id}" does not match its location "${expectedId}"`);
  if (manifest.population !== "public") errors.push("manifest population must be public");
  if (manifest.consumerContract !== CONTRACT_NAME || manifest.consumerContractVersion !== CONTRACT_VERSION) errors.push(`consumer contract must be ${CONTRACT_NAME} ${CONTRACT_VERSION}`);
  if (manifest.contentDigestSpec !== DIGEST_SPEC) errors.push(`unsupported contentDigestSpec ${manifest.contentDigestSpec}`);

  // files: exactly the listed set, digests and byte counts
  const listed = new Map((manifest.files ?? []).map((f) => [f.path, f]));
  const actual = Object.keys(files).filter((p) => p !== FILES.manifest);
  for (const p of actual) if (!listed.has(p)) errors.push(`${p}: file is not listed in the manifest`);
  for (const [p, f] of listed) {
    if (!files[p]) {
      errors.push(`${p}: listed in the manifest but missing`);
      continue;
    }
    if (sha256Hex(files[p]) !== f.sha256) errors.push(`${p}: sha256 does not match the manifest`);
    if (files[p].length !== f.bytes) errors.push(`${p}: byte length does not match the manifest`);
    if (f.records !== undefined && recordCount(files[p]) !== f.records) errors.push(`${p}: record count does not match the manifest`);
  }
  for (const req of [FILES.sources, FILES.claims, FILES.cases, FILES.fixtures, FILES.skipped, FILES.rules, FILES.kinds, FILES.jurisdictions, FILES.contexts]) if (!files[req]) errors.push(`${req}: required file is missing`);
  if (errors.length) return { errors, manifest };

  const digest = contentDigestOf(Object.fromEntries(actual.map((p) => [p, files[p]])));
  if (digest !== manifest.contentDigest) errors.push("contentDigest does not match the recomputed digest of the files");
  const wantId = snapshotIdOf(manifest.snapshotDate, digest);
  if (manifest.id !== wantId) errors.push(`id "${manifest.id}" is not derived from snapshotDate and content digest (expected "${wantId}")`);
  for (const v of forbiddenIdViolations(manifest.id)) errors.push(`id violates identity rule ${v.rule}`);
  if (sha256Hex(files[FILES.sources]) !== manifest.sourceManifestDigest) errors.push("sourceManifestDigest does not match sources.jsonl");

  const sources = parseJsonl(files[FILES.sources]);
  const claims = parseJsonl(files[FILES.claims]);
  const cases = parseJsonl(files[FILES.cases]);
  const fixtures = parseJsonl(files[FILES.fixtures]);
  const skipped = parseJsonl(files[FILES.skipped]);
  const rules = parseJsonl(files[FILES.rules]);
  const events = files[FILES.reviewEvents] ? parseJsonl(files[FILES.reviewEvents]) : [];
  const kinds = JSON.parse(text(FILES.kinds));

  const counts = { cases: cases.length, fixtures: fixtures.length, sources: sources.length, claims: claims.length, skipped: skipped.length, rules: rules.length, reviewEvents: events.length };
  for (const [k, n] of Object.entries(counts)) if (manifest.counts[k] !== n) errors.push(`counts.${k} is ${manifest.counts[k]} but the files hold ${n}`);
  const cov = coverageOf({ cases, fixtures, kindIds: kinds.kinds.map((k) => k.id) });
  const { languages, ...manifestCov } = manifest.coverage;
  if (canonicalJson(manifestCov) !== canonicalJson(cov)) errors.push("coverage does not match the recomputed coverage");

  // provenance re-check: every included source is public-safe by the lint's own evaluation
  for (const s of sources) {
    const ev = evaluateRecord(s);
    if (ev.readiness !== "public-safe") errors.push(`source ${s.id} is not public-safe (${[...ev.blocked, ...ev.unresolved, ...ev.errors].join("; ")})`);
  }
  if (manifest.validation.schema !== "passed" || manifest.validation.provenance !== "passed" || manifest.validation.privacy !== "passed") errors.push("validation status is not passed");
  if ((manifest.validation.checks ?? []).some((c) => c.status !== "passed")) errors.push("a recorded validation check did not pass");

  // exclusions: nothing excluded is present, nothing dangling in the taxonomy
  const present = new Set([...sources, ...claims, ...cases, ...rules].map((r) => r.id));
  for (const kind of ["sources", "claims", "cases", "rules"]) for (const e of manifest.exclusions[kind] ?? []) if (present.has(e.id)) errors.push(`excluded ${kind.slice(0, -1)} ${e.id} is present in the snapshot`);
  if (manifest.exclusions.cases.length !== manifest.counts.excludedCases) errors.push("counts.excludedCases does not match exclusions.cases");
  if (manifest.exclusions.sources.length !== manifest.counts.excludedSources) errors.push("counts.excludedSources does not match exclusions.sources");
  if (manifest.exclusions.claims.length !== manifest.counts.excludedClaims) errors.push("counts.excludedClaims does not match exclusions.claims");

  // lineage: fixtures resolve to a case in this snapshot, every case resolves its sources and claims (validator), no orphan fixture
  const caseIds = new Set(cases.map((c) => c.id));
  for (const f of fixtures) if (!caseIds.has(f.case)) errors.push(`fixture ${f.id} references a case outside the snapshot`);
  for (const c of cases) if (c.population !== undefined && c.population !== "public") errors.push(`case ${c.id} is not public`);

  // neutrality over every non-taxonomy record and the manifest
  for (const r of [...sources, ...claims, ...cases, ...fixtures, ...skipped, ...rules, ...events, manifest]) for (const e of bannedKeyErrors(r)) errors.push(`${r.id}${e}`);

  if (allowlist) {
    const stage = mkdtempSync(path.join(tmpdir(), "pii-evidence-verify-"));
    try {
      writeStage(stage, Object.fromEntries(Object.entries(files).map(([p, b]) => [p, b])));
      for (const f of scanRepo(stage, { allowlist }).findings) errors.push(`safe-data: ${f.path}:${f.line} ${f.rule} (value not printed)`);
    } finally {
      rmSync(stage, { recursive: true, force: true });
    }
  }
  return { errors, manifest };
}

function parseRecordBuffer(p, buf, corpus) {
  const stage = mkdtempSync(path.join(tmpdir(), "pii-evidence-rec-"));
  try {
    const abs = path.join(stage, path.basename(p));
    writeFileSync(abs, buf);
    return readRecordFile(abs, p, corpus);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

export function verifySnapshotDir(dir, opts = {}) {
  const { files, problems } = readSnapshotFiles(dir);
  if (problems.length) return { errors: problems, manifest: null, files };
  return { ...verifySnapshotFiles(files, opts), files };
}

// ---------- the repository: snapshot directories and the released registry ----------

/** Directories under <root>/snapshots that hold a manifest.json; the id is the path below snapshots/. */
export function findSnapshotDirs(root) {
  const base = path.join(root, SNAPSHOT_DIR);
  const found = [];
  if (!existsSync(base)) return found;
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true }).sort((a, b) => cmp(a.name, b.name))) {
      const abs = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) walk(abs);
      else if (ent.name === FILES.manifest) found.push(path.relative(base, dir).split(path.sep).join("/"));
    }
  };
  walk(base);
  return found.sort();
}

export function readRegistry(root) {
  const p = path.join(root, REGISTRY_FILE);
  if (!existsSync(p)) return { kind: "snapshot-registry", schemaVersion: "1", id: "snapshot-registry", snapshots: [] };
  return JSON.parse(readFileSync(p, "utf8"));
}

export function registryText(reg) {
  return pretty({ ...reg, snapshots: [...reg.snapshots].sort(byId) });
}

/** Registry entry for a built snapshot (everything except nothing: release pointers are derived). */
export function registryEntryOf({ id, manifest, files }) {
  const buf = Object.fromEntries(Object.entries(files).map(([p, t]) => [p, Buffer.from(t)]));
  const tar = tarOf(id, buf);
  const gz = gzipOf(tar);
  return {
    id,
    status: "released",
    snapshotDate: manifest.snapshotDate,
    manifestSha256: sha256Hex(buf[FILES.manifest]),
    contentDigest: manifest.contentDigest,
    files: Object.fromEntries(Object.keys(buf).sort().map((p) => [p, sha256Hex(buf[p])])),
    archive: { tarSha256: sha256Hex(tar), name: archiveNameOf(id), tarGzSha256: sha256Hex(gz) },
    release: { tag: tagOf(id), url: releaseUrlOf(id) },
  };
}

function gitShow(root, ref, rel) {
  try {
    return execFileSync("git", ["show", `${ref}:${rel}`], { cwd: root, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Verify every snapshot directory under <root>/snapshots against the registry.
 *   released: files must equal the registered digests; archive and release pointers must be derivable.
 *   draft (not registered): must verify and, unless rebuild is false, equal a fresh rebuild.
 * With `base` (a git ref), every entry registered there must still exist unchanged.
 */
export function verifyRepository({ root = REPO_ROOT, base, rebuild = true, allowlist } = {}) {
  const errors = [];
  const notes = [];
  const reg = readRegistry(root);
  const regById = new Map();
  for (const e of reg.snapshots) {
    if (regById.has(e.id)) errors.push(`registry lists ${e.id} twice`);
    regById.set(e.id, e);
  }
  const dirs = findSnapshotDirs(root);
  for (const id of regById.keys()) if (!dirs.includes(id)) errors.push(`released snapshot ${id} is registered but its directory is missing`);

  for (const id of dirs) {
    const dir = path.join(root, SNAPSHOT_DIR, id);
    const v = verifySnapshotDir(dir, { expectedId: id, allowlist });
    for (const e of v.errors) errors.push(`${id}: ${e}`);
    const entry = regById.get(id);
    if (entry) {
      notes.push(`${id}: released`);
      if (!v.manifest) continue;
      const want = registryEntryOf({ id, manifest: v.manifest, files: v.files });
      if (entry.manifestSha256 !== want.manifestSha256) errors.push(`${id}: manifest.json differs from the released digest (released snapshots never change; a correction is a new snapshot id)`);
      if (entry.contentDigest !== v.manifest.contentDigest) errors.push(`${id}: contentDigest differs from the released digest`);
      for (const p of new Set([...Object.keys(entry.files), ...Object.keys(want.files)])) {
        if (entry.files[p] !== want.files[p]) errors.push(`${id}: ${p} ${entry.files[p] ? (want.files[p] ? "differs from" : "is missing against") : "is not in"} the released file digests`);
      }
      if (entry.archive.tarSha256 !== want.archive.tarSha256) errors.push(`${id}: deterministic tar digest differs from the registry`);
      if (entry.archive.name !== want.archive.name) errors.push(`${id}: archive name is not ${want.archive.name}`);
      if (entry.release.tag !== want.release.tag || entry.release.url !== want.release.url) errors.push(`${id}: release tag/url is not the derived ${want.release.tag}`);
      if (entry.snapshotDate !== v.manifest.snapshotDate) errors.push(`${id}: snapshotDate differs from the registry`);
    } else {
      notes.push(`${id}: draft (not released)`);
      if (rebuild && v.manifest) {
        try {
          const built = buildSnapshot({ root, date: v.manifest.snapshotDate });
          const actualFiles = v.files;
          const paths = new Set([...Object.keys(built.files), ...Object.keys(actualFiles)]);
          if (built.id !== id) errors.push(`${id}: a fresh rebuild yields ${built.id}; the committed draft is stale (run npm run snapshot:build -- --date ${v.manifest.snapshotDate})`);
          else for (const p of paths) if (built.files[p] === undefined || !actualFiles[p] || Buffer.compare(Buffer.from(built.files[p]), actualFiles[p]) !== 0) errors.push(`${id}: ${p} differs from a fresh rebuild`);
        } catch (e) {
          if (e instanceof SnapshotRefusal) errors.push(`${id}: rebuild refused: ${e.errors.join("; ")}`);
          else throw e;
        }
      }
    }
  }

  if (base) {
    const text = gitShow(root, base, REGISTRY_FILE);
    if (text === null) notes.push(`base ${base}: no registry yet`);
    else {
      let baseReg;
      try {
        baseReg = JSON.parse(text);
      } catch {
        baseReg = null;
        errors.push(`base ${base}: registry is not valid JSON`);
      }
      for (const b of baseReg?.snapshots ?? []) {
        const cur = regById.get(b.id);
        if (!cur) errors.push(`base ${base}: released snapshot ${b.id} was removed from the registry`);
        else if (canonicalJson(cur) !== canonicalJson(b)) errors.push(`base ${base}: registry entry for released snapshot ${b.id} was modified`);
        const baseManifest = gitShow(root, base, `${SNAPSHOT_DIR}/${b.id}/${FILES.manifest}`);
        if (baseManifest !== null && sha256Hex(Buffer.from(baseManifest)) !== b.manifestSha256) errors.push(`base ${base}: committed manifest of ${b.id} does not match its registry entry`);
        for (const [p, sha] of Object.entries(b.files)) {
          const abs = path.join(root, SNAPSHOT_DIR, b.id, p);
          if (!existsSync(abs) || lstatSync(abs).isSymbolicLink() || sha256Hex(readFileSync(abs)) !== sha) errors.push(`base ${base}: ${b.id}/${p} differs from the released digest`);
        }
      }
      notes.push(`base ${base}: ${baseReg?.snapshots?.length ?? 0} released snapshot(s) checked for immutability`);
    }
  }
  return { errors, notes, dirs };
}

/** Write a built snapshot under <root>/snapshots/<id>/. Refuses to touch a released id; removes other drafts. */
export function writeSnapshot({ root = REPO_ROOT, built }) {
  const reg = readRegistry(root);
  const released = new Set(reg.snapshots.map((s) => s.id));
  const target = path.join(root, SNAPSHOT_DIR, built.id);
  if (released.has(built.id)) {
    const { files } = existsSync(target) ? readSnapshotFiles(target) : { files: {} };
    const same = Object.keys(built.files).length === Object.keys(files).length && Object.entries(built.files).every(([p, t]) => files[p] && Buffer.compare(Buffer.from(t), files[p]) === 0);
    if (!same) throw new SnapshotRefusal([`${built.id} is released and immutable; this build differs from it. A correction is a new snapshot id (docs/governance/snapshot-policy.md)`]);
    return { written: false, removedDrafts: [] };
  }
  const removedDrafts = [];
  for (const id of findSnapshotDirs(root)) {
    if (!released.has(id) && id !== built.id) {
      rmSync(path.join(root, SNAPSHOT_DIR, id), { recursive: true, force: true });
      removedDrafts.push(id);
    }
  }
  rmSync(target, { recursive: true, force: true });
  for (const [p, t] of Object.entries(built.files)) {
    const abs = path.join(target, p);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, t);
  }
  return { written: true, removedDrafts };
}
