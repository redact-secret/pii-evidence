#!/usr/bin/env node
// Usage:
//   node scripts/materialize-fixtures.mjs [--root <dir>] [--out <dir>] [--population public]
//   node scripts/materialize-fixtures.mjs --check [--root <dir>] [--out <dir>]
//
// Materialize: validates the tree, projects every authored Case through every in-scope rule in
// fixtures/rules/, and writes fixtures.jsonl, skipped.jsonl and manifest.json (default
// fixtures/materialized/, not committed: generated output is never canonical evidence).
//
// Check: no files are written. It projects twice (the second run over reversed input order),
// requires byte-identical results, requires every fixture to match its authored Case and rule,
// and, if an output directory exists, requires it to equal a fresh regeneration.
//
// Exit codes: 0 ok, 1 refused or failed, 2 usage.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, readRecordFile, validateRecords } from "./lib/validator.mjs";
import { MATERIALIZED_DIR, OUTPUT_FILES, PROJECTOR_NAME, PROJECTOR_VERSION, ProjectionRefusal, defaultOutDir, loadInputs, materializeTwice } from "./lib/projector.mjs";

const usage = () => {
  console.error("usage: node scripts/materialize-fixtures.mjs [--check] [--root <dir>] [--out <dir>] [--population public]");
  process.exit(2);
};

let root = REPO_ROOT;
let out;
let check = false;
let population = "public";
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--check") check = true;
  else if (args[i] === "--root" && args[i + 1]) root = path.resolve(args[++i]);
  else if (args[i] === "--out" && args[i + 1]) out = path.resolve(args[++i]);
  else if (args[i] === "--population" && args[i + 1]) population = args[++i];
  else usage();
}
out ??= defaultOutDir(root);

function fail(lines) {
  for (const l of lines) console.error(`error: ${l}`);
  console.error(`fixtures:materialize${check ? ":check" : ""}: FAILED with ${lines.length} error(s)`);
  process.exit(1);
}

let result;
try {
  const { first, diffs } = materializeTwice({ root, population });
  if (diffs.length) fail([`two runs differ (nondeterministic projection): ${diffs.join(", ")}`]);
  result = first;
} catch (e) {
  if (e instanceof ProjectionRefusal) fail(e.errors);
  throw e;
}
const { files, manifest } = result;
const summary = `${manifest.counts.fixtures} fixtures, ${manifest.counts.skipped} skipped, from ${manifest.counts.cases} cases and ${manifest.counts.rules} rules (${PROJECTOR_NAME}@${PROJECTOR_VERSION})`;

if (!check) {
  mkdirSync(out, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(out, name), text);
  console.log(`fixtures:materialize: wrote ${summary} to ${path.relative(process.cwd(), out) || "."}`);
  console.log(`  fixtures.jsonl sha256 ${manifest.outputs.fixtures.sha256}`);
  process.exit(0);
}

const errors = [];
if (existsSync(out)) {
  const stale = [];
  for (const [name, text] of Object.entries(files)) {
    const p = path.join(out, name);
    if (!existsSync(p)) stale.push(`${name} (missing)`);
    else if (readFileSync(p, "utf8") !== text) stale.push(name);
  }
  if (stale.length) {
    errors.push(`${path.relative(root, out) || out} is stale or was edited by hand: ${stale.join(", ")}; run npm run fixtures:materialize (generated output is never edited)`);
    // Say what is wrong with the on-disk records, using the same checks the validator applies.
    const { records } = loadInputs(root);
    const disk = [];
    for (const name of [OUTPUT_FILES.fixtures, OUTPUT_FILES.skipped]) {
      const p = path.join(out, name);
      if (existsSync(p)) disk.push(...readRecordFile(p, `${MATERIALIZED_DIR}/${name}`).records);
    }
    for (const e of validateRecords([...records, ...disk]).errors) if (e.includes(`${MATERIALIZED_DIR}/`)) errors.push(e);
  }
}
if (errors.length) fail(errors);
console.log(`fixtures:materialize:check: ok, ${summary}; two runs byte-identical${existsSync(out) ? "; on-disk output matches" : "; no on-disk output to compare"}`);
