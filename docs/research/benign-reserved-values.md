# Benign and reserved value discrimination: findings, gaps and impact

Status: draft, unreviewed agent work (observed 2026-10-07). Nothing here is independent validation. Records: `evidence/sources/benign-sources.jsonl`, `evidence/claims/benign-claims.jsonl`, `evidence/cases/benign-cases.jsonl`. No taxonomy, schema, rule, projector, allowlist or snapshot file was changed.

## Question

Which values that look like personal data are benign, and does the evidence say so for a reason a source supports? The repository already treats reserved values (example domains, the fictional telephone block, unissuable SSN structure, provider-documented test cards, documentation IBANs) as the safe way to author positives. That makes "reserved" a property of the value's origin, not of its semantics. This note separates the benign classes and records what each one does and does not establish.

## Benign classes

| Class | Examples (structure only) | What a source establishes | Authored here |
| --- | --- | --- | --- |
| Reserved or documentation value | example domains, `.test`, `.invalid`, `localhost`, fictional phone block, documented test card and IBAN | the value cannot reach a person (RFC 2606, RFC 6761, NANP block, provider docs) | existing positives; one new ambiguous case (single-label loopback host) |
| Unassignable structure | SSN area 000 or 666, group 00, serial 0000 | the structure is never issued (SSA excerpts) | existing negatives |
| Template or merge token | `${NAME}`, `{domain}` | nothing needed: not in the kind's grammar | 2 email negatives |
| Fill-in placeholder | letters in digit positions | nothing needed for letters; grammatically valid fills need a policy decision | 4 negatives (phone, SSN, card, IBAN), 1 email not-established |
| Partial mask | stars with a retained first character or last digits | grammar says it is not a complete value; sensitivity is a policy question | 5 ambiguous (email, phone, SSN, card, IBAN) |
| Role or non-person address at a reserved domain | no-reply sender | grammar only | 1 ambiguous email |

Established by cited sources: RFC 2606 section 2 and 3 (reserved names), RFC 6761 sections 6.2 to 6.5 (test, localhost, invalid, example), plus the existing NANP, SSA, provider and IBAN claims. Project inference, marked on each case: that letters and braces are outside the kind's grammar, that a mask character is not part of a value, and the sensitivity readings.

## Cases

Fourteen cases: email 6 (2 template negatives, 1 placeholder, 1 masked, 1 role address, 1 loopback host), phone 2, us-ssn 2, payment-card 2 and iban 2 (each a letter-fill negative and a masked ambiguity). All use reserved, public-test or letter-only synthetic values. Cases whose string is not a complete value carry no span. The ambiguous ones carry reasons and a `wouldSettle` statement and do not decide the policy question.

## Boundary with existing positives

A reserved value stays a positive with sensitivity `sensitive` where it is shaped as a value in ordinary context. This note does not change that. It records that "reserved" answers "can this reach a person" and says nothing about whether a labelled-as-example, role, or masked use is sensitive; those are the ambiguous cases above and the existing documentation twins.

## Deferred and excluded

- Values with a published history of being used as specimen or advertising numbers are excluded from the evidence even though they are widely published. Policy section 1 forbids values assumed safe because they are old or already public, and no allowlist route fits them. They are not quoted here.
- Repeated-digit and all-zero placeholders for telephone numbers and cards, and a letter-fill email on a non-reserved top-level name, are not authored: they have the shape of real data, fail the safe-data lint, and the policy allows an allowlist entry only for a value a publication lists. Recorded as unresolved, not worked around.
- IPv4 and IPv6 documentation ranges (RFC 5737, RFC 3849) are not a kind in the taxonomy.
- Bracketed redaction tokens (`[REDACTED]`, `<email>`) were not authored; they follow the template-token reasoning but are tool conventions, not specified.

## Unresolved

- Whether partially masked values are sensitive, and under which rule. The PCI DSS requirement on displayed card numbers was not read; no source was read for masked SSNs, telephone numbers or IBANs.
- Whether a role mailbox is personal data. RFC 2142 and a data-protection text were not read.
- Whether a grammatically valid placeholder-shaped string is an identity. The email placeholder case is `not-established` for this reason.
- Telephone area-code form rules in the NANP (leading digit limits, so that an all-zero area code is unassignable) were not read from a numbering-plan source.
- ISO 7812 allocation of the leading industry digit 0, needed to call a degenerate card run unassignable, was not read.
- The special-use name registry has changed since RFC 6761 (2013) and was not read; the source is partial.

## Schema notes

- No schema change was needed. `valueOrigin: reserved` covers a reserved value in a masked or role context; it has no value for "placeholder letters", so `synthetic` is used.
- There is no field to say that a string is a partial rendering of a value; the masked cases carry that in `rationale` and `ambiguity.reasons`. A representation marker, shared with the decoded-value question in the serialization note, may be warranted.
- `relationships` lacks a "benign counterpart" type; `twin` points at the baseline positive.

## Snapshot impact

None for the released snapshot `public-pii-phi/2026-10-07/9d4e8e036bbb`, which is immutable. The 14 cases, 1 source and 1 claim would enter the next snapshot only through a reviewed build. Six cases are `invalid` negatives and one a `not-established` negative, all without a span; seven are ambiguities (five span-less, two with a span) that add to the ambiguity counts, not to span-based denominators. Fixture projection derives additional fixtures from these cases through the existing rules; texts that a carrier would alter are skipped with reasons.
