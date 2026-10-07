# Medical record, patient, encounter and facility-local identifiers: recommendations

Status: draft, unreviewed agent work (observed 2026-10-07). Nothing here is independent validation. Records: `evidence/sources/clinical-identifier-sources.jsonl`, `evidence/claims/clinical-identifier-claims.jsonl`, `evidence/cases/clinical-identifier-cases.jsonl`. No taxonomy kind, context or schema was added or changed; the existing `phi-seed` sources (HHS 45 CFR 164.514, HL7 v2 table 0203, FHIR R4) are reused.

## Established (source-stated; locators in the claims)

- HL7 v2 table 0203 separates typed identifier roles: MR (unique within a set of medical records), PI (patient internal identifier, unique within an Assigning Authority), PT (patient external identifier), AN (account number) and VN (visit number).
- FHIR R4 `Encounter.identifier` and `Account.identifier` are optional repeating identifiers with no stated value format. Each links to a person through a separate element (`Encounter.subject`, `Account.subject`). `Account.type` can be patient, expense or depreciation.
- 45 CFR 164.514(b)(2)(i) lists medical record numbers (H), account numbers (J) and any other unique identifying number, characteristic or code (R) among identifiers removed for safe-harbor de-identification. It defines de-identification, not formats or labels.

## Inferred (project reasoning)

- No identifier in this family has a source-stated value format; each is recognized by field label or type code, never by shape.
- An identifier that links to a person only through a separate element is not shown to identify an individual by itself (same reasoning as the claim and order identifiers in the PHI seed).

## Recommendations per concept

| Concept | Format-defined | Field-defined | Classification | Recommendation |
| --- | --- | --- | --- | --- |
| MRN | no | yes (label, MR code) | pii + phi | **add** (already `medical-record-number/us/labeled-field`); no change |
| Patient ID (PI, PT) | no | partly (code; label vocabulary unsourced) | pii + phi candidate | **defer** a separate kind; record as a not-established case against the MRN kind until a source separates the roles in text |
| Account number (AN, `Account.identifier`) | no | yes (label, code) | context-dependent; HIPAA lists it, but it is financial | **context-only**: no health kind; collides with bank/utility account numbers; case records it is not an MRN |
| Encounter / visit id (VN, `Encounter.identifier`) | no | yes (label, code) | person linkage separate; unresolved | **defer**; no kind; case records it is not an MRN |
| Facility-local identifiers (department, bed, order-set, local codes) | no | no source | covered at most by catch-all (R) | **reject** as a kind; HIPAA (R) is a catch-all, not a field vocabulary. Revisit only with a provider-documented spec |

## Cases added

Three cases under `medical-record-number/us/labeled-field`, all synthetic `SYNTH-` values with no name, date or clinical detail adjacent:

- `.../collision/account-number-field`: identity `invalid` for the MRN kind, sensitivity `context-dependent`.
- `.../collision/encounter-identifier-field`: identity `invalid` for the MRN kind, sensitivity `context-dependent`.
- `.../ambiguous/patient-identifier-label`: identity `not-established`, sensitivity `sensitive`.

`invalid` is relative to the MRN kind only; it is not a claim that the token is non-sensitive. No span is asserted for the `invalid` and `not-established` outcomes except where a positive is justified, and none is.

## Unresolved

- Does a patient-identifier (PI/PT) kind separate from MRN help another scanner or evaluator? Settle with a provider-documented source that lists labels per role.
- Whether bare encounter, visit or account numbers are person-linked, by holder setting. Settle with an authority statement.
- Non-US regimes (GDPR health data, other national health identifiers) are not researched.
- Label vocabulary (`Patient ID`, `Account number`, `Encounter ID`) is project-authored.
- Only HL7 v2 table 0203 and FHIR R4 element pages were read; CX component layout was not.

## Schema notes

No schema gap blocked this work. A deferred concept has no kind id, so a not-established case must name an existing kind; the cases here use the MRN kind and say so. If a patient-identifier kind is later added, the patient-id case should move to it as a new case id rather than editing this one.

## Snapshot impact

None for released snapshots, which are immutable. The three cases and one source would appear in the next snapshot built after merge; counts will rise by three cases and the materialized projection by their fixtures.

## Needs human

- Approve or reject the defer/context-only/reject recommendations above.
- Evidence-class upgrades; every record stays `unreviewed`.

## Checks run

`npm run check` (validate, privacy-data and credential lint, provenance lint, fixture materialization check, snapshot verify, tests). No scanner was run or consulted. No formatter exists.
