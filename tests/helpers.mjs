import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, loadTree, readRecordFile } from "../scripts/lib/validator.mjs";

export const EXAMPLES = path.join(REPO_ROOT, "schemas", "v1", "examples");

export function exampleFiles(sub) {
  return readdirSync(path.join(EXAMPLES, sub)).filter((n) => n.endsWith(".json")).sort();
}

export function readExample(sub, name) {
  return JSON.parse(readFileSync(path.join(EXAMPLES, sub, name), "utf8"));
}

export const wrap = (data, file = "inline.json", corpus = "tree") => ({ file, corpus, data });

/** Records of the real taxonomy (the vocabulary that examples reference). */
export function taxonomyRecords() {
  const { records, errors } = loadTree(REPO_ROOT);
  if (errors.length) throw new Error(errors.join("\n"));
  return records.filter((r) => r.file.startsWith("taxonomy/"));
}

/**
 * Claim, source and review-event records under evidence/ that the taxonomy cites by id.
 * Cases are not included.
 */
export function citedEvidenceRecords() {
  const { records, errors } = loadTree(REPO_ROOT);
  if (errors.length) throw new Error(errors.join("\n"));
  const cited = new Set(["claim", "source", "review-event"]);
  return records.filter((r) => r.file.startsWith("evidence/") && cited.has(r.data.kind));
}

/** Taxonomy, the evidence it cites, and every valid example. */
export function validCorpus() {
  const out = [...taxonomyRecords(), ...citedEvidenceRecords()];
  for (const n of exampleFiles("valid")) {
    const { records } = readRecordFile(path.join(EXAMPLES, "valid", n), `valid/${n}`);
    out.push(...records);
  }
  return out;
}

export const clone = (o) => JSON.parse(JSON.stringify(o));
