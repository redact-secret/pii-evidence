# Neutrality wording

Write precise, falsifiable statements with jurisdiction, context and uncertainty.

Prefer: "The cited source documents `member_id` as the health-plan member identifier."
Avoid: "This is definitely PHI everywhere."

Do not write, in records, notes or PR text:

- scanner or detector names, support states, thresholds, "currently detected/missed";
- "validated", "verified" or "independent" for project-maintained evidence;
- "confirmed real", "leaked", "live" about any value;
- a conclusion the evidence does not state; leave it `not-established` or `research-needed`.

Unresolved evidence stays unresolved. Never weaken a schema, lint or expectation to make a
scanner pass.
