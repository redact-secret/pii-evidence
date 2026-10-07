// Tests for scripts/lint-provenance.mjs using in-memory records written to a temp directory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateRecord, lintSources, summarize } from '../scripts/lint-provenance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'lint-provenance.mjs');

const good = (over = {}) => ({
  kind: 'source',
  schemaVersion: '1',
  id: 'src-a',
  title: 'A standard',
  locator: 'https://example.com/standard',
  version: 'Edition 1.0, 2026',
  observedAt: '2026-10-07',
  license: { name: 'CC0-1.0', redistribution: 'allowed', terms: 'cited by section only' },
  evidenceClass: 'standards-body',
  transformations: [],
  naturallyOccurringPersonalData: false,
  valueOrigin: 'reserved',
  review: { state: 'unreviewed', events: [] },
  ...over,
});
const without = (field) => {
  const r = good();
  delete r[field];
  return r;
};

test('a complete record is public-safe', () => {
  const r = evaluateRecord(good());
  assert.deepEqual(r.errors, []);
  assert.equal(r.readiness, 'public-safe');
});

test('each required field is reported when missing', () => {
  for (const field of ['title', 'locator', 'version', 'observedAt', 'license', 'evidenceClass', 'transformations', 'naturallyOccurringPersonalData', 'valueOrigin', 'review']) {
    const r = evaluateRecord(without(field));
    assert.ok(r.errors.some((e) => e.includes(field)), `${field}: ${r.errors}`);
    assert.notEqual(r.readiness, 'public-safe', field);
  }
  for (const f of ['name', 'terms', 'redistribution']) {
    const lic = { ...good().license };
    delete lic[f];
    assert.ok(evaluateRecord(good({ license: lic })).errors.some((e) => e.includes(`license.${f}`)), f);
  }
});

test('invalid enumerations are errors', () => {
  assert.ok(evaluateRecord(good({ valueOrigin: 'scraped' })).errors.length);
  assert.ok(evaluateRecord(good({ evidenceClass: 'vibes' })).errors.length);
  assert.ok(evaluateRecord(good({ observedAt: 'yesterday' })).errors.length);
  assert.ok(evaluateRecord(good({ license: { name: 'x', terms: 'y', redistribution: 'maybe' } })).errors.length);
});

test('protected markers are errors and block the record', () => {
  for (const rec of [
    good({ valueOrigin: 'private-custodian' }),
    good({ valueOrigin: 'protected' }),
    good({ protected: true }),
    good({ title: 'x', custody: 'private-ledger' }),
  ]) {
    const r = evaluateRecord(rec);
    assert.equal(r.readiness, 'blocked');
    assert.ok(r.errors.some((e) => e.includes('protected-corpus marker')));
  }
});

test('unresolved sources are not public-release-ready but are not structural errors', () => {
  const r = evaluateRecord(good({ evidenceClass: 'research-needed' }));
  assert.deepEqual(r.errors, []);
  assert.equal(r.readiness, 'unresolved');
  for (const status of ['unknown', 'restricted']) {
    const red = evaluateRecord(good({ license: { name: 'x', terms: 'y', redistribution: status } }));
    assert.deepEqual(red.errors, []);
    assert.equal(red.readiness, 'unresolved');
  }
  assert.equal(evaluateRecord(good({ license: { name: 'x', terms: 'y', redistribution: 'prohibited' } })).readiness, 'blocked');
  assert.equal(evaluateRecord(good({ review: { state: 'rejected', events: ['review/x'] } })).readiness, 'blocked');
});

test('imported corpora need allowed redistribution, transformation record and a reviewed state', () => {
  const corpus = (over) =>
    good({
      evidenceClass: 'licensed-corpus',
      valueOrigin: 'licensed-corpus',
      license: { name: 'CC-BY-4.0', redistribution: 'allowed', terms: 'attribution required' },
      transformations: ['dropped free-text columns'],
      review: { state: 'reviewed', events: ['review/corpus-check'] },
      ...over,
    });
  assert.equal(evaluateRecord(corpus()).readiness, 'public-safe');
  assert.equal(evaluateRecord(corpus({ review: { state: 'unreviewed', events: [] } })).readiness, 'unresolved');
  assert.equal(evaluateRecord(corpus({ license: { name: 'x', terms: 'y', redistribution: 'restricted' } })).readiness, 'unresolved');
  assert.ok(evaluateRecord(corpus({ transformations: [] })).errors.some((e) => e.includes('transformations')));
  assert.ok(evaluateRecord(corpus({ license: undefined })).errors.some((e) => e.includes('license')));
  assert.ok(evaluateRecord(corpus({ review: { state: 'reviewed', events: [] } })).errors.some((e) => e.includes('review event')));
});

test('naturally occurring personal data requires a reviewed state', () => {
  assert.equal(evaluateRecord(good({ naturallyOccurringPersonalData: true })).readiness, 'unresolved');
  const ok = good({ naturallyOccurringPersonalData: true, review: { state: 'reviewed', events: ['review/x'] } });
  assert.equal(evaluateRecord(ok).readiness, 'public-safe');
});

function withRepo(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'lint-prov-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), content);
    }
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const run = (dir, ...args) => spawnSync(process.execPath, [SCRIPT, '--root', dir, ...args], { encoding: 'utf8' });

test('absent evidence/sources is tolerated', () => {
  withRepo({ 'README.md': 'x' }, (dir) => {
    const r = run(dir);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /no records under evidence\/sources/);
  });
});

test('reads JSON arrays, {sources}, single objects and JSONL', () => {
  withRepo(
    {
      'evidence/sources/a.json': JSON.stringify(good({ id: 'a' })),
      'evidence/sources/b.json': JSON.stringify([good({ id: 'b1' }), good({ id: 'b2' })]),
      'evidence/sources/c.json': JSON.stringify({ sources: [good({ id: 'c' })] }),
      'evidence/sources/nested/d.jsonl': `${JSON.stringify(good({ id: 'd1' }))}\n\n${JSON.stringify(good({ id: 'd2' }))}\n`,
    },
    (dir) => {
      const sum = summarize(lintSources(dir));
      assert.equal(sum.total, 6);
      assert.equal(sum.counts['public-safe'], 6);
      assert.equal(run(dir).status, 0);
    },
  );
});

test('CLI: missing fields and protected markers fail; unresolved passes unless --public-release', () => {
  withRepo({ 'evidence/sources/a.json': JSON.stringify(without('license')) }, (dir) => {
    const r = run(dir);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /missing license/);
  });
  withRepo({ 'evidence/sources/a.json': JSON.stringify(good({ valueOrigin: 'private-custodian' })) }, (dir) => {
    assert.equal(run(dir).status, 1);
    assert.equal(run(dir, '--public-release').status, 1);
  });
  withRepo({ 'evidence/sources/a.json': JSON.stringify(good({ evidenceClass: 'research-needed' })) }, (dir) => {
    const r = run(dir);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /unresolved:\s+1/);
    assert.match(r.stdout, /NOT READY/);
    assert.equal(run(dir, '--public-release').status, 1);
  });
  withRepo({ 'evidence/sources/a.json': JSON.stringify(good()) }, (dir) => {
    assert.match(run(dir, '--public-release').stdout, /READY/);
    assert.equal(run(dir, '--public-release').status, 0);
  });
});

test('malformed JSON is an error', () => {
  withRepo({ 'evidence/sources/a.json': '{not json' }, (dir) => {
    assert.equal(run(dir).status, 1);
  });
});

test('the repository itself passes the provenance lint', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout);
});
