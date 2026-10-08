import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createDelta, recordDelta, renderDelta, canonical, runDelta } from '../scripts/snapshot-delta.mjs';

const snapshot = (id, cases = []) => ({ manifest: { id, contentDigest: 'digest', counts: { cases: cases.length, fixtures: 0 }, coverage: { kindsWithoutCases: [] }, exclusions: { cases: [] } }, records: { cases, fixtures: [], claims: [], sources: [], 'review-events': [], 'fixture-rules': [] }, taxonomy: { kinds: [], contexts: [], jurisdictions: [] } });
const ledger = candidates => [{ path: 'docs/research/test-adjudication.json', record: { schemaVersion: '1', candidates } }];

test('record delta detects semantic changes while ignoring property order and record order', () => {
  assert.deepEqual(recordDelta([{ id: 'b', value: 1 }, { id: 'a', value: 1 }], [{ value: 1, id: 'a' }, { id: 'b', value: 2 }, { id: 'c' }]), { added: ['c'], removed: [], changed: ['b'] });
});

test('delta keeps independent denominator changes, exclusions and unresolved decisions visible', () => {
  const before = snapshot('baseline', [{ id: 'old', review: { state: 'unreviewed' } }]);
  const after = snapshot('candidate', [{ id: 'new', review: { state: 'reviewed' } }, { id: 'control' }]);
  after.manifest.exclusions.cases.push({ id: 'deferred', reasons: ['research disposition defer'] });
  const adjudications = ledger([
    { id: 'deferred', disposition: 'defer', researchIssue: 20, implementation: { cases: ['evidence/cases/example.jsonl'] }, unresolved: ['Authority unresolved.'] },
    { id: 'new-role', disposition: 'reject', researchIssue: 25, canonicalCaseDisposition: 'retain-bounded-existing-cases', implementation: { cases: ['control'] } },
  ]);
  const report = createDelta({ baseline: before, candidate: after, adjudications });
  assert.equal(report.counts.cases.delta, 1);
  assert.deepEqual(report.records.cases.removed, ['old']);
  assert.equal(report.adjudications.unresolvedInventory.length, 2);
  assert.equal(report.adjudications.candidates[0].caseAccounting[0].state, 'excluded');
  assert.equal(report.adjudications.candidates[1].caseAccounting[0].state, 'included');
  assert.match(renderDelta(report), /Cases: 1 -> 2 \(\+1\)/);
  assert.deepEqual(canonical(report), canonical(createDelta({ baseline: before, candidate: after, adjudications: ledger([...adjudications[0].record.candidates].reverse()) })));
});

test('deferred canonical Case cannot silently enter candidate and unknown dispositions fail closed', () => {
  const before = snapshot('baseline');
  const after = snapshot('candidate', [{ id: 'deferred' }]);
  assert.throws(() => createDelta({ baseline: before, candidate: after, adjudications: ledger([{ id: 'deferred', disposition: 'defer', implementation: { cases: ['evidence/cases/example.jsonl'] } }]) }), /deferred canonical Case/);
  assert.throws(() => createDelta({ baseline: before, candidate: after, adjudications: ledger([{ id: 'x', disposition: 'guess' }]) }), /invalid adjudication/);
});

test('report gate binds release pins, snapshot bytes and adjudication bytes and detects stale reports', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'snapshot-delta-test-'));
  const hash = text => createHash('sha256').update(text).digest('hex');
  const put = (relative, text) => { const file = path.join(root, relative); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text); };
  const make = (date, suffix) => {
    const id = `public-pii-phi/${date}/${suffix}`;
    const value = snapshot(id);
    const files = [['taxonomy/privacy-kinds.json', { kinds: [] }], ['taxonomy/contexts.json', { contexts: [] }], ['taxonomy/jurisdictions.json', { jurisdictions: [] }]].map(([relative, data]) => {
      const bytes = JSON.stringify(data);
      put(`snapshots/${id}/${relative}`, bytes);
      return { path: relative, bytes: Buffer.byteLength(bytes), sha256: hash(bytes) };
    });
    const manifest = JSON.stringify({ ...value.manifest, files });
    put(`snapshots/${id}/manifest.json`, manifest);
    return { id, manifestSha256: hash(manifest) };
  };
  try {
    const baseline = make('2026-10-07', '000000000001');
    const candidate = make('2026-10-08', '000000000002');
    put('snapshots/released.json', JSON.stringify({ snapshots: [baseline] }));
    const ledgerPath = 'docs/research/test-adjudication.json';
    put(ledgerPath, JSON.stringify({ schemaVersion: '1', candidates: [] }));
    put('docs/research/snapshot-v2-candidate.json', JSON.stringify({ schema: 'snapshot-v2-candidate/1', status: 'candidate', baseline, snapshot: candidate, adjudications: [ledgerPath] }));
    const report = runDelta({ root });
    assert.equal(report.adjudications.ledgers[0].sha256, hash(readFileSync(path.join(root, ledgerPath))));
    assert.doesNotThrow(() => runDelta({ root, check: true }));
    put(ledgerPath, JSON.stringify({ schemaVersion: '1', candidates: [{ id: 'future', disposition: 'defer', unresolved: [] }] }));
    assert.throws(() => runDelta({ root, check: true }), /stale/);
    put(`snapshots/${candidate.id}/taxonomy/contexts.json`, '{}');
    assert.throws(() => runDelta({ root }), /file digest mismatch/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
