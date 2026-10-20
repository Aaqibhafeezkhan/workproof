import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { makeRepo } from "./fixture.js";
import { analyseRepo, buildReport, checkReport, hashOf } from "../src/index.js";
import type { Report } from "../src/index.js";

const root = process.cwd();
const doc = () => readFile(join(root, "docs/THREAT-MODEL.md"), "utf8");

function sections(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let name = "";
  for (const line of text.split("\n")) {
    const m = /^## (.+)$/.exec(line);
    if (m) {
      name = m[1]!;
      out.set(name, "");
    } else if (name) out.set(name, out.get(name)! + line + "\n");
  }
  return out;
}

const params = { author: ["ada@example.com"], depth: 2, threshold: 0.5, minCommits: 1, paths: false, emails: false, sample: 1, fingerprintKey: "ab".repeat(16) };
const meta = { version: "0.6.2", generatedAt: "2026-10-20T00:00:00Z" };

test("the threat model has the sections the issue asks for, in a stable shape", async () => {
  const s = sections(await doc());
  for (const h of [
    "What is being protected",
    "Who the adversaries are",
    "check",
    "verify",
    "attest",
    "countersign",
    "What the hash covers",
    "The fingerprint",
    "Privacy defaults",
    "Rewritten history",
    "Narration",
    "Attacks nothing here stops",
  ]) assert.ok(s.has(h), `missing section: ${h}`);
});

test("each command states what it proves and what it does not protect against", async () => {
  const s = sections(await doc());
  for (const c of ["check", "verify", "attest", "countersign"]) {
    const body = s.get(c) ?? "";
    assert.ok(body.includes("**Proves.**"), `${c}: no Proves label`);
    assert.ok(body.includes("**Does not protect against.**"), `${c}: no Does not protect against label`);
  }
});

test("where the honest answer is no, the document says it in those words", async () => {
  const text = await doc();
  const n = text.split("does not protect against").length - 1 + text.split("Does not protect against").length - 1;
  assert.ok(n >= 8, `expected at least 8, found ${n}`);
  assert.ok(!text.includes("—"), "no em dash");
});

test("every repository path the document cites exists", async () => {
  const text = await doc();
  const paths = [...new Set([...text.matchAll(/`((?:src|test|scripts|docs|schema|bench)\/[A-Za-z0-9_./-]+)`/g)].map((m) => m[1]!))];
  assert.ok(paths.length >= 12, `expected the document to cite at least 12 files, found ${paths.length}`);
  for (const p of paths) await access(join(root, p)).catch(() => assert.fail(`cited but missing: ${p}`));
});

test("the README links the threat model", async () => {
  assert.match(await readFile(join(root, "README.md"), "utf8"), /\]\(docs\/THREAT-MODEL\.md\)/);
});

test("the countersignature page links the threat model it points at", async () => {
  assert.match(await readFile(join(root, "docs/countersignature-v1.md"), "utf8"), /\]\(THREAT-MODEL\.md\)/);
});

test("limit: an edited report whose hash was recomputed still passes check", async () => {
  const dir = await makeRepo();
  try {
    const report = buildReport([await analyseRepo(dir, params)], params, meta);
    const forged = JSON.parse(JSON.stringify(report)) as Report;
    const figure = forged.repositories[0]!.figures.find((f) => f.id === "survivingLines")!;
    (figure.value as { lines: number }).lines += 100;
    assert.equal(checkReport(forged).ok, false, "editing without recomputing the hash is caught");
    forged.hash = hashOf(forged.params, forged.repositories);
    assert.equal(checkReport(forged).ok, true, "the hash is a checksum, not a signature: whoever edits can recompute it");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("limit: generatedAt and the tool version are outside the hash, so editing them passes check", async () => {
  const dir = await makeRepo();
  try {
    const report = buildReport([await analyseRepo(dir, params)], params, meta);
    const edited = JSON.parse(JSON.stringify(report)) as Report;
    edited.generatedAt = "1999-01-01T00:00:00Z";
    edited.version = "9.9.9";
    const result = checkReport(edited);
    assert.equal(result.ok, true);
    assert.equal(result.hash.computed, report.hash);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("limit: the repository name in the report is the local directory name, which privacy defaults do not hide", async () => {
  const dir = await makeRepo();
  try {
    const report = buildReport([await analyseRepo(dir, params)], params, meta);
    assert.equal(report.repositories[0]!.name, basename(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
