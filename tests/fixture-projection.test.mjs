import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { REPO_ROOT, validateRecords } from "../scripts/lib/validator.mjs";
import {
  GENERATOR, PROJECTOR_NAME, PROJECTOR_VERSION, ProjectionRefusal, inScope, loadInputs, materialize, materializeTwice, populationErrors, projectOne,
} from "../scripts/lib/projector.mjs";
import { clone, wrap } from "./helpers.mjs";

const SCRIPT = path.join(REPO_ROOT, "scripts", "materialize-fixtures.mjs");
const inputs = loadInputs(REPO_ROOT).records;
const byKind = (k) => inputs.filter((r) => r.data.kind === k).map((r) => r.data);
const cases = byKind("case");
const rules = byKind("fixture-rule");
const caseById = new Map(cases.map((c) => [c.id, c]));
const ruleById = new Map(rules.map((r) => [r.id, r]));
const result = materialize({ records: inputs });
const has = (list, text) => list.some((e) => e.includes(text));

const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

function tempRepo() {
  const root = mkdtempSync(path.join(tmpdir(), "pii-evidence-fx-"));
  cpSync(path.join(REPO_ROOT, "taxonomy"), path.join(root, "taxonomy"), { recursive: true });
  cpSync(path.join(REPO_ROOT, "evidence"), path.join(root, "evidence"), { recursive: true });
  mkdirSync(path.join(root, "fixtures"));
  cpSync(path.join(REPO_ROOT, "fixtures", "rules"), path.join(root, "fixtures", "rules"), { recursive: true });
  return root;
}
const editJsonl = (file, fn) => {
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  fn(lines);
  writeFileSync(file, lines.map((l) => `${JSON.stringify(l)}\n`).join(""));
};

test("generator identity and version are recorded on every fixture, skip and the manifest", () => {
  assert.equal(PROJECTOR_NAME, "pii-evidence-fixture-projector");
  assert.match(PROJECTOR_VERSION, /^\d+\.\d+\.\d+$/);
  for (const f of [...result.fixtures, ...result.skipped, result.manifest]) assert.deepEqual(f.generator, GENERATOR);
});

test("two runs, including one over reversed input order, are byte-identical", () => {
  const { first, second, diffs } = materializeTwice({ records: inputs });
  assert.deepEqual(diffs, []);
  for (const name of Object.keys(first.files)) assert.equal(first.files[name], second.files[name], name);
});

test("two CLI materializations into separate directories are byte-identical, LF only, with no timestamps", () => {
  const a = mkdtempSync(path.join(tmpdir(), "pii-evidence-out-"));
  const b = mkdtempSync(path.join(tmpdir(), "pii-evidence-out-"));
  try {
    assert.equal(run(["--out", a]).status, 0);
    assert.equal(run(["--out", b]).status, 0);
    for (const name of readdirSync(a)) {
      const x = readFileSync(path.join(a, name));
      assert.ok(x.equals(readFileSync(path.join(b, name))), name);
      assert.ok(!x.includes(13), `${name} contains CR`);
      assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:/.test(x.toString("utf8")), `${name} contains a timestamp`);
    }
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});

test("fixtures are sorted by case id, rule ordering, rule id; the manifest digests match the files", () => {
  const key = (f) => [f.case, String(ruleById.get(f.rule).ordering).padStart(8, "0"), f.rule].join("\u0000");
  const keys = result.fixtures.map(key);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(result.manifest.outputs.fixtures.sha256, createHash("sha256").update(result.files["fixtures.jsonl"]).digest("hex"));
  assert.equal(result.manifest.outputs.skipped.sha256, createHash("sha256").update(result.files["skipped.jsonl"]).digest("hex"));
  assert.equal(result.manifest.counts.fixtures, result.fixtures.length);
  assert.equal(result.manifest.counts.skipped, result.skipped.length);
  assert.equal(result.manifest.outputs.fixtures.bytes, Buffer.byteLength(result.files["fixtures.jsonl"]));
});

test("the projection is non-trivial and covers each required carrier layout and transformation", () => {
  const layouts = new Set(result.fixtures.map((f) => f.carrier.layout));
  for (const l of ["plain-text", "json", "logfmt", "form-query", "header-config", "unicode-context"]) assert.ok(layouts.has(l), l);
  const kinds = new Set(rules.map((r) => r.transformation));
  assert.deepEqual([...kinds].sort(), ["carrier", "mutation", "twin"]);
  assert.ok(result.fixtures.length > 200);
});

test("every fixture resolves to an authored case, a rule and source lineage", () => {
  const sources = new Set(inputs.filter((r) => r.data.kind === "source").map((r) => r.data.id));
  const claims = new Set(inputs.filter((r) => r.data.kind === "claim").map((r) => r.data.id));
  for (const f of result.fixtures) {
    const c = caseById.get(f.case);
    assert.ok(c, `${f.id}: no authored case`);
    assert.ok(ruleById.has(f.rule), `${f.id}: no rule`);
    assert.equal(f.id, `${f.case}/${f.rule}`);
    assert.equal(f.ruleVersion, ruleById.get(f.rule).ruleVersion);
    assert.deepEqual(f.lineage.sources, c.provenance.sources);
    assert.deepEqual(f.lineage.claims, c.provenance.claims);
    for (const s of f.lineage.sources) assert.ok(sources.has(s), `${f.id}: unknown source ${s}`);
    for (const s of f.lineage.claims) assert.ok(claims.has(s), `${f.id}: unknown claim ${s}`);
  }
});

test("expectations are copied from the case, or are the fixed outcome a rule documents (never invented)", () => {
  for (const f of result.fixtures) {
    const c = caseById.get(f.case);
    const rule = ruleById.get(f.rule);
    assert.deepEqual(f.expectation.domains, c.expectation.domains, f.id);
    if (rule.expectation.mode === "copy") {
      assert.equal(f.expectation.identity, c.expectation.identity, f.id);
      assert.equal(f.expectation.sensitivity, c.expectation.sensitivity, f.id);
      assert.equal(f.expectation.derivedFromRule, false);
    } else {
      assert.equal(f.expectation.derivedFromRule, true);
      assert.equal(f.expectation.identity, "not-established");
      assert.equal(f.expectation.sensitivity, "context-dependent");
      assert.deepEqual(f.spans, []);
    }
    const flat = JSON.stringify(f);
    assert.ok(!/scanner|detector|support|threshold|score/i.test(Object.keys(f).join(" ") + Object.keys(f.expectation).join(" ")), flat.slice(0, 80));
  }
  const derived = result.fixtures.filter((f) => f.expectation.derivedFromRule);
  assert.ok(derived.length > 0);
  assert.ok(derived.every((f) => ruleById.get(f.rule).transformation !== "carrier"));
});

test("spans are UTF-8 byte offsets computed from the final bytes, including multi-byte carriers", () => {
  let multibyte = 0;
  for (const f of result.fixtures) {
    const c = caseById.get(f.case);
    const bytes = Buffer.from(f.content, "utf8");
    assert.equal(bytes.length, f.byteLength);
    for (const s of f.spans) {
      const want = Buffer.from(c.input.text, "utf8").subarray(c.expectation.span.start, c.expectation.span.end);
      assert.ok(bytes.subarray(s.start, s.end).equals(want), f.id);
      if (bytes.length !== f.content.length) multibyte++;
    }
  }
  assert.ok(multibyte > 0, "no multi-byte fixture exercised");
  const id = "email/global/basic/positive/after-multibyte-label";
  const prefixed = result.fixtures.find((f) => f.id === `${id}/unicode-context/multibyte-prefix`);
  const plain = result.fixtures.find((f) => f.id === `${id}/plain-text/line`);
  assert.equal(prefixed.content, "참고: 연락처: user@example.com\n");
  assert.equal(prefixed.spans[0].start - plain.spans[0].start, Buffer.byteLength("참고: "));
  // a character-offset implementation would be wrong here
  assert.notEqual(prefixed.spans[0].start, Array.from("참고: 연락처: ").length);
  assert.equal(Buffer.from(prefixed.content).subarray(prefixed.spans[0].start, prefixed.spans[0].end).toString(), "user@example.com");
});

test("a carrier never rewrites the authored value: it is skipped with a reason instead", () => {
  const c = caseById.get("phone/global/basic/positive/nanp-parenthesized"); // value contains spaces
  const form = ruleById.get("form-query/query-string");
  assert.ok(inScope(form, c));
  const r = projectOne(c, form);
  assert.equal(r.skip.reason, "carrier-would-alter-value");
  assert.ok(!JSON.stringify(r.skip).includes("555"), "skip detail must not carry the value");
});

test("the skip report lists cases without input and no-effect transforms, machine-readably", () => {
  const ids = (reason) => result.skipped.filter((s) => s.reason === reason).map((s) => s.id);
  const noInput = ids("no-input");
  assert.ok(noInput.includes("us-ssn/us/structured/twin/issuable-structure-description/plain-text/line"));
  assert.ok(noInput.includes("us-ssn/us/structured/collision/itin-shaped-nine-range/plain-text/line"));
  for (const s of result.skipped) {
    assert.equal(s.id, `${s.case}/${s.rule}`);
    assert.ok(caseById.has(s.case) && ruleById.has(s.rule));
    assert.ok(s.detail.length > 0);
  }
  assert.ok(ids("transform-no-effect").length > 0);
  // no pair is both projected and skipped
  const fixtureIds = new Set(result.fixtures.map((f) => f.id));
  for (const s of result.skipped) assert.ok(!fixtureIds.has(s.id), s.id);
  // every in-scope pair is accounted for exactly once
  let pairs = 0;
  for (const c of cases) for (const r of rules) if (inScope(r, c)) pairs++;
  assert.equal(pairs, result.fixtures.length + result.skipped.length);
  const lines = result.files["skipped.jsonl"].trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines.length, result.skipped.length);
});

test("protected and mixed populations are refused, never merged", () => {
  assert.deepEqual(populationErrors(inputs, "public"), []);
  assert.ok(has(populationErrors(inputs, "protected"), "protected population"));
  const withProtected = [...inputs, wrap({ ...clone(cases[0]), id: "email/global/basic/positive/protected-probe", population: "protected" }, "evidence/cases/probe.jsonl")];
  assert.ok(has(populationErrors(withProtected, "public"), "protected population at evidence/cases/probe.jsonl"));
  assert.ok(has(populationErrors(withProtected, "public"), "mixed populations"));
  assert.throws(() => materialize({ records: withProtected }), (e) => e instanceof ProjectionRefusal && has(e.errors, "protected population"));
  assert.throws(() => materialize({ records: inputs, population: "protected" }), (e) => e instanceof ProjectionRefusal);
  assert.throws(() => materialize({ records: inputs, population: "merged" }), (e) => has(e.errors, "unknown population"));
  const cli = run(["--check", "--population", "protected"]);
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /protected population/);
  // the fixture schema itself pins public
  const fx = clone(result.fixtures[0]);
  fx.population = "protected";
  assert.ok(has(validateRecords([...inputs, wrap(fx)]).errors, "/population"));
});

const REF = { repository: "redact-secret/ner-evidence", snapshot: "person-en-ko-beta.1-1dc0b13fe0ff", entity: "entity-0001" };
const withRefs = (refs) => {
  const c = clone(caseById.get("medical-record-number/us/labeled-field/context/patient-placeholder-with-labeled-number"));
  c.externalRefs = refs;
  return inputs.map((r) => (r.data.id === c.id ? { ...r, data: c } : r));
};

test("externalRefs are validated and passed through to fixtures untouched", () => {
  const records = withRefs([REF]);
  assert.deepEqual(validateRecords(records).errors, []);
  const out = materialize({ records });
  const mine = out.fixtures.filter((f) => f.case.startsWith("medical-record-number/us/labeled-field/context/patient-placeholder"));
  assert.ok(mine.length > 0);
  for (const f of mine) assert.deepEqual(f.externalRefs, [REF]);
  assert.ok(out.fixtures.filter((f) => !mine.includes(f)).every((f) => f.externalRefs === undefined));
  assert.ok(!JSON.stringify(out.fixtures).includes("PERSON-NAME"));
});

test("externalRefs reject inline PERSON content, floating snapshots, unknown repositories and duplicates", () => {
  for (const key of ["text", "name", "span", "surface", "value"]) {
    const records = withRefs([{ ...REF, [key]: "x" }]);
    assert.ok(has(validateRecords(records).errors, `unknown property "${key}"`), key);
    assert.throws(() => materialize({ records }), (e) => has(e.errors, `inline content field "${key}"`));
  }
  assert.ok(has(validateRecords(withRefs([{ ...REF, snapshot: "latest" }])).errors, "floating name"));
  assert.ok(has(validateRecords(withRefs([{ ...REF, snapshot: "<pinned snapshot id>" }])).errors, "/snapshot"));
  assert.ok(has(validateRecords(withRefs([{ ...REF, repository: "someone/else" }])).errors, "/repository"));
  assert.ok(has(validateRecords(withRefs([REF, REF])).errors, "must NOT have duplicate items"));
  assert.ok(has(validateRecords(withRefs([{ repository: REF.repository, snapshot: REF.snapshot }])).errors, "entity"));
  const personCase = clone(withRefs([REF]).find((r) => r.data.id?.endsWith("patient-placeholder-with-labeled-number")));
  personCase.data.person = { name: "x" };
  const records = inputs.map((r) => (r.data.id === personCase.data.id ? personCase : r));
  assert.throws(() => materialize({ records }), (e) => has(e.errors, 'inline PERSON content field "person"'));
});

test("the validator rejects fixtures that drift from their case, rule or lineage", () => {
  const f0 = result.fixtures.find((f) => f.rule === "json/object-field" && f.expectation.domains.join() === "pii");
  const bad = (mutate) => {
    const f = clone(f0);
    mutate(f);
    return validateRecords([...inputs, wrap(f, "fixtures/probe.jsonl")]).errors;
  };
  assert.deepEqual(validateRecords([...inputs, wrap(clone(f0), "fixtures/probe.jsonl")]).errors, []);
  assert.ok(has(bad((f) => (f.expectation.identity = "invalid")), "differs from the authored case"));
  assert.ok(has(bad((f) => (f.expectation.sensitivity = "non-sensitive")), "expectation.sensitivity"));
  assert.ok(has(bad((f) => (f.expectation.domains = ["phi"])), "expectation.domains differs"));
  assert.ok(has(bad((f) => (f.expectation.derivedFromRule = true)), "derivedFromRule must be false"));
  assert.ok(has(bad((f) => (f.lineage.sources = [])), "lineage differs"));
  assert.ok(has(bad((f) => (f.rule = "json/missing")), "dangling fixture rule reference"));
  assert.ok(has(bad((f) => (f.ruleVersion = "9.9.9")), "ruleVersion"));
  assert.ok(has(bad((f) => (f.externalRefs = [REF])), "externalRefs must be passed through"));
  assert.ok(has(bad((f) => (f.supportState = "stable")), 'unknown property "supportState"'));
  assert.ok(has(bad((f) => (f.spans = [{ start: 0, end: 3 }])), "bytes at the fixture span differ"));
  assert.ok(has(bad((f) => delete f.expectation), "must record ruleVersion, carrier, expectation and lineage"));
  const mut = clone(result.fixtures.find((f) => f.rule === "mutation/zero-width-insertion"));
  mut.expectation.identity = "valid";
  mut.expectation.derivedFromRule = true;
  assert.ok(has(validateRecords([...inputs, wrap(mut)]).errors, "not the outcome documented in rule"));
});

test("a rule cannot be written to invent an outcome or contradict itself", () => {
  const rulesOf = (id) => clone(ruleById.get(id));
  const probe = (r, extra = []) => validateRecords([...inputs.filter((x) => x.data.id !== r.id), wrap(r, "fixtures/rules/probe.json"), ...extra]).errors;
  assert.deepEqual(probe(rulesOf("plain-text/line")), []);
  // derived rule asserting validity
  let r = rulesOf("mutation/zero-width-insertion");
  r.expectation.identity = "valid";
  assert.ok(has(probe(r), "/expectation/identity"));
  // derived rule keeping the value bytes while changing the value
  r = rulesOf("mutation/zero-width-insertion");
  r.mustNotChange.push("valueBytes");
  assert.ok(has(probe(r), 'must not include "valueBytes"'));
  // mutation using copy mode
  r = rulesOf("mutation/zero-width-insertion");
  r.expectation = { mode: "copy", basis: "x" };
  assert.ok(has(probe(r), 'must use expectation.mode "derived"'));
  // copy rule carrying an outcome
  r = rulesOf("json/object-field");
  r.expectation.identity = "not-established";
  assert.ok(has(probe(r), "/expectation/identity"));
  // copy rule that does not protect identity
  r = rulesOf("json/object-field");
  r.mustNotChange = r.mustNotChange.filter((m) => m !== "identity");
  assert.ok(has(probe(r), 'mustNotChange must include "identity"'));
  // twin without explicit parameters
  r = rulesOf("twin/separator-swap-hyphen-to-dot");
  delete r.transform;
  assert.ok(has(probe(r), "needs an explicit transform"));
  r = rulesOf("twin/separator-swap-hyphen-to-dot");
  r.transform = { kind: "separator-swap", from: "-" };
  assert.ok(has(probe(r), "must have required property 'to'"));
  // layout and template mismatch; carrier id not derived from layout/variant
  r = rulesOf("json/object-field");
  r.template = { type: "line" };
  assert.ok(has(probe(r), "is not valid for layout"));
  r = rulesOf("json/object-field");
  r.id = "json/renamed";
  assert.ok(has(probe(r), 'must equal "<layout>/<variant>"'));
  // ordering must be unique
  r = rulesOf("json/object-field");
  r.ordering = ruleById.get("logfmt/key-value").ordering;
  assert.ok(has(validateRecords(inputs.map((x) => (x.data.id === r.id ? { ...x, data: r } : x))).errors, "reuses ordering"));
  // scanner or support-state fields cannot appear
  r = rulesOf("json/object-field");
  r.supportState = "stable";
  assert.ok(has(probe(r), 'unknown property "supportState"'));
  // justifiedBy resolves to authored cases
  r = rulesOf("unicode-context/multibyte-prefix");
  r.justifiedBy = ["email/global/basic/positive/missing"];
  assert.ok(has(probe(r), "dangling justifying case reference"));
  // unknown applies-to kind
  r = rulesOf("json/object-field");
  r.appliesTo.kinds = ["email/global/missing"];
  assert.ok(has(probe(r), "dangling privacy kind reference"));
});

test("tampering in a temp copy makes the check fail (cannot invent expectations)", () => {
  const root = tempRepo();
  try {
    assert.equal(run(["--root", root]).status, 0);
    const ok = run(["--root", root, "--check"]);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /on-disk output matches/);
    const fixturesFile = path.join(root, "fixtures", "materialized", "fixtures.jsonl");
    const pristine = readFileSync(fixturesFile, "utf8");

    // 1. edit a generated expectation by hand
    editJsonl(fixturesFile, (l) => (l.find((f) => f.rule === "json/object-field").expectation.identity = "invalid"));
    let r = run(["--root", root, "--check"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /stale or was edited by hand/);
    assert.match(r.stderr, /differs from the authored case/);
    writeFileSync(fixturesFile, pristine);
    assert.equal(run(["--root", root, "--check"]).status, 0);

    // 2. hand-edit a generated span
    editJsonl(fixturesFile, (l) => (l.find((f) => f.spans.length).spans[0].start += 1));
    r = run(["--root", root, "--check"]);
    assert.equal(r.status, 1);
    writeFileSync(fixturesFile, pristine);

    // 3. change an authored case after generation: output is stale
    const casesFile = path.join(root, "evidence", "cases", "email.jsonl");
    editJsonl(casesFile, (l) => (l[0].expectation.sensitivity = "non-sensitive"));
    r = run(["--root", root, "--check"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /stale/);

    // 4. a rule that invents an outcome is refused before anything is written
    const rulesFile = path.join(root, "fixtures", "rules", "twins-and-mutations.jsonl");
    editJsonl(rulesFile, (l) => (l[1].expectation.identity = "valid"));
    r = run(["--root", root]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /input invalid/);
    assert.match(r.stderr, /expectation\/identity/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("projector refuses an invalid tree and a tree with a protected case", () => {
  const root = tempRepo();
  try {
    const casesFile = path.join(root, "evidence", "cases", "email.jsonl");
    editJsonl(casesFile, (l) => (l[0].population = "protected"));
    const r = run(["--root", root]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /protected population/);
    editJsonl(casesFile, (l) => {
      delete l[0].population;
      l[0].privacyKind = "email/global/missing";
    });
    const r2 = run(["--root", root]);
    assert.equal(r2.status, 1);
    assert.match(r2.stderr, /dangling privacy kind/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("materialized output is generated, not canonical: ignored by git and excluded from projector input", () => {
  assert.match(readFileSync(path.join(REPO_ROOT, ".gitignore"), "utf8"), /^\/fixtures\/materialized\/$/m);
  assert.ok(loadInputs(REPO_ROOT).records.every((r) => !r.file.startsWith("fixtures/materialized/")));
});
