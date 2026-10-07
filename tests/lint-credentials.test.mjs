// Tests for scripts/lint-credentials.mjs, which delegates all detection to @redact-secret/core.
// Credential-shaped inputs are assembled at runtime so no literal here resembles a secret.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'lint-credentials.mjs');

const pemBody = () =>
  Array.from({ length: 12 }, (_, i) => Buffer.from(Array.from({ length: 48 }, (_, j) => (i * 37 + j * 11 + 7) % 256)).toString('base64')).join('\n');
const fakePem = () => `-----BEGIN ${'PRIVATE'} KEY-----\n${pemBody()}\n-----END ${'PRIVATE'} KEY-----\n`;
const fakeGithubToken = () => `gh${'p'}_${'a1B2'.repeat(9)}`;

test('CLI: reports path, line and type only, exits 1, no allowlist applies', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lint-cred-'));
  try {
    const token = fakeGithubToken();
    const pem = fakePem();
    writeFileSync(join(dir, 'a.txt'), `first\nsecond\ntoken ${token}\n`);
    writeFileSync(join(dir, 'b.txt'), `x\n${pem}`);
    const r = spawnSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^a\.txt:3 \S+$/m);
    assert.match(r.stdout, /^b\.txt:2 private_key$/m, 'multi-line private key is found at its first line');
    const out = r.stdout + r.stderr;
    assert.ok(!out.includes(token) && !out.includes(pemBody().slice(0, 40)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI: clean tree exits 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lint-cred-'));
  try {
    writeFileSync(join(dir, 'ok.txt'), 'nothing secret here\n');
    assert.equal(spawnSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' }).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the repository itself passes the credential lint', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout);
});
