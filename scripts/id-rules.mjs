// Single source of truth for what a canonical id must not embed.
// Ids are stable semantic names (docs/methodology/schemas.md). They must not carry
// provenance of the work that produced them. Matching is on the whole id with
// "-" and "/" as token boundaries, case-insensitive (ids are lowercase anyway).
//
// To extend: add a pattern here and a test case in tests/id-rules.test.mjs.

const B = "(?:^|[-/])"; // token start
const E = "(?:[-/]|$)"; // token end

export const FORBIDDEN_ID_RULES = [
  {
    name: "issue-or-pr-number",
    why: "ids must not embed issue or pull request numbers",
    patterns: [
      new RegExp(`${B}(?:issues?|prs?|pull|gh|bug|ticket|jira)-?\\d+${E}`),
      new RegExp(`${B}(?:issues?|prs?|pull-requests?|tickets?|jira)${E}`),
    ],
  },
  {
    name: "release-or-milestone",
    why: "ids must not embed release, milestone, or schedule names",
    patterns: [
      new RegExp(`${B}v\\d+(?:-\\d+)*${E}`),
      new RegExp(`${B}(?:releases?|milestones?|sprints?|phases?|waves?|alpha|beta|ga|rc\\d*)${E}`),
      new RegExp(`${B}(?:release|milestone|sprint|phase|wave)-?\\d+${E}`),
    ],
  },
  {
    name: "scanner-or-detector-name",
    why: "ids must not embed scanner, detector, or product names",
    patterns: [
      new RegExp(`${B}(?:redact-secret|redactsecret|fastner|presidio|gitleaks|trufflehog|detect-secrets|comprehend|macie|scanners?|detectors?|pii-eval)${E}`),
    ],
  },
  {
    name: "benchmark-score",
    why: "ids must not embed benchmark scores or metrics",
    patterns: [
      new RegExp(`${B}(?:f1|f2|precision|recall|accuracy|scores?|auc|mcc)(?:-?\\d+)?${E}`),
      new RegExp(`${B}\\d+(?:-\\d+)?-?(?:pct|percent)${E}`),
      new RegExp(`${B}top-?\\d+${E}`),
    ],
  },
  {
    name: "migration-coordinate",
    why: "ids must not embed migration coordinates (legacy row, offset, or rename provenance)",
    patterns: [
      new RegExp(`${B}(?:migrat[a-z]*|legacy|renamed|moved)${E}`),
      new RegExp(`${B}(?:row|line|offset|index|idx|seq|entry|record)-?\\d+${E}`),
      new RegExp(`${B}from-.+-to-`),
    ],
  },
];

/** Returns [{rule, why}] for every forbidden-content rule the id violates. */
export function forbiddenIdViolations(id) {
  const out = [];
  for (const rule of FORBIDDEN_ID_RULES) {
    if (rule.patterns.some((p) => p.test(id))) out.push({ rule: rule.name, why: rule.why });
  }
  return out;
}
