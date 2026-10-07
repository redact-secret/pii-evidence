---
name: snapshot-check
description: Verify an immutable evidence snapshot manifest, digests, counts, coverage and the pii-eval consumer contract before release. Read-only. Use when preparing, reviewing or auditing a snapshot.
---

# Snapshot check

Read `ARCHITECTURE.md` §10-11 and `CONVENTIONS.md` (Snapshots). Snapshots are the only supported
evaluator input; consumers must not depend on source-tree layout. Read-only: never edit a
released snapshot.

## Verify

1. **Identity and immutability.** The id is unique; a released snapshot's files are unchanged
   from its recorded digest. Any semantic correction is a new snapshot id, never an edit.
2. **Manifest binds** taxonomy and schema versions, source manifest digest, content digest,
   generator identity/version, case and fixture counts, language/jurisdiction/domain coverage,
   provenance/privacy validation status, and the consumer contract version.
3. **Recompute** digests and counts independently from `cases.jsonl`, `fixtures.jsonl`,
   `sources.jsonl`; they must match the manifest.
4. **Lineage.** Every fixture references an existing Case and generation rule; every Case
   references sources; no orphan or dangling reference.
5. **Consumer contract** (`ARCHITECTURE.md` §11): stable case/fixture IDs, exact byte ranges,
   identity state, sensitivity/context axes, jurisdiction/domain metadata, deterministic fixture
   bytes, scanner-independent expected outcome.
6. **Neutrality.** No detector IDs, support states, thresholds or current-scanner expectations.
7. **Safety.** Run the [safe-data review](../safe-data-review/SKILL.md) over snapshot content.
8. **Public/protected separation.** Nothing indicates protected corpus material or a merged denominator.

Report each item as `pass`, `fail` or `not assessable` with path evidence. If the digest or
validation tooling does not exist, mark `not assessable`; do not claim a pass.
