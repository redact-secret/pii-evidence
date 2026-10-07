---
name: boundary-review
description: Review a change, PR or record set for ownership-boundary violations - PERSON/NER content, scanner-specific or product-policy content, evaluator code, protected data, and dependency-direction breaches. Read-only. Use before merging evidence or schema changes.
---

# Boundary review

Read [scope boundary](../_shared/scope-boundary.md), `ARCHITECTURE.md` §2, §5, §11, §13 and
`CONVENTIONS.md`. Read-only; report, do not fix.

## Checklist

- **PERSON/NER:** no general name recognition, name ambiguity, person/location or
  person/organization collisions, Korean name morphology or NER datasets. Synthetic names appear
  only as placeholders inside a structured context.
- **Scanner neutrality:** no scanner or detector names, Redact Secret detector IDs, support
  states, thresholds, release blockers, or "current scanner behaviour" in records, ids, slugs,
  fixtures or prose. Expectations are semantic.
- **No scanner-derived truth:** no expectation, class upgrade or claim whose only basis is
  scanner output or consensus.
- **Evaluator/benchmark leakage:** no `pii-eval` internals, scoring code or run artifacts as
  evidence; no import from scanner packages.
- **Protected data:** no protected corpus bytes, custody or signing logic; public and protected
  populations are never merged.
- **PHI modeling:** no duplicated base kind created only because it can be PHI; context is
  modeled explicitly.
- **Identity hygiene:** ids lowercase, URL-safe, stable; no issue/PR numbers, milestones,
  release names, scores or migration coordinates.
- **Lineage:** generated fixtures trace to an authored Case and rule; nothing generated is
  presented as canonical.
- **Honesty:** project-maintained evidence is not described as independent validation.

Report each item `pass`, `fail` or `not applicable` with file:line, and end with
`VERDICT: pass|fail|needs-human`. Never approve or merge.
