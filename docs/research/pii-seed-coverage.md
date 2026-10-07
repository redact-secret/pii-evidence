# Structured PII seed: coverage notes

Scope: the kinds `email/global/basic`, `phone/global/basic`, `payment-card/global/basic`, `iban/global/basic` and `us-ssn/us/structured`. PHI kinds and the medical context are out of scope here (they are seeded separately). Everything below is project-authored and unreviewed; no scanner output was consulted, and no value was looked up or tested against a service.

Records live in `evidence/sources/<kind>.jsonl`, `evidence/claims/<kind>.jsonl` and `evidence/cases/<kind>.jsonl`, where `<kind>` is `email`, `phone`, `payment-card`, `iban` or `us-ssn`. Each taxonomy kind lists its claim ids in `formatClaims`. No review events exist: every record is `unreviewed`.

## Conventions used by the cases

- Expectations are semantic: identity (`valid`, `invalid`, `not-established`), sensitivity and domains. `valid` describes the shape class (grammar, prefix, length, check digit), not the existence of an account or mailbox; values are reserved, documented test values or constructed so they cannot belong to a person.
- An expectation span is given where identity is `valid` or the candidate token matters (UTF-8 byte offsets). Cases with identity `invalid` carry no span.
- Relationships are reciprocal and stay inside one kind.
- Where a read source did not settle the outcome, the case is `not-established` with the candidate readings and what would settle it.

## Source readiness

Sources that are not `public-safe` (see `npm run lint:provenance`): `iban/swift-registry` (page returned HTTP 403, nothing read, class `research-needed`), `payment-card/stripe-testing`, and `phone/itu-e164` (redistribution terms not read or not established, recorded `unknown`). `us-ssn/ssa-randomization` was later made `public-safe` when the SSA public-domain statement was read (see `first-snapshot-coverage.md`); the SSA statements themselves were read only as search-result excerpts because direct fetches returned HTTP 403, so those claims are `partial`. The E.164 recommendation text was not read, so its maximum length claim is `research-needed` and the cases depending on it are `not-established`.

## Coverage per kind and axis

Legend: covered (case roles in `evidence/cases/`), gap (recorded, not filled).

### email (18 cases)

| Axis | Status |
| --- | --- |
| valid positives | covered: example domains, subdomain with tag, reserved `.test` |
| invalid shapes | covered: missing local part, two at signs, consecutive dots, 65-octet local part |
| not-established identities | covered: non-ASCII local part, fullwidth at sign, reserved `.invalid` mailbox |
| benign/reserved/example | covered: `.invalid`, example domains |
| context-sensitive | gap: field-label and medical contexts have `research-needed` claims; no case asserts a context effect |
| jurisdiction collisions | gap: none identified for the global kind |
| punctuation/serialization | covered: angle brackets, JSON field, trailing sentence period |
| Unicode/boundary | covered: multibyte label (byte span), 64/65-octet boundary, fullwidth at, non-ASCII local part |
| one-property twins | covered: dot for at sign |
| deterministic mutations | covered: two at signs, empty local part, consecutive dots, 65 octets |
| cross-family collisions | covered: `name@version` specifier, `user@host:path` remote |

Gaps: quoted-string, domain-literal, obsolete and internationalized (RFC 6531, unread) forms.

### phone (11 cases)

| Axis | Status |
| --- | --- |
| valid positives | covered, NANP fictional range only (secondary reference) |
| invalid shapes | gap: structural invalidity needs the E.164/NANP text, which was not read; shape cases are `not-established` |
| not-established | covered: seven-digit local, truncated, overlong, fullwidth digits |
| benign/reserved | covered: all values are in the fictional 01xx range |
| context-sensitive | gap |
| jurisdiction collisions | gap: no non-NANP reserved range was researched (for example other countries' drama ranges) |
| punctuation/serialization | covered: dashes, parentheses, spaces, compact, dots, JSON |
| Unicode/boundary | covered: fullwidth digits and parentheses |
| one-property twins / mutations | covered: truncation, appended groups |
| cross-family collisions | covered: ZIP+4-shaped digits, date-time digits |

### payment-card (11 cases)

| Axis | Status |
| --- | --- |
| valid positives | covered: Visa and Mastercard provider-documented test numbers |
| invalid shapes | covered: changed check digit, transposition, 15 digits with Visa prefix, 20-digit run |
| not-established | covered: fullwidth digits |
| benign/reserved | covered by test-number values; gap: other documented numbers (15-digit American Express and others) were not read from the provider page |
| context-sensitive | covered: test number under a non-card label (`context-dependent`); gap: medical context |
| jurisdiction collisions | gap: not applicable to the global kind as researched |
| punctuation/serialization | covered: groups of four with spaces, hyphens |
| Unicode/boundary | covered: fullwidth digits, over-length run |
| twins / mutations | covered |
| cross-family collisions | covered: 16-digit order number, 13-digit epoch milliseconds |

Gaps: Luhn-valid digit strings that are not cards cannot be published (the safe-data rules treat any Luhn-valid run as card-shaped unless allowlisted), so that collision is only represented by check-digit-failing look-alikes. Issuer rules beyond a secondary reference to ISO/IEC 7812 are unread. Whether a payment card is `pii`, a separate financial domain, or both remains an open taxonomy question.

### iban (11 cases)

| Axis | Status |
| --- | --- |
| valid positives | covered: documented United Kingdom example in three serializations |
| invalid shapes | covered: altered check digits, transposition, swapped country code, truncation, over 34 characters |
| not-established | covered: lowercase, non-breaking-space grouping |
| benign/reserved | covered: documented example; gap: the German example in the allowlist was not observed in the read source |
| context-sensitive | gap |
| jurisdiction collisions | gap: per-country structures need the registry, which returned HTTP 403 |
| punctuation/serialization | covered: paper grouping, JSON |
| Unicode/boundary | covered: non-breaking spaces, 34-character boundary |
| twins / mutations | covered |
| cross-family collisions | covered: alphanumeric product key |

### us-ssn (11 cases)

| Axis | Status |
| --- | --- |
| valid positives | gap by design: every value in the issuable range may belong to a person and cannot be published. Represented structurally by a description-only twin (`twin/issuable-structure-description`) |
| invalid shapes | covered: area 000, 666, 9xx, group 00, serial 0000 (group and serial cases also use area 000 so they stay unissuable independent of the property under test) |
| not-established | covered: ITIN-shaped description-only collision |
| benign/reserved | covered: all values are in unissuable ranges |
| context-sensitive | gap |
| jurisdiction collisions | gap: other national identifiers are not researched |
| punctuation/serialization | covered: spaces, parentheses boundary, bare nine digits |
| Unicode/boundary | covered: non-breaking hyphens |
| twins / mutations | covered |
| cross-family collisions | covered: bare nine digits, ITIN structure inside the SSN-unassigned 9xx area |

### National and tax identifiers beyond us-ssn

Not seeded. `national-id/unresolved/placeholder` remains unresolved with its open questions. The only related evidence is the secondary-reference statement that ITINs use a 9xx area with a 7x or 8x group (claim `us-ssn/reference-itin-format`); an ITIN or EIN kind would need the IRS publications read first.

## Ids a fixture projection needs

Case ids have the form `<privacy-kind-id>/<role>/<slug>`; each case that has `input.text` is directly projectable and carries its own byte span. The description-only cases (`us-ssn/us/structured/twin/issuable-structure-description` and `us-ssn/us/structured/collision/itin-shaped-nine-range`) have no input and must not be materialized as values.
