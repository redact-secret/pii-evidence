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
- Rules live in `fixtures/rules/` (kind `fixture-rule`, format in
  `docs/methodology/fixture-projection.md`). Carrier rules copy the Case expectation. Twin and
  mutation rules may only assign identity `not-established` / sensitivity `context-dependent`,
  flagged `derivedFromRule`; if you want a stronger outcome, author a Case.
- Every rule records `mustNotChange`. Never copy PERSON content: reference it with
  `externalRefs` (repository, pinned snapshot, entity id). Populations are public only.

## Steps

1. Read the Case and its expectation; stop if it is unresolved (no projection for a
   `not-established` outcome unless the Case says what is asserted).
2. Write or edit the rule under `fixtures/rules/` with its inputs, carrier, and what it must not change.
3. Materialize with `npm run fixtures:materialize` (writes ignored, uncommitted `fixtures/materialized/`:
   `fixtures.jsonl`, `skipped.jsonl`, `manifest.json`). Never hand-produce or hand-edit bytes.
4. Run `npm run fixtures:materialize:check`: it projects twice (second run over reversed input),
   requires byte-identical output, re-validates every fixture against its Case, rule and lineage,
   and compares any existing on-disk output. Review `skipped.jsonl`; a new skip reason or a
   rule that skips many cases needs an explanation.
5. Confirm no value in the output is real ([synthetic safety](../_shared/synthetic-safety.md)).

## Output

A PR-ready change set (rule files and tests; materialized output is never committed), and notes
stating the rule, the `fixtures:materialize:check` result, the skip report delta, and any check
that does not exist yet.
