---
name: research-kind
description: Research one structured PII/PHI kind (email, phone, payment-card, iban, us-ssn, medical-record-number, health-plan-member-id, ...) from public authority or standards sources and record its domains, jurisdictions, format and context claims, and open questions. Use when a kind is missing from the taxonomy or its claims lack provenance.
---

# Research a privacy kind

One bounded unit per run: one `PrivacyKind` (and its jurisdiction profile), with every material
claim traced to a source. Read [scope boundary](../_shared/scope-boundary.md),
[domain modeling](../_shared/domain-modeling.md), [evidence classes](../_shared/evidence-classes.md),
[synthetic safety](../_shared/synthetic-safety.md) and [neutrality wording](../_shared/neutrality-wording.md)
first, then `ARCHITECTURE.md` §4-6 and `CONVENTIONS.md`.

## Inputs

| Input | Required | Default when headless |
| --- | --- | --- |
| kind id or concept (`us-ssn`, `iban`, `medical-record-number`) | yes | none; stop and ask |
| jurisdiction | no | `global` only if the sources say so; otherwise name the jurisdiction |

## Steps

1. **Boundary check.** If the concept is a PERSON/name or free-text NER matter, stop and point to
   `ner-evidence`. If it only matters to one scanner, it does not belong here.
2. **Look for existing records** under `taxonomy/` and `evidence/` (or `graft ask`). A duplicate
   or near-duplicate ends the run: name it. If the repository has no taxonomy or schema yet,
   report that and propose the structure rather than inventing files outside `ARCHITECTURE.md` §12.
3. **Find sources**, preferring standards bodies, public authorities and provider documentation.
   Record each: what it proves, class, exact location/version/date, observed-at date, licence and
   redistribution terms, and whether naturally occurring personal data appears in it.
4. **Write the claims.**
   - `formatClaims`: structure, length, alphabet, checksum, separators, reserved/unissued ranges.
   - `contextClaims`: labels and fields (`mrn`, `patient_id`, `member_id`) only when source-backed.
   - `domains`: `pii`, `phi` or both, with the reason; a shared base kind is modeled once.
   - `openQuestions`: what the sources do not settle. Do not guess.
5. **Separate** observed fact from project inference in every claim.
6. **Validate** with whatever schema/reference checks exist; say which ran and which do not exist.
7. Commit `feat(taxonomy): kind <id>` (or `feat(evidence): ...`), open a pull request, stop.

## Stop conditions

- Only a scanner, a blog or an unattributed gist supports a claim: class `research-needed`.
- Sources conflict: record both, mark unresolved, add Needs human. Never choose.
- A source page contains real personal data: do not copy it; report the location only
  ([synthetic safety](../_shared/synthetic-safety.md#if-something-looks-real)).
- The source licence forbids redistribution: cite it, do not quote beyond what the licence allows.

## Output

1. A PR-ready change set: the kind, its jurisdiction/context records, sources and claims.
2. Research notes with fixed headings: **Established** (source-stated facts with locators),
   **Inferred** (project reasoning), **Unresolved** (open questions and what would settle them),
   **Needs human** (class upgrades, domain decisions, licence questions, checks that do not exist).
