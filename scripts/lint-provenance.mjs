#!/usr/bin/env node
// Provenance lint: checks source records under evidence/sources/ (JSON or JSONL).
//
// Policy authority: docs/governance/provenance-and-licensing.md. The JSON Schema for sources
// (schemas/v1/source.schema.json) is the structural authority and field names follow it; this tool enforces the policy-level rules that a
// schema cannot express (protected-corpus markers, readiness derivation, review requirements).
// Zero dependencies, Node >= 22, ESM. Tolerates a missing evidence/sources/ directory.
//
// Usage:
//   node scripts/lint-provenance.mjs [--root <dir>] [--public-release] [--json]
//
// Exit codes:
//   0  no errors (unresolved sources may exist; they are reported as not public-release-ready)
//   1  errors: malformed files, missing/invalid required fields, protected markers, or blocked
//      sources. With --public-release, any source that is not public-safe is also an error.
//   2  usage error

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const EVIDENCE_CLASSES = [
  'public-authority',
  'provider-documented',
  'standards-body',
  'reference-backed',
  'licensed-corpus',
  'authored-baseline',
  'authored-adversarial',
  'tool-corroborated',
  'research-needed',
];
export const VALUE_ORIGINS = ['synthetic', 'reserved', 'public-test', 'licensed-corpus'];
export const REDISTRIBUTION_STATUSES = ['allowed', 'restricted', 'prohibited', 'unknown'];
export const REVIEW_STATES = ['unreviewed', 'in-review', 'reviewed', 'rejected'];
export const READINESS = ['public-safe', 'unresolved', 'blocked'];
const PROTECTED_MARKERS = new Set(['protected', 'private-custodian', 'private-ledger']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isStr = (v) => typeof v === 'string' && v.trim() !== '';

function collectProtectedMarkers(node, path, out) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectProtectedMarkers(v, `${path}[${i}]`, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const p = path ? `${path}.${k}` : k;
      if (k === 'protected' && v === true) out.push(p);
      else if (typeof v === 'string' && PROTECTED_MARKERS.has(v.trim().toLowerCase())) out.push(p);
      else collectProtectedMarkers(v, p, out);
    }
  }
}

/**
 * Evaluate one source record (field names follow schemas/v1/source.schema.json).
 * Returns { id, errors, blocked, unresolved, readiness }.
 * errors: structural or policy violations (missing or invalid required fields, protected
 * markers). blocked / unresolved: reasons the record is not public-safe. Reasons name fields
 * only, never values.
 */
export function evaluateRecord(rec) {
  const errors = [];
  const blocked = [];
  const unresolved = [];
  const id = isStr(rec?.id) ? rec.id : null;
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
    return { id, errors: ['record is not an object'], blocked, unresolved, readiness: 'unresolved' };
  }
  if (!id) errors.push('missing id');

  const cls = rec.evidenceClass;
  if (cls === undefined) errors.push('missing evidenceClass');
  else if (!EVIDENCE_CLASSES.includes(cls)) errors.push('invalid evidenceClass');
  if (cls === 'research-needed') unresolved.push('evidenceClass is research-needed');

  if (!isStr(rec.title)) errors.push('missing title');
  if (!isStr(rec.locator)) errors.push('missing locator');
  if (!isStr(rec.version)) errors.push('missing version');

  if (rec.observedAt === undefined) errors.push('missing observedAt');
  else if (typeof rec.observedAt !== 'string' || !DATE_RE.test(rec.observedAt)) errors.push('invalid observedAt');

  // license and redistribution
  const lic = rec.license;
  const redStatus = lic?.redistribution;
  if (!lic || typeof lic !== 'object' || Array.isArray(lic)) errors.push('missing license');
  else {
    if (!isStr(lic.name)) errors.push('missing license.name');
    if (!isStr(lic.terms)) errors.push('missing license.terms');
    if (redStatus === undefined) errors.push('missing license.redistribution');
    else if (!REDISTRIBUTION_STATUSES.includes(redStatus)) errors.push('invalid license.redistribution');
    else if (redStatus === 'prohibited') blocked.push('redistribution prohibited');
    else if (redStatus !== 'allowed') unresolved.push(`redistribution ${redStatus}`);
  }

  // transformation / minimization record
  if (!Array.isArray(rec.transformations)) errors.push('missing transformations (use [] when nothing was transformed)');
  else if (!rec.transformations.every(isStr)) errors.push('invalid transformations entries');

  if (typeof rec.naturallyOccurringPersonalData !== 'boolean') errors.push('missing naturallyOccurringPersonalData');

  // value origin: one of the four documented origins; protected markers are reported below
  const origin = rec.valueOrigin;
  if (origin === undefined) errors.push('missing valueOrigin');
  else if (!VALUE_ORIGINS.includes(origin) && !(typeof origin === 'string' && PROTECTED_MARKERS.has(origin.trim().toLowerCase()))) {
    errors.push('invalid valueOrigin');
  }

  // review
  const review = rec.review;
  const reviewState = review?.state;
  if (!review || typeof review !== 'object') errors.push('missing review');
  else {
    if (!REVIEW_STATES.includes(reviewState)) errors.push('missing or invalid review.state');
    if (!Array.isArray(review.events)) errors.push('missing review.events');
    else if (reviewState === 'reviewed' && review.events.length === 0) errors.push('reviewed state needs at least one review event');
  }
  if (reviewState === 'rejected') blocked.push('review rejected');

  // protected-corpus markers anywhere in the record are failures and block the record
  const markers = [];
  collectProtectedMarkers(rec, '', markers);
  if (markers.length) {
    errors.push(`protected-corpus marker at ${[...new Set(markers)].join(', ')} (protected material can never be a public source)`);
    blocked.push('protected-corpus marker');
  }

  // risk-bearing records need a reviewed state
  const licensedCorpus = cls === 'licensed-corpus' || origin === 'licensed-corpus';
  const needsReview = licensedCorpus || rec.naturallyOccurringPersonalData === true;
  if (needsReview && reviewState !== undefined && reviewState !== 'reviewed' && reviewState !== 'rejected') {
    unresolved.push('review.state is not reviewed');
  }

  // imported corpora: a non-empty minimization record is mandatory
  if (licensedCorpus && Array.isArray(rec.transformations) && rec.transformations.length === 0) {
    errors.push('imported corpus needs a non-empty transformations record');
  }

  let readiness;
  if (blocked.length) readiness = 'blocked';
  else if (errors.length || unresolved.length) readiness = 'unresolved';
  else readiness = 'public-safe';
  return { id, errors, blocked, unresolved, readiness };
}

function parseFile(abs) {
  const text = readFileSync(abs, 'utf8');
  if (abs.endsWith('.jsonl')) {
    const recs = [];
    const problems = [];
    text.split('\n').forEach((line, i) => {
      if (!line.trim()) return;
      try {
        recs.push({ rec: JSON.parse(line), where: `line ${i + 1}` });
      } catch {
        problems.push(`line ${i + 1}: not valid JSON`);
      }
    });
    return { recs, problems };
  }
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return { recs: [], problems: ['not valid JSON'] };
  }
  const list = Array.isArray(doc) ? doc : Array.isArray(doc?.sources) ? doc.sources : [doc];
  return { recs: list.map((rec, i) => ({ rec, where: list.length > 1 ? `item ${i}` : '' })), problems: [] };
}

function walk(dir, base, out) {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, `${base}${name}/`, out);
    else if (/\.(json|jsonl)$/.test(name)) out.push({ abs, rel: `${base}${name}` });
  }
}

/** Lint all records under <root>/evidence/sources. */
export function lintSources(root) {
  const dir = join(root, 'evidence', 'sources');
  const results = [];
  const fileProblems = [];
  if (existsSync(dir) && statSync(dir).isDirectory()) {
    const files = [];
    walk(dir, 'evidence/sources/', files);
    for (const { abs, rel } of files) {
      const { recs, problems } = parseFile(abs);
      for (const p of problems) fileProblems.push({ path: rel, message: p });
      for (const { rec, where } of recs) {
        results.push({ path: rel, where, ...evaluateRecord(rec) });
      }
    }
  }
  return { results, fileProblems };
}

export function summarize({ results, fileProblems }) {
  const counts = { 'public-safe': 0, unresolved: 0, blocked: 0 };
  for (const r of results) counts[r.readiness]++;
  const errorCount = fileProblems.length + results.reduce((n, r) => n + r.errors.length, 0);
  return { total: results.length, counts, errorCount };
}

export function main(argv = process.argv.slice(2)) {
  let root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let publicRelease = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = resolve(argv[++i]);
    else if (argv[i] === '--public-release') publicRelease = true;
    else if (argv[i] === '--json') json = true;
    else {
      console.error(`unknown argument: ${argv[i]}`);
      return 2;
    }
  }
  const lint = lintSources(root);
  const sum = summarize(lint);
  const notReady = lint.results.filter((r) => r.readiness !== 'public-safe');
  const failed = sum.errorCount > 0 || lint.results.some((r) => r.blocked.length) || (publicRelease && notReady.length > 0);

  if (json) {
    console.log(JSON.stringify({ ...sum, publicRelease, fileProblems: lint.fileProblems, sources: lint.results }, null, 2));
  } else {
    for (const p of lint.fileProblems) console.log(`ERROR ${p.path}: ${p.message}`);
    for (const r of lint.results) {
      const label = `${r.path}${r.where ? ` (${r.where})` : ''} [${r.id ?? 'no id'}]`;
      for (const e of r.errors) console.log(`ERROR ${label}: ${e}`);
      for (const b of r.blocked) console.log(`BLOCKED ${label}: ${b}`);
      for (const u of r.unresolved) console.log(`UNRESOLVED ${label}: ${u}`);
    }
    console.log('release readiness summary');
    console.log(`  sources:     ${sum.total}${sum.total === 0 ? ' (no records under evidence/sources/)' : ''}`);
    console.log(`  public-safe: ${sum.counts['public-safe']}`);
    console.log(`  unresolved:  ${sum.counts.unresolved} (not public-release-ready)`);
    console.log(`  blocked:     ${sum.counts.blocked} (never releasable)`);
    console.log(`  errors:      ${sum.errorCount}`);
    console.log(`  public release: ${sum.total > 0 && notReady.length === 0 && sum.errorCount === 0 ? 'READY' : sum.total === 0 ? 'NOTHING TO RELEASE' : 'NOT READY'}${publicRelease ? ' (enforced)' : ''}`);
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
