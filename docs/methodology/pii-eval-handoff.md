# Handoff to `pii-eval`

Status: accepted. The first end to end loop, `pii-evidence snapshot -> pii-eval -> reproducible measurement artifact`,
has run over the first released snapshot (issue #9). This page is the pointer from the evidence side. The implementation,
the exact mapping decisions, the reproduction commands and the measurement are in `pii-eval`
(`docs/evidence-consumer.md`, ADR 0019, `docs/migration/pii-evidence-handoff.md`); nothing here duplicates them and
nothing in this repository depends on them ([consumer contract](consumer-contract.md), dependency direction in
`ARCHITECTURE.md`).

## What was consumed

Only the released snapshot `public-pii-phi/2026-10-07/9d4e8e036bbb`, pinned by id, manifest SHA-256
(`a9e24b6dc73bc876f9fce341c7305421b054ae399df83d198513bede03555ca9`) and content digest
(`9d4e8e036bbb180fb3a09569a2993e51ad10fbc183765882325f2bc10b321ba2`), with the release tag
`snapshot-public-pii-phi-2026-10-07-9d4e8e036bbb` resolving to commit `c436ae013011b9c8b1126f589d1b14d99a84baf5`
(`snapshots/released.json`). `pii-eval` vendors a copy that is byte-identical to the released archive (it rebuilds the
deterministic tar and compares the pinned digest) and verifies it with its own loader before anything runs. The
loader refuses, with a stable reason code and nothing written: a different or incompatible snapshot id, an unknown
consumer contract name or version, a pin or recorded digest mismatch, a tampered or missing or unlisted file, a
record whose `kind` or `schemaVersion` is unknown or whose required field is missing, a population that is not
`public`, any scanner, detector, support-state, threshold or score key, an unresolved reference, a bad span, and a
fixture that asserts more than its case or rule. This is the contract's section 4 plus the neutrality and population
rules of section 2, applied by a consumer that shares no code with this repository.

## Who owns what

| Concern | Owner |
| --- | --- |
| What a value is: cases, fixture bytes, spans, expectations, sources, provenance, the snapshot and its digests | `pii-evidence` (this repository) |
| How a scanner behaves on an identified population under a protocol: verification, mapping, execution, replay, accounting, the artifact | `pii-eval` |
| What a result means for Redact Secret: scorer, denominators, thresholds, support states, rankings, release and publication | downstream benchmark qualification (`redact-secret-benchmarks`) |
| Protected populations, custody, budgets | `private-custodian`, `private-ledger` |

The public measurement does **not** authorize Redact Secret product qualification, a support state, a threshold or a
ranking, and it is not a protected evaluation. It used no protected corpus, custodian, ledger, EC2 host or production
key. Counts stay over this snapshot only: a consumer must not add another population into this denominator.

## What the first run showed about the evidence

Findings for authors, not scanner findings. Each is a mapping loss in `pii-eval` that follows from how the evidence is
written; none changes a released record (released snapshots are immutable), and each is a candidate for a later
snapshot or a contract revision.

- **Assertions without a span cannot be anchored.** 17 fixtures state identity `invalid` and 19 state sensitivity
  `non-sensitive` or `sensitive` with no span. `pii-eval` carries a located value only with a span; without one it can hold
  only `not-established` (observed `unresolved`, `review-required`). The weaker value never asserts more than the
  evidence, but the authored "this invalid value is benign" claim is not scored. Authoring a span for such a negative
  case would let it be measured.
- **`context-dependent` is not `not-established`.** 11 located fixtures state sensitivity `context-dependent`;
  `pii-eval` has one weaker value and maps both to it.
- **Contexts and the `phi` domain are not carried.** `pii-eval` has no context-id or domain field and its families are
  PII-only, so 37 fixtures keep their `contexts[]` and `domains[]` only in the consumer's binding record, by identity.
- **Slash-separated ids are re-derived.** `pii-eval` identifiers forbid `/`, so ids are mapped with a domain-separated
  SHA-256 and the mapping is recorded; the evidence ids themselves are untouched.
- **Rule-derived fixtures are consumed as the contract says.** The 16 `derivedFromRule` fixtures arrive as range-less,
  `not-established` variants and are never scored as valid or invalid.
- **The taxonomy contains a JSON `null`** (an example occurrence in `taxonomy/contexts.json`). The contract does not
  forbid it, and a consumer reader must accept it (`pii-eval`'s own contract parser rejects `null`, so its evidence reader
  is separate). See the clarification in section 1 of the [consumer contract](consumer-contract.md).
- **Excluded kinds.** The snapshot has no `payment-card`, `iban` or `national-id` case (`coverage.kindsWithoutCases`);
  the consumer maps the first two so a later snapshot needs no rule change, and refuses `national-id` until a
  jurisdiction is named.

## Reproduce

In a `pii-eval` checkout (commands and expected digests are in its `docs/evidence-consumer.md`):

```sh
cargo build --release --locked -p pii-eval-cli
node tools/pii-evidence/reproduce.mjs      # verify, import, plan, execute, replay, compare with the committed record
```

The committed record, observation set and artifacts are under
`docs/measurements/pii-evidence-public-pii-phi-2026-10-07-9d4e8e036bbb/` in `pii-eval`. The replay of that observation set
(no scanner, no network) reproduces the committed semantic digests and bytes and runs in `pii-eval` CI.
