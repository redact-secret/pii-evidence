# Domain modeling

`pii` and `phi` are axes, not buckets ([CONVENTIONS.md](../../../CONVENTIONS.md)).

```text
email                      domains: [pii]
medical-record-number      domains: [pii, phi]
patient-email (occurrence) base kind: email, domains: [pii, phi], context: medical
```

- **Structured kind vs context.** Do not duplicate a base identifier because it can become
  PHI. Model the kind once and the contextual relationship explicitly. Create a dedicated
  kind only when the identifier itself is health-domain specific.
- **Fields** of a `PrivacyKind`: `id`, `label`, `domains`, `baseKind?`, `jurisdictions[]`,
  `formatClaims[]`, `contextClaims[]`, `openQuestions[]`.
- **Identity.** Lowercase, URL-safe, semantic, stable: `email/global/basic`,
  `us-ssn/us/structured`, `medical-record-number/us/labeled-field`. Never put issue or PR
  numbers, milestones, release names, detector IDs, scanner names, scores or migration
  coordinates in an id; put them in metadata or external references.
- **Expected outcomes** are semantic: identity `valid | invalid | not-established`;
  `sensitive | non-sensitive | context-dependent`; exact span; jurisdiction match/mismatch;
  `must-observe | must-not-observe` where justified.
- **Out of scope:** general PERSON/name recognition ([scope-boundary](scope-boundary.md)).
