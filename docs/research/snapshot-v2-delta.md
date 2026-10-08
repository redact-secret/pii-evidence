# Snapshot v2 candidate coverage delta

Project-maintained evidence, not independent validation or product qualification.

Baseline: `public-pii-phi/2026-10-07/9d4e8e036bbb`. Candidate: `public-pii-phi/2026-10-08/ee61c7afc32d`. Both are pinned by manifest SHA-256 in snapshot-v2-candidate.json.

## Denominators

Cases: 49 -> 118 (+69). Fixtures: 139 -> 285 (+146). Counts include only these public evidence snapshots; no scanner or protected population is added.

## Taxonomy

- kinds: added `date-of-birth/global/labeled-field`, `uk-nino/uk/structured`; removed none; changed `health-claim-identifier/us/claim-field`, `health-plan-member-id/us/member-field`, `medical-record-number/us/labeled-field`, `national-id/unresolved/placeholder`, `prescription-order-identifier/us/order-field`.
- contexts: added `date-locale/global/en-gb`, `date-locale/global/en-us`; removed none; changed none.
- jurisdictions: added `uk`; removed none; changed none.

Kinds without accepted cases: `iban/global/basic`, `national-id/unresolved/placeholder`, `payment-card/global/basic`.

## Evidence and review

- cases: 69 added, 0 removed, 0 changed.
- fixtures: 146 added, 0 removed, 0 changed.
- claims: 30 added, 0 removed, 0 changed.
- sources: 14 added, 0 removed, 0 changed.
- review-events: 0 added, 0 removed, 0 changed.
- fixture-rules: 0 added, 0 removed, 0 changed.

Exact IDs, source changes, review-state counts, exclusions and per-kind case/fixture denominators are in [snapshot-v2-delta.json](snapshot-v2-delta.json).

## Adjudication and unresolved inventory

- add: 61 research decisions.
- context-only: 15 research decisions.
- defer: 44 research decisions.
- reject: 23 research decisions.

- `case-strengthening/assignable-ssn-itin-near-shapes` (reject, research #23): Decision and rationale remain in the adjudication ledger.
- `case-strengthening/covered-holder-and-other-jurisdictions` (defer, research #20): HIPAA holder exclusions and GDPR health contexts require separate source-backed review.
- `case-strengthening/deeper-nesting-and-serialization-chains` (defer, research #21): One nesting level accepted; new chains need authored scope and exact spans.
- `case-strengthening/documentation-ip-ranges` (defer, research #22): IP taxonomy and domain contracts are outside this bounded promotion.
- `case-strengthening/domestic-bank-card-phone-collisions` (defer, research #23): New domestic format and allocation sources not reviewed.
- `case-strengthening/ein-near-shape` (defer, research #23): Format authority and safe-value range not established.
- `case-strengthening/encoding-and-decoded-span-schema` (defer, research #21): Raw versus decoded scope and discontiguous decoded spans require explicit consumer agreement.
- `case-strengthening/historical-specimen-or-advertising-identifiers` (reject, research #22): Decision and rationale remain in the adjudication ledger.
- `case-strengthening/label-overrides-shape-policy` (reject, research #23): Decision and rationale remain in the adjudication ledger.
- `case-strengthening/label-swap-generation` (reject, research #20): Decision and rationale remain in the adjudication ledger.
- `case-strengthening/masked-sensitivity-role-mailbox-and-localhost-decisions` (defer, research #22): Retain current ambiguities; PCI/RFC2142 and data-protection reasoning is not reviewed.
- `case-strengthening/payment-card-iban-carrier-expansion` (defer, research #21): Grouping/spacing semantics and publication-safe source closure need kind-specific review.
- `case-strengthening/quoted-printable-html-base64-double-encoding` (defer, research #21): No reviewed authored semantics or representation contract.
- `case-strengthening/real-shaped-degenerate-digit-placeholders` (defer, research #22): No documented reserved source or proven unassignability; never bypass safety lint.
- `case-strengthening/reserved-means-non-sensitive` (reject, research #22): Decision and rationale remain in the adjudication ledger.
- `case-strengthening/sensitive-pointer-context-twins` (defer, research #24): Pointer sensitivity lacks reviewed authority and bounded context.
- `case-strengthening/text-level-no-value-enum-and-negative-regions` (defer, research #24): Semantic contract change requires consumer agreement; current invalid absence convention is preserved explicitly.
- `case-strengthening/tsv-unix-delimiters-formula-prefixes` (defer, research #21): No bounded reviewed candidate; formula execution is not a privacy identity rule.
- `email/global/basic/ambiguous/json-unicode-escaped-at-sign` (defer, research #21): JSON allows any character to be escaped, so the encoded form is legitimate and decodes to the baseline mailbox. Raw-text versus decoded-value scope is undecided, as for the percent-encoded twin.
- `email/global/basic/ambiguous/masked-local-part` (add, research #22): Asterisk is not atext, so the string is not a mailbox as written. The retained first character and full domain still partly identify the address.
- `email/global/basic/ambiguous/percent-encoded-at-sign` (defer, research #21): The decoded octets equal a reserved mailbox, but the raw text is not a mailbox in the RFC 5322 grammar. Which representation an expectation addresses (raw bytes or decoded value) is a project decision; a span over the encoded token would assume one.
- `email/global/basic/ambiguous/role-address-reserved-domain` (add, research #22): Syntactically a mailbox at a reserved domain. A role address does not name an individual, but role-versus-person is not decided by the grammar; no source on role mailboxes was read.
- `email/global/basic/ambiguous/single-label-localhost-domain` (add, research #22): A single-label domain is grammatical under the RFC 5322 dot-atom rule but not a public mail domain. The reserved name is non-attributable, which the label does not make non-sensitive in every policy.
- `email/global/basic/ambiguous/trailing-ideographic-full-stop` (add, research #21): RFC 6531 extends atext with non-ASCII characters in the local part, but this character follows the domain, where the grammar is a different question. An IDNA treatment of this character as a dot was not read, so whether it belongs to the domain is unresolved. The ASCII-period counterpart is already an authored positive with the period excluded.
- `email/global/basic/negative/all-x-placeholder` (add, research #22): Grammatically a mailbox; the placeholder reading rests on convention while the reserved top-level name only establishes that it cannot be delivered. Whether a placeholder-shaped but syntactically valid string is an identity at all is a policy question.
- `email/global/basic/twin/billing-same-value` (add, research #20): The health-plan context is research-needed in the taxonomy; the billing label is project-authored. Payment for care is within the regulation's definition only for a listed holder; a billing record outside that setting is not established as phi.
- `email/global/basic/twin/docs-same-value` (add, research #20): The label states the value is an example, but the identical text would also be written about a real value; the classification of a self-declared example is a policy question the evidence does not settle. The value is reserved or provider-documented as non-attributable, which the label alone cannot prove.
- `health-plan-member-id/us/member-field/collision/group-number-label` (add, research #23): A group or policy number can identify a coverage shared by many people rather than one person. Whether such an identifier is within the health plan beneficiary number category was not read.
- `iban/global/basic/ambiguous/masked-middle` (add, research #22): Asterisks are not alphanumeric, so the mod 97 check cannot be satisfied. Whether a retained fragment is sensitive depends on policy.
- `iban/global/basic/twin/billing-same-value` (add, research #20): The health-plan context is research-needed in the taxonomy; the billing label is project-authored. Payment for care is within the regulation's definition only for a listed holder; a billing record outside that setting is not established as phi.
- `iban/global/basic/twin/docs-same-value` (add, research #20): The label states the value is an example, but the identical text would also be written about a real value; the classification of a self-declared example is a policy question the evidence does not settle. The value is reserved or provider-documented as non-attributable, which the label alone cannot prove.
- `iban/global/basic/twin/patient-same-value` (add, research #20): The medical-context claim for this kind is research-needed in the taxonomy; an explicit patient label is a project-authored signal. Whether the phi domain applies depends on the holder type and on bounded signals that are not established.
- `medical-record-number/us/labeled-field/collision/generic-patient-id-label` (add, research #23): The label does not name a medical record number; a patient may carry several identifiers. No format is defined, so shape cannot select among them.
- `medical-record-number/us/labeled-field/collision/order-label-in-clinical-context` (add, research #23): An order label names a different identifier role from a medical record number. The sources state no value format, so shape cannot separate the roles. The medical and field-label contexts are research-needed.
- `payment-card/global/basic/ambiguous/masked-first-six-last-four` (add, research #22): Asterisks are not digits, so the string cannot satisfy the check-digit method. Whether such a truncation is sensitive depends on policy; the PCI DSS rule on displayed PANs was not read.
- `payment-card/global/basic/collision/short-luhn-valid-reference` (add, research #23): The check digit and length are satisfied, so structure alone does not exclude a card number. Whether an issuer prefix beginning with 1 is allocated was not read.
- `payment-card/global/basic/twin/billing-same-value` (add, research #20): The health-plan context is research-needed in the taxonomy; the billing label is project-authored. Payment for care is within the regulation's definition only for a listed holder; a billing record outside that setting is not established as phi.
- `payment-card/global/basic/twin/docs-same-value` (add, research #20): The label states the value is an example, but the identical text would also be written about a real value; the classification of a self-declared example is a policy question the evidence does not settle. The value is reserved or provider-documented as non-attributable, which the label alone cannot prove.
- `payment-card/global/basic/twin/patient-same-value` (add, research #20): The medical-context claim for this kind is research-needed in the taxonomy; an explicit patient label is a project-authored signal. Whether the phi domain applies depends on the holder type and on bounded signals that are not established.
- `phone/global/basic/ambiguous/form-plus-read-as-space` (defer, research #21): Per form parsing the plus becomes a space, so the parsed value has no plus; the raw text still reads as an E.164-style number. A producer may have intended a literal plus without encoding it; the text alone does not say.
- `phone/global/basic/ambiguous/masked-keep-last-four` (add, research #22): Asterisks are not digits, so the string is not a complete number. Whether a retained final fragment is personal data depends on policy; no source on partial telephone numbers was read.
- `phone/global/basic/collision/dotted-groups-version-label` (add, research #23): Dotted three-part digit groups are used for both telephone numbers and numeric versions or OIDs. The label is the sole discriminator and no source ranks it.
- `phone/global/basic/collision/epoch-seconds-timestamp` (add, research #23): Length alone does not separate a timestamp from a ten-digit national number. Whether a leading digit of 1 is excluded as an area code was not read from a numbering-plan source.
- `phone/global/basic/collision/order-number-label-same-digits` (add, research #23): The digits fit a North American number and an order reference equally; only the label differs. No numbering-plan or order-reference source was read that makes a label authoritative.
- `phone/global/basic/twin/billing-same-value` (add, research #20): The health-plan context is research-needed in the taxonomy; the billing label is project-authored. Payment for care is within the regulation's definition only for a listed holder; a billing record outside that setting is not established as phi.
- `phone/global/basic/twin/docs-same-value` (add, research #20): The label states the value is an example, but the identical text would also be written about a real value; the classification of a self-declared example is a policy question the evidence does not settle. The value is reserved or provider-documented as non-attributable, which the label alone cannot prove.
- `prescription-order-identifier/us/order-field/collision/order-label-without-prescription-wording` (add, research #23): The label does not distinguish a prescription order from other orders. Without a medical context no recorded context adds phi.
- `us-ssn/us/structured/ambiguous/masked-keep-last-four` (add, research #22): Asterisks are not digits, so the string is not a complete SSN. Whether a retained serial fragment is sensitive depends on policy; no source was read.
- `us-ssn/us/structured/twin/billing-same-value` (add, research #20): Identity is settled as invalid; only the domain composition is open. The health-plan context is research-needed in the taxonomy and the label is project-authored.
- `us-ssn/us/structured/twin/docs-same-value` (add, research #20): The label states the value is an example, but the identical text would also be written about a real value; the classification of a self-declared example is a policy question the evidence does not settle. The value is reserved or provider-documented as non-attributable, which the label alone cannot prove.
- `admission-date` (defer, research #27): Need scoped kind, safe values and bounded occurrence signals.
- `age-over-89` (defer, research #27): Define separate role and calendar/holder semantics before expansion.
- `age-under-90` (defer, research #27): Define separate role and calendar/holder semantics before expansion.
- `canada-social-insurance-number` (defer, research #28): Research authority and safe values before canonical kind; source lead is recorded in originating research document, not an accepted claim.
- `company-registration-number` (reject, research #28): Holder-specific privacy semantics remain unresolved.
- `death-date` (defer, research #27): Need scoped kind, safe values and bounded occurrence signals.
- `dependent-identifier` (defer, research #26): Need bounded standalone semantics.
- `discharge-date` (defer, research #27): Need scoped kind, safe values and bounded occurrence signals.
- `encounter-identifier` (defer, research #25): Need person-linkage and bounded role contract.
- `encounter-visit-order-reference` (defer, research #29): Need scoped role/person linkage.
- `facility-bed-code` (reject, research #25): Reconsider only with provider documentation and safe values.
- `facility-department-code` (reject, research #25): Reconsider only with provider documentation and safe values.
- `facility-identifier` (reject, research #29): No patient-privacy kind here; individual practitioner privacy needs separate bounded analysis.
- `facility-local-code` (reject, research #25): Reconsider only with provider documentation and safe values.
- `facility-order-set-code` (reject, research #25): Reconsider only with provider documentation and safe values.
- `finland-personal-identity-code` (defer, research #28): Research authority and safe values before canonical kind; source lead is recorded in originating research document, not an accepted claim.
- `france-nir` (defer, research #28): Research authority and safe values before canonical kind; source lead is recorded in originating research document, not an accepted claim.
- `germany-tax-identifier` (defer, research #28): Research authority and safe values before canonical kind; source lead is recorded in originating research document, not an accepted claim.
- `health-plan-organization-identifier` (reject, research #26): Decision and rationale remain in the adjudication ledger.
- `healthcare-claim-identifier` (defer, research #29): Need bounded holder setting and person-linkage claim.
- `locale-numeric-birth-date` (context-only, research #27): Locales without an explicit declaration, application overrides and other calendars remain outside this bounded acceptance.
- `medicare-beneficiary-identifier` (defer, research #26): Prove reserved/test or deterministic non-issued value strategy, author MBI kind and contrasts.
- `organization-identifier` (reject, research #29): No patient-privacy kind here; individual practitioner privacy needs separate bounded analysis.
- `other-eu-personal-identifiers` (defer, research #28): Research authority and safe values before canonical kind; source lead is recorded in originating research document, not an accepted claim.
- `other-individual-date` (defer, research #27): Need scoped kind, safe values and bounded occurrence signals.
- `patient-account-claim-reference` (defer, research #29): Need scoped role/person linkage.
- `patient-account-number` (context-only, research #25): Standalone account kind and holder context remain deferred.
- `patient-external-identifier` (defer, research #25): Need bounded source-defined occurrence and source-backed person linkage; do not equate PI/PT with MR.
- `patient-internal-identifier` (defer, research #25): Need bounded source-defined occurrence and source-backed person linkage; do not equate PI/PT with MR.
- `payer-organization-identifier` (reject, research #26): Decision and rationale remain in the adjudication ledger.
- `pharmacist-license-number` (reject, research #29): No patient-privacy kind here; individual practitioner privacy needs separate bounded analysis.
- `pharmacy-identifier` (reject, research #29): No patient-privacy kind here; individual practitioner privacy needs separate bounded analysis.
- `policy-coverage-number` (defer, research #26): Need holder-specific person linkage.
- `prescription-order-identifier` (defer, research #29): Need pharmacy/provider role specification and safe values.
- `provider-npi` (reject, research #29): No patient-privacy kind here; individual practitioner privacy needs separate bounded analysis.
- `provider-number` (reject, research #29): No patient-privacy kind here; individual practitioner privacy needs separate bounded analysis.
- `south-korea-resident-registration-number` (defer, research #28): Research authority and safe values before canonical kind; source lead is recorded in originating research document, not an accepted claim.
- `spain-dni` (defer, research #28): Research authority and safe values before canonical kind; source lead is recorded in originating research document, not an accepted claim.
- `spain-nie` (defer, research #28): Research authority and safe values before canonical kind; source lead is recorded in originating research document, not an accepted claim.
- `state-practitioner-license` (reject, research #29): No patient-privacy kind here; individual practitioner privacy needs separate bounded analysis.
- `subscriber-identifier` (context-only, research #26): Member/subscriber taxonomy relationship remains unresolved.
- `sweden-personnummer` (defer, research #28): Research authority and safe values before canonical kind; source lead is recorded in originating research document, not an accepted claim.
- `unlabeled-generic-date` (reject, research #27): Decision and rationale remain in the adjudication ledger.
- `upin` (reject, research #29): No patient-privacy kind here; individual practitioner privacy needs separate bounded analysis.
- `us-employer-identification-number` (reject, research #28): Holder-specific privacy semantics remain unresolved.
- `us-individual-taxpayer-identification-number` (defer, research #28): Research authority and safe values before canonical kind; source lead is recorded in originating research document, not an accepted claim.
- `vat-number` (reject, research #28): Holder-specific privacy semantics remain unresolved.
- `visit-number` (defer, research #25): Need person-linkage and bounded role contract.
- `year-only-birth-value` (defer, research #27): Define separate role and calendar/holder semantics before expansion.

## Consumer handoff

Mapping expectations are declared metadata owned by pii-eval, not observed scanner behavior. Exact mapping additions, refusal states and semantic losses must be read with the separate candidate preflight report before adoption. The machine report retains the declared metadata without importing consumer code.

Counts describe these pinned public snapshots only; no scanner results, protected population or product qualification is inferred.
