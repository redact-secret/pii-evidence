# Fixture projection

A Case explains why an example matters. A fixture is a deterministic, executable projection of one Case through one documented rule. Fixtures are derived artifacts: they are never canonical evidence and never carry an expectation that is not already in authored evidence (ARCHITECTURE.md sections 7 and 11, CONVENTIONS.md "Fixture generation").

## Commands

| Command | What it does |
| --- | --- |
| `npm run fixtures:materialize` | validates the tree, projects every Case through every in-scope rule, writes `fixtures/materialized/{fixtures.jsonl,skipped.jsonl,manifest.json}` |
| `npm run fixtures:materialize:check` | writes nothing. Projects twice (the second time over reversed input order), requires byte-identical results, re-validates every fixture against its Case and rule, and if `fixtures/materialized/` exists requires it to equal a fresh regeneration. Part of `npm run check` |

Options: `--root <dir>`, `--out <dir>`, `--population public` (the only accepted value).

## Is materialized output committed?

No. `fixtures/materialized/` is git-ignored. Output is generated, so it can be rebuilt from `evidence/` and `fixtures/rules/` at any time and committing it would create a second copy that can drift. The check does not need a committed copy: determinism is proved by running the projector twice, and correctness by validating each fixture against the authored Case, rule and lineage. Immutable fixture bytes are bound by a snapshot (`snapshots/<id>/fixtures.jsonl` with the manifest digest), not by the working tree.

If a directory is present locally, `--check` and `npm run validate` hold it to the same rules, so a hand edit or a stale copy fails.

## Rules (`fixtures/rules/`, kind `fixture-rule`)

Schema: `schemas/v1/fixture-rule.schema.json`. One record per rule, in JSONL files under `fixtures/rules/`.

| Field | Meaning |
| --- | --- |
| `id` | carrier rules: `<layout>/<variant>`; twin and mutation rules: `twin/<slug>` or `mutation/<slug>`. The fixture id is `<case id>/<rule id>` |
| `ruleVersion` | semver; bump when the rule changes bytes or outcome |
| `transformation` | `carrier` (wrap the Case text unchanged), `twin` or `mutation` (change one property of the value, then wrap) |
| `carrier` | `layout`: `plain-text`, `json`, `logfmt`, `form-query`, `header-config`, `unicode-context`; `variant` id |
| `template` | one of a closed set the projector implements: `line`, `json-object`, `logfmt-line`, `query-string`, `header-line`, `ini-entry`, `prefixed-line`, with `field` or `prefix` |
| `transform` | twin and mutation only, explicit parameters: `separator-swap` (`from`, `to`), `case-change` (`mode`, ASCII only), `zero-width-insertion` (`codepoint`, `afterChars`) |
| `appliesTo` | `roles`, optional `kinds`, `identities`, `requiresSpan`, `contexts` (`any` or `none`) |
| `expectation` | `mode` `copy` or `derived`, plus a required `basis` stating why the outcome follows |
| `ordering` | unique integer; fixtures sort by case id, then `ordering`, then rule id |
| `mustNotChange` | what the projection must leave untouched (see below) |
| `justifiedBy` | authored Cases that justify the variant (for example the multibyte-label email Case) |

Current rules: carriers `plain-text/line`, `json/object-field`, `logfmt/key-value`, `form-query/query-string`, `header-config/header-line`, `header-config/ini-entry`, `unicode-context/multibyte-prefix`; twin `twin/separator-swap-hyphen-to-dot`; mutations `mutation/zero-width-insertion`, `mutation/ascii-case-upper`. Adding a template type or transform kind is a projector change (bump `PROJECTOR_VERSION`) plus a schema enum member.

### Expectation modes

- `copy` (carriers): identity, sensitivity and domains are copied from the Case. The rule's claim that the carrier is representational only is project inference and is recorded in `expectation.basis`.
- `derived` (twin and mutation): the value is no longer an authored value, so the outcome cannot be copied. The only outcome a rule may assign is the weakest one, identity `not-established` and sensitivity `context-dependent` (the schema fixes both constants), domains are copied, no span is emitted, and the fixture carries `expectation.derivedFromRule: true`. A rule can therefore never assert that a perturbed value is valid or invalid. If a stronger outcome is wanted, author a Case for it.

### `mustNotChange`

Always `privacyKind`, `jurisdiction`, `contexts`, `domains`. Copy rules also list `identity`, `sensitivity` and `valueBytes` (the bytes at the span). Derived rules must not list those three (the validator rejects the contradiction). `valueBytes` is enforced per fixture: if the carrier's escaping would change the value bytes, the Case is skipped (`carrier-would-alter-value`), never rewritten.

### Scope and skips

A Case is in scope when it passes `appliesTo`. An in-scope Case that cannot be projected is written to `skipped.jsonl` with a reason, never dropped silently:

| `reason` | Meaning |
| --- | --- |
| `no-input` | structural-only Case without `input.text` (for example the two us-ssn Cases that intentionally have no value) |
| `no-span` | the rule needs the authored span and the Case has none |
| `case-rejected` | the Case review state is `rejected` |
| `carrier-would-alter-value` | carrier escaping would change the value bytes |
| `carrier-unrepresentable` | text contains characters the carrier cannot hold (CR, or control characters for header lines) |
| `transform-no-effect` | the one-property transform leaves the value unchanged |

Every in-scope pair is either one fixture or one skip.

## Determinism contract

Same inputs and same `PROJECTOR_VERSION` give byte-identical output.

- no timestamps, no randomness (no seed exists), no locale-dependent operations (case change is ASCII-only);
- ordering by case id, rule `ordering`, rule id; input order is irrelevant (checked by running over reversed input);
- LF line endings, UTF-8; every fixture ends with one LF; input text containing CR is skipped;
- spans are UTF-8 byte offsets `[start, end)` computed from the final fixture bytes, on character boundaries (the validator re-checks);
- `sha256` and `byteLength` are of the exact content bytes;
- generator identity `pii-evidence-fixture-projector` with the version constant `PROJECTOR_VERSION` in `scripts/lib/projector.mjs`. Changing the code that changes any byte requires a version bump.

## Outputs

`fixtures.jsonl`: one `fixture-projection` per line (schema `fixture-projection.schema.json`). Existing required fields: `kind`, `schemaVersion`, `id`, `case`, `rule`, `generator`, `sha256`, `byteLength`, `spans`, `population`. Added optional fields, always written by the projector: `ruleVersion`, `carrier {layout, variant}`, `content`, `expectation {identity, sensitivity, domains, derivedFromRule}`, `lineage {evidenceClass, sources, claims}`, and `externalRefs` when the Case has them.

`skipped.jsonl`: one `fixture-skip` per line: `id` (`<case>/<rule>`), `case`, `rule`, `reason`, `detail`, `generator`, `population`.

`manifest.json`: a `materialization-manifest`: `generator`, `determinism`, `inputs.{cases,rules}.{count,sha256}` (sha256 over sorted-key JSON of the records, sorted by id, joined by LF), `outputs.{fixtures,skipped}.{path,records,bytes,sha256}`, `counts`.

## Lineage and no invented expectations

Every fixture resolves to an authored Case, a rule and the Case's sources and claims. `npm run validate` (and so `check`) enforces, per fixture: the `case` and `rule` exist; `ruleVersion` and `carrier` equal the rule's; `lineage` equals the Case provenance and every source and claim resolves; identity, sensitivity and domains equal the Case's (copy) or the rule's documented constant plus the Case's domains (derived); the bytes at the span equal the authored value bytes (copy); `externalRefs` equal the Case's; no scanner, detector, support-state, threshold or score key exists anywhere in the record. The projector runs the same validator over its own output before writing.

## Composition with external evidence

A Case may carry `externalRefs` (`defs.schema.json#/$defs/externalRef`): `repository`, `snapshot`, `entity`.

```json
{ "repository": "redact-secret/ner-evidence", "snapshot": "<pinned immutable snapshot id>", "entity": "<entity id chosen by that repository>" }
```

- Identity only. The object has no other property, so a name, text, span or surface form is a schema error, and the projector additionally refuses any `externalRefs` entry or Case with inline PERSON content keys.
- `snapshot` must be a pinned immutable id; floating names (`latest`, `main`, ...) are rejected. `repository` is an enum (currently `redact-secret/ner-evidence`) that grows additively.
- The projector passes `externalRefs` through to the fixture untouched and the validator checks the fixture's copy equals the Case's.
- Composition never merges denominators: PERSON entities stay owned and counted by `ner-evidence`; this repository's counts cover only the structured evidence it authored. A consumer joins on the pinned reference.

No authored Case uses `externalRefs` yet; no PERSON entity id has been selected.

## Population separation

Every fixture, skip and manifest has `population: "public"` (a schema constant). Cases and rules may declare `population: "public"`. The projector refuses to run, before projecting anything, when `--population` is not `public`, when any input record declares `protected` or any other population, or when more than one population is present (mixed). Protected evidence never enters this repository; `redact-secret-benchmarks` combines populations explicitly and keeps separate denominators.

## Safety

Values come only from authored Cases, which are already reserved, synthetic or allowlisted. Rules add only fixed neutral text (field names, a Korean label, U+200B) and perturb existing values; they cannot create a new identifier shape. Twin and mutation rules never assert validity. `npm run lint:safe-data` covers rule files; materialized output reuses the same values.
