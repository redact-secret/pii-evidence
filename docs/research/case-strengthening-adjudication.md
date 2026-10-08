# Case-strengthening adjudication

Observed 2026-10-08. Project-maintained agent review of research #20–#24, stored Cases, schema v1 and consumer contract v1. This is not independent validation, human approval, or a scanner measurement. Canonical review states remain unreviewed. Exact per-candidate reasoning, target files, source/claim ids, safety and consumer limitations are in `case-strengthening-adjudication.json`.

## Decisions

60 authored Cases: 57 accepted (`add`) and 3 deferred. The 24 additional proposals have 16 combined deferred items with the Cases, 6 context-only items and 5 rejected items. No candidate is accepted because of scanner output.

- Same-value twins: accept bounded context evidence with identity invariant. Correct the invalid SSN documentation twin to non-sensitive with no ambiguity; documentation wording cannot restore assignability. Supplement context twins with their base-kind grammar and safe-value lineage. Account-number composition for cards/IBAN remains inference and source eligibility remains a separate publication gate.
- Serialization: accept unchanged contiguous raw values and the explicitly unresolved ideographic punctuation Case. Defer percent-encoded and JSON Unicode-encoded mailbox Cases because their draft `valid` identity has no defined raw/decoded scope or span. Defer form-plus parsing until WHATWG is pinned and identity scope is decided.
- Benign/reserved discrimination: accept grammar exclusions and conservative mask/role/host ambiguities. Reserved/test origins make publication safe; they do not make an identifier semantically negative. Never replace an unresolved masked value with a benign assertion.
- Collisions: accept source-backed invalid structure and explicit unresolved label collisions. Correct epoch-seconds and short Luhn-reference sensitivity to context-dependent because unread allocation rules cannot establish non-sensitivity.
- Span-less negatives: accept authored absence examples under the current invalid/non-sensitive convention. They assert no located value and remain unscored by the present consumer. A text-level enum or fake span is not added.

## Promotion and projection

Changes belong in existing `evidence/cases/context-twin-cases.jsonl` and `collision-cases.jsonl`; the remaining accepted cases already exist. Sources and claims listed by each Case remain factual/inference-separated. Agent adjudication does not authorize changing `review.state` to reviewed.

Existing `plain-text/line` in `fixtures/rules/carriers.jsonl` preserves every accepted raw input and expectation, including empty span arrays. Existing carrier rules may add eligible located-value projections and documented skips. No new projector, encoding transform, schema enum, or expectation-generating label swap is necessary. Reciprocal relationships are optional convention and are not changed just to increase exclusion coupling.

The snapshot selection gate must consult the ledger before public-safe provenance closure: preserve deferred canonical research records but exclude their Case ids from the candidate snapshot. Related cases may then be excluded by existing reference closure, and the delta inventory must report that consequence. No released snapshot is edited.

## Consumer boundary

Consumer contract v1 can preserve all authored records. The present pii-eval mapping cannot faithfully measure span-less invalid/absence statements, loses the distinction between context-dependent and unresolved sensitivity, and retains contexts/phi only in bindings rather than PII semantic families. These limitations accompany accepted evidence; acceptance never promises added scored coverage. Representation/schema changes require a separate consumer contract decision.

Unsafe historical/public identifiers and fabricated assignable SSN/ITIN collisions are rejected. Unresearched source pins, decoding, allocation, other jurisdictions and text-level semantics remain discoverable in the ledger rather than silently promoted.
