# Same-value context twins: findings, gaps and impact

Status: draft, unreviewed agent work (observed 2026-10-07). Nothing here is independent validation. Records: `evidence/sources/context-twin-sources.jsonl`, `evidence/claims/context-twin-claims.jsonl`, `evidence/cases/context-twin-cases.jsonl`. No taxonomy, schema or snapshot file was changed.

## Question

How does one structured value change classification across patient/clinical, customer/account, documentation/example, billing/administrative and neutral contexts? Each twin group holds the value fixed and changes only the leading label.

## Findings

**Established** (source-stated; see the claim records)

- 45 CFR 160.103: individually identifiable health information must relate to health, care, or payment for care, be held by a listed holder type, and identify the individual. Health status alone is not the trigger.
- 45 CFR 164.514(a): information that does not identify an individual is not individually identifiable health information.
- 45 CFR 164.514(b)(2)(i): email, telephone, social security and account numbers are on the safe-harbor identifier list.

**Inferred** (project reasoning, marked on each claim or case)

- A context adds the phi domain to the occurrence only when a health, care or payment-for-care relationship is signalled. A customer label does not. A billing label alone does not either; the health-plan context is the composed signal.
- Context never changes identity: a never-assigned SSN stays `invalid` under a patient label.
- Reading payment cards and IBANs as "account numbers" is inference; the list does not name them.

## Twin groups

| Group | Value | Cases (new / existing) | Contexts covered |
| --- | --- | --- | --- |
| email | reserved example.com mailbox | 3 / 2 | patient, customer, billing, documentation, neutral |
| phone | reserved 555-0100 | 3 / 2 | same |
| us-ssn | never-assigned 000-12-3456 | 4 / 1 | same; identity `invalid` throughout |
| payment-card | provider-documented test number | 4 / 1 | same |
| iban | published documentation example | 4 / 1 | same |

Expectations: patient and billing (health-plan) are `context-dependent`, domains `[pii, phi]`, `uncertain`; customer is `sensitive`, `[pii]`, no ambiguity; documentation is `context-dependent`, `[pii]`, `ambiguous`; neutral reuses the existing baseline case. For `invalid` SSN twins the sensitivity is `non-sensitive` and the phi domain follows the repository convention (candidate domains recorded for invalid cases).

## Unresolved

- Documentation/example: is a self-declared example sensitive? No source settles it; the cases are authored as ambiguities, not expectations. Needs a project decision with cited reasoning.
- Holder dependence: the regulation applies to listed holders; customer data held by a non-covered business is not covered here. Employer-held and education-record exclusions were not worked through.
- Billing: when does a billing or administrative record count as payment for care? Other jurisdictions (GDPR health data, for example) are not researched.
- The signal vocabulary for medical and health-plan contexts is still project-authored; both contexts stay `research-needed`.
- Neutral context for payment-card and IBAN reuses the existing baselines, whose text uses a different label; they are not strictly one-property twins of the new cases.

## Schema notes

- There are no `customer-account`, `documentation-example` or `billing-administrative` context profiles. Customer and documentation twins use `contexts: []`, so the distinction lives in the label text and rationale only. A future taxonomy change could add profiles with `addsDomains: []`; not done here because context claims need sources first.
- Twin relationships are directional in the schema; new cases link to every other member of the group, but the five existing baseline and patient cases were not edited to link back. Reciprocity is not validated.
- `expectation.sensitivity` has no value for "example, policy undecided"; `context-dependent` plus `ambiguous` is used.

## Snapshot impact

None for the released snapshot `public-pii-phi/2026-10-07/9d4e8e036bbb`, which is immutable. These 18 cases, 1 source and 3 claims would enter the next snapshot only through a reviewed snapshot build. Payment-card and IBAN sources have unresolved or excluded redistribution status in the first snapshot, so those twin groups may be excluded again until that is settled.

## Safe fixture and projection ideas

Existing plain-text projection rules apply to twins; a label-swap rule over one case would generate the context axis deterministically, but the expectation must stay authored per context, so it is left as a proposal.
