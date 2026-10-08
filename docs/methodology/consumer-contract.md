# Consumer contract: `pii-evidence-consumer-contract` version 1

Status: accepted. Implements ARCHITECTURE.md section 11 and the snapshot contract of section 10. Producer: `scripts/snapshot.mjs`. Policy: [snapshot policy](../governance/snapshot-policy.md).

A snapshot is the only supported evaluator input. A consumer (`pii-eval`) needs the snapshot directory or its archive and this document. It needs no knowledge of the repository layout, and `pii-evidence` imports nothing from the consumer.

## 1. What a snapshot is

A directory `snapshots/<snapshot-id>/` (the id contains slashes, so it is a nested path) of UTF-8 files with LF line endings:

| File | Content |
| --- | --- |
| `manifest.json` | the `snapshot-manifest` record (schema `schemas/v1/snapshot-manifest.schema.json`), key-sorted, pretty-printed |
| `cases.jsonl` | one authored `case` per line |
| `fixtures.jsonl` | one `fixture-projection` per line, with the exact fixture bytes in `content` |
| `skipped.jsonl` | one `fixture-skip` per line: in-scope case and rule pairs that were not projected, with a reason |
| `fixture-rules.jsonl` | the `fixture-rule` records the fixtures cite |
| `sources.jsonl` | the `source` records (license, redistribution, value origin, observed-at) |
| `claims.jsonl` | the `claim` records the cases cite |
| `review-events.jsonl` | `review-event` records, present only when included records reference some |
| `taxonomy/privacy-kinds.json`, `taxonomy/jurisdictions.json`, `taxonomy/contexts.json` | the vocabulary the cases refer to |

`.jsonl` files hold one canonical JSON object per line (keys sorted at every depth, no insignificant whitespace), sorted by `id` in code point order. Every record carries `kind` and `schemaVersion` (`"1"`). Unknown `schemaVersion` or `kind` must be treated as an error (fail closed). Within version 1 changes are additive: ignore unknown optional properties, never ignore an unknown required one. JSON `null` is permitted in the taxonomy files (for example in an illustrative occurrence of `taxonomy/contexts.json`), so a consumer's reader must accept it; duplicate keys, floats and integers beyond 2^53 - 1 do not occur and a strict reader may refuse them.

## 2. What a consumer can rely on

| Need (section 11) | Where |
| --- | --- |
| stable case and fixture ids | `case.id`; `fixture.id` is `<case id>/<rule id>`; `fixture.case` and `fixture.rule` reference them. An id never changes meaning; a semantic change is a new snapshot. |
| exact byte ranges | `fixture.spans[]` are half-open UTF-8 byte ranges `[start, end)` into the bytes of `fixture.content`, on character boundaries. `case.expectation.span` is the same for `case.input.text`. |
| identity state | `expectation.identity`: `valid`, `invalid` or `not-established` |
| sensitivity and context axes | `expectation.sensitivity` (`sensitive`, `non-sensitive`, `context-dependent`), `case.contexts[]` (ids from `taxonomy/contexts.json`), `expectation.domains[]` (`pii`, `phi`; an axis, not a partition) |
| jurisdiction and domain metadata | `case.jurisdiction`, `case.privacyKind` (id from `taxonomy/privacy-kinds.json`, which lists the kind's domains and jurisdictions); the manifest `coverage` summarizes them |
| deterministic fixture bytes | `fixture.content` with `fixture.byteLength` and `fixture.sha256` of its UTF-8 bytes. The projector is deterministic; `fixtureGenerator` in the manifest names it and its version. |
| scanner-independent expected outcome | `fixture.expectation` (copied from the case, or the fixed weakest outcome for `derivedFromRule` fixtures) and `case.expectation`. No record contains a detector id, support state, threshold, score or current-scanner behavior. |
| lineage | `fixture.case`, `fixture.rule`, `fixture.lineage {evidenceClass, sources, claims}`; every id resolves inside the snapshot. |
| evidence strength | `case.provenance.evidenceClass`, `case.ambiguity`, `case.review`. Project-maintained evidence is not independent validation; review states are `unreviewed` unless a `review-event` says otherwise. |

Rules a consumer must follow:

- A `derivedFromRule` fixture (twin or mutation rules) carries `identity: not-established` and `sensitivity: context-dependent` and no span. It asserts nothing stronger.
- `not-established` means the evidence does not decide validity. A consumer must not score it as valid or as invalid.
- Cases whose `evidenceClass` is `research-needed` assert only `not-established`.
- Counts are over this snapshot only. Excluded records (section 5) are not part of any denominator, and a consumer must not add other populations into this denominator. Public and protected populations keep separate identities (`population` is always `public`).

## 3. `externalRefs`

A case or fixture may carry `externalRefs[]` of `{repository, snapshot, entity}`: identity only, a pinned immutable snapshot id in another repository (for example PERSON evidence in `redact-secret/ner-evidence`). No names, text or spans are copied. A consumer joins on the pinned reference and keeps the other repository's denominator separate. The first snapshot carries none.

## 4. Verifying a snapshot

Everything below needs only the snapshot files.

1. Parse `manifest.json`. Check `consumerContract` is `pii-evidence-consumer-contract` and `consumerContractVersion` is `1`.
2. Every file except `manifest.json` must be listed in `manifest.files` with its byte length and `sha256`, and no other file may exist. Recompute each SHA-256 over the raw file bytes.
3. **Content digest** (`contentDigestSpec: files-v1`): sort the paths of all files except `manifest.json` by code point; for each build the line `<sha256 of file bytes> <path>\n`; concatenate and take SHA-256 of the UTF-8 result. It must equal `manifest.contentDigest`. Any change to any byte of any digested file changes it.
4. **Snapshot id**: `public-pii-phi/<snapshotDate>/<first 12 hex digits of contentDigest>`. The date is an explicit input recorded in the manifest; it is not the build time and is not part of the content digest.
5. `sourceManifestDigest` is the SHA-256 of `sources.jsonl`.
6. Record counts in `manifest.counts` equal the line counts of the files; `coverage` equals the coverage recomputed from `cases.jsonl`, `fixtures.jsonl` and the taxonomy.
7. Every `fixture.sha256`/`byteLength` match `content`; every span lies inside it on character boundaries.
8. References resolve: case to kind, jurisdiction, contexts, sources, claims and related cases; claim to source; fixture to case and rule; skip to case and rule. (`node scripts/snapshot.mjs verify-dir <dir>` does all of this plus schema validation, neutrality and provenance re-checks; the standalone test in `tests/snapshot.test.mjs` shows a consumer doing it from the directory alone.)
9. For a released snapshot, `manifest.json` has the SHA-256 recorded in `snapshots/released.json` (a repository file outside the digested content) and in the release notes. Archives are deterministic: `node scripts/snapshot.mjs pack <id> --out <dir>` produces a tar (sorted names, mode 0644, uid/gid 0, mtime 0, top directory = the id with `/` replaced by `-`) whose SHA-256 is `archive.tarSha256`. The published `.tar.gz` has its own SHA-256 beside it (`.sha256` asset).

Pin a snapshot by id plus manifest SHA-256 (or content digest). Never consume a floating reference.

## 5. What is excluded and why

The manifest lists every exclusion under `exclusions` with reasons: `sources`, `claims`, `cases`, `rules`, the number of excluded fixtures, and `taxonomyClaimRefsRemoved`. Rule summary (the exact text is `exclusions.rule`):

- only sources the provenance lint derives `public-safe` are included (the `--public-release` condition); a claim or case that cites an excluded source or claim is excluded; exclusion propagates across case relationships to a fixed point so no included case points at a missing case;
- explicit project research adjudication can defer or reject an existing authored Case; that Case remains in research but is excluded with its disposition and ledger identity, with ordinary relationship exclusion closure;
- no record is edited; excluded records are not copied;
- the taxonomy is copied as vocabulary, minus references to excluded claims;
- cases that cite no source are included with their evidence class unchanged.

Exclusion is not a finding about the evidence. It records that provenance was unresolved or depended on something unresolved at snapshot time. A later snapshot may include more.

## Optional promotion summary

A later snapshot may include `manifest.coverageDelta`: the exact earlier released
baseline id and manifest SHA-256, added/removed/changed kind and Case ids, signed
Case/fixture count changes, and project-maintained research dispositions bound by
ledger SHA-256. It describes evidence promotion, never consumer mapping or product
policy. Detailed contexts, source/review changes and unresolved reasons remain in
the companion delta report that pins this manifest. A consumer may ignore this additive
optional field under version 1. Registering the candidate never changes this
summary: the baseline is a strictly earlier dated release.

## 6. Versioning

`consumerContractVersion` is `"1"`. A change that removes or reinterprets a field, the digest algorithm or the id derivation is a new contract version and a new `consumerContract` handling path in the consumer. Additive optional fields do not bump it. A consumer rejects a contract version it does not know.
