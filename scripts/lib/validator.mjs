// Validation of pii-evidence records. Fails closed: unknown schemaVersion or
// kind is an error, never skipped. See docs/methodology/schemas.md.
import { readFileSync, readdirSync, lstatSync, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { forbiddenIdViolations } from "../id-rules.mjs";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SCHEMA_BASE = "https://github.com/redact-secret/pii-evidence/schemas";

/** schemaVersion value -> schema directory. Anything else is unsupported. */
export const SUPPORTED_SCHEMA_VERSIONS = { "1": "v1" };

/** Record `kind` marker -> schema file name (same in every version directory). */
export const KIND_SCHEMAS = {
  "privacy-kinds": "privacy-kinds.schema.json",
  jurisdictions: "jurisdictions.schema.json",
  contexts: "contexts.schema.json",
  source: "source.schema.json",
  claim: "claim.schema.json",
  case: "case.schema.json",
  "fixture-projection": "fixture-projection.schema.json",
  "review-event": "review-event.schema.json",
  "snapshot-manifest": "snapshot-manifest.schema.json",
};

export const SCAN_DIRS = ["taxonomy", "evidence", "fixtures", "snapshots"];
const TAXONOMY_TYPES = new Set(["privacy-kind", "jurisdiction", "context"]);

export function fixtureId(caseId, ruleId) {
  return `${caseId}/${ruleId}`;
}

let ajvSingleton;
function getAjv() {
  if (ajvSingleton) return ajvSingleton;
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  for (const dir of Object.values(SUPPORTED_SCHEMA_VERSIONS)) {
    const full = path.join(REPO_ROOT, "schemas", dir);
    for (const f of readdirSync(full).filter((n) => n.endsWith(".schema.json")).sort()) {
      ajv.addSchema(JSON.parse(readFileSync(path.join(full, f), "utf8")));
    }
  }
  // Compile every kind eagerly so a schema defect fails loudly, not only when a record uses it.
  for (const version of Object.keys(SUPPORTED_SCHEMA_VERSIONS)) {
    for (const kind of Object.keys(KIND_SCHEMAS)) {
      const dir = SUPPORTED_SCHEMA_VERSIONS[version];
      ajv.getSchema(`${SCHEMA_BASE}/${dir}/${KIND_SCHEMAS[kind]}`);
    }
  }
  ajvSingleton = ajv;
  return ajv;
}

function schemaFor(kind, version) {
  const dir = SUPPORTED_SCHEMA_VERSIONS[version];
  return getAjv().getSchema(`${SCHEMA_BASE}/${dir}/${KIND_SCHEMAS[kind]}`);
}

function describeAjvError(e) {
  let msg = e.message;
  if (e.keyword === "additionalProperties") msg = `unknown property "${e.params.additionalProperty}" is not allowed`;
  else if (e.keyword === "enum") msg = `${msg}: ${e.params.allowedValues.join(", ")}`;
  return `${e.instancePath || "/"} ${msg}`;
}

// ---------- discovery ----------

/** Read one .json/.jsonl file into [{file, line?, corpus, data}] plus parse errors. */
export function readRecordFile(absPath, label, corpus = "tree") {
  const records = [];
  const errors = [];
  let text;
  try {
    text = readFileSync(absPath, "utf8");
  } catch (e) {
    return { records, errors: [`${label}: cannot read file: ${e.message}`] };
  }
  if (absPath.endsWith(".jsonl")) {
    text.split("\n").forEach((line, i) => {
      if (line.trim() === "") return;
      try {
        records.push({ file: label, line: i + 1, corpus, data: JSON.parse(line) });
      } catch (e) {
        errors.push(`${label}:${i + 1}: invalid JSON: ${e.message}`);
      }
    });
  } else {
    try {
      records.push({ file: label, corpus, data: JSON.parse(text) });
    } catch (e) {
      errors.push(`${label}: invalid JSON: ${e.message}`);
    }
  }
  return { records, errors };
}

function corpusOf(rel) {
  const m = /^snapshots\/([^/]+)\//.exec(rel);
  return m ? `snapshot:${m[1]}` : "tree";
}

/** Discover records under taxonomy/, evidence/, fixtures/, snapshots/ (absent dirs are fine). */
export function loadTree(root) {
  const records = [];
  const errors = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const abs = path.join(dir, ent.name);
      const rel = path.relative(root, abs).split(path.sep).join("/");
      if (ent.isSymbolicLink()) {
        errors.push(`${rel}: symbolic links are not allowed in evidence directories`);
      } else if (ent.isDirectory()) {
        walk(abs);
      } else if (ent.isFile() && /\.jsonl?$/.test(ent.name)) {
        const r = readRecordFile(abs, rel, corpusOf(rel));
        records.push(...r.records);
        errors.push(...r.errors);
      }
    }
  };
  for (const d of SCAN_DIRS) {
    const abs = path.join(root, d);
    if (!existsSync(abs)) continue;
    if (lstatSync(abs).isSymbolicLink()) {
      errors.push(`${d}: symbolic links are not allowed in evidence directories`);
      continue;
    }
    walk(abs);
  }
  return { records, errors };
}

// ---------- validation ----------

function loc(r, pointer = "") {
  return `${r.file}${r.line ? `:${r.line}` : ""}${pointer ? ` (${pointer})` : ""}`;
}

function utf8BoundaryOk(buf, offset) {
  return offset === 0 || offset === buf.length || (buf[offset] & 0xc0) !== 0x80;
}

function checkSpan(errors, where, span, buf, what) {
  if (!span) return;
  if (span.end <= span.start) errors.push(`${where}: ${what} end (${span.end}) must be greater than start (${span.start})`);
  else if (span.end > buf.length) errors.push(`${where}: ${what} [${span.start}, ${span.end}) exceeds the ${buf.length} UTF-8 bytes of the text`);
  else if (!utf8BoundaryOk(buf, span.start) || !utf8BoundaryOk(buf, span.end)) errors.push(`${where}: ${what} [${span.start}, ${span.end}) does not lie on UTF-8 character boundaries`);
}

/** Expand a validated record into id-bearing entries. */
function entriesOf(r) {
  const d = r.data;
  switch (d.kind) {
    case "privacy-kinds":
      return d.kinds.map((x, i) => ({ type: "privacy-kind", id: x.id, data: x, r, pointer: `/kinds/${i}` }));
    case "jurisdictions":
      return d.jurisdictions.map((x, i) => ({ type: "jurisdiction", id: x.id, data: x, r, pointer: `/jurisdictions/${i}` }));
    case "contexts":
      return d.contexts.map((x, i) => ({ type: "context", id: x.id, data: x, r, pointer: `/contexts/${i}` }));
    default:
      return [{ type: d.kind, id: d.id, data: d, r, pointer: "" }];
  }
}

function refsOf(e) {
  const d = e.data;
  const refs = [];
  const add = (pointer, id, types, what) => id !== undefined && refs.push({ pointer: e.pointer + pointer, id, types, what });
  const addAll = (pointer, ids, types, what) => (ids ?? []).forEach((id, i) => add(`${pointer}/${i}`, id, types, what));
  switch (e.type) {
    case "privacy-kind":
      add("/baseKind", d.baseKind, ["privacy-kind"], "base kind");
      addAll("/jurisdictions", d.jurisdictions, ["jurisdiction"], "jurisdiction");
      addAll("/formatClaims", d.formatClaims, ["claim"], "claim");
      (d.contextClaims ?? []).forEach((c, i) => {
        add(`/contextClaims/${i}/context`, c.context, ["context"], "context");
        addAll(`/contextClaims/${i}/claims`, c.claims, ["claim"], "claim");
      });
      break;
    case "context":
      addAll("/claims", d.claims, ["claim"], "claim");
      break;
    case "source":
      addAll("/review/events", d.review.events, ["review-event"], "review event");
      break;
    case "claim":
      add("/source", d.source, ["source"], "source");
      add("/privacyKind", d.privacyKind, ["privacy-kind"], "privacy kind");
      add("/jurisdiction", d.jurisdiction, ["jurisdiction"], "jurisdiction");
      addAll("/review/events", d.review.events, ["review-event"], "review event");
      break;
    case "case":
      add("/privacyKind", d.privacyKind, ["privacy-kind"], "privacy kind");
      add("/jurisdiction", d.jurisdiction, ["jurisdiction"], "jurisdiction");
      addAll("/contexts", d.contexts, ["context"], "context");
      addAll("/provenance/sources", d.provenance.sources, ["source"], "source");
      addAll("/provenance/claims", d.provenance.claims, ["claim"], "claim");
      d.relationships.forEach((rel, i) => add(`/relationships/${i}/case`, rel.case, ["case"], "related case"));
      addAll("/review/events", d.review.events, ["review-event"], "review event");
      break;
    case "fixture-projection":
      add("/case", d.case, ["case"], "case");
      break;
    case "review-event":
      add("/subject", d.subject, ["privacy-kind", "jurisdiction", "context", "source", "claim", "case", "fixture-projection"], "subject record");
      break;
    default:
  }
  return refs;
}

/**
 * Validate a list of {file, line?, corpus, data} records.
 * Returns {errors: string[], stats}. Order of errors is deterministic.
 */
export function validateRecords(records) {
  const errors = [];
  const entries = [];

  // 1. schema, version, kind (fail closed)
  for (const r of records) {
    const d = r.data;
    if (d === null || typeof d !== "object" || Array.isArray(d)) {
      errors.push(`${loc(r)}: record must be a JSON object`);
      continue;
    }
    if (typeof d.schemaVersion !== "string" || !Object.hasOwn(SUPPORTED_SCHEMA_VERSIONS, d.schemaVersion)) {
      errors.push(`${loc(r)}: unsupported or missing schemaVersion ${JSON.stringify(d.schemaVersion)}; supported: ${Object.keys(SUPPORTED_SCHEMA_VERSIONS).map((k) => JSON.stringify(k)).join(", ")} (failing closed)`);
      continue;
    }
    if (typeof d.kind !== "string" || !Object.hasOwn(KIND_SCHEMAS, d.kind)) {
      errors.push(`${loc(r)}: unknown or missing kind ${JSON.stringify(d.kind)}; known: ${Object.keys(KIND_SCHEMAS).join(", ")} (failing closed)`);
      continue;
    }
    const validate = schemaFor(d.kind, d.schemaVersion);
    if (!validate(d)) {
      for (const e of validate.errors) errors.push(`${loc(r)}: ${describeAjvError(e)}`);
      continue;
    }
    entries.push(...entriesOf(r));
  }

  // 2. id lint and duplicates (per corpus)
  const byCorpus = new Map(); // corpus -> Map(id -> entry)
  for (const e of entries) {
    for (const v of forbiddenIdViolations(e.id)) {
      errors.push(`${loc(e.r, e.pointer)}: id "${e.id}" violates identity rule ${v.rule}: ${v.why}`);
    }
    if (!byCorpus.has(e.r.corpus)) byCorpus.set(e.r.corpus, new Map());
    const ids = byCorpus.get(e.r.corpus);
    const prior = ids.get(e.id);
    if (prior) {
      errors.push(`${loc(e.r, e.pointer)}: duplicate id "${e.id}" (also defined as ${prior.type} at ${loc(prior.r, prior.pointer)})`);
    } else ids.set(e.id, e);
  }

  // 3. cross references. A snapshot corpus also resolves taxonomy ids from the tree.
  const lookup = (corpus, id) => {
    const own = byCorpus.get(corpus)?.get(id);
    if (own) return own;
    const t = byCorpus.get("tree")?.get(id);
    return t && TAXONOMY_TYPES.has(t.type) ? t : undefined;
  };
  for (const e of entries) {
    for (const ref of refsOf(e)) {
      const target = lookup(e.r.corpus, ref.id);
      if (!target) errors.push(`${loc(e.r, ref.pointer)}: dangling ${ref.what} reference "${ref.id}" (no ${ref.types.join("/")} with that id)`);
      else if (!ref.types.includes(target.type)) errors.push(`${loc(e.r, ref.pointer)}: reference "${ref.id}" is a ${target.type}, expected ${ref.types.join("/")}`);
    }
  }

  // 4. semantic checks
  for (const e of entries) {
    const d = e.data;
    const where = loc(e.r, e.pointer);
    if (e.type === "privacy-kind" && d.baseKind === d.id) errors.push(`${where}: kind "${d.id}" is its own baseKind`);
    if (e.type === "case") {
      d.relationships.forEach((rel, i) => {
        if (rel.case === d.id) errors.push(`${loc(e.r, `/relationships/${i}`)}: case "${d.id}" relates to itself`);
      });
      const span = d.expectation.span;
      if (span) {
        if (!d.input) errors.push(`${where}: expectation.span requires input.text`);
        else checkSpan(errors, where, span, Buffer.from(d.input.text, "utf8"), "expectation.span");
      }
    }
    if (e.type === "fixture-projection") {
      const expected = fixtureId(d.case, d.rule);
      if (d.id !== expected) errors.push(`${where}: fixture id "${d.id}" must equal "<case>/<rule>" = "${expected}"`);
      let len = d.byteLength;
      let buf = null;
      if (d.content !== undefined) {
        buf = Buffer.from(d.content, "utf8");
        if (buf.length !== d.byteLength) errors.push(`${where}: byteLength ${d.byteLength} does not match content (${buf.length} UTF-8 bytes)`);
        const sha = createHash("sha256").update(buf).digest("hex");
        if (sha !== d.sha256) errors.push(`${where}: sha256 does not match content`);
        len = buf.length;
      }
      d.spans.forEach((span, i) => {
        if (buf) checkSpan(errors, where, span, buf, `spans[${i}]`);
        else if (span.end <= span.start || span.end > len) errors.push(`${where}: spans[${i}] [${span.start}, ${span.end}) is empty or exceeds byteLength ${len}`);
      });
    }
  }

  errors.sort();
  return { errors, stats: { records: records.length, entries: entries.length } };
}

/** Validate the evidence tree under `root`. */
export function validateTree(root = REPO_ROOT) {
  const { records, errors: loadErrors } = loadTree(root);
  const { errors, stats } = validateRecords(records);
  return { errors: [...loadErrors, ...errors], stats };
}
