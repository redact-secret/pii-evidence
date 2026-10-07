// Deterministic fixture projector. Pure functions plus a thin loader.
// Contract (docs/methodology/fixture-projection.md): same inputs and same PROJECTOR_VERSION give
// byte-identical output. No timestamps, no randomness, no locale or filesystem-order dependence,
// LF line endings, UTF-8 byte spans computed from the final bytes. The projector copies the
// authored expectation (or applies the fixed outcome a rule documents) and invents nothing.
import path from "node:path";
import { REPO_ROOT, loadTree, validateRecords } from "./validator.mjs";
import { PERSON_CONTENT_KEYS, sha256Hex } from "./fixture-checks.mjs";

export const PROJECTOR_NAME = "pii-evidence-fixture-projector";
export const PROJECTOR_VERSION = "1.0.0";
export const GENERATOR = { name: PROJECTOR_NAME, version: PROJECTOR_VERSION };
export const MATERIALIZED_DIR = "fixtures/materialized";
export const OUTPUT_FILES = { fixtures: "fixtures.jsonl", skipped: "skipped.jsonl", manifest: "manifest.json" };
export const MANIFEST_ID = "fixture-materialization";

export class ProjectionRefusal extends Error {
  constructor(errors) {
    super(errors.join("\n"));
    this.errors = errors;
  }
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---------- canonical serialization ----------

export function canonicalJson(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

const digestOf = (records) => {
  const lines = records.map((r) => ({ id: r.id, line: canonicalJson(r) })).sort((a, b) => cmp(a.id, b.id)).map((x) => x.line);
  return { count: lines.length, sha256: sha256Hex(Buffer.from(lines.join("\n"), "utf8")) };
};

// ---------- guards ----------

/** Refuse protected or mixed populations. Records and the request may each declare one. */
export function populationErrors(records, requested = "public") {
  const errs = [];
  const seen = new Map(); // population -> first location
  if (requested !== undefined) seen.set(requested, "--population");
  for (const r of records) {
    const p = r.data?.population;
    if (p !== undefined && !seen.has(p)) seen.set(p, `${r.file}${r.line ? `:${r.line}` : ""}`);
  }
  for (const [p, where] of seen) {
    if (p === "protected") errs.push(`refused: protected population at ${where}; this repository and projector are public-only (protected evidence never enters pii-evidence)`);
    else if (p !== "public") errs.push(`refused: unknown population ${JSON.stringify(p)} at ${where}; only "public" is accepted`);
  }
  if (seen.size > 1) errs.push(`refused: mixed populations (${[...seen.keys()].map((k) => JSON.stringify(k)).join(", ")}); populations are never merged by the projector`);
  return errs;
}

/** Refuse PERSON content carried inline: PERSON evidence is only referenced, never copied. */
export function inlinePersonContentErrors(records) {
  const errs = [];
  const banned = new Set(PERSON_CONTENT_KEYS);
  for (const r of records) {
    const d = r.data;
    if (d?.kind !== "case" || !Array.isArray(d.externalRefs)) continue;
    const where = `${r.file}${r.line ? `:${r.line}` : ""}`;
    d.externalRefs.forEach((ref, i) => {
      for (const k of Object.keys(ref ?? {})) {
        if (banned.has(k)) errs.push(`${where}: externalRefs[${i}] carries inline content field "${k}"; reference repository, snapshot and entity only`);
      }
    });
    for (const k of ["person", "persons", "personName", "personText", "mention", "mentions", "entities"]) {
      if (Object.hasOwn(d, k)) errs.push(`${where}: case carries inline PERSON content field "${k}"; use externalRefs`);
    }
  }
  return errs;
}

// ---------- carrier templates (closed set) ----------

const quoted = (s) => s.replace(/[\\"]/g, "\\$&").replace(/\n/g, "\\n");
const QUERY_SAFE = /[A-Za-z0-9\-._~:@,;/()!*'$[\]]/;
const percent = (s) => {
  let out = "";
  for (const ch of s) {
    if (QUERY_SAFE.test(ch)) out += ch;
    else for (const b of Buffer.from(ch, "utf8")) out += `%${b.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
};

const TEMPLATES = {
  line: () => ({ head: "", tail: "\n", esc: (s) => s }),
  "json-object": (t) => ({ head: `{"${t.field}":"`, tail: '"}\n', esc: (s) => JSON.stringify(s).slice(1, -1) }),
  "logfmt-line": (t) => ({ head: `level=info ${t.field}="`, tail: '"\n', esc: quoted }),
  "query-string": (t) => ({ head: `${t.field}=`, tail: "\n", esc: percent }),
  "header-line": (t) => ({ head: `${t.field}: `, tail: "\n", esc: (s) => s, controlFree: true }),
  "ini-entry": (t) => ({ head: `[record]\n${t.field} = "`, tail: '"\n', esc: quoted }),
  "prefixed-line": (t) => ({ head: t.prefix, tail: "\n", esc: (s) => s }),
};

// ---------- one-property transforms (explicit parameters) ----------

function applyTransform(tr, value) {
  switch (tr.kind) {
    case "separator-swap":
      return value.split(tr.from).join(tr.to);
    case "case-change":
      return tr.mode === "upper" ? value.replace(/[a-z]/g, (c) => c.toUpperCase()) : value.replace(/[A-Z]/g, (c) => c.toLowerCase());
    case "zero-width-insertion": {
      const chars = Array.from(value);
      if (chars.length <= tr.afterChars) return value;
      const cp = String.fromCodePoint(parseInt(tr.codepoint.slice(2), 16));
      return chars.slice(0, tr.afterChars).join("") + cp + chars.slice(tr.afterChars).join("");
    }
    default:
      throw new ProjectionRefusal([`unknown transform kind ${JSON.stringify(tr.kind)}`]);
  }
}

// ---------- projection ----------

export function inScope(rule, c) {
  const a = rule.appliesTo;
  if (!a.roles.includes(c.role)) return false;
  if (a.kinds && !a.kinds.includes(c.privacyKind)) return false;
  if (a.identities && !a.identities.includes(c.expectation.identity)) return false;
  if (a.contexts === "none" && c.contexts.length > 0) return false;
  return true;
}

const skip = (c, rule, reason, detail) => ({
  kind: "fixture-skip", schemaVersion: "1", id: `${c.id}/${rule.id}`, case: c.id, rule: rule.id, reason, detail, generator: GENERATOR, population: "public",
});

/** Project one Case through one Rule: {fixture} or {skip}. Caller has checked inScope. */
export function projectOne(c, rule) {
  if (c.review.state === "rejected") return { skip: skip(c, rule, "case-rejected", "The authored case is rejected; rejected cases are not projected.") };
  if (!c.input) return { skip: skip(c, rule, "no-input", "The authored case has no input text (structural-only case), so there are no bytes to project.") };
  const span = c.expectation.span;
  if (rule.appliesTo.requiresSpan && !span) return { skip: skip(c, rule, "no-span", "The rule needs the authored value span to delimit the value; the case has none.") };
  const text = c.input.text;
  if (text.includes("\r")) return { skip: skip(c, rule, "carrier-unrepresentable", "The authored text contains a carriage return; fixtures are LF-only.") };

  const buf = Buffer.from(text, "utf8");
  let pre = text;
  let value = "";
  let post = "";
  if (span) {
    pre = buf.subarray(0, span.start).toString("utf8");
    value = buf.subarray(span.start, span.end).toString("utf8");
    post = buf.subarray(span.end).toString("utf8");
  }
  const tpl = TEMPLATES[rule.template.type](rule.template);
  if (tpl.controlFree && /[\u0000-\u001f\u007f]/.test(text)) return { skip: skip(c, rule, "carrier-unrepresentable", "The authored text contains control characters that this carrier cannot hold.") };

  let outValue = value;
  if (rule.transform) {
    outValue = applyTransform(rule.transform, value);
    if (outValue === value) return { skip: skip(c, rule, "transform-no-effect", "The transform leaves the authored value unchanged, so there is nothing to perturb.") };
  }
  const escPre = tpl.esc(pre);
  const escValue = tpl.esc(outValue);
  const escPost = tpl.esc(post);
  if (span && !rule.transform && rule.mustNotChange.includes("valueBytes") && escValue !== value) {
    return { skip: skip(c, rule, "carrier-would-alter-value", "Carrier escaping would change the authored value bytes; the value is never rewritten, so the case is skipped.") };
  }
  const content = tpl.head + escPre + escValue + escPost + tpl.tail;
  const bytes = Buffer.from(content, "utf8");
  const derived = rule.expectation.mode === "derived";
  const spans = [];
  if (span && !derived) {
    const start = Buffer.byteLength(tpl.head + escPre, "utf8");
    spans.push({ start, end: start + Buffer.byteLength(escValue, "utf8") });
  }
  const fixture = {
    kind: "fixture-projection",
    schemaVersion: "1",
    id: `${c.id}/${rule.id}`,
    case: c.id,
    rule: rule.id,
    ruleVersion: rule.ruleVersion,
    carrier: { layout: rule.carrier.layout, variant: rule.carrier.variant },
    generator: GENERATOR,
    population: "public",
    sha256: sha256Hex(bytes),
    byteLength: bytes.length,
    content,
    spans,
    expectation: {
      identity: derived ? rule.expectation.identity : c.expectation.identity,
      sensitivity: derived ? rule.expectation.sensitivity : c.expectation.sensitivity,
      domains: [...c.expectation.domains],
      derivedFromRule: derived,
    },
    lineage: { evidenceClass: c.provenance.evidenceClass, sources: [...c.provenance.sources], claims: [...c.provenance.claims] },
  };
  if (c.externalRefs) fixture.externalRefs = c.externalRefs.map((r) => ({ repository: r.repository, snapshot: r.snapshot, entity: r.entity }));
  return { fixture };
}

/** Project every in-scope (case, rule) pair. Input order does not matter. */
export function projectAll(cases, rules) {
  const orderedRules = [...rules].sort((a, b) => a.ordering - b.ordering || cmp(a.id, b.id));
  const orderedCases = [...cases].sort((a, b) => cmp(a.id, b.id));
  const fixtures = [];
  const skipped = [];
  for (const c of orderedCases) {
    for (const rule of orderedRules) {
      if (!inScope(rule, c)) continue;
      const r = projectOne(c, rule);
      if (r.fixture) fixtures.push(r.fixture);
      else skipped.push(r.skip);
    }
  }
  return { fixtures, skipped };
}

const jsonl = (records) => records.map((r) => `${JSON.stringify(r)}\n`).join("");

/** Serialize a projection to the exact bytes written to disk. */
export function serialize({ cases, rules, fixtures, skipped }) {
  const files = {
    [OUTPUT_FILES.fixtures]: jsonl(fixtures),
    [OUTPUT_FILES.skipped]: jsonl(skipped),
  };
  const fileDigest = (name, records) => ({
    path: `${MATERIALIZED_DIR}/${name}`,
    records: records.length,
    bytes: Buffer.byteLength(files[name], "utf8"),
    sha256: sha256Hex(Buffer.from(files[name], "utf8")),
  });
  const manifest = {
    kind: "materialization-manifest",
    schemaVersion: "1",
    id: MANIFEST_ID,
    population: "public",
    generator: GENERATOR,
    determinism: { randomness: "none", timestamps: "none", lineEndings: "LF", ordering: "case id, rule ordering, rule id; code point order" },
    inputs: { cases: digestOf(cases), rules: digestOf(rules) },
    outputs: { fixtures: fileDigest(OUTPUT_FILES.fixtures, fixtures), skipped: fileDigest(OUTPUT_FILES.skipped, skipped) },
    counts: { cases: cases.length, rules: rules.length, fixtures: fixtures.length, skipped: skipped.length },
  };
  files[OUTPUT_FILES.manifest] = `${JSON.stringify(manifest, null, 2)}\n`;
  return { files, manifest };
}

// ---------- loading and the full run ----------

/** Canonical inputs: the tree minus generated output under fixtures/materialized/. */
export function loadInputs(root = REPO_ROOT) {
  const { records, errors } = loadTree(root);
  const kept = records.filter((r) => r.corpus === "tree" && !r.file.startsWith(`${MATERIALIZED_DIR}/`) && !r.file.startsWith("snapshots/"));
  return { records: kept, errors };
}

/**
 * Load, guard, validate, project, re-validate. Throws ProjectionRefusal listing every problem.
 * `records` may be supplied (tests); `population` is what the caller asserts.
 */
export function materialize({ root = REPO_ROOT, population = "public", records } = {}) {
  let inputs = records;
  const errors = [];
  if (!inputs) {
    const loaded = loadInputs(root);
    inputs = loaded.records;
    errors.push(...loaded.errors);
  }
  errors.push(...populationErrors(inputs, population), ...inlinePersonContentErrors(inputs));
  if (errors.length) throw new ProjectionRefusal(errors);
  const validation = validateRecords(inputs);
  if (validation.errors.length) throw new ProjectionRefusal(validation.errors.map((e) => `input invalid: ${e}`));

  const cases = inputs.filter((r) => r.data.kind === "case").map((r) => r.data);
  const rules = inputs.filter((r) => r.data.kind === "fixture-rule").map((r) => r.data);
  const { fixtures, skipped } = projectAll(cases, rules);
  const { files, manifest } = serialize({ cases, rules, fixtures, skipped });

  // The output must itself validate against the same lineage and expectation checks.
  const wrap = (name, list) => list.map((data, i) => ({ file: `${MATERIALIZED_DIR}/${name}`, line: i + 1, corpus: "tree", data }));
  const out = [
    ...wrap(OUTPUT_FILES.fixtures, fixtures),
    ...wrap(OUTPUT_FILES.skipped, skipped),
    { file: `${MATERIALIZED_DIR}/${OUTPUT_FILES.manifest}`, corpus: "tree", data: manifest },
  ];
  const outErrors = validateRecords([...inputs, ...out]).errors;
  if (outErrors.length) throw new ProjectionRefusal(outErrors.map((e) => `output invalid: ${e}`));
  return { cases, rules, fixtures, skipped, files, manifest };
}

/** Run the projection twice, the second time over reversed input order; both must be byte-identical. */
export function materializeTwice(opts = {}) {
  const first = materialize(opts);
  let records = opts.records;
  if (!records) records = loadInputs(opts.root ?? REPO_ROOT).records;
  const second = materialize({ ...opts, records: [...records].reverse() });
  const diffs = Object.keys(first.files).filter((n) => first.files[n] !== second.files[n]);
  return { first, second, diffs };
}

export const defaultOutDir = (root) => path.join(root, MATERIALIZED_DIR);
