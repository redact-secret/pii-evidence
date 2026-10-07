# Schemas

Versioned JSON Schemas (draft 2020-12) for the canonical entities in ARCHITECTURE.md section 4. They live in `schemas/v1/`. Validation is `npm run validate`; tests are `npm test`; `npm run check` runs both and is what CI (`verify`) runs.

None of the schemas holds scanner behavior, detector or support state, thresholds, scores or any Redact Secret qualification policy. Objects use `additionalProperties: false`, so such fields cannot appear. The test: would this record still be meaningful to another scanner or evaluator?

## Schemas

| File | Record `kind` | What it is |
| --- | --- | --- |
| `defs.schema.json` | none | shared definitions: id, evidence class, value origin, byte span, review, uncertainty, digests |
| `privacy-kind.schema.json` | none (item) | one structured kind (`kinds[]` entry) |
| `jurisdiction-profile.schema.json` | none (item) | one jurisdiction (`jurisdictions[]` entry) |
| `context-profile.schema.json` | none (item) | one context (`contexts[]` entry) |
| `privacy-kinds.schema.json` | `privacy-kinds` | wrapper for `taxonomy/privacy-kinds.json` |
| `jurisdictions.schema.json` | `jurisdictions` | wrapper for `taxonomy/jurisdictions.json` |
| `contexts.schema.json` | `contexts` | wrapper for `taxonomy/contexts.json` |
| `source.schema.json` | `source` | a public source or import with privacy and licensing record (ARCHITECTURE.md section 9) |
| `claim.schema.json` | `claim` | a source-backed statement; observed fact apart from project inference |
| `case.schema.json` | `case` | the authored reasoning unit with a semantic expectation |
| `fixture-projection.schema.json` | `fixture-projection` | a deterministic projection of one case, with lineage |
| `fixture-rule.schema.json` | `fixture-rule` | a documented projection rule (carrier, template, transform, scope, expectation mode, `mustNotChange`) |
| `fixture-skip.schema.json` | `fixture-skip` | one line of the skip report (generated) |
| `materialization-manifest.schema.json` | `materialization-manifest` | digests and counts of one projector run (generated) |
| `review-event.schema.json` | `review-event` | one review decision about one record |
| `snapshot-manifest.schema.json` | `snapshot-manifest` | binds an immutable snapshot (ARCHITECTURE.md section 10) |

Every record carries `kind` and `schemaVersion`. `schemaVersion` is the string `"1"` for everything in `schemas/v1/`.

### Case

A case has an `id`, `title`, `rationale`, its own `role` (positive, negative, ambiguous, twin, mutation, collision, context), `privacyKind`, `jurisdiction`, `contexts[]`, `valueOrigin`, optional `input.text`, and:

- `expectation` (semantic only): `identity` (valid, invalid, not-established), `sensitivity` (sensitive, non-sensitive, context-dependent), `domains[]`, and an optional `span`. The span is a half-open range of UTF-8 byte offsets into `input.text`. It must be in range and on character boundaries; a positive case must carry one.
- `ambiguity`: `none`, `ambiguous` or `uncertain`; the last two need `reasons`.
- `relationships[]`: `positive`, `negative`, `twin`, `mutation` or `collision`, each pointing at another case.
- `provenance`: `evidenceClass`, `sources[]`, `claims[]`, optional `inference`. Source-backed classes need at least one source.
- `review`: state plus `review-event` ids; `reviewed` needs at least one event. An agent never marks its own work reviewed.

### Fixture projection

The id is `<case id>/<rule id>`. It does not change when the fixture is regenerated; `generator`, `sha256`, `byteLength` and `content` may. When `content` is present the validator checks `sha256`, `byteLength` and every span. `population` is always `public`. Additive optional fields (always written by the projector): `ruleVersion`, `carrier`, `expectation`, `lineage`, `externalRefs`; when the rule resolves, the validator compares them with the Case and rule. Rules, projection, the skip report and composition are specified in `fixture-projection.md`.

A case also accepts optional `externalRefs` (pinned `repository`, `snapshot`, `entity`; no copied content) and `population` (`public`), both additive to schema version 1.

## Identity

Ids are lowercase, URL-safe, slash-separated semantic segments (`defs.schema.json#/$defs/id`). Kinds use `<name>/<jurisdiction>/<profile>`; other records pick readable segments such as `<kind id>/<role>/<slug>` for cases. Ids are unique within a corpus regardless of record type.

Ids must not embed issue or PR numbers, release or milestone names, scanner or detector names, benchmark scores, or migration coordinates. The denylist is one file, `scripts/id-rules.mjs`; add a pattern there and a case in `tests/id-rules.test.mjs`.

## Layout and discovery

`scripts/validate.mjs` reads every `.json` and `.jsonl` file under `taxonomy/`, `evidence/`, `fixtures/` and `snapshots/`. Missing or empty directories succeed. Symbolic links are rejected. A `.json` file holds one object (a record or a taxonomy wrapper); a `.jsonl` file holds one record per line. Errors name the file, the line for JSONL, and the JSON pointer.

Each `snapshots/<id>/` directory is its own corpus: ids are unique inside it but may repeat the working tree's ids (a snapshot copies them), and references resolve inside it plus the working tree's taxonomy.

Cross-references checked: case to kind, jurisdiction, contexts, sources, claims, related cases and review events; claim to source (and optional kind, jurisdiction); fixture to case, rule, source and claim lineage; rule to applicable kinds and justifying cases; skip to case and rule; review-event subject to any record; kind to jurisdictions, base kind, context claims and claim ids; context to claim ids.

`schemas/v1/examples/valid/` and `invalid/` hold synthetic examples used by the tests. They are not evidence and are not scanned by `validate`. Values are reserved or documented-invalid only (`example.com`, no real data).

## Versioning and evolution

- The schema version is part of every record and of the directory name (`schemas/v1/`).
- Within a major version, changes are additive: new optional properties, new enum members only where consumers can ignore them. A change that tightens or removes something is a new major.
- A new major version is a new directory (`schemas/v2/`) and a new entry in `SUPPORTED_SCHEMA_VERSIONS` in `scripts/lib/validator.mjs`. Old directories stay so released snapshots remain verifiable.
- Fail closed: a record with a missing or unknown `schemaVersion`, or an unknown `kind`, is an error, never skipped or guessed. New record kinds need a schema and an entry in `KIND_SCHEMAS`.
- The taxonomy files carry `schemaVersion` as well as `taxonomyVersion`; the latter changes when vocabulary meaning changes.
- Released snapshots are immutable; a correction is a new snapshot.
