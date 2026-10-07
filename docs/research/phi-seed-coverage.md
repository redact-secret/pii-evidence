# Structured PHI and medical-context seed: coverage and gaps

Status: draft, unreviewed agent work (observed 2026-10-07). Nothing here is independent validation. Records: `evidence/sources/phi-seed-sources.jsonl`, `evidence/claims/phi-seed-claims.jsonl`, `evidence/cases/phi-seed-cases.jsonl`. Taxonomy edits are limited to the health-domain kinds and the `medical/global/general` and `health-plan/us/general` contexts.

## Research notes

**Established** (source-stated; locators in the claim records)

- 45 CFR 164.514(b)(2)(i) lists medical record numbers (H), health plan beneficiary numbers (I), electronic mail addresses (F) and telephone numbers (D) among the identifiers removed for safe-harbor de-identification. It defines de-identification, not formats.
- HL7 v2 identifier type code MR is defined as an identifier unique to a patient within a set of medical records, not necessarily unique within an application. Code MB is an insurer-assigned identifier for the insured.
- FHIR R4 (4.0.1) defines `Patient.identifier`, `Coverage.subscriberId` (string), `Claim.identifier` and `MedicationRequest.identifier` without any value format. `Claim` and `MedicationRequest` link a person through a separate element (`Claim.patient`, `MedicationRequest.subject`).
- The CMS MBI has a documented 11-character format and is randomly generated. It is Medicare-specific.

**Inferred** (project reasoning, marked as inference on each claim or case)

- MRNs and member ids have no universal format, so they are identified by label or type code and not by shape. Cases therefore rely on labeled-field context and explicit `SYNTH-` markers.
- Email or phone inside health information is modeled as the base kind plus `medical/global/general`, with occurrence domains `[pii, phi]`; no second kind.

**Unresolved**

- Which bounded signals make a context "medical" (the seed uses an explicit patient label, project-authored). Context stays `research-needed`.
- Holder dependence: the HIPAA list applies to covered entities and business associates; whether the phi domain applies to an occurrence outside that setting is not established. Other jurisdictions (for example GDPR health data) are not researched.
- Claim and prescription identifier person linkage (the open modeling question from the taxonomy work): the cited definitions link person and identifier through a separate element, so the classification stays `unresolved` and the cases are `not-established`.
- Field label vocabulary (`MRN`, `Member ID`, `Claim ID`, `Rx order`) has no source; only the element name `subscriberId` (FHIR) and the code `MR` (HL7 v2) are documented.

**Needs human**

- Evidence-class upgrades for kind classifications (left `research-needed` on purpose; agents do not upgrade classes).
- Redistribution terms for the HL7 terminology page and the CMS PDF (sources are `unresolved` until read; they are cited by code or heading only).
- Whether the MBI deserves its own kind (it has a source-backed format, unlike general member ids).

## Coverage

| Kind or composition | Cases | Notes |
| --- | --- | --- |
| `medical-record-number/us/labeled-field` | 9 | positive; JSON, logfmt, HL7 v2 type code and punctuation-boundary variants; invalid shape (label without value); benign twin (same token, non-identifier label); unlabeled variant (`not-established`); placeholder person reference |
| `health-plan-member-id/us/member-field` | 5 | positive; FHIR `subscriberId` variant; invalid shape; non-health membership collision (domain `pii` only); unlabeled variant (`not-established`) |
| `health-claim-identifier/us/claim-field` | 1 | `not-established`, person linkage open |
| `prescription-order-identifier/us/order-field` | 1 | `not-established`, person linkage open |
| `email/global/basic` plus `medical/global/general` | 2 | contextual case (domains `pii`, `phi`) and non-medical twin (domain `pii`) with the same value; no duplicate email kind |
| `phone/global/basic` plus `medical/global/general` | 2 | same pair for telephone |

Expected spans are byte offsets into `input.text` and are present only where an observation is justified. `not-established` and `invalid` cases carry no span on purpose. For `invalid` and `not-established` cases, `expectation.domains` records the kind's candidate domains (or `pii` only for the non-health collision); read `identity` first.

## Values

All identifiers are synthetic: `SYNTH-000001`, `SYNTH-M000001`, `SYNTH-C000001`, `SYNTH-R000001`. Each case records how it was made. MRN and member id have no bounded format, so no value can be shown unissuable by range; safety rests on the explicit marker, no name, date or clinical detail adjacent, and no lookup against any service. Email values use the reserved `example.com` domain; the phone value uses exchange 555, line 0100 (see `docs/governance/safe-data-policy.md`). The person reference is the literal placeholder `PATIENT-PLACEHOLDER`.

## PERSON composition and the external-reference gap

`taxonomy/contexts.json` defines `externalRefs` on an occurrence: repository, pinned snapshot identity and entity id. The v1 case schema has no such field and forbids unknown properties, and this seed does not change the schema. The seed case `medical-record-number/us/labeled-field/context/patient-placeholder-with-labeled-number` therefore carries only the placeholder and expects only the structured identifier.

Intended shape of a future composed case, as it would be recorded once a schema field exists:

```json
{ "repository": "redact-secret/ner-evidence", "snapshot": "person-en-ko-beta.1-1dc0b13fe0ff", "entity": "<entity id chosen by that repository>" }
```

The snapshot id above is the identity format used by `ner-evidence` at the time of writing (`snapshots/index.json`, content digest `1dc0b13fe0ff...`, pin the full id and digest when used). No entity id was selected and no PERSON content was read into or copied into this repository. The case-level `externalRefs` field has since been added (see `docs/methodology/fixture-projection.md`); this seed case does not use it yet.

## Explicit gaps

- No non-US profiles; no state-level or HIPAA-versus-other-regime distinctions.
- No `patient_id` or generic account-number kinds: no source ties them to a format or field semantics.
- No NCPDP or pharmacy-standard source for prescription or order identifiers; no HICN source (superseded by the MBI per CMS, not otherwise researched).
- No NPI or provider identifiers (not in the taxonomy).
- PID-3 placement and CX component layout for the HL7 v2 variant were not read; that variant is project-authored apart from the MR code.
- Only the first 100000 characters of the FHIR Patient, Coverage, Claim and MedicationRequest pages were read.
- Fixture projections are generated from rules and not committed (see `docs/methodology/fixture-projection.md`) and no review events; every record is `unreviewed`.
- The email and phone kind entries and their format claims are owned by the structured PII seed; this seed references them by id only and did not edit them.

## Checks run

`npm ci && npm run check` (schema and reference validation, safe-data lint, provenance lint, tests). Provenance lint reports two sources as unresolved (redistribution unknown); that is expected and not hidden. No scanner was run or consulted.
