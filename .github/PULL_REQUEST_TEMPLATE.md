Closes #
Part of #

## Summary

<!-- What changed and why. Never paste a PII/PHI-shaped value or a credential here. -->

## Safe-data attestation

- [ ] No real-person, customer, patient, employee, support, incident or production data, and no protected corpus material, is added (including old, revoked or already leaked values).
- [ ] Every PII/PHI-shaped value is a reserved/test value, a deterministic synthetic value, a documented public example, or a reviewed licensed-corpus value, and its provenance is recorded.
- [ ] Every new or changed source records license, redistribution terms, observed-at date, value origin, evidence class and a minimization record.
- [ ] No PERSON/name evidence copied from `ner-evidence`; no scanner support status, threshold or detector id in the canonical model.
- [ ] `node scripts/lint-safe-data.mjs` and `node scripts/lint-provenance.mjs` pass; any allowlist entry cites a publication and was reviewed.
- [ ] No evidence is described as independently validated unless an independent review is recorded.
- [ ] Commit messages, branch names and this description contain no sensitive value.

## Checks run

<!-- Commands and results. -->
