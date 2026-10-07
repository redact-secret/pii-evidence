---
name: scan-pii-in-history
description: Scan the full Git history of pii-evidence for accidentally committed real PII, PHI or credentials and triage hits against recorded provenance. Report-only; never prints matched values. Use for periodic audits or before a snapshot release.
---

# Scan PII in history

Run a history-aware scanner with redaction enabled over all commits reachable from `HEAD`
(for example gitleaks, which is also CI's independent second opinion, or trufflehog for credentials, plus a PII-pattern pass for emails, phones,
cards, IBANs, SSNs and health identifiers). Record tool, version, rule set and scope. A scanner
being absent is `not assessable`, not a pass.

Every hit needs provenance-based triage. A value is expected only when its record proves it is
reserved, synthetic or a documented public example. Format validity, age, or location under a
fixtures directory is not enough. Hits in sources, prose, notes, snapshots, logs, CI artifacts
or commit messages get extra scrutiny.

Report commit, path, rule id and one disposition: `reserved/test value`, `verified synthetic`,
`documented public example`, `unclear: maintainer review`, or `possible real data: needs
private remediation`. Never print or partially quote a match.

Do not rewrite history, contact a source, open a public issue or notify downstream consumers.
Remediation and snapshot revocation are maintainer decisions made privately
([SECURITY.md](../../SECURITY.md)).
