# pii-evidence

Canonical, scanner-neutral public evidence for structured PII and PHI detection in the Redact Secret ecosystem.

> **Status:** Initial architecture phase. This repository contains only public, safe-to-redistribute evidence. Real-person or protected PII/PHI belongs in the private custody path, not here.

`pii-evidence` is intended to become the long-term source of truth for structured personally identifiable information (PII), structured protected-health-information (PHI) identifiers, provenance, authored cases, benign/context contrasts, deterministic fixture projections, and immutable evidence snapshots.

It must remain useful even if Redact Secret itself did not exist.

## Core principle

```text
privacy evidence != scanner behavior
scanner behavior != product qualification
product qualification != protected-data custody
```

This repository owns the first layer only: public evidence.

## Scope

Initial scope is **structured privacy data** that can be described with inspectable contracts and bounded context.

Examples include:

- email addresses;
- phone numbers;
- payment cards;
- IBAN/bank identifiers;
- national identifiers such as SSNs;
- tax identifiers;
- medical record numbers;
- health-plan/member identifiers;
- claim/prescription identifiers;
- other reviewed jurisdiction-specific structured identifiers.

### PII and PHI are axes, not mutually exclusive buckets

A record may belong to more than one privacy domain.

```text
email
  domains: [pii]

medical-record-number
  domains: [pii, phi]

patient-email
  base kind: email
  domains: [pii, phi]
  context: medical
```

PHI often depends on context. The repository therefore distinguishes a value's structured kind from the context that makes an occurrence health-related.

## PERSON names are intentionally out of scope

General person-name recognition is owned by [`redact-secret/ner-evidence`](https://github.com/redact-secret/ner-evidence).

`pii-evidence` must not duplicate PERSON evidence, name ambiguity research, person/location collisions, person/organization collisions, Korean name morphology, or general NER work.

When a future product policy combines a PERSON entity with medical context, the PERSON evidence remains sourced from `ner-evidence`; this repository may own the structured medical/context evidence used in that composition.

## What this repository owns

- PII/PHI evidence taxonomy;
- structured identifier contracts;
- jurisdiction and domain metadata;
- public source provenance;
- authored positive, negative, ambiguous, and context cases;
- benign twins and collision cases;
- deterministic fixture projection rules;
- authored-vs-generated lineage;
- review history;
- privacy/licensing metadata;
- immutable snapshot manifests and digests;
- a consumer contract for `pii-eval`.

## What this repository does not own

- Redact Secret detector code;
- FastNER/PERSON evidence;
- scanner execution;
- benchmark scoring;
- support states such as `stable`, `provisional`, or `pending`;
- product thresholds or release blockers;
- protected/private PII or PHI corpus bytes;
- custody, signing, revocation, or private-ledger operations.

## Ecosystem boundary

```text
                       public evidence
                            │
                      pii-evidence
                            │
                     pinned snapshot
                            ▼
                         pii-eval
                            │
                    measurement artifacts
                            ▼
              redact-secret-benchmarks
                            │
               product qualification/policy
                            ▼
                    redact-secret core
```

Protected evidence is a separate lane using the same evaluator contract:

```text
private PII/PHI corpus
        │
private-custodian
        │
   isolated pii-eval
        │
signed aggregate/projection
        │
redact-secret-benchmarks
```

Public and protected populations are never silently merged into one denominator. They retain separate identities and provenance. A product may combine their conclusions explicitly at qualification time.

## Knowledge model

```text
PrivacyKind
  ├─ domains: pii | phi
  ├─ jurisdiction
  ├─ format/context contracts
  ├─ sources
  ├─ authored cases
  ├─ benign/collision cases
  ├─ fixture projections
  └─ review history

Snapshot
  ├─ taxonomy/schema versions
  ├─ source manifest
  ├─ case/fixture counts
  ├─ content digest
  └─ consumer contract
```

A **Case** is the human reasoning unit. A fixture is an executable projection of that reasoning.

## Safe-data policy

This is a public repository. Never commit:

- real-person PII;
- patient records or health records;
- customer/user logs;
- production form submissions;
- scraped personal datasets without explicit legal/provenance approval;
- real identifiers merely because they were revoked or are old;
- private corpora intended for protected evaluation.

Prefer reserved/test namespaces, documented public examples, deterministic synthetic generators, and licensed public corpora whose redistribution is reviewed.

## Snapshot model

Downstream consumers pin immutable snapshots. A snapshot should include:

- snapshot identity;
- content digest;
- taxonomy/schema versions;
- source manifest digest;
- case and fixture counts;
- generation-tool identity;
- provenance/privacy validation result;
- exact consumer contract version.

Released snapshots are immutable. Corrections create a new snapshot. The first public snapshot, its consumer contract and its correction policy: `docs/methodology/consumer-contract.md`, `docs/governance/snapshot-policy.md`, `docs/research/first-snapshot-coverage.md`.

## Relationship to `pii-eval`

`pii-eval` consumes pinned evidence snapshots and measures scanners. It does not define the evidence and `pii-evidence` does not execute scanners.

The first milestone for this repository is complete when a pinned public PII/PHI snapshot can be consumed by `pii-eval` and produce a reproducible measurement artifact without repository-private assumptions. The first released snapshot has been consumed this way; what belongs to evidence, measurement and downstream qualification, what the run showed about the evidence, and where to reproduce it: `docs/methodology/pii-eval-handoff.md`. The run does not authorize Redact Secret product qualification or protected evaluation.

## Relationship to `ner-evidence`

`ner-evidence` owns PERSON and other semantic NER entity research. `pii-evidence` owns structured privacy evidence. Cross-domain composition is allowed, duplication is not.

## Initial delivery sequence

1. Freeze PII/PHI/PERSON ownership boundaries.
2. Define versioned taxonomy and case/source schemas.
3. Define provenance, privacy, licensing, and safe-data rules.
4. Seed structured PII evidence.
5. Seed structured PHI/context evidence.
6. Define deterministic fixture projection and snapshot contract.
7. Publish the first immutable snapshot.
8. Verify consumption and measurement in `pii-eval`.

Run `npm ci && npm run check` to validate schemas, records, and references (Node 22+); see `docs/methodology/schemas.md`.

See `ARCHITECTURE.md`, `SECURITY.md`, and `CONVENTIONS.md` before contributing.
