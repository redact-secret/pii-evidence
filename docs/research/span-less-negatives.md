# Span-less and text-level negative expectations: patterns, guidance and impact

Status: draft, unreviewed agent work (observed 2026-10-07). Nothing here is independent validation. Records: `evidence/cases/span-less-cases.jsonl` (7 cases, no new source or claim). No taxonomy, schema, rule, projector, allowlist or snapshot file was changed.

## Question

Some negatives have no meaningful value span: the text mentions a kind but holds nothing in its grammar. How should these be authored so the expectation stays scanner-neutral, a span is never invented, and a consumer can tell "no value here" from "a value that is not a value"?

## Span-required versus span-less

The schema already allows both: only a `positive` case must carry `expectation.span`; every other role may omit it. The decision rule used here:

| Text contains | Author | Why |
| --- | --- | --- |
| a string in the kind's grammar that is valid, or valid under a context | span (positive, twin, context) | the located value is the claim |
| a value-shaped string that is invalid, masked, placeholder or collides | span only when exactly one byte range is the thing denied; otherwise none | a located negative lets a consumer score "this range is not an identity"; with several candidate ranges or a partial string the range would be a guess |
| no string in the kind's grammar at all | no span, whole-text expectation | any range would be fabricated; the claim is about the text |
| a structural description with no text | no `input` at all | already supported; fixtures are skipped with `no-input` |

A span that merely wraps the whole sentence is not authored: it would assert that the sentence is the located subject.

## Patterns (one case each)

| Pattern | Case | Reasoning |
| --- | --- | --- |
| prompt prose | `email/global/basic/negative/span-less-prompt-prose` | running instruction text that names the kind |
| empty labelled field | `phone/global/basic/negative/span-less-empty-labelled-field` | label present, explicit not-provided marker; closest twin of a labelled positive |
| format description | `us-ssn/us/structured/negative/span-less-format-description` | layout in letters, no digit run; unlike letter-fill negatives that mimic a value |
| redaction notice | `payment-card/global/basic/negative/span-less-redaction-notice` | value removed upstream, no mask characters or digits left (masked residue is a different, ambiguous pattern) |
| aggregate statement | `iban/global/basic/negative/span-less-aggregate-statement` | count or summary about values, none carried |
| absence statement | `medical-record-number/us/labeled-field/negative/span-less-absence-statement` | clinical note says there is no identifier; medical context and `phi` domain stay on the occurrence |
| pointer to elsewhere | `health-plan-member-id/us/member-field/negative/span-less-pointer-to-elsewhere` | label refers to a document, not a value |

Every case: identity `invalid`, sensitivity `non-sensitive`, `ambiguity: none`, `valueOrigin: synthetic`, evidence class `authored-adversarial`, a one-property `twin` link to an existing sibling, no sources or claims. Texts are plain sentences with no digit string. PHI is modeled as before: the base kind plus the medical or health-plan context and domains `[pii, phi]`.

The reasoning is project inference: that a text without a grammar-conforming string has no identity. It rests on the grammar claims already cited by the siblings, not on any source of its own.

## Fixture projection implications

- Only `plain-text/line` accepts negatives (`appliesTo.roles` lists all roles with no span requirement). Every other carrier rule requires `valid` identity and a span, so each new case yields one fixture and no skips from those rules; the twin and mutation rules also need a span.
- The copy rule carries the authored expectation unchanged and emits `spans: []`. This is correct: the fixture asserts no located value.
- Carrier variety (JSON, logfmt, query) is not available to span-less negatives. A prose-in-JSON variant would be a reasonable rule, but a rule that wraps negative text must keep `mustNotChange` honest without `valueBytes`; that is a projector decision and was not made here.
- No rule is needed to derive these cases; they are authored. Fixtures never invent an expectation.

## pii-eval compatibility notes

Descriptive only; nothing in this repository depends on `pii-eval` code. From `docs/methodology/pii-eval-handoff.md`: a consumer that carries a located value only with a span can hold a span-less assertion only as `not-established`. So for these cases:

- the consumer-facing statement is "the evidence asserts no value occurs in this text"; a consumer that scores findings can read it as a text-level no-finding expectation. This is a reading by the consumer, not a field here.
- No fake span (empty range, whole-text range, label range) should be added to make these measurable. The cost is that the assertion may stay unscored; that is preferable to a wrong location.
- Identity `invalid` on a text with no value is a convention. It is the same convention the existing span-less negatives use; the handoff counts those among the 17 unanchorable `invalid` fixtures.
- Counts: these cases add to span-less negative counts and to no span-based denominator.

## Unresolved

- Whether `identity: invalid` is the right state when there is no candidate value at all, or whether a distinct text-level state (for example "no value present") is needed. That is a schema enum change, additive only with consumer agreement. Not made.
- A text-level expectation field (such as "no finding in this text", with no span) would state the claim directly rather than through `invalid`. Proposed, not authored; it would be additive to schema v1 and would need a consumer-contract section.
- Whether a prose negative should be authored per kind or once for all kinds. Seven cases cover seven kinds; the pattern, not the count, is the finding. The remaining kinds (`health-claim-identifier`, `prescription-order-identifier`, `national-id`) were not covered.
- Whether an explicit `must-not-observe` set of ranges is wanted for texts with candidate-looking tokens. The schema has no such field.
- Whether a negative-carrier fixture rule (negative text in JSON, logfmt and query carriers) should exist, and how `mustNotChange` should read without a value range.
- Whether the "empty labelled field" and "pointer" patterns should have context-dependent twins where a pointer is itself sensitive (for example a pointer naming where records are kept). Not read from any source.
- The note rests on no external source; if a standard defines "absence of a value" expectations for data classification, it was not read.

## Schema notes

- No schema change was needed. `expectation.span` is optional for non-positive roles and `input` is optional for structural cases.
- There is no field recording why a span is absent (no value, partial value, structural case). It is carried in `rationale`; a controlled field could be proposed.

## Snapshot impact

None for the released snapshot `public-pii-phi/2026-10-07/9d4e8e036bbb`, which is immutable. The 7 cases enter a later snapshot only through a reviewed build: 7 `invalid`, `non-sensitive` negatives with no span, 7 `plain-text/line` fixtures with empty spans, no new skips. Counts of cases and negatives rise; span-based denominators do not.
