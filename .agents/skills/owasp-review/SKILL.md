---
name: owasp-review
description: Review pii-evidence validators, materializers, snapshot builders and CI against applicable OWASP guidance and the repository's evidence trust model. Read-only. Use for secure-design reviews of implementation once it exists.
---

# OWASP review

Start with `ARCHITECTURE.md`, `SECURITY.md`, schemas and the scoped implementation. If no
implementation exists yet, report that and review the contracts instead.

Assess untrusted structured-data validation, reference and path containment (path traversal),
unsafe archive/snapshot extraction, digest and manifest verification bypass, schema confusion
that could mix protected and public evidence, remote-source fetching, output encoding,
denial of service, CI permissions, dependency integrity, error/log redaction (no sensitive
values in logs), and provenance spoofing (private data presented as safe public evidence).
Include controls preventing generated fixtures or scanner output from becoming canonical facts.

Report each applicable control as `pass`, `fail` or `not assessable` with file:line evidence.
Separate application-security controls from evidence quality: an unsupported claim is a
governance issue unless it bypasses a security boundary. A scanner miss is not a vulnerability.

Do not edit records or judge scanner detection quality.
