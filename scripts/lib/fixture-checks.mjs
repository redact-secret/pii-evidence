// Pure checks shared by the validator and the fixture projector. No I/O.
// They enforce that a projection cannot invent an expectation: every fixture is compared
// against the authored Case and the documented rule that produced it.
import { createHash } from "node:crypto";

export const sha256Hex = (buf) => createHash("sha256").update(buf).digest("hex");

/** Layout -> template types allowed for it. */
export const LAYOUT_TEMPLATES = {
  "plain-text": ["line"],
  json: ["json-object"],
  logfmt: ["logfmt-line"],
  "form-query": ["query-string"],
  "header-config": ["header-line", "ini-entry"],
  "unicode-context": ["prefixed-line"],
};

/** Keys that would carry PERSON/NER content inline. PERSON evidence is only ever referenced. */
export const PERSON_CONTENT_KEYS = ["person", "persons", "personName", "personText", "name", "names", "mention", "mentions", "entities", "surface", "text", "span", "spans", "value", "content"];

const FLOATING_SNAPSHOT = new Set(["latest", "main", "master", "head", "current", "trunk", "dev", "stable", "nightly"]);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Rule-internal consistency (the JSON Schema handles shape). Returns error strings. */
export function ruleConsistencyErrors(rule) {
  const errs = [];
  const must = new Set(rule.mustNotChange);
  const need = (...names) => names.forEach((n) => !must.has(n) && errs.push(`mustNotChange must include "${n}"`));
  const forbid = (...names) => names.forEach((n) => must.has(n) && errs.push(`mustNotChange must not include "${n}" for this rule (it would contradict the rule)`));
  need("privacyKind", "jurisdiction", "contexts", "domains");

  const allowed = LAYOUT_TEMPLATES[rule.carrier.layout];
  if (!allowed.includes(rule.template.type)) errs.push(`template type "${rule.template.type}" is not valid for layout "${rule.carrier.layout}" (allowed: ${allowed.join(", ")})`);

  if (rule.transformation === "carrier") {
    const expectedId = `${rule.carrier.layout}/${rule.carrier.variant}`;
    if (rule.id !== expectedId) errs.push(`carrier rule id must equal "<layout>/<variant>" = "${expectedId}"`);
    if (rule.transform) errs.push("a carrier rule must not carry a transform");
    if (rule.expectation.mode !== "copy") errs.push('a carrier rule must use expectation.mode "copy"');
    need("identity", "sensitivity", "valueBytes");
  } else {
    if (!rule.id.startsWith(`${rule.transformation}/`)) errs.push(`${rule.transformation} rule id must start with "${rule.transformation}/"`);
    if (!rule.transform) errs.push(`a ${rule.transformation} rule needs an explicit transform with parameters`);
    if (rule.expectation.mode !== "derived") errs.push(`a ${rule.transformation} rule must use expectation.mode "derived" (the outcome is not the Case's)`);
    if (rule.appliesTo.requiresSpan !== true) errs.push(`a ${rule.transformation} rule must set appliesTo.requiresSpan true (the value must be delimited)`);
    if (!same(rule.appliesTo.identities, ["valid"])) errs.push(`a ${rule.transformation} rule must apply only to identities ["valid"] (it perturbs an authored valid value)`);
    forbid("identity", "sensitivity", "valueBytes");
    if (rule.transform?.kind === "separator-swap" && rule.transform.from === rule.transform.to) errs.push("separator-swap from and to must differ");
  }
  if (rule.carrier.layout !== "plain-text" && rule.transformation !== "carrier" && rule.template.type !== "line") errs.push("twin and mutation rules project through the plain-text line template");
  if (rule.transformation !== "carrier" && rule.carrier.layout !== "plain-text") errs.push("twin and mutation rules use the plain-text layout");
  return errs;
}

/** Cross-rule checks: ordering keys are unique so the order is well defined. */
export function rulesetErrors(rules) {
  const errs = [];
  const seen = new Map();
  for (const r of rules) {
    if (seen.has(r.ordering)) errs.push(`rule "${r.id}" reuses ordering ${r.ordering} (also "${seen.get(r.ordering)}")`);
    else seen.set(r.ordering, r.id);
  }
  return errs;
}

/** Semantic checks on case.externalRefs: pinned snapshot, no duplicates. */
export function externalRefErrors(refs) {
  const errs = [];
  const keys = new Set();
  (refs ?? []).forEach((r, i) => {
    if (FLOATING_SNAPSHOT.has(r.snapshot.toLowerCase())) errs.push(`/externalRefs/${i}/snapshot "${r.snapshot}" is a floating name; pin an immutable snapshot id`);
    const k = `${r.repository}\u0000${r.snapshot}\u0000${r.entity}`;
    if (keys.has(k)) errs.push(`/externalRefs/${i} duplicates an earlier reference`);
    keys.add(k);
  });
  return errs;
}

function bytesAt(content, span) {
  return Buffer.from(content, "utf8").subarray(span.start, span.end);
}

/**
 * Compare one fixture with its Case and Rule. Returns error strings (empty when the fixture
 * is exactly what the rule is allowed to derive from the Case).
 */
export function fixtureAgainstSourceErrors(fx, c, rule) {
  const errs = [];
  if (fx.population !== "public") errs.push(`population must be "public"`);
  if (fx.ruleVersion === undefined || fx.carrier === undefined || fx.expectation === undefined || fx.lineage === undefined) {
    errs.push("a fixture projected by a rule must record ruleVersion, carrier, expectation and lineage");
    return errs;
  }
  if (fx.ruleVersion !== rule.ruleVersion) errs.push(`ruleVersion "${fx.ruleVersion}" differs from rule "${rule.id}" version "${rule.ruleVersion}"`);
  if (!same(fx.carrier, rule.carrier)) errs.push(`carrier differs from rule "${rule.id}"`);

  const derived = rule.expectation.mode === "derived";
  if (fx.expectation.derivedFromRule !== derived) errs.push(`expectation.derivedFromRule must be ${derived} for rule "${rule.id}"`);
  if (!same(fx.expectation.domains, c.expectation.domains)) errs.push("expectation.domains differs from the authored case");
  if (derived) {
    if (fx.expectation.identity !== rule.expectation.identity) errs.push(`expectation.identity "${fx.expectation.identity}" is not the outcome documented in rule "${rule.id}"`);
    if (fx.expectation.sensitivity !== rule.expectation.sensitivity) errs.push(`expectation.sensitivity "${fx.expectation.sensitivity}" is not the outcome documented in rule "${rule.id}"`);
    if (fx.spans.length !== 0) errs.push("a derived fixture carries no span (the rule makes no positional claim)");
  } else {
    if (fx.expectation.identity !== c.expectation.identity) errs.push(`expectation.identity "${fx.expectation.identity}" differs from the authored case ("${c.expectation.identity}")`);
    if (fx.expectation.sensitivity !== c.expectation.sensitivity) errs.push(`expectation.sensitivity "${fx.expectation.sensitivity}" differs from the authored case ("${c.expectation.sensitivity}")`);
    const want = c.expectation.span && c.input ? 1 : 0;
    if (fx.spans.length !== want) errs.push(`expected ${want} span(s) as in the authored case, found ${fx.spans.length}`);
    else if (want === 1 && fx.content !== undefined && rule.mustNotChange.includes("valueBytes")) {
      const caseValue = Buffer.from(c.input.text, "utf8").subarray(c.expectation.span.start, c.expectation.span.end);
      if (!bytesAt(fx.content, fx.spans[0]).equals(caseValue)) errs.push("the bytes at the fixture span differ from the authored value (mustNotChange valueBytes)");
    }
  }
  const lin = { evidenceClass: c.provenance.evidenceClass, sources: c.provenance.sources, claims: c.provenance.claims };
  if (!same(fx.lineage, lin)) errs.push("lineage differs from the authored case provenance");
  if (!same(fx.externalRefs, c.externalRefs)) errs.push("externalRefs must be passed through unchanged from the authored case");
  return errs;
}

/** Keys that must never appear anywhere in a generated record. */
const BANNED_KEY = /scanner|detector|support|threshold|blocker|score|benchmark|qualif|expectedCurrent/i;

export function bannedKeyErrors(node, pointer = "") {
  const errs = [];
  if (Array.isArray(node)) node.forEach((n, i) => errs.push(...bannedKeyErrors(n, `${pointer}/${i}`)));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (BANNED_KEY.test(k)) errs.push(`${pointer}/${k}: scanner, detector, support-state or score fields cannot appear in generated output`);
      errs.push(...bannedKeyErrors(v, `${pointer}/${k}`));
    }
  }
  return errs;
}
