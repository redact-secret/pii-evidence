# Snapshot candidate delta

`npm run snapshot:delta` writes deterministic machine and human reports to
`docs/research/snapshot-v2-delta.json` and `.md`. `npm run snapshot:delta:check`
recomputes both and refuses missing or stale bytes; it is part of `npm run check`.

The input pointer is `docs/research/snapshot-v2-candidate.json`, schema
`snapshot-v2-candidate/1`. `baseline` and `snapshot` each contain the exact
snapshot `id` and `manifestSha256`. The baseline must match the released registry;
the target with `status: candidate` must remain unregistered. A later explicit
maintainer release updates the pointer to `status: released`, which requires the
target's exact manifest pin to match the registry. `adjudications` lists the bounded
research ledger paths. The report binds each ledger's raw-byte SHA-256, verifies
the manifest pins and listed file digests, and reads only the pinned snapshot
files. It does not rebuild evidence or import consumer implementation code.

The delta compares taxonomy entries and authored/generated records by stable ID
and canonical JSON, reports added/removed/changed IDs, exact count changes,
coverage, review-state counts and complete exclusions. Every research disposition
and unresolved question remains visible. Per-decision Case accounting records
whether the cited Case is included, excluded with reasons, or not authored or
selected. An accepted research decision does not override provenance gates;
acceptance and snapshot inclusion are different facts.

A deferred or rejected new role may still cite an existing bounded ambiguity or
collision control. `canonicalCaseDisposition` records that distinction. A Case
whose own effective disposition is `defer` or `reject` cannot appear in the
candidate. Unknown dispositions refuse rather than guessing.

`mappingExpectations` is optional declared metadata owned by `pii-eval`. It is
reported as expectations, never scanner results or an executed measurement.
The separate candidate handoff report records actual verify/import refusal and
downstream preparation results. Neither report authorizes product adoption,
changes population denominators or registers the candidate as released.
