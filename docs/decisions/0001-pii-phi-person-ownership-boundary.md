# 0001. PII, PHI and PERSON ownership boundary

- Status: accepted
- Scope: `pii-evidence`, `ner-evidence`, and any consumer of a pinned snapshot

## Context

Structured privacy evidence and general name recognition are researched by different repositories. Without a recorded boundary, PERSON evidence gets copied into this repository, PHI gets modeled as a second copy of ordinary identifiers, and product concepts leak into the evidence model.

## Decision

1. `pii-evidence` owns public, scanner-neutral evidence for structured PII and PHI identifiers and bounded context.
2. `ner-evidence` owns PERSON and personal-name recognition, name ambiguity and collisions, language-specific name morphology, and general NER evidence. None of it is canonical here.
3. `pii` and `phi` are domain axes. A kind or an occurrence can carry both.
4. A base kind is modeled once. Medical context is modeled explicitly and composes with the base kind at the occurrence level. A dedicated kind exists only when the identifier itself is health-domain specific.
5. Classification that is jurisdiction- or context-dependent is recorded as `unresolved` with `openQuestions`. It is not guessed.
6. Cross-repository composition references `ner-evidence` by repository, pinned snapshot identity and entity id. It never copies PERSON content, and it never merges denominators.
7. The taxonomy contains no scanner, detector, support-state, threshold or product-policy vocabulary.
8. Public and protected evidence stay separate. This repository holds public, redistributable evidence only; protected corpora and their custody live in `private-custodian` and `private-ledger`, and their populations keep independent identities and denominators.

The taxonomy implementing this decision is `taxonomy/privacy-kinds.json`, `taxonomy/jurisdictions.json` and `taxonomy/contexts.json`; the model is described in `docs/methodology/taxonomy.md`.

## Examples

| Situation | Treatment |
| --- | --- |
| An email address with no health context | kind `email/global/basic`, domains `pii` |
| An email address in a documented medical context | occurrence of `email/global/basic` plus context `medical/global/general`; domains `pii` and `phi`; no second email kind |
| A medical record number | dedicated kind `medical-record-number/us/labeled-field`, domains `pii` and `phi` |
| A claim or prescription identifier whose person linkage is not established | dedicated kind, classification `unresolved`, open questions recorded |
| A national identifier family in a jurisdiction not yet researched | placeholder kind with jurisdiction `unresolved`; split later |

## Non-examples

These do not belong in `pii-evidence`:

- Deciding whether a capitalized word is a person, a place or an organization.
- Name morphology or name lists for any language.
- Name-versus-location or name-versus-organization collision cases.
- A scanner detector id, a "supported" or "pending" status, a pass threshold, or "currently detected".
- Real patient or customer data, or any protected corpus bytes, including values that are old, revoked or already leaked.
- Evaluator or scoring code.

## Composition rules for PERSON plus medical context

A future case that combines a person reference with medical context follows these rules.

1. The PERSON part is a reference to `ner-evidence`: repository, pinned snapshot identity, entity id. No name text, span or label is copied.
2. This repository supplies only the structured part: the medical context (`medical/global/general`) and any structured identifiers.
3. Both source identities are recorded on the composed case. If `ner-evidence` content changes, a new snapshot of it is pinned; the existing reference is never edited in place.
4. Counts and denominators for each source stay separate. A composed case does not increase either repository's totals silently.
5. Where a structured example needs a person reference to read naturally, use an obviously synthetic placeholder, never a real name (see `SECURITY.md`).
6. The composition is evidence about facts. Whether a product detects or redacts it is outside this repository.

## Public/protected separation

```text
public:     pii-evidence -> pinned snapshot -> pii-eval -> benchmarks
protected:  private corpus -> private-custodian -> isolated pii-eval -> signed projection -> benchmarks
```

Raw public and protected corpora are never merged. They converge only at versioned measurement contracts, and any combination of conclusions is made by a downstream qualification step, not here.

## Consequences

- Other PII/PHI scanners and evaluators can use the taxonomy without adopting any Redact Secret concept.
- Later issues (schemas, provenance, kind research, cases) add content under this boundary and must not move PERSON content or product semantics into the canonical model.
- Reversing this decision requires a new ADR that supersedes this one.
