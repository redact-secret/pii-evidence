# Conventions

## Principle

Evidence must be scanner-neutral, privacy-safe, inspectable, and reproducible.

## Scope rule

`pii-evidence` owns structured PII/PHI evidence.

General PERSON/name recognition belongs to `redact-secret/ner-evidence`.

Do not duplicate PERSON cases, name ambiguity research, linguistic name morphology, or general NER datasets here.

## Domain modeling

Treat `pii` and `phi` as evidence-domain axes, not mutually exclusive repositories or necessarily distinct detectors.

Examples:

```text
email                    domains: [pii]
medical-record-number    domains: [pii, phi]
patient-email occurrence domains: [pii, phi], context: medical
```

A health context may change the privacy domain without changing the underlying structured kind.

## Naming and identity

Canonical IDs are lowercase, URL-safe, semantic, and stable.

Good:

```text
email/global/basic
us-ssn/us/structured
medical-record-number/us/labeled-field
health-plan-member-id/us/member-field
```

Avoid IDs containing:

- issue or pull-request numbers;
- milestones or release names;
- Redact Secret detector IDs;
- benchmark scores;
- scanner names;
- temporary migration coordinates.

Put those in metadata/external references instead.

## Claims and provenance

Every source-backed claim records:

- what the source proves;
- source class;
- exact location/version/date;
- observed-at date;
- applicable jurisdiction/domain;
- uncertainty or open questions.

Separate observed fact from project inference.

A scanner majority is not ground truth.

## Cases

A Case is an authored reasoning unit. Every Case should state:

- what is being tested;
- expected semantic outcome;
- why the case matters;
- source/provenance basis;
- privacy domains and jurisdiction;
- ambiguity or uncertainty;
- relationships to twins, negatives, mutations, or collisions.

If multiple fixtures share identical reasoning, use one Case plus deterministic projections instead of duplicating prose.

## Expected outcomes

Expectations describe semantics, not one scanner's behavior.

Prefer concepts such as:

- valid / invalid / not-established identity;
- sensitive / non-sensitive / context-dependent;
- expected exact span;
- jurisdiction match/mismatch;
- must-observe / must-not-observe where justified.

Do not encode Redact Secret support status or threshold decisions.

## Synthetic data

Prefer deterministic synthetic values whenever real data is unnecessary.

Synthetic values must not be copied from leaked, customer, patient, employee, or production datasets.

Where a real public example is necessary, record why it is legally and ethically reusable.

## PHI authoring

PHI evidence should distinguish:

1. health-domain-specific structured identifiers, and
2. ordinary PII occurring under medical context.

Do not create a second copy of the same base identifier solely because it can become PHI. Model the contextual relationship explicitly.

## PERSON composition

If a future case requires PERSON + medical context, reference or compose with a `ner-evidence` snapshot rather than importing PERSON evidence into this repository.

Cross-repository composition must preserve both source identities and must never collapse their denominators silently.

## Fixture generation

Generated fixtures must be deterministic, preserve case lineage, and record generator identity/version.

Generated output must never invent a new expectation not present in canonical authored evidence.

## Snapshots

Released snapshots are immutable.

Any semantic correction creates a new snapshot identity.

A snapshot must bind:

- taxonomy/schema versions;
- source manifest digest;
- content digest;
- generator identity;
- case/fixture counts;
- coverage summary;
- provenance/privacy validation result;
- consumer contract version.

## Consumer boundary

`pii-eval` consumes snapshots and measures scanners. `pii-evidence` does not import evaluator behavior back into ground truth.

`redact-secret-benchmarks` may combine public and protected evidence conclusions, but public/protected populations retain separate identities and denominators.

## Writing

Use precise, falsifiable wording.

Prefer:

> The cited source documents `member_id` as the health-plan member identifier.

Avoid:

> This is definitely PHI everywhere.

State jurisdiction, context, and uncertainty explicitly.

## Review honesty

Project-maintained evidence is not described as independent validation unless an actually independent review exists and is recorded.

Unresolved evidence remains unresolved; do not weaken a schema, lint, or expectation merely to make a scanner pass.
