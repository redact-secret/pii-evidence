#!/usr/bin/env node
// Usage: node scripts/validate.mjs [--root <dir>]
// Validates taxonomy/, evidence/, fixtures/ and snapshots/ under the root
// (default: the repository). Missing or empty directories succeed.
import path from "node:path";
import { REPO_ROOT, validateTree } from "./lib/validator.mjs";

const args = process.argv.slice(2);
let root = REPO_ROOT;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--root" && args[i + 1]) root = path.resolve(args[++i]);
  else {
    console.error(`usage: node scripts/validate.mjs [--root <dir>]`);
    process.exit(2);
  }
}

const { errors, stats } = validateTree(root);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`validate: FAILED with ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`validate: ok (${stats.records} record file entries, ${stats.entries} ids)`);
