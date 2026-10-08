# Snapshot policy

Status: accepted. Applies with [provenance and licensing](provenance-and-licensing.md), [safe-data policy](safe-data-policy.md) and [review requirements](review-requirements.md). Format and verification of a snapshot: [consumer contract](../methodology/consumer-contract.md).

## Principles

- A snapshot is the only supported evaluator input; consumers depend on it, not on the source tree.
- A released snapshot never changes. A correction of any kind is a new snapshot id.
- Everything in a snapshot passed the gates over exactly the included set. Evidence that does not pass is excluded and listed with reasons; a gate is never weakened and a review state is never edited to include something.
- Project-maintained evidence is described as such. The manifest and release notes never call it independently validated.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run snapshot:build -- --date YYYY-MM-DD` | assemble `snapshots/<id>/` from the public-safe subset. The date is an explicit input, never read from the clock. |
| `npm run snapshot:verify` | verify every snapshot directory and the registry (part of `npm run check`) |
| `npm run snapshot:verify -- --base origin/main` | additionally require that everything released at the base ref is unchanged (CI mode for pull requests) |
| `node scripts/snapshot.mjs verify-dir <dir>` | verify one directory standalone |
| `node scripts/snapshot.mjs register <id>` | add the registry entry that marks the snapshot released |
| `node scripts/snapshot.mjs pack <id> --out <dir>` | write the deterministic archive and its `.sha256` |

## Gates inside the build

The build refuses (exit 1, nothing written) unless all of these pass over the included set:

1. population: every record is public; any `protected` or other population, or a mix, is refused;
2. `npm run validate` semantics: schema, references, ids, lineage;
3. `lint-provenance --public-release` semantics: every included source is `public-safe`, no structural error;
4. fixture projection run twice (second over reversed input) byte-identical, each fixture valid against its case and rule;
5. the privacy-data lint (`lint-safe-data`; PII/PHI shapes only) over the included evidence and the published bytes;
6. neutrality: no scanner, detector, support-state, threshold or score key in any record (schemas already forbid unknown properties; the build adds an explicit key scan);
7. the assembled directory passes `snapshot:verify` standalone checks and the tree validator as its own corpus.

The manifest records each check under `validation.checks`.

## Research promotion selection

The project-maintained disposition ledgers in `docs/research/case-strengthening-adjudication.json`
and `docs/research/coverage-expansion-adjudication.json` govern existing authored Case promotion.
An existing Case whose canonical disposition is `defer` or `reject` remains research in the
source tree and is excluded from candidates. The manifest records the disposition and ledger
identity, and the usual relationship/rule exclusion closure still applies. A deferred proposal
for a new standalone kind does not exclude an accepted bounded ambiguity or relative-kind
collision Case. `context-only` accepts only the authored bounded semantics, never a universal
grammar. Invalid or duplicate dispositions fail closed.

The optional manifest `coverageDelta` binds the earlier release, count/kind/Case delta and dispositions. Its baseline is a strictly earlier dated release, so registering the candidate does not change rebuild bytes. The candidate pointer and deterministic coverage report bind both ledgers by SHA-256, identify
the baseline released snapshot, and keep unresolved proposals and downstream mapping losses
visible. Agent adjudication does not change a record to `reviewed` or make the evidence independent.
Candidate preparation does not register a release or authorize benchmark adoption.

## Identity and digest

Id: `public-pii-phi/<snapshotDate>/<first 12 hex of contentDigest>`. Content digest `files-v1`: SHA-256 over the sorted lines `<file sha256> <path>`, for every file except `manifest.json`. The id is checked against `scripts/id-rules.mjs`, so it never carries release, milestone, scanner or score words. Rebuilding from the same sources with the same tool versions is byte-identical; any content change changes the digest and therefore the id.

## Immutability

`snapshots/released.json` (kind `snapshot-registry`) is the committed registry. A released entry binds the manifest SHA-256, content digest, every file SHA-256, the deterministic archive digests, and the derived tag and release URL. Release pointers live there, outside the digested files.

Enforcement:

- `snapshot:verify` fails if a released snapshot's files differ from the registered digests, if its directory is missing, or if its derived tag or archive digest differs;
- `snapshot:build` refuses to write a released id whose bytes would differ; an identical rebuild is a no-op;
- `snapshot:verify --base <ref>` fails if an entry registered at the base ref was removed or modified, or if its files differ from the base's recorded digests. CI runs it on pull requests against the base branch (full history is fetched);
- an unreleased (draft) snapshot must equal a fresh rebuild from the sources, so a stale committed draft fails the check. Building a new draft replaces older drafts. Once a snapshot is registered, later changes to `evidence/` do not affect it; they produce a different snapshot when next built.

Releasing a snapshot means: merge the pull request that adds the snapshot directory and its registry entry; create the git tag `snapshot-<id with / replaced by ->` on the merge commit; publish a GitHub release for that tag with the deterministic `.tar.gz` and its `.sha256`. Release notes state the id, digests, counts, exclusions and that the evidence is project-maintained and unreviewed.

## Correction policy

A released snapshot is never edited, force-moved or deleted from history to fix content.

- **Evidence or expectation error, new evidence, wider coverage:** fix the source records, build a new snapshot (new id), release it. The old snapshot stays as published; its notes may point to the successor.
- **Real or real-looking personal data found:** follow the [safe-data incident procedure](safe-data-policy.md). The maintainer revokes the snapshot (withdrawal note on the release and in the advisory, without repeating the value), publishes a corrected snapshot under a new id and tells downstream consumers privately to discard derived artifacts. Revocation is an annotation outside the immutable files; the digests in the registry stay.
- **Tooling defect (digest, projection):** bump the tool version, build a new snapshot; do not edit the old one.

## Not in a snapshot

Scanner results, detector ids, support states, thresholds, benchmark scores, protected corpus material, PERSON/NER entities (only pinned `externalRefs`), and wording that presents project-maintained review as independent validation.
