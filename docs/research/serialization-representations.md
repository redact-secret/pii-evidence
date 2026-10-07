# Representation and serialization adversarial cases: findings, gaps and impact

Status: draft, unreviewed agent work (observed 2026-10-07). Nothing here is independent validation. Records: `evidence/sources/serialization-sources.jsonl`, `evidence/claims/serialization-claims.jsonl`, `evidence/cases/serialization-cases.jsonl`. No taxonomy, schema, rule, projector or snapshot file was changed.

## Question

When a structured value (email, phone) is carried inside CSV, JSON, query strings, logfmt or a nested serialization, what does the semantic expectation say about the value and its span? Each authored case changes one property of an existing baseline and keeps the value reserved.

## Transformation taxonomy

| Class | Transformation | Value bytes in the raw text | Span implication | Status here |
| --- | --- | --- | --- | --- |
| Delimiting | quoted field (CSV), quoted value (logfmt), JSON string quotes | unchanged, contiguous | span excludes the quote characters | authored (clear) |
| Escape adjacency | doubled CSV quote, JSON backslash-quote pair next to the value | unchanged | span excludes the escape characters; they are not atext | authored (clear) |
| Record boundary | CRLF after the value (CSV record end) | unchanged | span stops before CR | authored (clear) |
| Nesting | serialization inside a serialization (JSON in JSON string) | unchanged, with one escape level around it | as above; deeper levels only add escapes | one level authored |
| Value encoding | percent-encoding (`%40`), JSON `\uXXXX` escapes | changed: the raw text is not in the kind's grammar | undefined until raw-text versus decoded-value scope is decided | authored as ambiguous, no span |
| Parse-time rewriting | form `+` read as space | digits unchanged, formatting character rewritten | undefined, same decision | authored as ambiguous, no span |
| Punctuation neighbours | non-ASCII sentence punctuation after a value | unchanged | grammar alone does not bound the value | authored as ambiguous, no span |

Established by the cited sources: RFC 4180 quoting and CRLF (section 2), RFC 8259 string escapes (section 7), RFC 3986 percent-encoding (section 2.1), WHATWG form parsing (plus to space), RFC 6531 extended atext (section 3.3). Project inference, marked on each case: that delimiter and escape characters are not part of the value, and what the identity of a decoded representation is.

## Cases

Eleven new cases: 6 clear email twins (CSV quoted, CSV CRLF end, CSV doubled quote, JSON escaped quote, JSON nested, logfmt quoted), 3 ambiguous email (percent-encoded at sign, JSON unicode-escaped at sign, trailing ideographic full stop), 1 phone twin (CSV quoted) and 1 ambiguous phone (form plus). Ambiguous cases carry no span on purpose: authoring one would decide the open question. The existing fullwidth at-sign, non-ASCII local part, fullwidth digit and trailing-period cases were not duplicated.

## Deterministic projection guidance

- The existing carriers already wrap every clear twin: 36 fixtures derive from the new cases through the current rules (copy mode, spans recomputed from final bytes). Texts with CR or quote characters are skipped with reasons (`carrier-unrepresentable`, `carrier-would-alter-value`), not rewritten; this is the intended behavior and shows the skip report working.
- Proposed, not implemented (each needs a projector change, a `PROJECTOR_VERSION` bump and a schema enum member): a `csv-field` template with RFC 4180 quoting; a `crlf-record` template; a `percent-encode` transform and a `json-unicode-escape` transform applied to a single character. As derived mutations they could only assert identity `not-established` and `context-dependent`, with no span, which matches the authored ambiguous cases rather than replacing them.
- Generation must never decide the raw-versus-decoded question; only an authored case may.

## Deferred ambiguous cases (not authored)

- Quoted-printable soft line break splitting a mailbox across lines.
- HTML character references for the at sign (for example `&#64;`) and double-encoding (`%2540`).
- Mailbox inside a base64 or URL-embedded payload.
- Unix-style or TSV delimiters; CSV formula-injection prefixes.
- Deeper JSON nesting and JSON-in-form-in-URL chains.
- Payment-card and IBAN under these carriers: the value-specific questions (spacing, grouping) belong with a rule for each kind.

## Unresolved

- Raw-text versus decoded-value scope for encoded representations, and a span convention for decoded values. This is the central open decision; three authored cases wait on it.
- Whether a lost leading plus changes phone identity.
- logfmt has no cited specification; the logfmt case rests on the mailbox grammar and project inference only. Its evidence class is `authored-adversarial`.
- The WHATWG URL Standard is a living standard; its commit was not recorded, so its source record cannot give a stable version. A snapshot should not include claims from it until pinned.
- IDNA treatment of U+3002 was not read.
- Bare-LF CSV, other delimiters and non-RFC producers are not modeled.

## Schema notes

- No change needed to record the clear twins. A relationship type for "same value, different encoding" does not exist; `twin` is used, and the twin target is the baseline, not a sibling.
- `valueOrigin` has no value for "reserved value in an encoded form"; `reserved` is used for the underlying value.
- A `span` convention for decoded values would need a schema addition (for example a representation marker); not made.
- The mapping from identity `valid` to a decoded value is carried in `provenance.inference`, not in a field.

## Snapshot impact

None for the released snapshot `public-pii-phi/2026-10-07/9d4e8e036bbb`, which is immutable. The 11 cases, 5 sources and 6 claims would enter the next snapshot only through a reviewed build. The four ambiguous encoded cases and the full-stop case are span-less and `context-dependent`, so they would add to the ambiguity counts, not to span-based denominators. The WHATWG source should be held back until pinned.
