// Tests for scripts/lint-safe-data.mjs. Every value-shaped string is built at runtime so that no
// literal in this file resembles real data and the linter passes on its own test sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashValue, scanText, validateAllowlist } from '../scripts/lint-safe-data.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'lint-safe-data.mjs');

const luhnCheckDigit = (body) => {
  let sum = 0;
  for (let i = body.length - 1, dbl = true; i >= 0; i--, dbl = !dbl) {
    let d = Number(body[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return String((10 - (sum % 10)) % 10);
};
const makeCard = (body) => body + luhnCheckDigit(body);
const makeIban = (cc, bban) => {
  const num = (bban + cc).replace(/[A-Z]/g, (c) => c.charCodeAt(0) - 55) + '00';
  let rem = 0;
  for (const ch of num) rem = (rem * 10 + Number(ch)) % 97;
  return `${cc}${String(98 - rem).padStart(2, '0')}${bban}`;
};
const rules = (text, opts) => scanText(text, opts).map((f) => f.rule);

test('email: real-looking flagged, reserved domains and TLDs ignored', () => {
  assert.deepEqual(rules(['some.one', 'mail.test-provider.com'].join('@')), ['email']);
  for (const d of ['example.com', 'example.org', 'example.net', 'mail.example.com', 'host.test', 'x.invalid', 'a.example']) {
    assert.deepEqual(rules(`contact: ${['user', d].join('@')}`), [], d);
  }
  assert.deepEqual(rules('install pkg@1.2.3 and name@latest'), []);
});

test('phone: only 555-0100..0199 is safe', () => {
  const p = (a, e, l) => `(${a}) ${e}-${l}`;
  assert.deepEqual(rules(`call ${p('415', '555', '0123')}`), []);
  assert.deepEqual(rules(`call +1 ${['415', '555', '0150'].join('-')}`), []);
  assert.deepEqual(rules(`call ${p('415', '555', '0200')}`), ['phone']);
  assert.deepEqual(rules(`call ${['415', '867', '5309'].join('-')}`), ['phone']);
  assert.deepEqual(rules(`call +44 ${['20', '7946', '0958'].join(' ')}`), ['phone']);
});

test('card: Luhn-valid flagged unless allowlisted; invalid checksum ignored', () => {
  const card = makeCard('40000000000000');
  assert.deepEqual(rules(`pan ${card}`), ['card']);
  const spaced = card.replace(/(\d{4})(?=\d)/g, '$1 ');
  assert.deepEqual(rules(`pan ${spaced}`), ['card']);
  const bad = card.slice(0, -1) + String((Number(card.at(-1)) + 1) % 10);
  assert.deepEqual(rules(`pan ${bad}`), []);
  const entry = { id: 'x', rule: 'card', sha256: hashValue('card', card), reason: 'r', source: 's', observedAt: '2026-01-01' };
  assert.deepEqual(rules(`pan ${card}`, { allowlist: [entry] }), []);
  assert.deepEqual(rules(`pan ${spaced}`, { allowlist: [entry] }), [], 'normalized before hashing');
});

test('ssn: unissuable ranges are safe, issuable flagged', () => {
  const s = (a, g, n) => [a, g, n].join('-');
  assert.deepEqual(rules(`ssn ${s('000', '12', '3456')}`), []);
  assert.deepEqual(rules(`ssn ${s('666', '12', '3456')}`), []);
  assert.deepEqual(rules(`ssn ${s('912', '34', '5678')}`), []);
  assert.deepEqual(rules(`ssn ${s('123', '45', '6789')}`), ['ssn']);
});

test('iban: checksum-valid flagged, allowlist applies, broken checksum ignored', () => {
  const iban = makeIban('GB', 'WEST1357924680AB17');
  assert.deepEqual(rules(`acct ${iban}`), ['iban']);
  assert.deepEqual(rules(`acct ${iban.replace(/(.{4})/g, '$1 ').trim()}`), ['iban']);
  const broken = iban.slice(0, 2) + String((Number(iban[2]) + 1) % 10) + iban.slice(3);
  assert.deepEqual(rules(`acct ${broken}`), []);
  const entry = { id: 'x', rule: 'iban', sha256: hashValue('iban', iban), reason: 'r', source: 's', observedAt: '2026-01-01' };
  assert.deepEqual(rules(`acct ${iban}`, { allowlist: [entry] }), []);
});

test('private key header flagged and never allowlistable', () => {
  const header = `-----BEGIN ${'RSA'} ${'PRIVATE'} KEY-----`;
  assert.deepEqual(rules(header), ['private-key']);
  const { errors } = validateAllowlist({ entries: [{ id: 'x', rule: 'private-key', sha256: 'a'.repeat(64), reason: 'r', source: 's', observedAt: '2026-01-01' }] });
  assert.ok(errors.length > 0);
});

test('credential shapes and high-entropy tokens', () => {
  assert.deepEqual(rules(`k=${'AKIA'}${'ABCDEFGHIJKLMNOP'}`), ['credential']);
  // deterministic pseudo-random base62 token
  let x = 12345;
  const alphabet = ['abcdefghijklm', 'nopqrstuvwxyz', 'ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', '0123456789'].join('');
  let tok = '';
  for (let i = 0; i < 40; i++) { x = (x * 1103515245 + 12345) % 2147483648; tok += alphabet[(x >> 8) % 62]; }
  tok = `Aa1${tok}`;
  assert.ok(rules(`value ${tok}`).includes('high-entropy'));
  assert.deepEqual(rules(`digest ${'ab12cd34'.repeat(8)}`), [], 'hex digests are not secrets');
  assert.deepEqual(rules('a-long-kebab-case-identifier-with-many-words-in-it'), []);
});

test('findings never carry the matched value', () => {
  const card = makeCard('40000000000000');
  const findings = scanText(`pan ${card}`);
  assert.deepEqual(Object.keys(findings[0]).sort(), ['line', 'rule']);
  assert.ok(!JSON.stringify(findings).includes(card));
});

test('allowlist validation requires reason, source, observedAt and a sha256', () => {
  assert.ok(validateAllowlist({ entries: [{ id: 'x', rule: 'card', sha256: 'zz' }] }).errors.length >= 3);
  assert.ok(validateAllowlist({}).errors.length === 1);
  const ok = { id: 'x', rule: 'card', sha256: 'a'.repeat(64), reason: 'r', source: 's', observedAt: '2026-01-01' };
  assert.deepEqual(validateAllowlist({ entries: [ok] }).errors, []);
  assert.ok(validateAllowlist({ entries: [ok, ok] }).errors.some((e) => e.includes('duplicate')));
});

test('CLI: reports path, line and rule only, exits 1, and honours the allowlist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lint-safe-'));
  try {
    const card = makeCard('40000000000000');
    mkdirSync(join(dir, 'docs'));
    writeFileSync(join(dir, 'docs', 'note.md'), `first line\npan ${card}\n`);
    const run = (...args) => spawnSync(process.execPath, [SCRIPT, '--root', dir, ...args], { encoding: 'utf8' });

    const bad = run();
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /^docs\/note\.md:2 card$/m);
    assert.ok(!bad.stdout.includes(card) && !bad.stderr.includes(card));
    assert.ok(!bad.stdout.includes(card.slice(0, 8)));

    const entry = { id: 'x', rule: 'card', sha256: hashValue('card', card), reason: 'test fixture', source: 'runtime', observedAt: '2026-01-01' };
    mkdirSync(join(dir, 'docs', 'governance'));
    writeFileSync(join(dir, 'docs', 'governance', 'safe-data-allowlist.json'), JSON.stringify({ entries: [entry] }));
    assert.equal(run().status, 0);

    writeFileSync(join(dir, 'docs', 'governance', 'safe-data-allowlist.json'), JSON.stringify({ entries: [{ id: 'x' }] }));
    const invalid = run();
    assert.equal(invalid.status, 2);
    assert.ok(!invalid.stderr.includes(card));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('--hash prints the sha256 of the normalized value', () => {
  const card = makeCard('40000000000000');
  const r = spawnSync(process.execPath, [SCRIPT, '--hash', 'card'], { input: card, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), hashValue('card', card));
});

test('the repository itself passes the safe-data lint', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout);
});
