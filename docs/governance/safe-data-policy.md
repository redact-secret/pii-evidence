# Safe-data policy

Status: accepted. Scope: every file, commit message, issue, pull request and comment in `pii-evidence`.

`pii-evidence` is public and is about sensitive-data detection, so accidental publication of real personal or health information is its primary risk. This policy makes the rules in [`SECURITY.md`](../../SECURITY.md) explicit and, where practical, machine-checkable. When the documents differ, the stricter rule wins and `SECURITY.md` is updated.

Related: [provenance and licensing](provenance-and-licensing.md), [review requirements](review-requirements.md), [ADR 0001](../decisions/0001-pii-phi-person-ownership-boundary.md).

## 1. Forbidden material

Never commit, paste into an issue or pull request, or place in a commit message:

- real-person PII when a synthetic or reserved value can express the same case;
- medical, patient, claim, prescription, lab or insurance records tied to a real person;
- customer or user logs, production form submissions, support cases, incident data;
- employee or user directories;
- datasets obtained from customers, incidents, connected systems or breaches;
- scraped personal data without a recorded legal, provenance and redistribution review;
- production credentials, tokens or private keys;
- protected evaluation corpus bytes, or excerpts, samples, hashes-of-values or reconstructions of them;
- a real value with characters altered, or a value assumed safe because it is old, revoked, deleted elsewhere or already leaked;
- PERSON/name evidence copied from real sources (owned by `ner-evidence`).

A scanner result is not evidence that a value is safe to publish. Do not look a value up, or test it against a live service, to find out whether it is real.

## 2. Preference order

Use the first option that expresses the case.

| Rank | Option | Provenance required |
| --- | --- | --- |
| 1 | Reserved or official test namespace or value | the publication that reserves it and an observed-at date; `valueOrigin: reserved` |
| 2 | Deterministic synthetic generator with no real-world provenance | the generator rule; `valueOrigin: synthetic` |
| 3 | Public example from a standard or authority whose redistribution is permitted | link, version, license; `valueOrigin: public-test` |
| 4 | Licensed corpus with recorded redistribution and privacy review | full record, reviewed state; `valueOrigin: licensed-corpus` |
| 5 | Structural description only ("nine digits, area 000, 666 or 9xx") | none beyond the claim's source |

Rank 5 is always acceptable and often best: a structural description needs no value at all.

Reserved sets the lint recognises:

| Shape | Reserved or unissuable |
| --- | --- |
| Email | domains `example.com`, `example.org`, `example.net` (and subdomains); TLDs `.test`, `.invalid`, `.example` |
| Phone (US) | exchange 555 with line numbers 0100 through 0199 |
| SSN | area 000, 666 or 900-999; group 00; serial 0000 |
| Card | only issuer-published test numbers recorded in the allowlist |
| IBAN | only published documentation examples recorded in the allowlist |

Everything else that has the shape of personal data fails the lint until a maintainer decides otherwise (section 7).

## 3. Naturally occurring public examples

A public example that happens to contain personal data (a sample document, a forum post, a dataset row) is never accepted on resemblance to a test value. It requires, recorded in the source record:

1. a stated reason no reserved or synthetic value can express the case;
2. license and redistribution terms that cover the exact excerpt;
3. `naturallyOccurringPersonalData: true`, a `transformations` minimization record (what surrounding text, names, metadata and attachments were removed) and the observed-at date;
4. `review.state: reviewed`, backed by a `review-event` from a maintainer who did not author the change (see [review requirements](review-requirements.md));
5. confirmation the excerpt does not include names, signatures, screenshots, spreadsheet tabs or EXIF/metadata that identify a person.

Until all five hold, the source is `unresolved` and is not public-release-ready. Personal data about a private individual is never accepted this way.

## 4. Protected corpus material is never a public source

Protected corpora, their custody and their results belong to `private-custodian` and `private-ledger`. A source record that carries a protected marker (`protected: true`, or `protected`, `private-custodian` or `private-ledger` as any field value) is a failure of `scripts/lint-provenance.mjs`, is `blocked`, and cannot be made `public-safe` by editing other fields. Protected populations keep independent identities and denominators; only approved sanitized aggregates may cross the boundary, and only through versioned measurement contracts, never as evidence records here.

## 5. Machine checks

| Command | Checks |
| --- | --- |
| `node scripts/lint-safe-data.mjs` | tracked and unignored text files for email, phone, card (Luhn), SSN, IBAN (mod 97), private-key block, credential-shape and high-entropy token patterns |
| `node scripts/lint-provenance.mjs` | source records under `evidence/sources/` for required provenance fields and protected markers; prints the release-readiness summary |
| `node scripts/lint-provenance.mjs --public-release` | the same, and any non-`public-safe` source is a failure |
| `node --test "tests/**/*.test.mjs"` | the linters' own tests, with values built at runtime |

`lint-safe-data` prints only `path:line rule`. It never prints, returns or logs the matched value, and neither must its tests, CI logs or reports. It is a floor, not proof: passing it does not make content safe, and a human review per [review requirements](review-requirements.md) still applies.

### Allowlist

`docs/governance/safe-data-allowlist.json` excuses specific reserved or documented public test values. Each entry needs `id`, `rule`, `sha256`, `reason`, `source` (a publication link) and `observedAt`. An entry identifies the value by the SHA-256 of `rule:normalized-value`, so the allowlist does not repeat it. Compute a hash locally with `printf %s "<value>" | node scripts/lint-safe-data.mjs --hash <rule>`. Optional `paths` restricts an entry to named files. Private-key blocks cannot be allowlisted. Adding an entry is a reviewed change: the reviewer verifies the source publication lists that exact value. An entry is never a way to publish a value that merely resembles a test value.

To cite a reserved or test value in a source record, state its reserving publication in `locator`/`version` with `observedAt`, and set `valueOrigin` to `reserved` or `public-test`. If the lint fires on a documented card or IBAN example, add an allowlist entry; reserved emails, phones and SSNs need none.

## 6. Contributor attestation

Every pull request answers the checklist in `.github/PULL_REQUEST_TEMPLATE.md`. An agent never marks its own work reviewed.

## 7. Accidental exposure: reporting and remediation

If something looks real, stop. Do not copy it into a record, comment, commit message or pull request, and do not open a public issue.

1. **Report privately** through a GitHub Security Advisory for `redact-secret/pii-evidence`, naming the revision, path and line only. Never include the value.
2. **Contain.** A maintainer removes the content from the default branch with a minimal commit and closes or edits any public thread that quoted it.
3. **Decide on history remediation.** Removal in a later commit does not remove the value from history, forks or caches. The maintainer decides, and records in the advisory, whether to rewrite history. Rewrite when the value is, or may be, real personal or health data, a credential, or protected corpus material. Do not rewrite for a reserved or synthetic value that only looked real. A rewrite must be coordinated because forks and clones keep the old objects.
4. **Rotate or revoke** credentials, and notify the data custodian or affected party through the private channel when the value is real.
5. **Snapshots are immutable.** A released snapshot that contains the value cannot be edited. The maintainer revokes it (marks it withdrawn in the advisory and in release notes, without repeating the value) and publishes a corrected snapshot under a new identity. Downstream consumers (`pii-eval`, benchmarks) are told privately to stop using the revoked snapshot identity and to discard derived artifacts that embed the value.
6. **Record the decision** (what was removed, whether history was rewritten, which snapshots were revoked) in the advisory, and add a regression check or lint rule when the shape was not caught.

The history audit workflow is `.agents/skills/scan-pii-in-history`.
