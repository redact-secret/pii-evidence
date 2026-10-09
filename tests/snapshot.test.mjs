import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { forbiddenIdViolations } from "../scripts/id-rules.mjs";
import {
  FILES, REGISTRY_FILE, SnapshotRefusal, adjudicationExclusionsOf, buildSnapshot, contentDigestOf, flatId, readRegistry, readSnapshotFiles, registryEntryOf, registryText,
  selectEvidence, snapshotIdOf, tarOf, verifyRepository, verifySnapshotDir, verifySnapshotFiles, writeSnapshot,
} from "../scripts/lib/snapshot.mjs";
import { REPO_ROOT, loadTree } from "../scripts/lib/validator.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const DATE = "2026-10-07";

/** A throwaway source tree: taxonomy, evidence and fixture rules copied from the repository. */
function tempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "pii-evidence-snaptest-"));
  for (const d of ["taxonomy", "evidence"]) cpSync(path.join(REPO_ROOT, d), path.join(root, d), { recursive: true });
  cpSync(path.join(REPO_ROOT, "fixtures", "rules"), path.join(root, "fixtures", "rules"), { recursive: true });
  const ledgerDir = path.join(root, "docs/research");
  mkdirSync(ledgerDir, { recursive: true });
  for (const name of ["case-strengthening", "coverage-expansion"]) {
    const src = path.join(REPO_ROOT, "docs/research", `${name}-adjudication.json`);
    if (existsSync(src)) cpSync(src, path.join(ledgerDir, `${name}-adjudication.json`));
  }
  return root;
}
const cleanup = (root) => rmSync(root, { recursive: true, force: true });
const readLines = (p) => readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const writeLines = (p, recs) => writeFileSync(p, `${recs.map((r) => JSON.stringify(r)).join("\n")}\n`);
const bufs = (files) => Object.fromEntries(Object.entries(files).map(([p, t]) => [p, Buffer.from(t)]));

// Built once from the real tree and reused read-only.
const built = buildSnapshot({ root: REPO_ROOT, date: DATE });

test("rebuilding from the same sources is byte-identical", () => {
  const again = buildSnapshot({ root: REPO_ROOT, date: DATE });
  assert.equal(again.id, built.id);
  assert.deepEqual(Object.keys(again.files).sort(), Object.keys(built.files).sort());
  for (const p of Object.keys(built.files)) assert.equal(again.files[p], built.files[p], p);
});

test("the id is derived from the explicit date and the content digest, never from the clock", () => {
  const m = built.manifest;
  assert.equal(m.snapshotDate, DATE);
  assert.equal(m.id, snapshotIdOf(DATE, m.contentDigest));
  assert.match(m.id, /^public-pii-phi\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{12}$/);
  assert.deepEqual(forbiddenIdViolations(m.id), []);
  assert.equal(buildSnapshot({ root: REPO_ROOT, date: "2026-10-08" }).manifest.contentDigest, m.contentDigest, "the date is not part of the content digest");
  assert.notEqual(buildSnapshot({ root: REPO_ROOT, date: "2026-10-08" }).id, m.id);
  assert.throws(() => buildSnapshot({ root: REPO_ROOT }), SnapshotRefusal);
  assert.throws(() => buildSnapshot({ root: REPO_ROOT, date: "yesterday" }), SnapshotRefusal);
});

test("the content digest changes on any content change", () => {
  const root = tempRoot();
  try {
    const casesFile = path.join(root, "evidence", "cases", "email.jsonl");
    const cases = readLines(casesFile);
    cases[0].rationale = `${cases[0].rationale} Edited.`;
    writeLines(casesFile, cases);
    const changed = buildSnapshot({ root, date: DATE });
    assert.notEqual(changed.manifest.contentDigest, built.manifest.contentDigest);
    assert.notEqual(changed.id, built.id);

    // a source change and a rule change also move the digest
    const srcFile = path.join(root, "evidence", "sources", "email.jsonl");
    const srcs = readLines(srcFile);
    srcs[0].license.terms = `${srcs[0].license.terms} Edited.`;
    writeLines(srcFile, srcs);
    const changed2 = buildSnapshot({ root, date: DATE });
    assert.notEqual(changed2.manifest.contentDigest, changed.manifest.contentDigest);
    assert.notEqual(changed2.manifest.sourceManifestDigest, changed.manifest.sourceManifestDigest);
  } finally {
    cleanup(root);
  }
});

test("key order in authored files does not change the snapshot", () => {
  const root = tempRoot();
  try {
    const f = path.join(root, "evidence", "cases", "email.jsonl");
    writeLines(f, readLines(f).map((r) => Object.fromEntries(Object.entries(r).reverse())));
    assert.equal(buildSnapshot({ root, date: DATE }).manifest.contentDigest, built.manifest.contentDigest);
  } finally {
    cleanup(root);
  }
});

test("exclusion rule: unresolved sources and everything that depends on them are excluded, nothing is edited", () => {
  const { records } = loadTree(REPO_ROOT);
  const sel = selectEvidence(records.filter((r) => r.corpus === "tree" && !r.file.startsWith("snapshots/") && !r.file.startsWith("fixtures/materialized/")));
  const exSources = sel.exclusions.sources.map((s) => s.id);
  assert.deepEqual(exSources, ["iban/swift-registry", "payment-card/stripe-testing", "phone/itu-e164"]);
  const exSet = new Set(exSources);
  const exClaims = new Set(sel.exclusions.claims.map((c) => c.id));
  const exCases = new Set(sel.exclusions.cases.map((c) => c.id));
  for (const c of sel.included.cases) {
    for (const s of c.provenance.sources) assert.ok(!exSet.has(s), `${c.id} cites excluded source ${s}`);
    for (const cl of c.provenance.claims) assert.ok(!exClaims.has(cl), `${c.id} cites excluded claim ${cl}`);
    for (const r of c.relationships) assert.ok(!exCases.has(r.case), `${c.id} relates to excluded case ${r.case}`);
  }
  // propagation through relationships is recorded as such
  const viaRelation = sel.exclusions.cases.filter((c) => c.reasons.every((r) => r.startsWith("relates to excluded case")));
  assert.ok(viaRelation.length > 0);
  // included records are byte-for-byte the authored ones
  const authored = new Map(records.filter((r) => r.data.kind === "case").map((r) => [r.data.id, r.data]));
  for (const c of sel.included.cases) assert.deepEqual(c, authored.get(c.id));
  // the manifest lists every exclusion with reasons and counts them
  const m = built.manifest;
  assert.equal(m.counts.excludedCases, m.exclusions.cases.length);
  assert.ok(m.exclusions.cases.every((c) => c.reasons.length > 0));
  assert.ok(m.exclusions.taxonomyClaimRefsRemoved.length === 3);
  // the taxonomy copy has no reference to an excluded claim
  const kinds = JSON.parse(built.files[FILES.kinds]);
  const claimRefs = kinds.kinds.flatMap((k) => [...k.formatClaims, ...k.contextClaims.flatMap((c) => c.claims ?? [])]);
  for (const c of claimRefs) assert.ok(!exClaims.has(c));
});

test("a source that stops being public-safe removes its claims and cases from the snapshot", () => {
  const root = tempRoot();
  try {
    const f = path.join(root, "evidence", "sources", "us-ssn.jsonl");
    const srcs = readLines(f).map((s) => (s.id === "us-ssn/wikipedia-ssn" ? { ...s, license: { ...s.license, redistribution: "unknown" } } : s));
    writeLines(f, srcs);
    const b = buildSnapshot({ root, date: DATE });
    assert.ok(b.manifest.exclusions.sources.some((s) => s.id === "us-ssn/wikipedia-ssn"));
    assert.ok(b.manifest.counts.cases < built.manifest.counts.cases);
    assert.ok(!parseLines(b.files[FILES.sources]).some((s) => s.id === "us-ssn/wikipedia-ssn"));
  } finally {
    cleanup(root);
  }
});
const parseLines = (t) => t.split("\n").filter(Boolean).map((l) => JSON.parse(l));

test("gates refuse: protected population, an invalid tree, and an unallowlisted PII-shaped value", () => {
  for (const [label, mutate, pattern] of [
    ["protected population", (cs) => { cs[0].population = "protected"; }, /protected population/],
    ["mixed population", (cs) => { cs[1].population = "public"; cs[2].population = "other"; }, /unknown population|mixed/],
    ["scanner field", (cs) => { cs[0].supportState = "stable"; }, /unknown property "supportState"/],
    ["real-looking value", (cs) => { cs[0].input = { text: `contact ${["q.public4721", "mail-host.io"].join("@")} today` }; cs[0].expectation.span = { start: 8, end: 33 }; }, /safe-data gate: .* email/],
  ]) {
    const root = tempRoot();
    try {
      const f = path.join(root, "evidence", "cases", "email.jsonl");
      const cases = readLines(f);
      mutate(cases);
      writeLines(f, cases);
      assert.throws(() => buildSnapshot({ root, date: DATE }), (e) => e instanceof SnapshotRefusal && pattern.test(e.message), label);
    } finally {
      cleanup(root);
    }
  }
});

test("the provenance gate is enforced on the assembled files, not trusted from the manifest", () => {
  const files = bufs(built.files);
  const srcs = parseLines(built.files[FILES.sources]);
  srcs[0].license.redistribution = "unknown";
  files[FILES.sources] = Buffer.from(srcs.map((s) => `${JSON.stringify(s)}\n`).join(""));
  const { errors } = verifySnapshotFiles(files);
  assert.ok(errors.some((e) => /not public-safe|sha256|sourceManifestDigest/.test(e)));
  // even with the file digest and sourceManifestDigest recomputed to match, the provenance re-check still fails
  const m = JSON.parse(files[FILES.manifest]);
  m.files.find((f) => f.path === FILES.sources).sha256 = sha(files[FILES.sources]);
  m.sourceManifestDigest = sha(files[FILES.sources]);
  files[FILES.manifest] = Buffer.from(JSON.stringify(m));
  assert.ok(verifySnapshotFiles(files).errors.some((e) => /not public-safe|contentDigest/.test(e)));
});

test("neutrality: scanner, support-state, threshold and score fields are rejected in snapshot records", () => {
  for (const key of ["supportState", "threshold", "detectorId", "scannerResult", "score"]) {
    const files = bufs(built.files);
    const cases = parseLines(built.files[FILES.cases]);
    cases[0][key] = 1;
    files[FILES.cases] = Buffer.from(cases.map((c) => `${JSON.stringify(c)}\n`).join(""));
    assert.ok(verifySnapshotFiles(files).errors.length > 0, key);
  }
  for (const f of [FILES.cases, FILES.fixtures, FILES.sources, FILES.claims, FILES.rules, FILES.manifest]) {
    assert.doesNotMatch(built.files[f], /"(?:scanner|detector|support|threshold|score|blocker|benchmark|qualif)[A-Za-z]*"\s*:/i, f);
  }
});

test("coverage includes a PHI kind and the contextual PII-to-PHI pair", () => {
  const cov = built.manifest.coverage;
  assert.ok(cov.domains.includes("phi") && cov.domains.includes("pii"));
  assert.ok(cov.kinds.includes("medical-record-number/us/labeled-field"));
  const cases = parseLines(built.files[FILES.cases]);
  const ctx = cases.find((c) => c.id === "email/global/basic/context/patient-labeled-medical-field");
  const twin = cases.find((c) => c.id === "email/global/basic/twin/no-medical-context-same-value");
  assert.ok(ctx && twin, "the email context pair is included");
  assert.ok(ctx.expectation.domains.includes("phi"));
  assert.deepEqual(twin.expectation.domains, ["pii"]);
});

test("standalone: a consumer can load and re-verify the snapshot from its directory alone", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pii-evidence-standalone-"));
  try {
    for (const [p, t] of Object.entries(built.files)) {
      mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
      writeFileSync(path.join(dir, p), t);
    }
    // read only the directory: no taxonomy/, evidence/ or fixtures/ of the repository is touched
    const v = verifySnapshotDir(dir);
    assert.deepEqual(v.errors, []);
    const { files } = readSnapshotFiles(dir);
    const m = JSON.parse(files[FILES.manifest]);
    const rows = (p) => parseLines(files[p].toString("utf8"));
    const cases = rows(FILES.cases);
    const fixtures = rows(FILES.fixtures);
    const sources = new Set(rows(FILES.sources).map((s) => s.id));
    const claims = new Set(rows(FILES.claims).map((c) => c.id));
    const rules = new Set(rows(FILES.rules).map((r) => r.id));
    const kinds = new Set(JSON.parse(files[FILES.kinds]).kinds.map((k) => k.id));
    const caseIds = new Set(cases.map((c) => c.id));
    assert.equal(cases.length, m.counts.cases);
    assert.equal(fixtures.length, m.counts.fixtures);
    for (const c of cases) {
      assert.ok(kinds.has(c.privacyKind));
      c.provenance.sources.forEach((s) => assert.ok(sources.has(s), `${c.id} -> ${s}`));
      c.provenance.claims.forEach((s) => assert.ok(claims.has(s), `${c.id} -> ${s}`));
      c.relationships.forEach((r) => assert.ok(caseIds.has(r.case), `${c.id} -> ${r.case}`));
    }
    for (const f of fixtures) {
      assert.ok(caseIds.has(f.case) && rules.has(f.rule));
      const bytes = Buffer.from(f.content, "utf8");
      assert.equal(bytes.length, f.byteLength);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), f.sha256);
      for (const s of f.spans) assert.ok(s.end > s.start && s.end <= bytes.length);
      assert.equal(f.population, "public");
    }
    // the digests recompute from the files alone
    assert.equal(contentDigestOf(Object.fromEntries(Object.entries(files).filter(([p]) => p !== FILES.manifest))), m.contentDigest);
    // tampering with any byte is detected
    writeFileSync(path.join(dir, FILES.cases), `${built.files[FILES.cases]} `);
    assert.ok(verifySnapshotDir(dir).errors.some((e) => /cases\.jsonl/.test(e)));
    // an unlisted extra file is detected
    writeFileSync(path.join(dir, FILES.cases), built.files[FILES.cases]);
    writeFileSync(path.join(dir, "extra.txt"), "x");
    assert.ok(verifySnapshotDir(dir).errors.some((e) => /extra\.txt/.test(e)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("deterministic tar: independent of insertion order, fixed owner and mtime", () => {
  const a = tarOf(built.id, bufs(built.files));
  const reversed = Object.fromEntries(Object.entries(bufs(built.files)).reverse());
  assert.equal(Buffer.compare(a, tarOf(built.id, reversed)), 0);
  assert.equal(a.length % 512, 0);
  assert.ok(flatId(built.id).startsWith("public-pii-phi-"));
  // header mtime field (offset 136) is all zeros
  assert.equal(a.subarray(136, 147).toString("ascii"), "00000000000");
});

test("immutability: a released snapshot cannot change, be removed, or be rebuilt with different bytes", () => {
  const root = tempRoot();
  try {
    writeSnapshot({ root, built });
    const reg = readRegistry(root);
    reg.snapshots.push(registryEntryOf(built));
    mkdirSync(path.join(root, "snapshots"), { recursive: true });
    writeFileSync(path.join(root, REGISTRY_FILE), registryText(reg));
    assert.deepEqual(verifyRepository({ root, rebuild: false }).errors, []);

    // 1. editing a released file is detected
    const cases = path.join(root, "snapshots", built.id, FILES.cases);
    const original = readFileSync(cases);
    writeFileSync(cases, Buffer.concat([original, Buffer.from("\n")]));
    const e1 = verifyRepository({ root, rebuild: false }).errors;
    assert.ok(e1.some((e) => /cases\.jsonl/.test(e)), e1.join("\n"));
    writeFileSync(cases, original);
    assert.deepEqual(verifyRepository({ root, rebuild: false }).errors, []);

    // 2. rebuilding a released id with different bytes is refused (and nothing is written)
    const altered = { ...built, files: { ...built.files, [FILES.cases]: `${built.files[FILES.cases]}\n` } };
    assert.throws(() => writeSnapshot({ root, built: altered }), (e) => e instanceof SnapshotRefusal && /released and immutable/.test(e.message));
    assert.deepEqual(readFileSync(cases), original);
    assert.equal(writeSnapshot({ root, built }).written, false, "an identical rebuild of a released id is a no-op");

    // 3. rewriting the registry digests to match edited files is caught against the base ref
    const git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: root, stdio: "pipe" });
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    assert.deepEqual(verifyRepository({ root, rebuild: false, base: "HEAD" }).errors, []);
    const regNow = readRegistry(root);
    regNow.snapshots[0].manifestSha256 = "0".repeat(64);
    writeFileSync(path.join(root, REGISTRY_FILE), registryText(regNow));
    assert.ok(verifyRepository({ root, rebuild: false, base: "HEAD" }).errors.some((e) => /modified|differs/.test(e)));
    writeFileSync(path.join(root, REGISTRY_FILE), registryText({ ...regNow, snapshots: [] }));
    assert.ok(verifyRepository({ root, rebuild: false, base: "HEAD" }).errors.some((e) => /removed from the registry/.test(e)));
  } finally {
    cleanup(root);
  }
});

test("an unreleased draft must equal a fresh rebuild; a stale draft fails", () => {
  const root = tempRoot();
  try {
    writeSnapshot({ root, built });
    assert.deepEqual(verifyRepository({ root }).errors, []);
    const f = path.join(root, "evidence", "cases", "email.jsonl");
    const cases = readLines(f);
    cases[0].rationale = `${cases[0].rationale} Edited.`;
    writeLines(f, cases);
    assert.ok(verifyRepository({ root }).errors.some((e) => /stale|differs from a fresh rebuild/.test(e)));
    // building again replaces the draft
    const next = buildSnapshot({ root, date: DATE });
    const res = writeSnapshot({ root, built: next });
    assert.deepEqual(res.removedDrafts, [built.id]);
    assert.deepEqual(verifyRepository({ root }).errors, []);
    assert.ok(!existsSync(path.join(root, "snapshots", built.id)));
  } finally {
    cleanup(root);
  }
});

test("the committed snapshot in this repository verifies", () => {
  assert.deepEqual(verifyRepository({ root: REPO_ROOT, rebuild: false }).errors, []);
});


test("adjudicated deferred Cases stay in research but not in a snapshot", () => {
  const { records } = loadTree(REPO_ROOT);
  const exclusions = adjudicationExclusionsOf(REPO_ROOT, records);
  assert.equal(exclusions.size, 3);
  const included = new Set(readLines(path.join(REPO_ROOT, "evidence/cases/serialization-cases.jsonl")).map((c) => c.id));
  for (const id of exclusions.keys()) {
    assert.ok(included.has(id), "research remains inspectable");
    assert.ok(built.manifest.exclusions.cases.some((c) => c.id === id && c.reasons.some((r) => r.startsWith("adjudication: defer"))));
    assert.ok(!JSON.parse(`[${built.files[FILES.cases].trim().split("\n").join(",")}]`).some((c) => c.id === id));
  }
});

test("unknown or duplicate adjudication dispositions fail closed", () => {
  const root = tempRoot();
  try {
    const p = path.join(root, "docs/research/case-strengthening-adjudication.json");
    const ledger = JSON.parse(readFileSync(p, "utf8"));
    ledger.candidates[0].disposition = "maybe";
    writeFileSync(p, JSON.stringify(ledger));
    assert.throws(() => buildSnapshot({ root, date: DATE }), SnapshotRefusal);
    ledger.candidates[0].disposition = "add";
    ledger.candidates.push(ledger.candidates[0]);
    writeFileSync(p, JSON.stringify(ledger));
    assert.throws(() => buildSnapshot({ root, date: DATE }), SnapshotRefusal);
    ledger.candidates.pop();
    const deferred = ledger.candidates.find(c => c.disposition === "defer" && c.implementation?.cases?.length);
    delete deferred.implementation.cases;
    writeFileSync(p, JSON.stringify(ledger));
    assert.ok(adjudicationExclusionsOf(root, loadTree(root).records).has(deferred.id));
    ledger.candidates.push(null);
    writeFileSync(p, JSON.stringify(ledger));
    assert.throws(() => buildSnapshot({ root, date: DATE }), SnapshotRefusal);
    ledger.candidates.pop();
    ledger.candidates[0].canonicalCaseDisposition = "unknown";
    writeFileSync(p, JSON.stringify(ledger));
    assert.throws(() => buildSnapshot({ root, date: DATE }), SnapshotRefusal);
  } finally { cleanup(root); }
});

test("promotion manifest binds earlier release and dispositions without changing on registration", () => {
  const root = tempRoot();
  try {
    const registry = readRegistry(REPO_ROOT);
    // This test authors a fresh snapshot; only its baseline is released in the sandbox.
    registry.snapshots = [registry.snapshots[0]];
    const baseline = registry.snapshots[0];
    cpSync(path.join(REPO_ROOT, "snapshots", baseline.id), path.join(root, "snapshots", baseline.id), { recursive: true });
    writeFileSync(path.join(root, REGISTRY_FILE), registryText(registry));
    const next = buildSnapshot({ root, date: "2026-10-08" });
    const delta = next.manifest.coverageDelta;
    assert.equal(delta.baseline.manifestSha256, baseline.manifestSha256);
    assert.equal(delta.counts.cases.previous, 49);
    assert.equal(delta.counts.cases.candidate, next.manifest.counts.cases);
    assert.equal(delta.counts.cases.delta, next.manifest.counts.cases - 49);
    assert.equal(delta.ledgers.length, 2);
    assert.ok(delta.decisions.some(row => row.disposition === "defer"));
    assert.ok(delta.kinds.added.includes("uk-nino/uk/structured"));
    writeSnapshot({ root, built: next });
    registry.snapshots.push(registryEntryOf(next));
    writeFileSync(path.join(root, REGISTRY_FILE), registryText(registry));
    assert.deepEqual(buildSnapshot({ root, date: "2026-10-08" }).files, next.files);
    const oldCases = path.join(root, "snapshots", baseline.id, FILES.cases);
    writeFileSync(oldCases, `${readFileSync(oldCases, "utf8")}\n`);
    assert.throws(() => buildSnapshot({ root, date: "2026-10-08" }), error => error instanceof SnapshotRefusal && /baseline file/.test(error.message));
  } finally { cleanup(root); }
});
