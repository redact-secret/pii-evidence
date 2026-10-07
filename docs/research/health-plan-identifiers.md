# Health-plan and insurance identifiers: recommendations

Status: draft, unreviewed agent work (observed 2026-10-07). Nothing here is independent validation. Records: `evidence/claims/health-plan-identifier-claims.jsonl` and `evidence/cases/health-plan-identifier-cases.jsonl`. No new source was needed: the existing `phi-seed` sources (HL7 v2 table 0203, FHIR R4 Coverage and Organization, 45 CFR 164.514, CMS MBI format) were re-read for the roles below. No taxonomy kind, context or schema was added; one open question was added to the existing member-id kind.

## Established (source-stated; locators in the claims)

- HL7 v2 table 0203 separates MB (member number: the insured, who always has a subscriber), SN (subscriber number), MC (patient Medicare number) and XV (national health plan identifier, an organization-level plan role).
- FHIR R4 Coverage separates `subscriberId` (insurer-assigned id for the subscriber), `dependent` (unique id for a dependent), `identifier` (unique id for the coverage), `class.value` (insurer-issued group or plan label value), `beneficiary` (references a Patient), `subscriber`, and `payor` (references an Organization, Patient or RelatedPerson). `Organization.identifier` identifies an organization across systems. None has a stated value format.
- 45 CFR 164.514(b)(2)(i)(I) lists health plan beneficiary numbers among safe-harbor identifiers.
- CMS documents a bounded MBI format (existing claim `phi-cms-mbi/format-and-randomness`).

## Inferred (project reasoning)

- Person-linked roles: member, subscriber, dependent, beneficiary Medicare number. Coverage-level roles (policy, group, plan class) can be shared by many people and are not shown to be person-linked by themselves. Organization-level roles (payer, plan, XV) identify an organization.
- Identification is by field label or type code, never by value shape, except the MBI.

## Role taxonomy and recommendations

| Role | Person-linked | Format-defined | Recommendation |
| --- | --- | --- | --- |
| Member id (MB) | yes | no | **add**, already `health-plan-member-id/us/member-field` |
| Subscriber id/number (SN, `subscriberId`) | yes | no | **context-only**: occurrence of the existing kind; ambiguous case records that the member/subscriber split is unsettled |
| Dependent id (`Coverage.dependent`) | yes | no | **defer** a separate kind; ambiguous case against the member kind |
| Policy / coverage number (`Coverage.identifier`) | unresolved | no | **defer**; collision case with group number already exists, policy label case added |
| Group / plan class value (`class.value`) | no, coverage-level | no | **context-only** (existing group-number collision case); not a person kind |
| Medicare Beneficiary Identifier (MC) | yes | yes (CMS) | **split**: candidate separate kind, recommended for a follow-up; not created here |
| Payer or plan organization id (XV, `Organization.identifier`) | no | no source read | **reject as a PII/PHI kind**; kept as a public-identifier collision case; revisit only with a licensed public directory |
| Claim-related member reference | n/a | n/a | out of scope here; claim identifiers belong to the claim/order boundary work (#29) |

## Cases added (all synthetic `SYNTH-M` values, no name, date or clinical detail)

- `.../ambiguous/subscriber-number-label`: identity `not-established`, `sensitive`.
- `.../ambiguous/dependent-identifier-label`: identity `not-established`, `sensitive`.
- `.../collision/policy-number-label`: identity `not-established`, `context-dependent`.
- `.../collision/public-payer-identifier-label`: identity `invalid` for this kind, `non-sensitive` under the organization reading.
- `.../ambiguous/medicare-number-label`: identity `not-established`, `sensitive`; the synthetic token deliberately does not follow the CMS format.

No span is asserted for any of them. `invalid` is relative to the member-id kind only.

## Unresolved

- Whether member id and subscriber id should be one kind or two; needs a payer-documented label source.
- Whether bare policy/coverage numbers are beneficiary numbers under 164.514, by holder.
- No public payer or plan identifier directory (license, value examples, current HPID/XV status) was read, so no public-identifier values are recorded.
- Whether to model the MBI as its own kind (recommended, not done).
- Non-US regimes (health cards, national insurance numbers) are not researched.
- Label vocabulary is project-authored. Last 9000 characters of the FHIR Coverage page were not read.

## Schema notes

No schema gap blocked this work. A deferred role has no kind id, so not-established cases name the member-id kind and say so; they should move to new case ids if a kind is added.

## Snapshot impact

None for released snapshots (immutable). The next snapshot after merge gains three claims and five cases plus their projected fixtures.

## Needs human

- Approve or reject the add/context-only/defer/split/reject recommendations.
- Decide on an MBI kind. All records stay `unreviewed`.

## Checks run

`npm run check`. No scanner was run or consulted. No formatter exists.
