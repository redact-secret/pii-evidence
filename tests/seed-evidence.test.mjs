import test from "node:test";
import assert from "node:assert/strict";
import { REPO_ROOT, loadTree } from "../scripts/lib/validator.mjs";

const SEED = ["email", "phone", "payment-card", "iban", "us-ssn"];
// Only the structured PII seed files: evidence/<sub>/<kind>.jsonl for the five kinds.
const records = loadTree(REPO_ROOT).records.filter((r) => SEED.some((k) => r.file.endsWith(`/${k}.jsonl`))).map((r) => r.data);
const of = (kind) => records.filter((d) => d.kind === kind);
const claims = new Map(of("claim").map((c) => [c.id, c]));
const cases = of("case");
const caseById = new Map(cases.map((c) => [c.id, c]));

test("every case claim exists and its source is listed in the case provenance", () => {
  for (const c of cases) {
    for (const id of c.provenance.claims) {
      const claim = claims.get(id);
      assert.ok(claim, `${c.id}: unknown claim ${id}`);
      assert.ok(c.provenance.sources.includes(claim.source), `${c.id}: claim ${id} source not listed`);
    }
  }
});

test("case relationships are reciprocal and stay inside one privacy kind", () => {
  for (const c of cases) {
    for (const rel of c.relationships) {
      const other = caseById.get(rel.case);
      assert.ok(other, `${c.id}: unresolved relation ${rel.case}`);
      assert.equal(other.privacyKind, c.privacyKind, `${c.id}: relation crosses kinds`);
      assert.ok(other.relationships.some((r) => r.case === c.id && r.type === rel.type), `${c.id}: relation to ${rel.case} is not reciprocal`);
    }
  }
});

test("authored cases never claim review, and sources and claims stay unreviewed", () => {
  for (const d of records) assert.notEqual(d.review.state, "reviewed", d.id);
});

test("a valid identity with input text always carries an exact span that is inside the text", () => {
  for (const c of cases) {
    if (c.input && c.expectation.identity === "valid") {
      assert.ok(c.expectation.span, `${c.id}: missing span`);
      assert.ok(c.expectation.span.end <= Buffer.byteLength(c.input.text), c.id);
    }
  }
});

test("case ids are prefixed by their privacy kind id", () => {
  for (const c of cases) assert.ok(c.id.startsWith(`${c.privacyKind}/`), c.id);
});
