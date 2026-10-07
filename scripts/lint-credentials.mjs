#!/usr/bin/env node
// Credential lint: scans the same tracked/unignored text files as the privacy-data lint using
// the published @redact-secret/core scanner. pii-evidence owns no credential patterns; detection
// is entirely the package's. Only the package's default credential detection is used (its opt-in
// PII families are NOT enabled; PII/PHI shapes belong to lint-safe-data.mjs).
//
// SAFETY CONTRACT: findings print only path, line and the package's detector type. Matched values
// are never printed. There is no allowlist: no credential or private key can be excused here.
// A false positive is fixed by changing the content, not by an exception.
//
// Usage: node scripts/lint-credentials.mjs [--root <dir>] [--json]
// Exit codes: 0 clean, 1 findings, 2 usage or scanner unavailable.

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SKIP_FILES, listFiles, readTextFile } from './lint-safe-data.mjs';

/** Convert a UTF-16 offset to a 1-based line number. */
function lineAt(text, offset) {
  let line = 1;
  for (let i = text.indexOf('\n'); i !== -1 && i < offset; i = text.indexOf('\n', i + 1)) line++;
  return line;
}

/** Scan text with a scan function from @redact-secret/core. Returns [{ type, line }]; no values. */
export function scanCredentials(text, scan) {
  // Whole-file scan: multi-line constructs such as PEM private keys span lines.
  return scan(text).map((f) => ({ rule: f.type, line: lineAt(text, f.start) }));
}

export async function main(argv = process.argv.slice(2)) {
  let root = null;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = argv[++i];
    else if (argv[i] === '--json') json = true;
    else {
      console.error(`unknown argument: ${argv[i]}`);
      return 2;
    }
  }
  let core;
  try {
    core = await import('@redact-secret/core');
    await core.initialize();
  } catch (e) {
    console.error(`lint-credentials: @redact-secret/core unavailable (${e?.code ?? e?.name}); run npm ci`);
    return 2;
  }
  const base = resolve(root ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  const findings = [];
  let scanned = 0;
  for (const rel of listFiles(base)) {
    if (SKIP_FILES.has(rel.split('/').pop())) continue;
    const text = readTextFile(join(base, rel));
    if (text === null) continue;
    scanned++;
    for (const f of scanCredentials(text, core.scan)) findings.push({ path: rel, ...f });
  }
  if (json) console.log(JSON.stringify({ scanned, findings }, null, 2));
  else {
    for (const f of findings) console.log(`${f.path}:${f.line} ${f.rule}`);
    console.log(`lint-credentials: ${scanned} files scanned, ${findings.length} finding(s)`);
    if (findings.length) console.log('Matched values are never printed. There is no allowlist; remove the credential and rotate it.');
  }
  return findings.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
