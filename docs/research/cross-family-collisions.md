# Cross-family and near-shape collisions: findings, gaps and impact

Status: draft, unreviewed agent work (observed 2026-10-07). Nothing here is independent validation. Records: `evidence/cases/collision-cases.jsonl`. No source, claim, taxonomy, schema, rule, projector, allowlist or snapshot file was changed; every case cites existing sources and claims, or none.

## Question

Where does a well-formed value of one kind coincide in shape with a different kind of identifier, a number, or the same kind under another label, and what discriminator, if any, does a source support? The existing collision cases cover ZIP+4, ISO timestamps, a sixteen-digit order number, epoch milliseconds, unseparated nine digits and an alphanumeric key. This note adds seven groups and states for each whether a source-backed discriminator exists.

## Collision groups

| Group | Cases | Discriminator | Support |
| --- | --- | --- | --- |
| phone vs order number | `phone/.../twin/tel-label-same-digits`, `phone/.../collision/order-number-label-same-digits` | label only (identical digits) | label rule is project inference; reserved range is sourced; ambiguity recorded |
| phone vs epoch seconds | `phone/.../collision/epoch-seconds-timestamp` | none established (leading digit rule unread) | unresolved ambiguity |
| phone vs dotted version | `phone/.../collision/dotted-groups-version-label` | label only | unresolved ambiguity |
| SSN vs part number | `us-ssn/.../collision/dashed-part-number` | structure: area 000 is never assigned | source-backed (SSA excerpts) |
| MRN vs order or patient id | `medical-record-number/.../collision/order-label-in-clinical-context`, `.../collision/generic-patient-id-label`, `prescription-order-identifier/.../collision/order-label-without-prescription-wording` | role definitions differ (HL7, FHIR); label is project inference | role claims sourced, discriminator unresolved |
| member id vs group number | `health-plan-member-id/.../collision/group-number-label` | FHIR separates subscriber id from coverage identifier | role claim sourced, application inferred |
| card vs short number | `payment-card/.../collision/short-luhn-valid-reference` | none: check digit and length pass | unresolved ambiguity |

All values are reserved (555-01xx), `SYNTH-` markers, or arbitrary synthetic digit patterns and fail no safe-data rule. Only the part number case carries an `invalid` identity, justified by structure. The rest are `not-established` with ambiguity reasons and a `wouldSettle` statement; none decides a label-versus-shape policy.

## Boundary and modeling notes

- A shared base kind is modeled once. The MRN and prescription order collisions reuse the existing kinds and contexts; no kind is duplicated for PHI. The same token under an order label is recorded against both kinds as a collision between kinds, not as a new identifier.
- No PERSON/name content. No scanner behavior was consulted; expectations rest on source claims or on explicit not-established reasoning.

## Unresolved

- A structurally assignable SSN-shaped number under a non-SSN label (the one-property twin of the part number case) cannot be authored without a real-looking value, and the safe-data policy bars it. ITIN-shaped values (9xx area, 7x or 8x group) were also not authored: no reserved ITIN range was found.
- Employer identification number shape (two digits, hyphen, seven digits) as a near-shape of SSN was not authored: no format source was read and no reserved range is known.
- North American area-code form rules (leading digit limits) were not read, so a ten-digit number beginning with 1 or 0 cannot yet be called an invalid phone by structure; this blocks promoting the epoch-seconds case.
- ISO/IEC 7812 allocation of leading digits was not read, which blocks calling the short Luhn-valid reference a non-card.
- Whether a label overrides shape is a policy question for all label-only groups; the repository has no recorded decision.
- Whether group or policy numbers fall in the health plan beneficiary number category was not read.
- Domestic bank account numbers versus IBAN, and card numbers versus phone numbers by length, were not authored; no source for domestic account formats was read.

## Schema notes

- No schema change was needed. `relationships` is symmetric only by convention; the new cases point at an existing sibling and the sibling does not point back, so existing cases were not edited.
- There is no field for a discriminator class (structure, checksum, label, context). It is carried in `rationale` and `ambiguity.reasons`; a controlled field may be worth proposing.
- A cross-kind collision (same token, two health kinds) has no dedicated record; each kind gets a case that points at the other.

## Snapshot impact

None for the released snapshot `public-pii-phi/2026-10-07/9d4e8e036bbb`, which is immutable. The 10 cases would enter the next snapshot only through a reviewed build: 1 valid twin with a span, 1 `invalid` collision and 8 `not-established` collisions, all of the latter without a span, adding to the ambiguity counts and not to span-based denominators. Fixture projection derives additional fixtures through existing rules; texts a carrier would alter are skipped with reasons.
