# Agent instructions

@\~/.codex/RTK.md

Read `README.md` and `ARCHITECTURE.md` before changing this repository. They
define the canonical ownership and dependency direction.

## Repository boundary

`pii-evidence` owns scanner-neutral, public structured PII/PHI evidence: privacy
kinds, jurisdiction and context profiles, source provenance, authored cases
(positive, negative, ambiguous, benign twins, collisions), deterministic fixture
projections with lineage, review history, and immutable snapshots. It does not
own scanner implementation or execution, measurement (`pii-eval`), support
states, thresholds or release decisions (`redact-secret-benchmarks`), PERSON/NER
evidence (`ner-evidence`), or protected PII/PHI corpora and custody
(`private-custodian`, `private-ledger`).

The primary architectural test is: would this record still be meaningful to
another PII/PHI scanner or evaluator?

## Working rules

- Start from a privacy kind, jurisdiction, context, case, or source claim, not a
  detector name.
- Author expectations from evidence and case reasoning, never from scanner
  output or consensus.
- Treat `pii` and `phi` as domain axes. Model a shared base kind once and the
  medical context explicitly; do not duplicate an identifier because it can
  become PHI.
- Do not add PERSON/name evidence, name ambiguity, or general NER content;
  compose with a `ner-evidence` snapshot by reference instead.
- Give every material claim traceable provenance and an observed-at date, and
  keep observed fact separate from project inference.
- Preserve authored-versus-generated lineage. Fixtures are derived artifacts;
  generation is deterministic and never invents an expectation.
- Use stable, lowercase, URL-safe ids with no issue/PR numbers, milestones,
  detector ids, scanner names, or scores.
- This repository is public. Use only reserved/test values, deterministic
  synthetic values, or documented redistributable examples. Real-person PII,
  patient data, customer or production data, and protected corpus bytes are
  forbidden, including values that are old, revoked, or already leaked.
  `SECURITY.md` governs.
- Released snapshots are immutable; a semantic correction is a new snapshot.
- Describe project-maintained evidence as such, never as independent validation.
- Governance docs in `docs/governance/` define the safe-data policy,
  provenance and licensing fields, and review requirements. Every source needs
  license, redistribution, observed-at, value-origin and evidence-class
  metadata; protected corpus material can never be a public source. Allowlist
  entries in `docs/governance/safe-data-allowlist.json` need a reason and a
  source; never print or quote a matched value.

## Branches

`main` is the default branch. Work on a feature branch and open pull requests
against `main`. Never merge your own pull request, with one exception: the repository owner
explicitly instructed the agent to run issues #2-#9 through merge, so for the
pull requests that close those issues the agent merges its own pull request
after verification. For every other pull request, never merge your own. If CI, branch protection, or
another long-lived branch is introduced, update this section first.

## Before finishing

Run `npm ci` (once) and `npm run check`. `check` runs `npm run validate`
(schema, cross-reference, duplicate-id, id-lint and fixture lineage checks over
`taxonomy/`, `evidence/`, `fixtures/`, `snapshots/`), `npm run lint:privacy-data`
(PII/PHI publication safety; `lint:safe-data` is an alias), `npm run lint:credentials`
(credential publication safety via `@redact-secret/core`, no allowlist),
`npm run lint:provenance` (see `docs/governance/`),
`npm run fixtures:materialize:check` (deterministic projection: two runs
byte-identical, every fixture matches its authored case and rule; see
`docs/methodology/fixture-projection.md`), `npm run snapshot:verify` (every snapshot
directory and the released registry; see `docs/governance/snapshot-policy.md`) and then `npm test`; CI (`verify`) runs the
same, plus a gitleaks second-pass job as an independent second opinion.
See `docs/methodology/schemas.md`. `npm run fixtures:materialize` writes the
untracked, ignored `fixtures/materialized/`, which is never committed. `npm run snapshot:build -- --date YYYY-MM-DD` assembles
`snapshots/<id>/`; released snapshots (`snapshots/released.json`) are immutable and CI
also runs `npm run snapshot:verify -- --base origin/main`. The consumer contract is
`docs/methodology/consumer-contract.md`; what `pii-eval` does with a released snapshot, and what the first public
measurement does and does not authorize, is `docs/methodology/pii-eval-handoff.md` (the consumer's loader and mapping
live in `pii-eval`; nothing here may depend on them, and a released snapshot is never edited to suit a consumer). A formatting command does not exist yet; report
that fact rather than inventing one, and add new steps to `npm run check` when they land. Verify that new fixtures trace to an
authored case, reviewed contract, or documented generation rule and that no
scanner-specific support status entered the canonical model.

## Local skills

Workflows live in `.agents/skills/` and are linked into `.claude/skills/` by
relative symlinks (`../../.agents/skills/<name>`). Edit only under `.agents/`.
Shared reference pages in [`.agents/skills/_shared/`](.agents/skills/_shared/README.md)
are not skills; they summarize the rules, and `README.md`, `ARCHITECTURE.md`,
`CONVENTIONS.md` and `SECURITY.md` win when they differ.

The repository is in its initial architecture phase (schemas, validators, the fixture
materializer and the snapshot builder exist; a formatter does not). Skills must report a
missing check as `not assessable` or "does not exist", never invent a command or
a pass.

Authoring (one bounded unit per run, always a pull request, never a merge):

- `research-kind`: one privacy kind with domains, jurisdictions, format/context
  claims, sources, and open questions.
- `author-case`: one Case with a scanner-neutral expectation, or the decision
  that no new record is needed.
- `fixture-projection`: deterministic projection rules and materialization with
  exact lineage.

Read-only review and audit:

- `boundary-review`: ownership and dependency-direction violations (PERSON/NER,
  scanner or product policy, evaluator code, protected data).
- `safe-data-review`: real or real-looking PII/PHI in a diff or the working tree.
- `scan-pii-in-history`: full-history scan for PII, PHI, and credentials.
- `snapshot-check`: manifest, digests, counts, lineage, and consumer contract.
- `owasp-review`: security review of tooling once implementation exists.

Safety scans must distinguish reserved/synthetic values from accidental real
data, and never print or quote a matched value.

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->
