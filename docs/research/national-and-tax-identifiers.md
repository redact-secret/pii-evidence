# National and tax identifiers beyond US SSN: recommendations

Status: draft, unreviewed agent work (observed 2026-10-07). Nothing here is independent validation. Records: kind `uk-nino/uk/structured` in `taxonomy/privacy-kinds.json` (jurisdiction `uk` added to `taxonomy/jurisdictions.json`), source `evidence/sources/uk-nino-sources.jsonl`, claims `evidence/claims/uk-nino-claims.jsonl`, cases `evidence/cases/uk-nino-cases.jsonl`. The placeholder `national-id/unresolved/placeholder` stays and now points here.

## Rule applied

A kind or case is authored only when a public authority documents the format and a safe value exists: a documented example, a reserved or never-assigned range, or a value that cannot be issued. Otherwise the family is recorded as deferred or rejected. No issuable-looking national or tax number is published, even when the page that documents it calls it fictional.

## Established (source-stated; locators in the claims)

- HMRC National Insurance Manual NIM39110 (Open Government Licence v3.0, read in full 2026-10-07): a NINO is 2 letters, 6 digits and a final letter A-D; the letters D, F, I, Q, U, V are never prefix letters; O is never the second letter; prefixes BG, GB, KN, NK, NT, TN, ZZ are not to be used; `QQ 12 34 56 A` is an example only. The page also names administrative NINO-lookalikes (OO, FY, NC, PZ, TN, and PP999999P) and the TRN (`11 a1 11 11`, not a NINO).
- Canada.ca SIN page (read 2026-10-07, page dated 2026-10-05): a SIN is a 9-digit identifier, private, and a SIN of a temporary resident starts with 9 and expires with the immigration documents. No checksum, reserved or example value is stated on that page.
- Finland DVV personal identity code page (read 2026-10-07): the code is `ddmmyy`, a century separator (`+` for the 1800s, `-` or `Y` for the 1900s, `A` for the 2000s), a 3-digit individual number (odd for men, even for women, in practice 002-899 issued) and a control character computed as the nine-digit number modulo 31. The page example belongs to a fictional named person but is an issuable-range code.

## Recommendations

| Candidate | Recommendation |
| --- | --- |
| UK National Insurance number (personal) | **add**: seven cases, never-used prefix Q as the safe-value rule |
| Canada SIN (personal) | **defer**: format known only as 9 digits; no reserved or example value read. Next step: the Government of Canada validation page (unreachable during this run) for the check-digit rule and any documented test value |
| Finland personal identity code (personal) | **defer**: structure and check character documented, but no reserved value on the page read; the 900-999 test-range statement is in the Finnish decree and was not read, so it is not claimed |
| US ITIN (personal) | **defer**: the existing claim `us-ssn/reference-itin-format` and one collision case cover only the shape; a dedicated kind needs the IRS publication, which was not read |
| US EIN | **reject as personal**: an employer identification number is a business or entity identifier (sole proprietors can hold one, which makes it holder-dependent); revisit as a separate public/business-id profile |
| South Korea resident registration number (personal) | **defer**: not researched; needs the statute or MOIS source, a documented check-digit rule and a never-issued value |
| Selected EU identifiers (Spain DNI/NIE, Germany tax ID, France NIR, Sweden personnummer, others) | **defer**: not researched in this run; Sweden's tax authority and similar bodies that publish synthetic test numbers are the leads |
| Business and public identifiers (VAT numbers, company numbers) | **reject for the personal-id kinds**: public registry values are not personal data; model as a separate public-identifier family if wanted |

## Cases (UK NINO)

Positive `labeled-spaced-example`; twin `compact-example`; negatives `suffix-letter-outside-a-d`, `excluded-prefix`, `too-few-digits`; collision `pension-reporting-placeholder`; ambiguous `unlabeled-example-under-tracking-label`. Values are the HMRC page example and variants that keep the never-used prefix Q (or an excluded prefix), so none can belong to a person. Identity `valid` on the positive means structure only.

## Unresolved

- Whether a NINO is phi in any context; no medical context claim is made.
- The label vocabulary is project-authored (field-label context stays research-needed).
- Prefix exclusions are as stated on the page at observation time.
- Personal vs business status of tax numbers by jurisdiction (EIN, VAT, company numbers) is not modeled.

## Schema notes

No gap blocked this work. A documented example whose structure is valid but which is not issued is modeled as identity `valid` with an `uncertain` ambiguity that says so, following the payment-card test-number convention; an unassignable structure variation is `invalid`. The `uk` jurisdiction id was added; no sub-national profiles.

## Snapshot impact

None for released snapshots (immutable). The next snapshot gains one kind, one jurisdiction, one source, two claims and seven cases; existing carrier rules project derived fixtures from them (untracked, regenerated).

## Needs human

- Approve or reject the recommendations; prioritize Canada, Finland, Korea and EU follow-up research. All records stay `unreviewed`.

## Checks run

`npm run check`. No scanner was run or consulted. No formatter exists.
