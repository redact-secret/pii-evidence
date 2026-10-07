# Scope boundary

Architectural test ([ARCHITECTURE.md](../../../ARCHITECTURE.md) §1): would this record still be
meaningful to another PII/PHI scanner or evaluator? If not, it belongs elsewhere.

| Content | Owner |
| --- | --- |
| structured PII/PHI kinds, contracts, sources, Cases, fixtures, snapshots | `pii-evidence` (here) |
| PERSON/name evidence, name ambiguity or collisions, Korean name morphology, general NER | `redact-secret/ner-evidence` |
| scanner execution, normalization, measurement, run artifacts | `pii-eval` |
| thresholds, support states (`stable`, `provisional`, `pending`), release blockers, combining populations | `redact-secret-benchmarks` |
| protected/private corpus bytes, custody, signing, revocation | `private-custodian` / `private-ledger` |

Rules:

- No Redact Secret detector IDs, scanner names, support status, thresholds or "expected current
  scanner behaviour" in any canonical record, id or fixture.
- PERSON + medical context composes with a `ner-evidence` snapshot by reference; never import
  PERSON evidence. Use synthetic names or placeholders where a structured context needs one.
- Public and protected populations keep separate identities and denominators.
- Dependency direction: consumers depend on snapshots, never the reverse. Do not import
  `pii-eval`, scanner packages or benchmark code.
