---
name: author-case
description: Author one PII/PHI Case (positive, negative, ambiguous, benign twin, context or collision) with a scanner-neutral semantic expectation, cited evidence and synthetic values. Use when a kind lacks cases, a context needs a recorded expectation, or when asked whether a situation deserves a Case.
---

# Author a Case

A Case is authored reasoning about one situation: what is tested, the expected semantic
outcome, why it matters, the evidence basis, and the uncertainty. A fixture is only its
projection. The correct answer is sometimes "no new record" (the situation is a projection of
an existing Case). Read [scope boundary](../_shared/scope-boundary.md),
[domain modeling](../_shared/domain-modeling.md), [evidence classes](../_shared/evidence-classes.md),
[synthetic safety](../_shared/synthetic-safety.md), [neutrality wording](../_shared/neutrality-wording.md)
and `ARCHITECTURE.md` §7 first.

## Inputs

| Input | Required | Default when headless |
| --- | --- | --- |
| kind id (and jurisdiction) | yes | none; stop |
| the situation, one sentence | no | derive only from the kind's claims, open questions and known benign/lookalike structures; never from a scanner finding |

At most one Case per run.

## Steps

1. **Boundary check.** PERSON/name ambiguity belongs to `ner-evidence`. A Case needing PERSON +
   medical context references a `ner-evidence` snapshot; it does not import PERSON evidence.
2. **Read** the kind, its claims and every Case already naming it. A duplicate ends the run.
3. **Decide the shape:** positive, negative, ambiguous, benign twin, context, mutation or
   collision. If several fixtures share identical reasoning, write one Case and describe the
   projections; do not duplicate prose.
4. **Derive the expectation from evidence.** State identity (`valid | invalid | not-established`),
   sensitivity/context (`sensitive | non-sensitive | context-dependent`), expected exact span
   when applicable, jurisdiction match/mismatch, and `must-observe`/`must-not-observe` only
   where justified. Use a source-stated consequence. Where sources are silent or conflict, the
   outcome is `not-established`/`research-needed`, with the candidate outcomes and what would
   settle it. Scanner output or agreement is never the basis.
5. **Model PHI compositionally.** Ordinary PII in medical context is the base kind plus a
   context and `domains: [pii, phi]`; do not copy the base identifier into a second kind.
6. **Values.** Describe the structure before constructing a value; construct one only when the
   contract states enough, using reserved/test values per
   [synthetic safety](../_shared/synthetic-safety.md). State which part is fake and why it cannot
   belong to a person. If a value would need a guess, keep the Case unresolved with no value.
7. **Provenance.** Record the author as an AI agent run, the sources read with dates, and that
   no scanner was consulted and the work is not reviewed.
8. **Validate** with the checks that exist (schema, reference, privacy/provenance); report
   what does not exist. Commit `feat(evidence): case <case-slug>`, open a PR, stop.

## Stop conditions

- Not a Case (a mechanical projection of an existing one): no record; name the Case. Success.
- Duplicate failure mode for the same kind: add nothing, name it.
- Only a scanner supports the expectation: record `research-needed` or stop.
- A value looks real or came from a log, page, incident or dataset: stop; copy it nowhere.
- The slug or id would contain an issue number, milestone, detector id or scanner name: rename.

## Output

1. A PR-ready change set: the Case with expectation, sources and relations (twins, negatives,
   collisions). The description names, for each value, how it was made and that it was not
   tested against any service.
2. Research notes: **Established**, **Inferred**, **Unresolved**, **Needs human**.

The expectation names no scanner and would still mean something if every scanner disappeared.
