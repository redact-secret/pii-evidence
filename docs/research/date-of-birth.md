# Date of birth as bounded contextual PII/PHI: recommendations

## Locale-order follow-up, observed 2026-10-08

The historical recommendations below are superseded only for the numeric-locale context. [Unicode CLDR JSON 48.0.0 en-GB Gregorian data](https://raw.githubusercontent.com/unicode-org/cldr-json/48.0.0/cldr-json/cldr-dates-full/main/en-GB/ca-gregorian.json) documents day/month/year order; [the versioned en data](https://raw.githubusercontent.com/unicode-org/cldr-json/48.0.0/cldr-json/cldr-dates-full/main/en/ca-gregorian.json) documents month/day/year order. For en-US, [identity-only en_US](https://raw.githubusercontent.com/unicode-org/cldr/release-48/common/main/en_US.xml), [default-content metadata](https://raw.githubusercontent.com/unicode-org/cldr/release-48/common/supplemental/supplementalMetadata.xml) and [parent-locale data](https://raw.githubusercontent.com/unicode-org/cldr/release-48/common/supplemental/supplementalData.xml) establish the en_US-to-en inheritance path. These are formatter locale facts, not universal country rules or DOB parser grammars.

Accepted context-only: `date-locale/global/en-gb` and `date-locale/global/en-us`, bounded by literal locale declarations applying to a labeled DOB field. Two new context Cases retain the existing synthetic date digits and differ only in the declared locale. Both retain global jurisdiction because locale is metadata, not inferred residence or legal jurisdiction. The original unspecified-locale Case remains date-order ambiguous; identity valid concerns the DOB role, not actual date assignment. No new kind or PHI duplicate is created.

New source `dob-unicode-cldr-date-patterns`, two `dob-cldr` claims, and the contexts/Cases are project-maintained and unreviewed. The Unicode-3.0 copyright and permission notice is retained in [unicode-license.txt](../governance/unicode-license.txt). No personal source examples are copied. DOB labels and application of formatting order to these hypothetical fields remain explicit authored inference; application overrides and other calendars remain unresolved.


Status: draft, unreviewed agent work (observed 2026-10-07). Nothing here is independent validation. Records: kind `date-of-birth/global/labeled-field` in `taxonomy/privacy-kinds.json`, sources `evidence/sources/date-of-birth-sources.jsonl`, claims `evidence/claims/date-of-birth-claims.jsonl`, cases `evidence/cases/date-of-birth-cases.jsonl`. Generic date detection and PERSON/name evidence are out of scope.

## Established (source-stated; locators in the claims)

- 45 CFR 164.514(b)(2)(i)(C) lists all elements of dates (except year) directly related to an individual, including birth date, plus ages over 89 and date elements indicative of such age (aggregable into "90 or older"), among safe-harbor identifiers.
- FHIR R4 `Patient.birthDate` is an optional `date` "for the individual"; the FHIR `date` type is YYYY, YYYY-MM or YYYY-MM-DD, no time zone, and dates SHALL be valid.
- RFC 3339 `full-date` fixes year-month-day order with month 01-12 and a month-dependent day range.

## Inferred (project reasoning)

- A birth date is recognized by a label (date of birth, DOB, birth date) plus a date, never by a bare date. The label vocabulary is project-authored.
- Base domain is `pii`; a medical context adds `phi` (modeled as `adds-domain`, backed by the HIPAA claim). `pii` and `phi` are domain axes: no PHI duplicate kind exists.
- Impossible calendar dates, format hints and unlabeled/unrelated dates are not instances.
- Numeric day/month order by locale is not documented by any source read; the order-ambiguity case is inference.

## Recommendations

| Candidate | Recommendation |
| --- | --- |
| Labeled birth date (`DOB`, `Date of birth`) | **add**, as the new kind (classification `unresolved`, evidence class `research-needed` for the label signal) |
| Medical-context birth date | **context-only**: occurrence of the same kind with `medical/global/general` adding `phi` |
| Locale-ordered numeric dates | **context-only** ambiguity case; defer a locale context until a source documents orders |
| Age, including ages over 89 | **defer**; separate kind or context candidate, two cases record the boundary |
| Year-only birth value | **defer**; ambiguous case, no kind |
| Admission, discharge, death and other individual dates | **defer**; a possible "individual date" kind, not birth-specific |
| Bare dates with no label | **reject** (generic date detection out of scope) |

## Cases (all synthetic 1800s dates, no name or other identifier)

Positive `labeled-iso-date`; context `medical-labeled-date` (adds phi); ambiguous `numeric-day-month-order`, `age-over-89`, `year-only-birth-label`; negative `impossible-calendar-date`, `label-without-value`, `format-placeholder-label`, `age-under-90`; twin `date-under-non-birth-label`. Only the positive and medical cases and the order case carry spans. The dates are earlier than any person who could be living, which is a project design choice, not a reserved set; no authority reserves birth dates.

## Unresolved

- Whether a birth date alone outside a medical context is PHI (holder-dependent).
- Label vocabulary and the locale order of numeric forms: no source read.
- HL7 v2 PID-7 and non-US regimes (for example EU or UK definitions) were not researched.
- Whether to model age and other individual dates; the HIPAA date list was read only through the eCFR rendering.
- Case jurisdiction for the HIPAA-based cases is `us`; the kind spans `global` and `us`.

## Schema notes

No schema gap blocked this work. Ids may not contain the word "precision" (benchmark-score id rule), so the claim is named `date-notation`. Context `medical/global/general` has no bounded signal source, so the medical case uses the project-authored patient label.

## Snapshot impact

None for released snapshots (immutable). The next snapshot gains one kind, two sources, four claims and ten cases. Existing carrier rules project 18 derived fixtures from the new cases (untracked, regenerated).

## Needs human

- Approve or reject the recommendations; decide on an age kind and individual-date kind. All records stay `unreviewed`.

## Checks run

`npm run check`. No scanner was run or consulted. No formatter exists.
