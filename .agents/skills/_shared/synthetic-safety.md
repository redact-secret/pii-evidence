# Synthetic-value safety checklist

Authority: [SECURITY.md](../../../SECURITY.md) and [README.md](../../../README.md) safe-data
policy; the stricter wins. Applies to cases, fixtures, source excerpts, notes, PR and issue
bodies and comments, and to a scheduled run as much as to a person. This repository is public.

## Allowed, in order of preference

1. **Official reserved/test namespaces and values**: `example.com`/`.test` domains, the
   555-01xx phone range, issuer-published test card numbers, SSA-unissuable SSN ranges, IBAN
   documentation examples. Cite the publication and an observed-at date.
2. **Deterministic synthetic generator** with no real-world provenance; state the rule.
3. **Public standard/example** whose redistribution is permitted; link it.
4. **Licensed corpus** with recorded redistribution and privacy review.
5. **Structural description only** when no value is needed ("9 digits, area 000/666/9xx").

## Check before every value

- [ ] A description or a reserved value did the job; no real-looking value was needed.
- [ ] I can state how it was made and why it cannot belong to a person (invalid area/range,
      failing checksum where the case is about invalidity, reserved domain, unissued prefix).
- [ ] It is not a real value with characters changed, nor a revoked, old, deleted or
      "already leaked" one.
- [ ] It did not come from a breach dump, customer/patient/employee data, a production log or
      form, a support case, a scanner's output, or a tool/prompt payload.
- [ ] I did not look a value up or test it against a live service to see whether it is real.
- [ ] Medical context is synthetic too: no real patient, claim, prescription or lab result,
      and no real name next to an identifier.
- [ ] Source excerpts quote the statement, not surrounding material holding real data.
- [ ] A scanner flagging or not flagging a value is not evidence it is safe to publish.

## If something looks real

Stop. Do not copy it into a record, comment, commit message or PR. Report the file and
location only, and hand off to a maintainer through GitHub Security Advisories
([SECURITY.md](../../../SECURITY.md)). Removing it in a later commit does not remove it from
history.
