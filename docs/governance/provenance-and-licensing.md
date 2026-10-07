# Provenance and licensing

Status: accepted.

**Authority.** The JSON Schema for sources (`schemas/v1/`, issue #3) is the structural authority: field names, types and enumerations. This document is the policy authority: which fields are required, what values are acceptable, and what makes a source releasable. Field names below follow ARCHITECTURE.md section 9 in camelCase, like `taxonomy/*.json`, so the schema can mirror them. If the schema and this document differ, the schema decides structure, this document decides policy, and the difference is reconciled in this document (see "Reconciliation" at the end).

`scripts/lint-provenance.mjs` enforces the policy rules a schema cannot express.

## 1. Evidence classes

Every source and every claim carries one class (ARCHITECTURE.md section 8; descriptions in `.agents/skills/_shared/evidence-classes.md`).

| Class | Use when |
| --- | --- |
| `public-authority` | a government or regulator states it |
| `provider-documented` | an issuer or vendor documents it |
| `standards-body` | a standards body publishes it |
| `reference-backed` | a reputable reference or specification summarises it |
| `licensed-corpus` | a redistributable corpus with recorded license and privacy review |
| `authored-baseline` | project-authored ordinary case; reasoning stated |
| `authored-adversarial` | project-authored hard case |
| `tool-corroborated` | a tool agrees; corroboration only, never the sole basis |
| `research-needed` | unresolved; say what would settle it |

Scanner consensus and scanner output are never ground truth. If that is the only support, the class is `research-needed`. An agent never upgrades a class on its own judgment.

## 2. Required provenance fields

Field names are those of `schemas/v1/source.schema.json`. Every source record under `evidence/sources/` has:

| Field | Meaning | Policy rule |
| --- | --- | --- |
| `id` | stable lowercase URL-safe id | no issue numbers, milestones, scanner names or scores |
| `title` | name of the source | required |
| `locator` | exact source location (URL or citation) | required |
| `version` | exact edition, version, revision or publication date | required |
| `observedAt` | date the source was read, `YYYY-MM-DD` | required |
| `license` | `{ name, redistribution, terms }` | `name` is an SPDX id or the license name as stated by the source; `terms` states what is permitted, including attribution |
| `license.redistribution` | `allowed`, `restricted`, `prohibited` or `unknown` | only `allowed` can be `public-safe` |
| `evidenceClass` | one class from section 1 | required |
| `transformations` | transformation and minimization steps | required; `[]` only when nothing was changed; non-empty for imported corpora |
| `naturallyOccurringPersonalData` | boolean | required; `true` triggers section 4 |
| `valueOrigin` | `synthetic`, `reserved`, `public-test` or `licensed-corpus` | required; exactly one origin per source |
| `review` | `{ state, events }`, `state` is `unreviewed`, `in-review`, `reviewed` or `rejected` | required; `events` lists `review-event` ids; `reviewed` needs at least one |

"What the source proves" is recorded on each Claim (`claim.statement`, `claim.location`), not on the source. A source that only cites a public document (a standard or authority page, no text copied) uses `redistribution: allowed` and states "cited by section only" in `terms`. A source that contributes no values still states the origin of any example values it supports; use `reserved` or `synthetic` when it contributes none.

The schema forbids unknown fields. In particular a source cannot carry a declared readiness: readiness is always derived by the lint (section 5).

## 3. Imported corpora

An imported corpus (`evidenceClass: licensed-corpus` or `valueOrigin: licensed-corpus`) must record, before any content is committed:

- a definite `license.name`;
- `license.redistribution: allowed` with `terms` that cover redistribution of the exact excerpt in a public repository (not just research or internal use);
- the exact `version` and `locator` of the corpus;
- a non-empty `transformations` record (what was dropped, masked or reduced, and why the remainder is sufficient and safe);
- `naturallyOccurringPersonalData` stated explicitly, and `review.state: reviewed` backed by at least one `review-event` with a named reviewer.

A missing license or redistribution field is a lint error. `restricted` or `unknown` redistribution makes the source `unresolved`; `prohibited` makes it `blocked`. A corpus obtained under terms that forbid public redistribution, or from a protected custody path, is never imported.

## 4. Naturally occurring personal data

`naturallyOccurringPersonalData: true` requires `review.state: reviewed` and satisfies [the public-example rules](safe-data-policy.md#3-naturally-occurring-public-examples). Without a review the source is `unresolved`.

## 5. Public-release readiness

Each source is in exactly one state. The lint derives it; it is not taken on trust.

| State | Meaning | Derived when |
| --- | --- | --- |
| `public-safe` | complete, definite, releasable | all required fields valid; no protected marker; redistribution `allowed`; class is not `research-needed`; any review that is required is `reviewed` |
| `unresolved` | not yet decidable | a field is missing or invalid; class is `research-needed`; redistribution `restricted` or `unknown`; a required review is not `reviewed` |
| `blocked` | must not be released as is | a protected-corpus marker; `license.redistribution: prohibited`; review `rejected` |

How validation distinguishes them:

- Default `node scripts/lint-provenance.mjs`: structural errors (missing or invalid fields, malformed files, protected markers, blocked sources) exit 1. Unresolved sources that are structurally complete are allowed while research continues; they are listed as not public-release-ready and the summary says so.
- `--public-release`: any source that is not `public-safe` exits 1. Snapshot builds and releases use this mode.
- The summary prints counts per state and, per source, the reasons (field names only, never values).

A snapshot may include only `public-safe` sources. The snapshot manifest records the provenance and privacy validation result (ARCHITECTURE.md section 10).

## 6. Review

A `reviewed` state is required before a source can be `public-safe` when it is a licensed corpus or carries naturally occurring personal data. Other sources may stay `unreviewed`; maintainers review them in the pull request. The lint checks the source's `review.state` and that `reviewed` has events; the independence of each event (`review-event.independent`) is checked at snapshot time against the event records. Project-maintained review is not independent validation. See [review requirements](review-requirements.md).

## Reconciliation with the schema (#3)

This document was first drafted before the source schema merged, then reconciled against `schemas/v1/source.schema.json` and `schemas/v1/review-event.schema.json`. Differences found and resolved in favor of the schema:

| First draft | Schema (authority) |
| --- | --- |
| `source: { location, version, date }` | `title`, `locator`, `version` (a publication date is a valid `version`) |
| `license` string plus `redistribution: { status, terms }` | `license: { name, redistribution, terms }` |
| redistribution statuses incl. `citation-only`, `unresolved` | `allowed`, `restricted`, `prohibited`, `unknown` |
| `transformation` | `transformations` |
| `valueOrigin` array, `[]` for none | single enum value |
| `review.state: approved`, inline `reviewers` | `review.state: reviewed`, `review.events` pointing at `review-event` records |
| `proves` on the source | `statement` and `location` on the Claim |
| declared `releaseReadiness` | not in the schema; readiness is derived only |

Policy rules that are not structural stay here and in the lint: protected-marker failure, readiness derivation, and the review requirement for licensed corpora and naturally occurring personal data. If the schema changes, update this document and `scripts/lint-provenance.mjs` together.
