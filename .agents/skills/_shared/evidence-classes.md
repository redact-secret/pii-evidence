# Evidence classes

Every source-backed claim and expectation carries one class ([ARCHITECTURE.md](../../../ARCHITECTURE.md) §8).

| Class | Use when |
| --- | --- |
| `public-authority` | a government or regulator states it (SSA, IRS, HHS, CMS, national registries) |
| `standards-body` | ISO, IETF RFC, ECMA, ITU, W3C and similar (IBAN ISO 13616, E.164, RFC 5322, Luhn) |
| `provider-documented` | an issuer or vendor documents it (card networks, EHR/FHIR profiles) |
| `reference-backed` | a reputable reference or specification summarises it |
| `licensed-corpus` | a redistributable corpus with recorded licence and privacy review |
| `authored-baseline` | project-authored ordinary case; reasoning stated, no external proof |
| `authored-adversarial` | project-authored hard case (mutation, collision, lookalike) |
| `tool-corroborated` | a tool agrees; corroboration only, never the sole basis |
| `research-needed` | unresolved; say what would settle it |

Rules:

- Scanner consensus, scanner output and the product's behaviour are never ground truth. If
  that is the only support, the class is `research-needed`.
- Every claim records what the source proves, exact location/version/date, observed-at date,
  jurisdiction and domain, and uncertainty. Keep observed fact and project inference apart.
- An agent never upgrades a class on its own judgement and never marks its own work reviewed.
- Project-maintained evidence is not independent validation unless an independent review is
  recorded.
