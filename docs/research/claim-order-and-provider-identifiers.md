# Healthcare claim, prescription, order and provider identifiers: recommendations

Status: draft, unreviewed agent work (observed 2026-10-07). Nothing here is independent validation. Records: `evidence/sources/provider-and-order-identifier-sources.jsonl`, `evidence/claims/provider-and-order-identifier-claims.jsonl`, `evidence/cases/provider-and-order-identifier-cases.jsonl`. Two CMS sources were added; the existing HL7 v2 table 0203 and FHIR R4 sources were re-read. No taxonomy kind, context or schema was added or changed. This closes the claim/order deferral in `clinical-record-identifiers.md` and `health-plan-identifiers.md`.

## Established (source-stated; locators in the claims)

- CMS: the NPI is a 10-position, intelligence-free numeric identifier for covered health care providers, applied for and accessed through NPPES. The CMS check-digit document uses the Luhn formula (modulus 10) with the 80840 prefix and contains a worked example.
- HL7 v2 table 0203 defines distinct types: NPI, PRN (provider number), RPH (pharmacist license), SL (state license), FI (facility ID), XX (organization identifier), PLAC and FILL (placer and filler identifiers), VN (visit number), AN (account number), PI (patient internal identifier).
- FHIR R4: `Practitioner.identifier` applies to a person in a practitioner role; `Encounter.identifier` identifies an encounter and `Encounter.subject` links the patient; `Claim.patient` and `MedicationRequest.subject` (existing claims) link the patient through a separate element. No value format is stated for any of these.

## Inferred (project reasoning)

- Provider, facility and organization identifiers name non-patient roles. The NPI is published through NPPES, so it is treated as a public provider identifier, not a patient-linked reference.
- Claim, order, encounter and account references reach a person only through a separate join, so they stay `context-dependent`, consistent with the existing claim and order kinds.

## Role matrix and recommendations

| Role | Patient-linked | Format-defined | Recommendation |
| --- | --- | --- | --- |
| Claim identifier (`Claim.identifier`) | via `Claim.patient` only | no | **keep** existing kind `health-claim-identifier/us/claim-field`, still `unresolved` |
| Prescription / order identifier (`MedicationRequest.identifier`) | via `subject` only | no | **keep** existing kind, still `unresolved` |
| Placer / filler order numbers (PLAC, FILL) | via join | no | **context-only**: occurrence of the order kind; ambiguous case |
| Encounter / visit number (VN, `Encounter.identifier`) | via `Encounter.subject` | no | **defer** a separate kind; ambiguous case against the order kind |
| Patient account number (AN) | via join | no | **defer**; ambiguous case against the claim kind |
| Patient internal identifier (PI) | yes | no | already covered by the MRN kind work; not re-modeled |
| Provider NPI (individual or organization) | no | yes (10 digits, Luhn with 80840) | **reject as a PII/PHI kind**; kept as a public-identifier collision case; revisit only if a public-identifier family is added |
| Provider number, UPIN (PRN, UPIN) | no | no source read | **reject as a kind**; no format source |
| Pharmacist / state license (RPH, SL) | no, practitioner role | no | **reject as a patient kind**; collision case, sensitivity open |
| Pharmacy / facility / organization id (FI, XX) | no | no | **reject as a PII/PHI kind**; collision case |

## Cases added (all synthetic `SYNTH-P` values, no name, date or clinical detail)

- `health-claim-identifier/.../collision/billing-provider-npi-label`: `invalid` for the claim kind, `non-sensitive`.
- `health-claim-identifier/.../ambiguous/patient-account-number-label`: `not-established`, `context-dependent`.
- `prescription-order-identifier/.../ambiguous/filler-order-number-label` and `.../encounter-visit-number-label`: `not-established`, `context-dependent`.
- `prescription-order-identifier/.../collision/pharmacy-or-facility-identifier-label`: `invalid`, `non-sensitive`.
- `prescription-order-identifier/.../collision/pharmacist-license-number-label`: `invalid`, `context-dependent`, domain `pii`.

No span is asserted. `invalid` is relative to the named kind only. The NPI case token intentionally does not use the NPI digit shape.

## Unresolved

- The CMS worked check-digit example was not copied: it was not established whether it is an issued NPI. A kind for NPI with documented structure would need a value known to be reserved or never issued, and the NPPES public-access terms.
- No NCPDP or pharmacy-standard source was read, so no prescription number format is stated.
- Whether individual practitioner identifiers (NPI, license) are ever sensitive in a patient context is not source-stated.
- Whether encounter or account references merit their own kind.
- Label vocabulary is project-authored. The check-digit PDF and the Practitioner page were read in summary only; the Encounter page only up to 100000 characters.

## Schema notes

No schema gap blocked this work. Non-patient roles have no kind, so their collision cases name the nearest patient-reference kind and state `invalid` relative to it; they should move to new case ids if a public-identifier kind is added. Domains on non-sensitive cases follow the earlier payer case.

## Snapshot impact

None for released snapshots (immutable). The next snapshot gains four claims, six cases, two sources and their projected fixtures.

## Needs human

- Approve or reject the keep/context-only/defer/reject recommendations; decide whether public provider identifiers deserve a kind.
- All records stay `unreviewed`.

## Checks run

`npm run check`. No scanner was run or consulted. No formatter exists.
