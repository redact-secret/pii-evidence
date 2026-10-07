# Architecture

## 1. Purpose

`pii-evidence` separates structured privacy knowledge from scanner implementation and product qualification.

Architectural test:

> Would this evidence still be meaningful to another PII/PHI scanner or evaluator?

If not, the content probably belongs in `pii-eval`, `redact-secret-benchmarks`, `redact-secret`, or a protected-data system instead.

## 2. Ownership boundary

### `pii-evidence`

Owns public, scanner-neutral structured PII/PHI evidence, provenance, authored reasoning, fixtures, and immutable snapshots.

### `ner-evidence`

Owns PERSON/name evidence and general NER ambiguity/collision research. Names are deliberately not reimplemented here.

### `pii-eval`

Owns scanner-neutral execution, normalization, measurement, replay, and versioned run artifacts.

### `redact-secret-benchmarks`

Owns Redact Secret product qualification, thresholds, support status, publication, and explicit combination of evidence populations.

### `private-custodian` / `private-ledger`

Own protected corpus execution, authorization, isolation, signing, disclosure, audit, revocation, and operational history.

## 3. Two evidence lanes

Public and protected evidence use the same measurement semantics but different trust boundaries.

```text
PUBLIC
pii-evidence snapshot
       ↓
    pii-eval
       ↓
public RunArtifact
       ↓
 benchmarks

PROTECTED
private corpus
       ↓
private-custodian
       ↓
 isolated pii-eval
       ↓
signed aggregate/projection
       ↓
 benchmarks
```

The repositories do not physically merge raw corpora. They converge only at versioned measurement/projection contracts.

## 4. Domain model

Recommended canonical entities:

```text
PrivacyKind
JurisdictionProfile
ContextProfile
Source
Claim
Case
FixtureProjection
ReviewEvent
SnapshotManifest
```

A `PrivacyKind` represents a structured privacy concept such as `email`, `us-ssn`, or `medical-record-number`.

Suggested fields include:

```text
id
label
domains: [pii, phi]
baseKind?
jurisdictions[]
formatClaims[]
contextClaims[]
openQuestions[]
```

Domain membership is not identity. A kind may legitimately be both PII and PHI.

## 5. Structured PII vs NER

This repository intentionally targets bounded structured data and bounded context.

Examples owned here:

- `email`;
- `phone`;
- `payment-card`;
- `iban`;
- `us-ssn`;
- `medical-record-number`;
- `health-plan-member-id`;
- field/context evidence such as `mrn`, `patient_id`, `member_id` when source-backed.

Examples not owned here:

- deciding whether `May` is a person;
- Korean PERSON morphology;
- name/location or name/organization ambiguity;
- general free-text NER.

Those belong to `ner-evidence`.

## 6. PHI modeling

PHI should not be implemented as a second unrelated taxonomy when the underlying structured kind is shared with PII.

Prefer compositional facts:

```text
kind: email
context: medical
occurrence domains: [pii, phi]
```

or a dedicated structured kind when the identifier itself is health-domain specific:

```text
kind: medical-record-number
domains: [pii, phi]
```

The evidence repository records the facts. Product policy decides what combination is detected, redacted, warned, or supported.

## 7. Cases before fixtures

A Case explains why an example matters. Fixtures are executable projections.

```text
Case
  ├─ authored rationale
  ├─ evidence/source links
  ├─ expected semantic outcome
  ├─ uncertainty
  └─ fixture projections
       ├─ plain text
       ├─ JSON
       ├─ logfmt
       ├─ form/query
       └─ Unicode/context variants
```

Generated fixtures must retain exact lineage to the authored Case and generation rule.

## 8. Evidence classes

At minimum distinguish:

- `public-authority`;
- `provider-documented`;
- `standards-body`;
- `reference-backed`;
- `licensed-corpus`;
- `authored-baseline`;
- `authored-adversarial`;
- `tool-corroborated`;
- `research-needed`.

Scanner consensus is never ground truth.

## 9. Privacy and licensing

Every source/import records:

- exact source and version/date;
- license and redistribution terms;
- transformation/minimization steps;
- whether naturally occurring personal data exists;
- whether values are synthetic, reserved, public test data, or licensed corpus material;
- review state.

Real customer/patient data is prohibited in this public repository.

Publication safety is split by responsibility. The `pii-evidence` privacy-data lint covers PII/PHI shapes only. Credential detection is delegated to the published `@redact-secret/core` package through `npm run lint:credentials`; `pii-evidence` does not own credential patterns. Gitleaks in CI is an independent second opinion.

## 10. Snapshot contract

Snapshots are the only supported evaluator input contract. Consumers should not depend on source-tree layout.

A snapshot manifest should bind:

- snapshot id;
- schema versions;
- taxonomy version;
- source manifest digest;
- content digest;
- fixture count and case count;
- generator identity/version;
- language/jurisdiction/domain coverage;
- provenance/privacy validation status.

Released snapshots are immutable.

## 11. `pii-eval` consumer contract

The first downstream contract should support:

- stable case/fixture IDs;
- exact byte ranges where applicable;
- identity state including valid/invalid/not-established;
- sensitivity/context axes;
- jurisdiction/domain metadata;
- deterministic fixture bytes;
- expected semantic outcome independent of scanner implementation.

`pii-evidence` must not encode Redact Secret thresholds, support statuses, detector IDs, or expected current scanner behavior.

## 12. Suggested repository layout

```text
schemas/
  v1/

taxonomy/
  privacy-kinds.json
  jurisdictions.json
  contexts.json

evidence/
  sources/
  claims/
  cases/

fixtures/
  rules/
  materialized/        # generated or snapshot-only

snapshots/
  <snapshot-id>/
    manifest.json
    cases.jsonl
    fixtures.jsonl
    sources.jsonl

scripts/
  validate.*
  materialize.*
  snapshot.*

docs/
  methodology/
  governance/
  decisions/
```

Canonical authored evidence stays separate from generated fixture output.

## 13. Dependency rule

This repository must not depend on:

- Redact Secret internals;
- scanner packages;
- `pii-eval` implementation internals;
- benchmark scoring code;
- protected corpus infrastructure.

Consumers depend on evidence snapshots, not the reverse.
