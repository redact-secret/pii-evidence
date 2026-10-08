import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const POINTER = 'docs/research/snapshot-v2-candidate.json';
const OUTPUT = 'docs/research/snapshot-v2-delta';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort(compare).map(key => [key, canonical(value[key])]));
  return value;
}
const json = value => `${JSON.stringify(canonical(value), null, 2)}\n`;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const lines = file => existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];

export function recordDelta(previous, candidate) {
  const before = new Map(previous.map(record => [record.id, record]));
  const after = new Map(candidate.map(record => [record.id, record]));
  return {
    added: [...after.keys()].filter(id => !before.has(id)).sort(compare),
    removed: [...before.keys()].filter(id => !after.has(id)).sort(compare),
    changed: [...after.keys()].filter(id => before.has(id) && json(before.get(id)) !== json(after.get(id))).sort(compare),
  };
}
const tally = values => Object.fromEntries([...new Set(values)].sort(compare).map(value => [value, values.filter(item => item === value).length]));

function loadSnapshot(root, pin) {
  if (!/^public-pii-phi\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{12}$/.test(pin?.id ?? '') || !/^[a-f0-9]{64}$/.test(pin.manifestSha256 ?? '')) throw new Error('snapshot delta requires exact snapshot identity and manifest pin');
  const dir = path.join(root, 'snapshots', pin.id);
  const manifestBytes = readFileSync(path.join(dir, 'manifest.json'));
  if (digest(manifestBytes) !== pin.manifestSha256) throw new Error('snapshot delta manifest pin mismatch');
  const manifest = JSON.parse(manifestBytes);
  if (manifest.id !== pin.id) throw new Error('snapshot delta id mismatch');
  for (const file of manifest.files) {
    if (file.path.startsWith('/') || file.path.split('/').some(part => part === '..' || !part)) throw new Error('snapshot delta unsafe file path');
    const bytes = readFileSync(path.join(dir, file.path));
    if (digest(bytes) !== file.sha256 || bytes.length !== file.bytes) throw new Error('snapshot delta file digest mismatch');
  }
  const records = Object.fromEntries(['cases', 'fixtures', 'claims', 'sources', 'review-events', 'fixture-rules'].map(name => [name, lines(path.join(dir, `${name}.jsonl`))]));
  const taxonomy = Object.fromEntries([['kinds', 'privacy-kinds'], ['contexts', 'contexts'], ['jurisdictions', 'jurisdictions']].map(([key, name]) => [key, read(path.join(dir, 'taxonomy', `${name}.json`))[key]]));
  return { manifest, records, taxonomy };
}

export function createDelta({ baseline, candidate, adjudications, mappingExpectations = null }) {
  const dispositions = [];
  for (const ledger of adjudications) {
    if (ledger.record.schemaVersion !== '1' || !Array.isArray(ledger.record.candidates)) throw new Error('snapshot delta unknown adjudication schema');
    const seen = new Set();
    for (const entry of ledger.record.candidates) {
      if (!entry.id || seen.has(entry.id) || !['add', 'context-only', 'defer', 'reject'].includes(entry.disposition)) throw new Error('snapshot delta invalid adjudication candidate');
      if (entry.canonicalCaseDisposition && !['add', 'context-only', 'defer', 'reject', 'retain-bounded-existing-cases', 'no-new-case'].includes(entry.canonicalCaseDisposition)) throw new Error('snapshot delta invalid canonical Case disposition');
      seen.add(entry.id);
      dispositions.push({ ledger: ledger.path, id: entry.id, disposition: entry.disposition, researchIssue: entry.researchIssue,
        semanticTarget: entry.semanticTarget, canonicalCaseDisposition: entry.canonicalCaseDisposition ?? null,
        implementationCases: entry.implementation?.cases ?? [], unresolved: entry.unresolved ?? [], consumerRepresentability: entry.consumerRepresentability ?? null });
    }
  }
  dispositions.sort((a, b) => compare(`${a.ledger}/${a.id}`, `${b.ledger}/${b.id}`));
  const countKeys = [...new Set([...Object.keys(baseline.manifest.counts), ...Object.keys(candidate.manifest.counts)])].sort(compare);
  const records = Object.fromEntries(Object.keys(candidate.records).map(key => [key, recordDelta(baseline.records[key], candidate.records[key])]));
  const taxonomy = Object.fromEntries(Object.keys(candidate.taxonomy).map(key => [key, recordDelta(baseline.taxonomy[key], candidate.taxonomy[key])]));
  const caseIds = new Set(candidate.records.cases.map(record => record.id));
  const exclusions = new Map((candidate.manifest.exclusions.cases ?? []).map(entry => [entry.id, entry.reasons]));
  for (const entry of dispositions) {
    const refs = entry.implementationCases;
    const ids = refs.some(ref => ref.startsWith('evidence/')) ? [entry.id] : refs;
    entry.caseAccounting = ids.map(id => ({ id, state: caseIds.has(id) ? 'included' : exclusions.has(id) ? 'excluded' : 'not-authored-or-not-selected', reasons: exclusions.get(id) ?? [] }));
    const effective = entry.canonicalCaseDisposition ?? entry.disposition;
    if (['defer', 'reject'].includes(effective) && caseIds.has(entry.id)) throw new Error('snapshot delta contains a deferred canonical Case');
  }
  const reviewStates = snapshot => Object.fromEntries(['cases', 'claims', 'sources', 'fixture-rules'].map(key => [key, tally(snapshot.records[key].map(record => record.review?.state ?? 'not-stated'))]));
  return { schema: 'pii-evidence-snapshot-delta/1', population: 'public', authority: 'project-maintained-evidence',
    baseline: { id: baseline.manifest.id, contentDigest: baseline.manifest.contentDigest },
    candidate: { id: candidate.manifest.id, contentDigest: candidate.manifest.contentDigest },
    taxonomy, records,
    counts: Object.fromEntries(countKeys.map(key => [key, { previous: baseline.manifest.counts[key] ?? 0, candidate: candidate.manifest.counts[key] ?? 0, delta: (candidate.manifest.counts[key] ?? 0) - (baseline.manifest.counts[key] ?? 0) }])),
    coverage: { previous: baseline.manifest.coverage, candidate: candidate.manifest.coverage },
    reviewStates: { previous: reviewStates(baseline), candidate: reviewStates(candidate) },
    exclusions: { previous: baseline.manifest.exclusions, candidate: candidate.manifest.exclusions },
    adjudications: { ledgers: adjudications.map(ledger => ({ path: ledger.path, sha256: ledger.sha256 ?? null })), counts: tally(dispositions.map(entry => entry.disposition)), candidates: dispositions,
      unresolvedInventory: dispositions.filter(entry => ['defer', 'reject'].includes(entry.disposition) || entry.unresolved.length) },
    mappingExpectations: { owner: 'pii-eval', status: 'declared-expectations-not-executed-measurement', metadata: mappingExpectations },
    denominatorPolicy: 'Counts describe these pinned public snapshots only; no scanner results, protected population or product qualification is inferred.' };
}

export function renderDelta(report) {
  const count = key => report.counts[key];
  const list = values => values.length ? values.map(value => `\`${value}\``).join(', ') : 'none';
  return `# Snapshot v2 candidate coverage delta\n\nProject-maintained evidence, not independent validation or product qualification.\n\nBaseline: \`${report.baseline.id}\`. Candidate: \`${report.candidate.id}\`. Both are pinned by manifest SHA-256 in snapshot-v2-candidate.json.\n\n## Denominators\n\nCases: ${count('cases').previous} -> ${count('cases').candidate} (${count('cases').delta >= 0 ? '+' : ''}${count('cases').delta}). Fixtures: ${count('fixtures').previous} -> ${count('fixtures').candidate} (${count('fixtures').delta >= 0 ? '+' : ''}${count('fixtures').delta}). Counts include only these public evidence snapshots; no scanner or protected population is added.\n\n## Taxonomy\n\n${Object.entries(report.taxonomy).map(([key, delta]) => `- ${key}: added ${list(delta.added)}; removed ${list(delta.removed)}; changed ${list(delta.changed)}.`).join('\n')}\n\nKinds without accepted cases: ${list(report.coverage.candidate.kindsWithoutCases)}.\n\n## Evidence and review\n\n${Object.entries(report.records).map(([key, delta]) => `- ${key}: ${delta.added.length} added, ${delta.removed.length} removed, ${delta.changed.length} changed.`).join('\n')}\n\nExact IDs, source changes, review-state counts, exclusions and per-kind case/fixture denominators are in [snapshot-v2-delta.json](snapshot-v2-delta.json).\n\n## Adjudication and unresolved inventory\n\n${Object.entries(report.adjudications.counts).map(([key, value]) => `- ${key}: ${value} research decisions.`).join('\n')}\n\n${report.adjudications.unresolvedInventory.map(entry => `- \`${entry.id}\` (${entry.disposition}, research #${entry.researchIssue}): ${entry.unresolved.length ? entry.unresolved.join(' ') : 'Decision and rationale remain in the adjudication ledger.'}`).join('\n')}\n\n## Consumer handoff\n\nMapping expectations are declared metadata owned by pii-eval, not observed scanner behavior. Exact mapping additions, refusal states and semantic losses must be read with the separate candidate preflight report before adoption. The machine report retains the declared metadata without importing consumer code.\n\n${report.denominatorPolicy}\n`;
}

export function runDelta({ root = ROOT, check = false } = {}) {
  const pointer = read(path.join(root, POINTER));
  if (pointer.schema !== 'snapshot-v2-candidate/1' || !['candidate', 'released'].includes(pointer.status) || !Array.isArray(pointer.adjudications)) throw new Error('snapshot delta unknown candidate pointer');
  const registry = read(path.join(root, 'snapshots/released.json'));
  const released = registry.snapshots.find(entry => entry.id === pointer.baseline?.id);
  if (!released || released.manifestSha256 !== pointer.baseline.manifestSha256) throw new Error('snapshot delta baseline is not the pinned released snapshot');
  const targetRelease = registry.snapshots.find(entry => entry.id === pointer.snapshot?.id);
  if (pointer.status === 'candidate' && targetRelease) throw new Error('snapshot delta candidate must remain unreleased');
  if (pointer.status === 'released' && (!targetRelease || targetRelease.manifestSha256 !== pointer.snapshot.manifestSha256)) throw new Error('snapshot delta released target must match registry pin');
  const adjudications = pointer.adjudications.map(relative => {
    if (!/^docs\/research\/[a-z0-9-]+\.json$/.test(relative)) throw new Error('snapshot delta unsafe ledger path');
    const bytes = readFileSync(path.join(root, relative));
    return { path: relative, sha256: digest(bytes), record: JSON.parse(bytes) };
  });
  const report = createDelta({ baseline: loadSnapshot(root, pointer.baseline), candidate: loadSnapshot(root, pointer.snapshot), adjudications, mappingExpectations: pointer.mappingExpectations });
  for (const [extension, bytes] of [['json', json(report)], ['md', renderDelta(report)]]) {
    const file = path.join(root, `${OUTPUT}.${extension}`);
    if (check) {
      if (!existsSync(file) || readFileSync(file, 'utf8') !== bytes) throw new Error(`snapshot delta ${extension} report is missing or stale`);
    } else writeFileSync(file, bytes);
  }
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some(arg => arg !== '--check') || process.argv.slice(2).length > 1) throw new Error('usage: snapshot-delta.mjs [--check]');
    // Before the candidate exists, this gate has no candidate report to verify.
    if (!existsSync(path.join(ROOT, POINTER))) throw new Error('snapshot v2 candidate pointer does not exist');
    const report = runDelta({ check: process.argv.includes('--check') });
    console.log(`Snapshot delta ${process.argv.includes('--check') ? 'verified' : 'written'}: ${report.baseline.id} -> ${report.candidate.id}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
