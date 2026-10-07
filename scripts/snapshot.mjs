#!/usr/bin/env node
// Snapshot builder and verifier (docs/methodology/consumer-contract.md, docs/governance/snapshot-policy.md).
//
//   node scripts/snapshot.mjs build --date YYYY-MM-DD [--root <dir>]
//       Assemble snapshots/<id>/ from the public-safe subset of the evidence. The date is an
//       explicit input recorded in the manifest; the clock is never read. Refuses a released id
//       whose bytes would differ. Removes other unreleased (draft) snapshot directories.
//   node scripts/snapshot.mjs verify [--base <git-ref>] [--no-rebuild] [--root <dir>]
//       Verify every snapshots/<id>/ (digests, counts, references, neutrality, provenance,
//       safe-data) and the released registry. Released snapshots must equal their registered
//       digests. Unreleased drafts must equal a fresh rebuild. With --base, every snapshot
//       released at that git ref must still exist unchanged (CI uses --base origin/main).
//   node scripts/snapshot.mjs verify-dir <dir>
//       Verify one snapshot directory standalone (no source tree, no registry).
//   node scripts/snapshot.mjs pack <id> --out <dir> [--root <dir>]
//       Write the deterministic <archive>.tar.gz and .sha256, print the tar and tar.gz digests.
//   node scripts/snapshot.mjs register <id> [--root <dir>]
//       Add the registry entry that marks <id> released (digests, archive, derived tag and URL).
//
// Exit codes: 0 ok, 1 refused or failed, 2 usage.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./lib/validator.mjs";
import { loadAllowlist } from "./lint-safe-data.mjs";
import {
  ALLOWLIST_PATH, REGISTRY_FILE, SnapshotRefusal, archiveNameOf, buildSnapshot, gzipOf, readRegistry,
  registryEntryOf, registryText, sha256Hex, tarOf, verifyRepository, verifySnapshotDir, writeSnapshot,
} from "./lib/snapshot.mjs";

const usage = () => {
  console.error("usage: node scripts/snapshot.mjs build --date YYYY-MM-DD | verify [--base <ref>] [--no-rebuild] | verify-dir <dir> | pack <id> --out <dir> | register <id> [--root <dir>]");
  process.exit(2);
};

const [cmd, ...rest] = process.argv.slice(2);
let root = REPO_ROOT;
let date;
let base;
let out;
let rebuild = true;
const positional = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--root" && rest[i + 1]) root = path.resolve(rest[++i]);
  else if (rest[i] === "--date" && rest[i + 1]) date = rest[++i];
  else if (rest[i] === "--base" && rest[i + 1]) base = rest[++i];
  else if (rest[i] === "--out" && rest[i + 1]) out = path.resolve(rest[++i]);
  else if (rest[i] === "--no-rebuild") rebuild = false;
  else if (!rest[i].startsWith("--")) positional.push(rest[i]);
  else usage();
}

const fail = (lines, label) => {
  for (const l of lines) console.error(`error: ${l}`);
  console.error(`snapshot:${label}: FAILED with ${lines.length} error(s)`);
  process.exit(1);
};
const allowlistOf = () => {
  const a = loadAllowlist(path.join(REPO_ROOT, ALLOWLIST_PATH));
  if (a.errors.length) fail(a.errors.map((e) => `allowlist: ${e}`), cmd);
  return a.entries;
};
const guard = (fn, label) => {
  try {
    return fn();
  } catch (e) {
    if (e instanceof SnapshotRefusal) fail(e.errors, label);
    throw e;
  }
};

if (cmd === "build") {
  const built = guard(() => buildSnapshot({ root, date }), "build");
  const res = guard(() => writeSnapshot({ root, built }), "build");
  const m = built.manifest;
  console.log(`snapshot:build: ${res.written ? "wrote" : "unchanged (released)"} snapshots/${built.id}`);
  for (const d of res.removedDrafts) console.log(`  removed stale draft snapshots/${d}`);
  console.log(`  cases ${m.counts.cases}, fixtures ${m.counts.fixtures}, sources ${m.counts.sources}, claims ${m.counts.claims}; excluded: ${m.counts.excludedSources} sources, ${m.counts.excludedClaims} claims, ${m.counts.excludedCases} cases, ${m.counts.excludedFixtures} fixtures`);
  console.log(`  contentDigest ${m.contentDigest}`);
} else if (cmd === "verify") {
  const r = verifyRepository({ root, base, rebuild, allowlist: allowlistOf() });
  if (r.errors.length) fail(r.errors, "verify");
  console.log(`snapshot:verify: ok, ${r.dirs.length} snapshot(s)${base ? ` (immutability checked against ${base})` : ""}`);
  for (const n of r.notes) console.log(`  ${n}`);
} else if (cmd === "verify-dir") {
  if (positional.length !== 1) usage();
  const v = verifySnapshotDir(path.resolve(positional[0]), { allowlist: allowlistOf() });
  if (v.errors.length) fail(v.errors, "verify-dir");
  console.log(`snapshot:verify-dir: ok ${v.manifest.id} (contentDigest ${v.manifest.contentDigest})`);
} else if (cmd === "pack" || cmd === "register") {
  if (positional.length !== 1) usage();
  const id = positional[0];
  const v = verifySnapshotDir(path.join(root, "snapshots", id), { expectedId: id });
  if (v.errors.length) fail(v.errors, cmd);
  const entry = registryEntryOf({ id, manifest: v.manifest, files: v.files });
  if (cmd === "pack") {
    if (!out) usage();
    const tar = tarOf(id, v.files);
    const gz = gzipOf(tar);
    mkdirSync(out, { recursive: true });
    const name = archiveNameOf(id);
    writeFileSync(path.join(out, name), gz);
    writeFileSync(path.join(out, `${name}.sha256`), `${sha256Hex(gz)}  ${name}\n`);
    console.log(`snapshot:pack: ${path.join(out, name)}`);
    console.log(`  tar sha256    ${sha256Hex(tar)}`);
    console.log(`  tar.gz sha256 ${sha256Hex(gz)}`);
  } else {
    const reg = readRegistry(root);
    const existing = reg.snapshots.find((s) => s.id === id);
    if (existing) fail([`${id} is already registered; released entries never change`], "register");
    reg.snapshots.push(entry);
    writeFileSync(path.join(root, REGISTRY_FILE), registryText(reg));
    console.log(`snapshot:register: ${id} registered in ${REGISTRY_FILE}`);
    console.log(`  tag ${entry.release.tag}`);
  }
} else usage();
