---
name: fixture-projection
description: Define or review deterministic fixture projection rules (plain text, JSON, logfmt, form/query, Unicode/context variants) that materialize authored Cases with exact lineage and byte ranges. Use when adding a projection rule, materializing fixtures, or reviewing generated fixture output.
---

# Fixture projection

Fixtures are derived artifacts, never canonical evidence. Read `ARCHITECTURE.md` §7 and §11 and
`CONVENTIONS.md` (Fixture generation) first, plus [synthetic safety](../_shared/synthetic-safety.md).

## Rules

- Every fixture traces to an authored Case and a documented generation rule, and records
  generator identity and version.
- Generation is deterministic: same inputs, same bytes. No timestamps, randomness without a
  recorded seed, locale or filesystem-order dependence.
- A generator never invents an expectation absent from the Case. Expected spans are computed
  from the materialized bytes (UTF-8 byte offsets), not hand-typed.
- Canonical authored evidence stays in `evidence/`; generated output lives under
  `fixtures/materialized/` or in a snapshot only. Never hand-edit generated output.
- Stable fixture IDs derived from the Case id and rule id, not from scanner, release or issue.
- Variants (JSON, logfmt, form, Unicode/context) must keep the semantic outcome stated by the
  Case; if a variant changes the outcome, it is a different Case.

## Steps

1. Read the Case and its expectation; stop if it is unresolved (no projection for a
   `not-established` outcome unless the Case says what is asserted).
2. Write or edit the rule under `fixtures/rules/` with its inputs, carrier, and what it must not change.
3. Materialize with the repository's script if it exists. If it does not, report that and
   describe the intended output instead of hand-producing bytes.
4. Run the materialization twice and compare digests; run the check that generated output matches
   the committed or snapshot copy, if one exists.
5. Confirm no value in the output is real ([synthetic safety](../_shared/synthetic-safety.md)).

## Output

A PR-ready change set (rule, plus materialized output only if the layout commits it), and notes
stating the rule, the determinism check actually run, and any check that does not exist yet.
