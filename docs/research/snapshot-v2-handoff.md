# Snapshot v2 candidate handoff

The final candidate verifies and imports with reviewed mapping revision 2. The
benchmarks helper prepared a concrete adoption proposal; no scanner ran and
active evidence pins, product authority and owner acceptance remain unchanged.

Candidate: `public-pii-phi/2026-10-08/ee61c7afc32d`, manifest SHA-256
`acf14bf012740f25083a6c50134afffa406605061138208bbe83d7f83ad8eb0b`.
The exact content, source-manifest and archive digests are in
[snapshot-v2-handoff.json](snapshot-v2-handoff.json). It contains **118 Cases,
285 fixtures and 18 skipped pairs**. The [coverage delta](snapshot-v2-delta.md)
reports all denominator changes and unresolved research decisions.

## Deterministic candidate and release state

Two independent pack runs produced byte-identical tar.gz archives. The tar
SHA-256 is `ae0324a180361a70bd6f225859fe46f7fde6f02f4d9d317a2336ae432c0a2e36`;
tar.gz SHA-256 is `e86648cf7c54fd6fcc62a17e58859aa334557b6cb9ba30954d12a42cc087c626`.

```sh
npm run snapshot:build -- --date 2026-10-08
npm run snapshot:verify
npm run snapshot:verify -- --base origin/main
npm run snapshot:delta:check
node scripts/snapshot.mjs pack public-pii-phi/2026-10-08/ee61c7afc32d --out <new-archive-dir>
```

The proposed release identity points at committed canonical evidence revision
`d6825d5985c7fbc83d54e49f5c0b5426e5d852a2`. The candidate is unregistered;
no tag or GitHub release was created. Registration/release remains an explicit
maintainer decision under [snapshot policy](../governance/snapshot-policy.md).

## Actual scanner-free consumer results

`pii-eval` revision `74b35e4aeffeef9c8679f3d7809cfe4415a0bc42` was built from
clean merged source with the exact locked command recorded in the machine
report. The local Darwin debug binary SHA-256 is
`42fdfda23ba649810f48f74b2c9555bd364070c1f6d15d8c8993791253e185e9`.
The source archive, lockfile, toolchain, helper and shim are pinned in the
reviewed benchmarks runtime registry. This is local verification, not a
canonical Linux measurement receipt.

```sh
cargo build --locked -p pii-eval-cli --bin pii-eval-evidence -j 2
pii-eval-evidence verify --snapshot-dir <candidate-dir> --pin <candidate-pin.json>
pii-eval-evidence import --snapshot-dir <candidate-dir> --pin <candidate-pin.json> --out <new-import-dir>
```

Both commands accepted with exit 0. Mapping revision 2 retains the shared
birth-date base kind and maps authored global/US/UK occurrence jurisdictions
into their correct scopes. UK NINO maps to the ISO GB national insurance family.
The original released snapshot keeps mapping revision 1 and its exact historical
population/import digests. Unknown kinds or jurisdictions still refuse.

The mapped population is **version 2**, with 123 corpus Cases and 285 occurrences:
198 located and 87 range-less. Three authored Cases have no fixture. The exact
population and output byte digests are in the machine report.

Actual loss counts: contexts not carried **102**, PHI domain not carried **74**,
context-dependent sensitivity flattened **35**, identity weakened without a span
**44**, sensitivity weakened without a span **47**. These are representation
losses, not scanner misses or product support findings. The proposal compares
all five loss classes to the original snapshot without pooling denominators.

## Concrete benchmarks proposal

The benchmark preflight accepted the whole import against an exact registered
candidate consumer identity. Its preparation helper then produced
`candidate.json`, `summary.md` and `acceptance-plan.json`, recorded under
`docs/reports/pii-evidence-snapshot-v2-candidate/` in `redact-secret-benchmarks`.
Candidate digest:
`5732aed798ea7da0cb484c6b14fe76e04bd8ee6efc3ff84773322d18ffcf78cc`.

```sh
node scripts/preflight-pii-evidence.mjs --source-dir <clean-pii-eval> --consumer-bin <exact-binary> --snapshot-dir <candidate-dir> --candidate-snapshot-pin <candidate-pin.json> --candidate-consumer-pin <reviewed-consumer-pin.json> --out <new-preflight.json>
node scripts/prepare-pii-evidence-adoption.mjs --preflight <verified-preflight.json> --previous benchmarks/pii-evidence/preflight.json --out-dir results-output/pii-evidence-adoption/snapshot-v2-candidate
```

The prior unknown-kind import and unpinned-runtime blockers were resolved.
The helper-generated proposal remains `proposed`, `canApply: false`, with zero
scanner executions, no owner acceptance and no active pin or authority changes.
Fresh canonical measurement requires its own Linux build receipt and explicit
cost/execution authorization; active adoption requires a separate explicit
maintainer acceptance. Neither prerequisite is manufactured by this handoff.
