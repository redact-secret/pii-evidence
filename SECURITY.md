# Security Policy

`pii-evidence` is a public evidence repository about sensitive-data detection. That makes accidental publication of real personal or health information the primary repository-specific risk.

## Reporting

Report suspected vulnerabilities or accidental sensitive-data exposure privately through GitHub Security Advisories for `redact-secret/pii-evidence`.

Do not place real PII, PHI, patient data, credentials, or private corpus samples in a public issue, pull request, discussion, comment, or reproduction.

## Forbidden material

Never commit:

- real-person PII when a synthetic or reserved value can express the same case;
- medical records, patient records, claims, prescriptions, lab results, or insurance records tied to a real person;
- customer/user logs or production form submissions;
- private employee/user directories;
- private datasets obtained from customers, incidents, support cases, or connected systems;
- scraped personal data without explicit legal, provenance, and redistribution review;
- production credentials or secrets;
- protected evaluation corpus bytes;
- data merely assumed safe because it is old, revoked, deleted elsewhere, or publicly leaked.

## Safe evidence

Prefer, in order:

1. official reserved/test namespaces and values;
2. deterministic synthetic generators with no real-world provenance;
3. public standards/examples whose redistribution is permitted;
4. licensed corpora with explicit redistribution and privacy review;
5. minimized structural descriptions when raw examples are unnecessary.

A scanner result is not evidence that an input is safe to publish.

## Publication checks

Three layers guard publication, each with one job. `npm run lint:privacy-data` checks PII/PHI shapes (email, phone, card, SSN, IBAN). `npm run lint:credentials` checks credentials and private keys using the published `@redact-secret/core` package; this repository owns no credential patterns and offers no allowlist for credentials. Gitleaks in CI is an independent second opinion. None proves content is safe; human review still applies.

## Protected evidence boundary

Real-world protected PII/PHI belongs outside this repository.

Protected evaluation should use the private custody path:

```text
private corpus → private-custodian → isolated pii-eval → signed aggregate/projection
```

Only approved sanitized outputs may leave that boundary. `pii-evidence` never acts as storage for the protected corpus.

## PERSON/name boundary

General person-name evidence belongs to `redact-secret/ner-evidence`. Do not copy naturally occurring names into this repository just to make a PII example more realistic.

Use synthetic names or placeholders when a surrounding structured PII/PHI context requires a person reference.

## Security-sensitive implementation issues

The following are in scope for private reporting:

- privacy/provenance validator bypass;
- generated fixtures unexpectedly containing real data;
- path traversal or arbitrary-file access in tooling;
- unsafe archive/snapshot extraction;
- digest or manifest verification bypass;
- schema confusion that can cause protected/public evidence mixing;
- accidental publication of protected corpus material;
- provenance spoofing that misrepresents private data as safe public evidence.

A scanner disagreement or missed detection by itself is not a vulnerability in this repository.

## Response expectations

A useful report includes the affected revision/path, impact, and a reproduction that avoids exposing the sensitive value. Maintainers may coordinate history remediation, source rotation, or downstream snapshot revocation privately where necessary.
