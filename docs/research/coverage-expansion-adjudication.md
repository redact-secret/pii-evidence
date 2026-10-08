# Coverage-expansion adjudication

Observed 2026-10-08. Project-maintained adjudication under the repository owner's delegated snapshot-v2 track, not independent validation. Machine-readable decisions and exact existing case/claim/source references: [ledger](coverage-expansion-adjudication.json).

## Decisions

4 add, 9 context-only, 28 defer, 18 reject; 59 candidate roles total. Every role in research #25–#29 receives exactly one decision. Repeated clinical/order views are separate bounded occurrences, not new duplicate kinds.

## Accepted implementation

Retain MRN, health-plan member, bounded DOB and UK NINO kinds. Source-defined identifier roles and calendar notation remain separate from authored label inference. Retain medical DOB as the same base kind plus medical context. Retain subscriber, group/class, account and order-role context/controls without claiming a universal value grammar. Preserve exact named-kind validity, sensitivity, uncertainty, synthetic origin and carrier projection lineage.

Opaque PI/PT, encounter/account, dependent/policy, claim and prescription identifiers receive no new grammar or stronger positive. Existing unresolved vocabulary and Cases remain usable by consumer contract v1; not-established is unscored. The CMS MBI split is deferred until a dedicated safe-value strategy and Cases exist, despite a documented format. No age, partial-date or other individual-date expansion is accepted.

UK NINO remains UK-only. Canada, Finland, ITIN, Korea and each named EU family remain individually deferred. Business IDs and provider/public operational IDs are rejected from the specified personal/patient role only. Individual NPI and licenses can identify practitioners; public availability never proves universally non-PII. The billing-provider NPI control now uses context-dependent sensitivity because the input does not distinguish individual and organization providers. Other existing non-sensitive controls must be read under their stated organization/operational scenario, not generalized to individual practitioners.

## Review authority and retained questions

A future independent reviewer may attach an adjudication ReviewEvent when available, with unresolved role and label findings retained; that is not claimed by this project-maintained promotion. The author of this promotion does not mark their own records reviewed. Keep claims' observedAt values unchanged; this adjudication date does not imply sources were fetched again. Any source whose public-safe provenance is unresolved remains excluded by snapshot policy. Reconcile legacy research recommendations with this ledger, especially MBI split, business/public identifier wording, and claim/order keep versus defer.

Materialize existing deterministic carrier rules for accepted Cases; no standalone deferred-kind fixture is invented. Consumer contract v1 represents every accepted expectation without a schema extension. Snapshot coverage must distinguish canonical vocabulary from resolved role evidence and enumerate these deferrals. Released snapshot v1 remains immutable.

## Verification

Ledger source and claim references checked against the working tree. Local schema/reference validation is run for this promotion; full npm checks and candidate snapshot verification are performed by the integrating orchestrator. No formatter exists.
