# Snapshot v2 candidate handoff

The candidate verifies in the existing consumer, but import refuses unknown
date-of-birth semantics. Downstream adoption is blocked and no scanner ran.

Candidate: `public-pii-phi/2026-10-08/d8add618935d`, manifest SHA-256
`cb396cfc2897aba01c423bbb6d6acec98fb3574183f1a98c0cf24a8d23633073`.
Content digest:
`d8add618935d350c30d4ba5df3a3f707ee02f1cd9d238af9740d69f2e8d07502`.
It contains 116 Cases, 275 fixtures and 18 skipped Case/rule pairs.
See [coverage delta](snapshot-v2-delta.md) for the complete denominator changes
and unresolved inventory, and [machine handoff](snapshot-v2-handoff.json) for
exact identities and refusal results.

## Reproducibility and release state

Two archive runs produced byte-identical archives:

- tar SHA-256: `4970d6f9e1108bd6298d89ee89ff63d847cd30df1463b45960d19a91b0f10040`.
- tar.gz SHA-256: `9afd9ce401b0019d9c409f153d016d84da62bbff664c7e788b0d5d9c543c3dd8`.

```sh
npm run snapshot:build -- --date 2026-10-08
npm run snapshot:verify
npm run snapshot:verify -- --base origin/main
npm run snapshot:delta:check
node scripts/snapshot.mjs pack public-pii-phi/2026-10-08/d8add618935d --out <new-archive-dir>
```

The candidate remains unregistered. No release tag or GitHub release was
created. Proposed archive/tag metadata used for local verification does not
claim a published release. Snapshot registration and release remain an explicit
maintainer action under [snapshot policy](../governance/snapshot-policy.md).

## Scanner-free consumer results

The existing local debug binary in `pii-eval` at source revision
`e99128f5633c5905497342623e249ad90d902800` was used without a new build.
Its SHA-256 is recorded in the machine handoff; it is exploratory local evidence,
not the pinned canonical benchmark runtime.

```sh
pii-eval-evidence verify --snapshot-dir <candidate-dir> --pin <candidate-pin.json>
pii-eval-evidence import --snapshot-dir <candidate-dir> --pin <candidate-pin.json> --out <new-import-dir>
```

`verify` accepted with exit 0. `import` refused with exit 3, reason
`kind-unmapped`, at
`date-of-birth/global/labeled-field/ambiguous/age-over-89`. No import output was
written. This confirms the consumer refuses unknown semantics rather than
guessing; it does not establish successful import of the broader candidate.

Mapping revision 1 also lacks UK NINO and jurisdiction `uk`. These are declared
compatibility gaps from the consumer's documented mapping, not additional
observed refusals after the first failure. Whole-snapshot import refused, so
there are no mapped population, measurement or observed mapping-loss counts.
The five known semantic loss classes remain listed in the machine report.

## Benchmarks proposal preparation

```sh
node scripts/preflight-pii-evidence.mjs --source-dir <pii-eval-checkout> --consumer-bin <binary> --snapshot-dir <candidate-dir> --candidate-snapshot-pin <candidate-pin.json> --out <new-preflight.json>
node scripts/prepare-pii-evidence-adoption.mjs --preflight <verified-preflight.json> --out-dir results-output/pii-evidence-adoption/snapshot-v2-candidate
```

The preflight refused with exit 1, `consumer-binary-not-pinned`, before writing
a report. The preparation helper then refused because a verified preflight
input did not exist. No helper-produced adoption candidate, approval, active
pin change or authority change was manufactured. The broader evidence candidate
and blocked proposal identities are available in the machine handoff.

The consumer owner must review the new kind and jurisdiction mappings. The
benchmark owner must supply the exact pinned consumer runtime before proposal
preparation can succeed. Release and acceptance require explicit maintainer
decisions. Fresh measurement, product support claims and protected execution
remain outside this scanner-free candidate handoff.
