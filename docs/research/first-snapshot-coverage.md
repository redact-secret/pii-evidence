# First public snapshot: coverage and exclusions

Snapshot id `public-pii-phi/2026-10-07/9d4e8e036bbb` (content digest `9d4e8e036bbb180fb3a09569a2993e51ad10fbc183765882325f2bc10b321ba2`). The manifest in `snapshots/public-pii-phi/2026-10-07/9d4e8e036bbb/manifest.json` is authoritative; this page explains the decisions behind it. All evidence is project-maintained and unreviewed (every review state is `unreviewed`); nothing here is independent validation.

## Result

Of 82 authored cases, 49 are included, with 139 fixtures (8 in-scope pairs skipped, listed in `skipped.jsonl`), 14 sources and 24 claims. 33 cases (102 fixtures), 3 sources and 3 claims are excluded. The honest result is smaller than the seed: the three structured kinds `iban`, `payment-card` and most of `phone` are absent because their provenance is unresolved.

| Kind | Cases | Fixtures |
| --- | --- | --- |
| `email/global/basic` (includes the PII to PHI context case and its no-context twin) | 20 | 92 |
| `us-ssn/us/structured` | 11 | 9 |
| `medical-record-number/us/labeled-field` (PII and PHI) | 9 | 17 |
| `health-plan-member-id/us/member-field` (PII and PHI) | 5 | 9 |
| `phone/global/basic` (only the medical-context case and its twin) | 2 | 10 |
| `health-claim-identifier/us/claim-field` | 1 | 1 |
| `prescription-order-identifier/us/order-field` | 1 | 1 |

Jurisdictions `global` and `us`; contexts `medical/global/general`, `health-plan/us/general`, `field-label/global/general`; domains `pii` and `phi`. Languages are not asserted. Kinds with no case: `iban/global/basic`, `payment-card/global/basic`, `national-id/unresolved/placeholder`.

## Sources made public-safe in this change

Ordinary evidence edits (license record and `observedAt` only; no review state or evidence class changed). Each was read on 2026-10-07:

| Source | Established terms |
| --- | --- |
| `phi-hl7-identifier-type-table` | the code system page states the material is HL7 Terminology (THO), copyright Health Level Seven International, "made available under the CC0 designation"; license page https://terminology.hl7.org/license.html |
| `phi-cms-mbi-format` | the CMS "Link to Us" page states "CMS.gov ... is a public domain web site"; the PDF carries no separate notice (recorded) |
| `us-ssn/ssa-randomization` | SSA website policy: content prepared by SSA staff as federal employees is public domain, not protected by copyright. The policy pages returned HTTP 403 to direct fetch, so the statement was read as a search-result excerpt of those pages (recorded in the terms) |

## Excluded sources

| Source | Reason |
| --- | --- |
| `iban/swift-registry` | the page returned HTTP 403, nothing was read; class is `research-needed`; redistribution `unknown` |
| `payment-card/stripe-testing` | the page was read and states no documentation license or reuse terms; redistribution stays `unknown` |
| `phone/itu-e164` | ITU states it holds copyright and reproduction needs permission; no permission or open license for the recommendation was found; redistribution stays `unknown` |

Excluded claims: `iban/registry-authority`, `payment-card/stripe-test-numbers`, `phone/e164-maximum-length`. Their references were removed from the bundled taxonomy copy (three kinds), each recorded in `exclusions.taxonomyClaimRefsRemoved`.

## Excluded cases

8 cases cite an excluded source or claim. The other 25 are excluded only because they relate to an excluded case: relationships carry no direction, and a snapshot copies records verbatim, so an included case must not point at a missing case. This is conservative (for example the IBAN positives are sourced from a public-safe reference but relate to two unresolved mutations). All 11 `iban` cases, all 11 `payment-card` cases and 9 of 11 `phone` cases are excluded. The manifest lists each case with its reasons.

Settling these would restore them in a later snapshot: read and record the SWIFT registry terms, the Stripe documentation terms, and ITU's terms (or replace the sources with redistributable ones), or author the unresolved mutations separately from the positives.

## Decisions recorded

- Cases that cite no source (authored baseline, adversarial and `research-needed`) are not gated by sources. They are included with their evidence class unchanged. The five included `research-needed` cases assert only `not-established`.
- Cases are not gated on review state beyond `rejected`; no case is `reviewed`.
- The taxonomy is included as vocabulary, not corpus.
- No scanner was run or consulted; nothing here encodes support status, thresholds or current scanner behavior.
