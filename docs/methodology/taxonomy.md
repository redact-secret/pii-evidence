# Taxonomy model

The taxonomy is JSON data in `taxonomy/`. Boundary rationale: [ADR 0001](../decisions/0001-pii-phi-person-ownership-boundary.md). Schemas and validation are separate later work; the files here are the initial vocabulary.

## Files

| File | Marker (`kind`) | Holds |
| --- | --- | --- |
| `taxonomy/privacy-kinds.json` | `privacy-kinds` | domain vocabulary, `outOfScope` list, the structured kinds |
| `taxonomy/jurisdictions.json` | `jurisdictions` | jurisdiction profiles |
| `taxonomy/contexts.json` | `contexts` | context profiles and the occurrence composition rules |

Every file has a top-level `taxonomyVersion` (currently `0.1.0`) and a `kind` marker. A snapshot binds the taxonomy version.

## Identity

Ids are lowercase, URL-safe, semantic and stable, in the form `<name>/<jurisdiction>/<profile>`, for example `email/global/basic`. The middle segment is a jurisdiction id from `jurisdictions.json`. Contexts use the same shape with the context name first. Ids carry no issue numbers, milestones, scanner or detector names, or scores.

## PrivacyKind

Each entry in `kinds` has the fields from ARCHITECTURE.md section 4.

| Field | Meaning |
| --- | --- |
| `id`, `label` | identity and display name |
| `domains[]` | `pii`, `phi`, or both |
| `baseKind?` | id of a kind this one specializes; absent when the kind is itself a base kind (all initial kinds) |
| `jurisdictions[]` | ids from `jurisdictions.json` |
| `formatClaims[]` | source-backed format claims; empty until sources exist |
| `contextClaims[]` | how a context relates to this kind: `adds-domain` (with `domains`) or `supports-identification` |
| `openQuestions[]` | what is unsettled |

Beyond the section 4 fields, each kind carries `classification`: `{ state: resolved | unresolved, evidenceClass }`. The `evidenceClass` is one of the classes in ARCHITECTURE.md section 8. No claim in these files has a source yet, so format claims are empty and context claims are `research-needed`. Sources arrive with the kind research work.

## Base kind versus occurrence

A kind is a structured concept. An occurrence is one appearance of a value in a context. The occurrence composes:

```text
kind + contexts[] + jurisdiction  ->  domains, classification
```

Rules (also in `contexts.json`):

- occurrence domains are the union of the kind's domains and the domains each applicable context adds;
- a context never removes a domain;
- an added domain belongs to the occurrence, not to the base kind;
- a base kind is never duplicated to express PHI.

## Overlapping domains

`domains` is a list. `medical-record-number/us/labeled-field` has `["pii", "phi"]`. An `email/global/basic` occurrence in `medical/global/general` context has `["pii", "phi"]` while the kind alone has `["pii"]`. Domain membership is not identity.

## Structured identifier versus contextual PHI

- Health-specific identifier: a dedicated kind whose own `domains` include `phi`.
- Contextual PHI: an ordinary kind plus a context whose `addsDomains` includes `phi`, with a matching `adds-domain` context claim on the kind.

## Unresolved and jurisdiction-dependent classification

`classification.state` is `unresolved` when the answer is not established. Rules:

- a kind, a context claim, or a jurisdiction can be unresolved, and an occurrence inherits unresolved from any of them;
- `domains` on an unresolved entry are candidates, and the reason is in `openQuestions`;
- the placeholder `national-id/unresolved/placeholder` uses jurisdiction `unresolved` and is split into per-jurisdiction kinds when researched.

Unresolved entries are not weakened to resolved to make anything convenient.

## Out of scope

`outOfScope` in `privacy-kinds.json` lists what the taxonomy deliberately does not define. PERSON/name recognition is listed with owner `redact-secret/ner-evidence`. A composition with PERSON uses `externalRefs` (repository, pinned snapshot, entity id); content is never copied.

## What the taxonomy does not contain

Scanner or detector ids, support states, thresholds, expected current behavior, or measurement results. The test: would this still be meaningful to another scanner or evaluator?

## Extending

Add a kind by adding an entry with a new id, a cited claim set (class and observed-at date when claims exist), and open questions. Do not add values to the taxonomy; values belong to authored cases and must follow `SECURITY.md`. Changes to meaning increase `taxonomyVersion`.
