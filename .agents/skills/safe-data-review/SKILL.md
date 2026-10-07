---
name: safe-data-review
description: Review a change or the working tree for real or real-looking personal and health data in a public evidence repository, and verify every PII/PHI-shaped value is reserved, synthetic or documented public test data. Read-only; never prints matched values. Use before opening or merging any change that adds values.
---

# Safe-data review

The primary risk of this repository is accidental publication of real PII/PHI. Read
[synthetic safety](../_shared/synthetic-safety.md) and `SECURITY.md` first. Read-only.

## Steps

1. List added/changed files in the diff, including records, fixtures, snapshots, source
   excerpts, docs, notes, scripts, test data, commit messages and PR text.
2. For every email, phone, card, IBAN, national/tax id, MRN, member/claim/prescription id,
   address, date of birth and name-like value, require provenance: reserved/test namespace,
   documented generator rule, published example with link, or licensed-corpus review. Resemblance
   to a valid format, age, revocation or a scanner verdict is not provenance.
3. Check context: medical wording near an identifier must not describe a real patient or event.
4. Check source excerpts and attachments for surrounding real data (names, signatures,
   screenshots, spreadsheet tabs, EXIF/metadata).
5. Check that values were not obtained from breach dumps, customer or patient data, logs, form
   submissions, support cases or scanner output.
6. Check for credentials or secrets in tooling and config.

## Report

Per finding: path, location (line or JSON pointer), kind, and one disposition:
`reserved/test value`, `verified synthetic`, `documented public example`,
`licensed corpus (reviewed)`, `unclear: maintainer review` or `possible real data: stop`.
Never print or partially quote the match. For `possible real data`, do not copy it anywhere,
open no public issue, and direct the maintainer to a private GitHub Security Advisory. History
remediation is a maintainer decision.
