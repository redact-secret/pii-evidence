import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { REPO_ROOT, fixtureId, validateRecords, validateTree } from "../scripts/lib/validator.mjs";
import { citedEvidenceRecords, clone, exampleFiles, readExample, taxonomyRecords, validCorpus, wrap } from "./helpers.mjs";

const errorsOf = (extra, base = validCorpus()) => validateRecords([...base, ...extra]).errors;
const has = (errors, text) => errors.some((e) => e.includes(text));

test("the repository tree validates", () => {
  const { errors } = validateTree(REPO_ROOT);
  assert.deepEqual(errors, []);
});

test("taxonomy files validate on their own", () => {
  assert.deepEqual(validateRecords([...taxonomyRecords(), ...citedEvidenceRecords()]).errors, []);
});

test("valid examples validate together with the taxonomy (positive)", () => {
  assert.deepEqual(validateRecords(validCorpus()).errors, []);
  assert.ok(exampleFiles("valid").length >= 9);
});

// invalid example file -> text the error must contain
const INVALID = {
  "case-scanner-field.json": 'unknown property "supportState"',
  "case-detector-field.json": 'unknown property "detector"',
  "case-unknown-schema-version.json": "unsupported or missing schemaVersion",
  "case-missing-schema-version.json": "unsupported or missing schemaVersion",
  "unknown-kind.json": "unknown or missing kind",
  "case-bad-identity-state.json": "/expectation/identity",
  "case-forbidden-id-issue.json": "identity rule issue-or-pr-number",
  "case-forbidden-id-scanner.json": "identity rule scanner-or-detector-name",
  "case-positive-missing-span.json": 'must have required property \'span\'',
  "case-span-out-of-range.json": "exceeds the",
  "case-reviewed-without-events.json": "/review/events",
  "case-ambiguous-without-reasons.json": "reasons",
  "case-source-backed-without-source.json": "/provenance/sources",
  "case-uppercase-id.json": "/id must match pattern",
  "fixture-protected-population.json": "/population",
  "fixture-sha-mismatch.json": "sha256 does not match content",
};

test("every invalid example fails with the expected error (negative)", () => {
  assert.deepEqual(Object.keys(INVALID).sort(), exampleFiles("invalid"), "table and files must match");
  for (const [name, text] of Object.entries(INVALID)) {
    const errors = errorsOf([wrap(readExample("invalid", name), `invalid/${name}`)]);
    assert.ok(has(errors, text), `${name}: expected "${text}" in\n${errors.join("\n")}`);
    assert.ok(errors.every((e) => e.includes(name) || !e.includes("invalid/")), name);
  }
});

test("unknown schema versions and kinds fail closed", () => {
  const c = readExample("valid", "case-positive.json");
  for (const v of ["2", "0", "1.0", 1, null, ["1"]]) {
    const x = clone(c);
    x.id = "email/global/basic/positive/version-probe";
    x.schemaVersion = v;
    const errors = errorsOf([wrap(x)]);
    assert.ok(has(errors, "failing closed"), `schemaVersion ${JSON.stringify(v)}`);
  }
  const k = clone(c);
  k.kind = "case-v2";
  assert.ok(has(errorsOf([wrap(k)]), "failing closed"));
  const proto = clone(c);
  proto.kind = "__proto__";
  assert.ok(has(errorsOf([wrap(proto)]), "failing closed"));
  assert.ok(has(errorsOf([wrap([1, 2])]), "must be a JSON object"));
});

test("duplicate ids are rejected, naming both locations", () => {
  const c = readExample("valid", "case-twin.json");
  const errors = errorsOf([wrap(c, "evidence/cases/dup.json")]);
  assert.ok(has(errors, `duplicate id "${c.id}"`));
  assert.ok(has(errors, "valid/case-twin.json"));
  // taxonomy ids too
  const dupKind = clone(taxonomyRecords().find((r) => r.data.kind === "jurisdictions").data);
  assert.ok(has(errorsOf([wrap(dupKind, "taxonomy/extra.json")]), 'duplicate id "global"'));
});

test("duplicate ids across a snapshot and the working tree are allowed, within a snapshot are not", () => {
  const c = readExample("valid", "case-twin.json");
  const inSnap = (n) => {
    const x = clone(c);
    x.relationships = [];
    return wrap(x, `snapshots/s/cases${n}.jsonl`, "snapshot:s");
  };
  assert.deepEqual(errorsOf([inSnap(1)]), []);
  assert.ok(has(errorsOf([inSnap(1), inSnap(2)]), "duplicate id"));
});

test("dangling references are rejected with a path", () => {
  const c = readExample("valid", "case-positive.json");
  const cases = [
    ["privacyKind", (x) => (x.privacyKind = "email/global/missing"), "/privacyKind"],
    ["jurisdiction", (x) => (x.jurisdiction = "nowhere"), "/jurisdiction"],
    ["context", (x) => (x.contexts = ["medical/global/missing"]), "/contexts/0"],
    ["source", (x) => (x.provenance.sources = ["no-such/source"]), "/provenance/sources/0"],
    ["claim", (x) => (x.provenance.claims = ["no-such/claim"]), "/provenance/claims/0"],
    ["relationship", (x) => (x.relationships = [{ type: "twin", case: "no-such/case" }]), "/relationships/0/case"],
    ["review", (x) => (x.review = { state: "in-review", events: ["no-such/event"] }), "/review/events/0"],
  ];
  for (const [name, mutate, pointer] of cases) {
    const x = clone(c);
    x.id = "email/global/basic/positive/dangling-probe";
    mutate(x);
    const errors = errorsOf([wrap(x, "evidence/cases/probe.json")]);
    assert.ok(errors.some((e) => e.includes("dangling") && e.includes("evidence/cases/probe.json") && e.includes(pointer)), `${name}\n${errors.join("\n")}`);
  }
  const claim = clone(readExample("valid", "claim.json"));
  claim.id = "dangling/claim-probe";
  claim.source = "no-such/source";
  assert.ok(has(errorsOf([wrap(claim)]), "dangling source reference"));
  const fx = clone(readExample("valid", "fixture-projection.json"));
  fx.case = "no-such/case";
  fx.id = fixtureId(fx.case, fx.rule);
  assert.ok(has(errorsOf([wrap(fx)]), "dangling case reference"));
  // wrong target type
  const wrongType = clone(c);
  wrongType.id = "email/global/basic/positive/wrong-type-probe";
  wrongType.privacyKind = "global";
  assert.ok(has(errorsOf([wrap(wrongType)]), "is a jurisdiction, expected privacy-kind"));
});

test("taxonomy-internal references are checked", () => {
  const kinds = clone(taxonomyRecords().find((r) => r.data.kind === "privacy-kinds").data);
  kinds.kinds[0].jurisdictions = ["nowhere"];
  kinds.kinds[0].contextClaims[0].context = "medical/global/missing";
  const rest = validCorpus().filter((r) => r.data.kind !== "privacy-kinds");
  const errors = validateRecords([...rest, wrap(kinds, "taxonomy/privacy-kinds.json")]).errors;
  assert.ok(has(errors, "/kinds/0/jurisdictions/0"));
  assert.ok(has(errors, "/kinds/0/contextClaims/0/context"));
});

test("fixture ids are stable semantic ids, unaffected by regeneration", () => {
  const fx = readExample("valid", "fixture-projection.json");
  assert.equal(fx.id, fixtureId(fx.case, fx.rule));
  // regenerate: new generator version, new bytes, new digest; same id
  const content = "contact: user@example.com\r\n";
  const regen = clone(fx);
  regen.generator.version = "9.9.9";
  regen.content = content;
  regen.byteLength = Buffer.byteLength(content);
  regen.sha256 = createHash("sha256").update(content).digest("hex");
  assert.equal(fixtureId(regen.case, regen.rule), fx.id);
  const base = validCorpus().filter((r) => r.data.kind !== "fixture-projection");
  assert.deepEqual(validateRecords([...base, wrap(regen)]).errors, []);
  // an id that drifts from <case>/<rule> is rejected
  const drift = clone(fx);
  drift.id = `${fx.id}-regenerated`;
  assert.ok(has(validateRecords([...base, wrap(drift)]).errors, 'must equal "<case>/<rule>"'));
});

test("spans are UTF-8 byte offsets on character boundaries", () => {
  const c = clone(readExample("valid", "case-positive.json"));
  c.id = "email/global/basic/positive/multibyte-probe";
  c.relationships = [];
  c.input.text = "café: user@example.com"; // e-acute is 2 bytes
  const start = Buffer.byteLength("café: ");
  c.expectation.span = { start, end: start + Buffer.byteLength("user@example.com") };
  assert.deepEqual(errorsOf([wrap(c)]), []);
  // character offsets (a common bug) are off by one byte
  c.expectation.span = { start: start - 1, end: start - 1 + 16 };
  c.input.text = "café user@example.com";
  const bad = clone(c);
  bad.expectation.span = { start: 4, end: 5 }; // inside the 2-byte e-acute
  assert.ok(has(errorsOf([wrap(bad)]), "UTF-8 character boundaries"));
  const inverted = clone(c);
  inverted.expectation.span = { start: 8, end: 5 };
  assert.ok(has(errorsOf([wrap(inverted)]), "must be greater than start"));
});

test("a case cannot relate to itself", () => {
  const c = clone(readExample("valid", "case-twin.json"));
  c.id = "email/global/basic/twin/self-probe";
  c.relationships = [{ type: "twin", case: c.id }];
  assert.ok(has(errorsOf([wrap(c)]), "relates to itself"));
});

test("no qualification-policy or scanner fields are accepted anywhere", () => {
  const forbidden = { supportState: "stable", threshold: 0.9, scannerId: "x", detectorId: "x", expectedCurrentBehavior: "detected", releaseBlocker: true, score: 1 };
  const targets = [
    ["case-positive.json", (x) => x, (x) => x],
    ["case-positive.json", (x) => x.expectation, (x) => x],
    ["source.json", (x) => x, (x) => x],
    ["claim.json", (x) => x, (x) => x],
    ["fixture-projection.json", (x) => x, (x) => x],
    ["snapshot-manifest.json", (x) => x, (x) => x],
    ["snapshot-manifest.json", (x) => x.coverage, (x) => x],
    ["review-event.json", (x) => x, (x) => x],
  ];
  for (const [file, pick] of targets) {
    for (const [field, value] of Object.entries(forbidden)) {
      const x = clone(readExample("valid", file));
      pick(x)[field] = value;
      const base = validCorpus().filter((r) => r.data.id !== x.id);
      const errors = validateRecords([...base, wrap(x)]).errors;
      assert.ok(has(errors, `unknown property "${field}"`), `${file} accepted ${field}`);
    }
  }
  // and the schemas themselves declare no such property names
  const dir = path.join(REPO_ROOT, "schemas", "v1");
  const propertyNames = (node, out = new Set()) => {
    if (Array.isArray(node)) node.forEach((n) => propertyNames(n, out));
    else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (k === "properties" && v && typeof v === "object") Object.keys(v).forEach((p) => out.add(p));
        propertyNames(v, out);
      }
    }
    return out;
  };
  const banned = /scanner|detector|support|threshold|blocker|score|benchmark|qualif/i;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".schema.json"))) {
    const names = propertyNames(JSON.parse(readFileSync(path.join(dir, f), "utf8")));
    for (const n of names) assert.ok(!banned.test(n), `${f} declares property ${n}`);
  }
});

test("a missing or empty set of evidence directories succeeds", () => {
  const root = mkdtempSync(path.join(tmpdir(), "pii-evidence-"));
  try {
    assert.deepEqual(validateTree(root).errors, []);
    mkdirSync(path.join(root, "evidence", "cases"), { recursive: true });
    mkdirSync(path.join(root, "snapshots"));
    assert.deepEqual(validateTree(root).errors, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("JSONL records are discovered, line numbers are reported, and bad lines fail", () => {
  const root = mkdtempSync(path.join(tmpdir(), "pii-evidence-"));
  try {
    cpSync(path.join(REPO_ROOT, "taxonomy"), path.join(root, "taxonomy"), { recursive: true });
    mkdirSync(path.join(root, "evidence", "cases"), { recursive: true });
    const a = clone(readExample("valid", "case-twin.json"));
    a.relationships = [];
    const b = clone(a);
    b.id = "email/global/basic/twin/second-twin";
    b.privacyKind = "email/global/missing";
    const file = path.join(root, "evidence", "cases", "email.jsonl");
    writeFileSync(file, `${JSON.stringify(a)}\n\n${JSON.stringify(b)}\n{not json}\n`);
    const errors = validateTree(root).errors;
    assert.ok(has(errors, "evidence/cases/email.jsonl:3"), errors.join("\n"));
    assert.ok(has(errors, "dangling privacy kind reference"));
    assert.ok(has(errors, "evidence/cases/email.jsonl:4: invalid JSON"));
    assert.ok(!has(errors, "email.jsonl:1"), "line 1 is valid");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("validate script exits non-zero on error and zero on success", async () => {
  const { spawnSync } = await import("node:child_process");
  const script = path.join(REPO_ROOT, "scripts", "validate.mjs");
  const ok = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  const root = mkdtempSync(path.join(tmpdir(), "pii-evidence-"));
  try {
    mkdirSync(path.join(root, "evidence"));
    writeFileSync(path.join(root, "evidence", "x.json"), JSON.stringify({ kind: "case", schemaVersion: "99" }));
    const bad = spawnSync(process.execPath, [script, "--root", root], { encoding: "utf8" });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /evidence\/x\.json: unsupported or missing schemaVersion/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
