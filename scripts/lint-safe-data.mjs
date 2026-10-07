#!/usr/bin/env node
// Privacy-data lint (npm run lint:privacy-data, alias lint:safe-data): scans text files for
// real-looking PII/PHI shapes (email, phone, card, SSN, IBAN) before they are published.
//
// Scope: privacy-data publication safety only. Credential publication safety is owned by
// scripts/lint-credentials.mjs (backed by @redact-secret/core); gitleaks in CI is an independent
// second opinion. This file deliberately carries no credential, private-key or entropy rules.
//
// Policy authority: docs/governance/safe-data-policy.md
// Zero dependencies, Node >= 22, ESM.
//
// SAFETY CONTRACT: this tool never prints, returns or logs a matched value. Findings carry
// only the path, the line number and a rule id. Allowlist entries identify values by SHA-256
// of the normalized value, so the allowlist does not need to repeat a value to excuse it.
//
// Usage:
//   node scripts/lint-safe-data.mjs [--root <dir>] [--allowlist <file>] [--json]
//   printf %s "<value>" | node scripts/lint-safe-data.mjs --hash <rule>   (prints the sha256)
//
// Exit codes: 0 clean, 1 findings, 2 usage or invalid allowlist.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RULES = ['email', 'phone', 'card', 'ssn', 'iban'];
export const ALLOWLISTABLE = RULES;

const RESERVED_EMAIL_DOMAINS = ['example.com', 'example.org', 'example.net'];
const RESERVED_EMAIL_TLDS = ['test', 'invalid', 'example'];
export const SKIP_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);
const SKIP_DIRS = new Set(['.git', 'node_modules', '.claude/worktrees']);
const MAX_BYTES = 2 * 1024 * 1024;

// ---------- normalization and hashing ----------

export function normalizeValue(rule, value) {
  switch (rule) {
    case 'email':
      return value.trim().toLowerCase();
    case 'phone':
    case 'card':
    case 'ssn':
      return value.replace(/\D/g, '');
    case 'iban':
      return value.replace(/\s/g, '').toUpperCase();
    default:
      return value.trim();
  }
}

export function hashValue(rule, value) {
  return createHash('sha256').update(`${rule}:${normalizeValue(rule, value)}`).digest('hex');
}

// ---------- detectors (each yields raw matched strings that are NOT reserved/safe) ----------

function luhn(digits) {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function ibanMod97(iban) {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const v = ch >= 'A' ? ch.charCodeAt(0) - 55 : ch.charCodeAt(0) - 48;
    rem = Number(`${rem}${v}`) % 97;
  }
  return rem === 1;
}

function* emailMatches(line) {
  const re = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.([A-Za-z]{2,}))/g;
  for (const m of line.matchAll(re)) {
    const domain = m[1].toLowerCase();
    const tld = m[2].toLowerCase();
    const first = domain.split('.')[0];
    if (/^\d+$/.test(first)) continue; // package@1.2.3 style
    if (RESERVED_EMAIL_TLDS.includes(tld)) continue;
    if (RESERVED_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) continue;
    yield m[0];
  }
}

function* phoneMatches(line) {
  const us = /(?<![\w.+-])(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}(?![\w-])/g;
  for (const m of line.matchAll(us)) {
    let digits = m[0].replace(/\D/g, '');
    if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
    const exchange = digits.slice(3, 6);
    const last4 = Number(digits.slice(6));
    if (exchange === '555' && last4 >= 100 && last4 <= 199) continue; // 555-0100..0199
    yield m[0];
  }
  const intl = /(?<![\w+])\+(?!1[\s.-]?\(?\d{3})[1-9]\d{0,2}(?:[\s.-]?\(?\d{1,4}\)?){2,5}(?![\w-])/g;
  for (const m of line.matchAll(intl)) {
    const n = m[0].replace(/\D/g, '').length;
    if (n >= 8 && n <= 15) yield m[0];
  }
}

function* cardMatches(line) {
  const re = /(?<![A-Za-z0-9])\d(?:[ -]?\d){12,18}(?![A-Za-z0-9])/g;
  for (const m of line.matchAll(re)) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) yield m[0];
  }
}

function* ssnMatches(line) {
  const re = /(?<![\d-])(\d{3})-(\d{2})-(\d{4})(?![\d-])/g;
  for (const m of line.matchAll(re)) {
    const area = Number(m[1]);
    const unissuable = area === 0 || area === 666 || area >= 900 || m[2] === '00' || m[3] === '0000';
    if (!unissuable) yield m[0];
  }
}

function* ibanMatches(line) {
  const re = /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?(?![A-Za-z0-9])/g;
  for (const m of line.matchAll(re)) {
    const compact = m[0].replace(/\s/g, '');
    if (compact.length >= 15 && compact.length <= 34 && ibanMod97(compact)) yield m[0];
  }
}

const DETECTORS = {
  email: emailMatches,
  phone: phoneMatches,
  card: cardMatches,
  ssn: ssnMatches,
  iban: ibanMatches,
};

// ---------- allowlist ----------

const SHA256_RE = /^[0-9a-f]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns { entries, errors }. Errors never contain values. */
export function loadAllowlist(path) {
  if (!path || !existsSync(path)) return { entries: [], errors: [] };
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { entries: [], errors: [`allowlist is not valid JSON (${e.name})`] };
  }
  return validateAllowlist(doc);
}

export function validateAllowlist(doc) {
  const errors = [];
  const entries = Array.isArray(doc?.entries) ? doc.entries : null;
  if (!entries) return { entries: [], errors: ['allowlist must have an "entries" array'] };
  const seen = new Set();
  entries.forEach((e, i) => {
    const where = `entries[${i}]`;
    for (const f of ['id', 'rule', 'sha256', 'reason', 'source', 'observedAt']) {
      if (typeof e?.[f] !== 'string' || e[f].trim() === '') errors.push(`${where}: missing ${f}`);
    }
    if (typeof e?.rule === 'string' && !ALLOWLISTABLE.includes(e.rule)) errors.push(`${where}: rule "${e.rule}" cannot be allowlisted`);
    if (typeof e?.sha256 === 'string' && !SHA256_RE.test(e.sha256)) errors.push(`${where}: sha256 must be 64 lowercase hex chars`);
    if (typeof e?.observedAt === 'string' && !DATE_RE.test(e.observedAt)) errors.push(`${where}: observedAt must be YYYY-MM-DD`);
    if (e?.paths !== undefined && !(Array.isArray(e.paths) && e.paths.every((p) => typeof p === 'string'))) errors.push(`${where}: paths must be an array of strings`);
    if (typeof e?.id === 'string') {
      if (seen.has(e.id)) errors.push(`${where}: duplicate id`);
      seen.add(e.id);
    }
  });
  return { entries: errors.length ? [] : entries, errors };
}

function allowed(entries, rule, value, path) {
  if (!entries.length) return false;
  const h = hashValue(rule, value);
  return entries.some((e) => e.rule === rule && e.sha256 === h && (!e.paths || e.paths.includes(path)));
}

// ---------- scanning ----------

/** Scan text. Returns [{ rule, line }] with no matched content. */
export function scanText(text, { allowlist = [], path = '' } = {}) {
  const findings = [];
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    for (const rule of RULES) {
      for (const value of DETECTORS[rule](line)) {
        if (allowed(allowlist, rule, value, path)) continue;
        findings.push({ rule, line: idx + 1 });
        break; // one finding per rule per line
      }
    }
  });
  return findings;
}

export function listFiles(root) {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
    const files = out.toString('utf8').split('\0').filter(Boolean);
    if (files.length) return files.sort();
  } catch {
    // not a git checkout (or git unavailable): fall through to a directory walk
  }
  const files = [];
  const walk = (rel) => {
    for (const ent of readdirSync(join(root, rel), { withFileTypes: true })) {
      const p = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) {
        if (!SKIP_DIRS.has(ent.name) && !SKIP_DIRS.has(p)) walk(p);
      } else if (ent.isFile()) files.push(p);
    }
  };
  walk('');
  return files.sort();
}

export function readTextFile(abs) {
  const st = lstatSync(abs, { throwIfNoEntry: false });
  if (!st || !st.isFile() || st.size > MAX_BYTES) return null;
  const buf = readFileSync(abs);
  if (buf.subarray(0, 8000).includes(0)) return null; // binary
  return buf.toString('utf8');
}

export function scanRepo(root, { allowlist = [] } = {}) {
  const findings = [];
  let scanned = 0;
  for (const rel of listFiles(root)) {
    const base = rel.split('/').pop();
    if (SKIP_FILES.has(base)) continue;
    const text = readTextFile(join(root, rel));
    if (text === null) continue;
    scanned++;
    for (const f of scanText(text, { allowlist, path: rel })) findings.push({ path: rel, ...f });
  }
  return { scanned, findings };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const opts = { root: null, allowlist: null, json: false, hash: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') opts.root = argv[++i];
    else if (a === '--allowlist') opts.allowlist = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--hash') opts.hash = argv[++i];
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

export async function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(e.message);
    return 2;
  }
  if (opts.help) {
    console.log('usage: lint-safe-data.mjs [--root <dir>] [--allowlist <file>] [--json] | --hash <rule> (value on stdin)');
    return 0;
  }
  if (opts.hash) {
    if (!ALLOWLISTABLE.includes(opts.hash)) {
      console.error(`--hash rule must be one of: ${ALLOWLISTABLE.join(', ')}`);
      return 2;
    }
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    console.log(hashValue(opts.hash, Buffer.concat(chunks).toString('utf8')));
    return 0;
  }
  const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const root = resolve(opts.root ?? defaultRoot);
  const allowPath = opts.allowlist ? resolve(opts.allowlist) : join(root, 'docs/governance/safe-data-allowlist.json');
  const { entries, errors } = loadAllowlist(allowPath);
  if (errors.length) {
    for (const e of errors) console.error(`allowlist: ${e}`);
    return 2;
  }
  const { scanned, findings } = scanRepo(root, { allowlist: entries });
  if (opts.json) {
    console.log(JSON.stringify({ scanned, allowlistEntries: entries.length, findings }, null, 2));
  } else {
    for (const f of findings) console.log(`${f.path}:${f.line} ${f.rule}`);
    console.log(`lint-privacy-data: ${scanned} files scanned, ${findings.length} finding(s), ${entries.length} allowlist entr${entries.length === 1 ? 'y' : 'ies'}`);
    if (findings.length) console.log('Matched values are never printed. See docs/governance/safe-data-policy.md.');
  }
  return findings.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
