# Review requirements

Status: accepted. Applies with [safe-data policy](safe-data-policy.md) and [provenance and licensing](provenance-and-licensing.md).

## Principle

Project-maintained evidence is not independent validation. A maintainer reviewing project-authored evidence produces maintainer review, recorded as such. A review is called independent only when the reviewer has no authorship of, or stake in, the reviewed evidence and the record says so. Unresolved evidence stays unresolved; a lint, schema or expectation is not weakened to make a change pass.

## Who reviews

| Change | Review needed | Reviewer |
| --- | --- | --- |
| Reserved or synthetic values, authored cases, structural descriptions | pull request review, safe-data checklist answered | a maintainer other than the author when one is available; otherwise the maintainer, recorded as self-review |
| Citation-only source (standard, authority, provider documentation) | pull request review; reviewer confirms the source says what `proves` claims | a maintainer |
| Public example with documented test values (rank 3) | the above, plus the reviewer opens the cited publication and confirms the value is listed | a maintainer |
| Naturally occurring public example | `reviewed` state with a `review-event`; minimization record checked against the original | a maintainer who did not author the change |
| Licensed corpus import | `reviewed` state with a `review-event`; license and redistribution terms read by the reviewer; transformation record checked | a maintainer who did not author the change; legal input when terms are unclear |
| Allowlist entry | the reviewer confirms the cited publication lists that exact value | a maintainer |
| Snapshot release | `--public-release` provenance lint passes; safe-data lint passes; history scan done for the release range | a maintainer |
| Suspected real data | stop; private security advisory | a maintainer through the advisory |

Agents never mark their own work `reviewed`, never upgrade an evidence class, and never merge a change outside the authority granted in `AGENTS.md`.

## Review records

A source or claim is `reviewed` only when `review.events` lists at least one `review-event` record (`schemas/v1/review-event.schema.json`): reviewer handle, `reviewerKind` (`human` or `agent`), `independent`, `decision` and time. `independent` is `true` only when the independence condition above holds. Public text must not describe evidence whose events are all `independent: false` as independently validated.

## What a reviewer checks

Use `.agents/skills/safe-data-review` and `.agents/skills/boundary-review`.

1. Every value has provenance: reserved or test namespace, documented generator rule, linked public example, or reviewed licensed corpus. Resemblance to a valid format, age, revocation or a scanner verdict is not provenance.
2. Medical wording near an identifier does not describe a real patient or event; no real name sits next to an identifier.
3. Source excerpts quote the statement, not surrounding data.
4. No protected corpus material or marker; no PERSON/NER content; no scanner or product-policy vocabulary.
5. License and redistribution terms cover public redistribution; `observedAt` and exact version or date are present.
6. `npm run lint:privacy-data`, `npm run lint:credentials` and `npm run lint:provenance` pass, and the reviewer did not need to print a value to judge the change.

A reviewer who finds possible real data stops and follows section 7 of the safe-data policy.
