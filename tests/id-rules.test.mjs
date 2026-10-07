import test from "node:test";
import assert from "node:assert/strict";
import { forbiddenIdViolations } from "../scripts/id-rules.mjs";
import { taxonomyRecords, validCorpus } from "./helpers.mjs";

const bad = {
  "issue-or-pr-number": ["email/global/basic/positive/issue-42-regression", "email/global/basic/pr-7", "case/gh123/x", "x/pull-request/y"],
  "release-or-milestone": ["email/global/basic/v1-cases", "case/release-2/email", "case/milestone-3/x", "case/beta/x", "case/v2/x"],
  "scanner-or-detector-name": ["email/global/basic/presidio-miss", "case/redact-secret/x", "case/detector-hit/x", "case/gitleaks/x"],
  "benchmark-score": ["email/global/basic/f1-92", "case/recall/x", "case/95-pct/x", "case/score-0/x"],
  "migration-coordinate": ["case/legacy-row-12/x", "case/row-12/x", "case/migrated/x", "case/from-old-to-new/x", "case/offset-40/x"],
};

for (const [rule, ids] of Object.entries(bad)) {
  test(`id lint rejects ${rule}`, () => {
    for (const id of ids) {
      const hit = forbiddenIdViolations(id).map((v) => v.rule);
      assert.ok(hit.includes(rule), `${id} should violate ${rule}, got [${hit}]`);
    }
  });
}

test("id lint accepts semantic ids, including every taxonomy and example id", () => {
  const ok = ["email/global/basic", "email/global/basic/positive/example-domain-address", "us-ssn/us/structured", "health-plan/us/general"];
  for (const id of ok) assert.deepEqual(forbiddenIdViolations(id), [], id);
  for (const r of validCorpus()) {
    const d = r.data;
    const ids = d.id ? [d.id] : (d.kinds ?? d.jurisdictions ?? d.contexts ?? []).map((x) => x.id);
    for (const id of ids) assert.deepEqual(forbiddenIdViolations(id), [], id);
  }
  assert.ok(taxonomyRecords().length === 3);
});
