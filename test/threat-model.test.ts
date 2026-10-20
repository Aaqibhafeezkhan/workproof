import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, access, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { makeRepo } from "./fixture.js";
import { analyseRepo, buildReport, checkReport, hashOf, narrate, predicateFor, renderMarkdown } from "../src/index.js";
import type { Report } from "../src/index.js";
import { possibleSplits } from "../src/figures/identity.js";

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

// The noreply address and the name are fixtures; the login the report should carry is derived from the address.
const OTHER_NOREPLY = "99+adalovelace@users.noreply.github.com";
const OTHER_NAME = "A. L.";
const OTHER_LOGIN = OTHER_NOREPLY.split("@")[0]!.replace(/^\d+\+/, "");

// A repository where two other addresses share the subject's GitHub login. The names and logins are fixtures.
const SPLIT_SUBJECT = "7+adalovelace@users.noreply.github.com";
const SPLIT_OTHERS = [
  { name: "Quentin Zed", email: "99+adalovelace@users.noreply.github.com" },
  { name: "Rhea Vox", email: "adalovelace@corp.example" },
];

async function makeSplitRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "workproof-split-"));
  const commit = (who: { name: string; email: string }, date: string, file: string) => {
    const env = { ...process.env, GIT_AUTHOR_NAME: who.name, GIT_AUTHOR_EMAIL: who.email, GIT_COMMITTER_NAME: who.name, GIT_COMMITTER_EMAIL: who.email, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
    execFileSync("git", ["add", "."], { cwd: dir, env });
    execFileSync("git", ["commit", "-q", "-m", file], { cwd: dir, env });
  };
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  const mine = { name: "Ada Lovelace", email: SPLIT_SUBJECT };
  for (const [i, who] of [mine, ...SPLIT_OTHERS].entries()) {
    await writeFile(join(dir, `f${i}.ts`), Array.from({ length: 12 }, (_, j) => `line ${j} ${i}`).join("\n") + "\n");
    commit(who, `2026-01-${String(5 + i * 7).padStart(2, "0")}T10:00:00Z`, `c${i}`);
  }
  return dir;
}

test("privacy: other identities' names and logins stay out of the report without --emails", async () => {
  const dir = await makeSplitRepo();
  try {
    const base = { ...params, author: [SPLIT_SUBJECT], sample: 1 };
    const quiet = { ...base, emails: false };
    const report = buildReport([await analyseRepo(dir, quiet)], quiet, meta);
    const split = report.repositories[0]!.identity.possiblySplit;
    assert.ok(split, "the suspicion is still disclosed");
    assert.equal(split.count, SPLIT_OTHERS.length, "the count of other addresses is written");
    assert.match(split.hint ?? "", /--emails/, "a fixed hint points at --emails");
    const text = JSON.stringify(report) + "\n" + renderMarkdown(report);
    for (const leak of ["Quentin Zed", "Rhea Vox", "adalovelace", "corp.example"]) {
      assert.ok(!text.includes(leak), `"${leak}" must not be written without --emails`);
    }
    assert.ok(checkReport(JSON.parse(JSON.stringify(report))).ok, "the report still validates against the schema");

    const loud = { ...base, emails: true };
    const full = buildReport([await analyseRepo(dir, loud)], loud, meta);
    const fullText = JSON.stringify(full) + "\n" + renderMarkdown(full);
    assert.ok(fullText.includes("Quentin Zed") && fullText.includes("Rhea Vox"), "--emails keeps the names");
    assert.ok(fullText.includes("adalovelace"), "--emails keeps the login in the reasons");
    assert.ok(checkReport(JSON.parse(JSON.stringify(full))).ok);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("privacy: possibleSplits tags every record with a fixed category", () => {
  const commits = [
    { name: "Ada Lovelace", email: "ada.lovelace@example.com" },
    { name: "A. L.", email: "99+adalovelace@users.noreply.github.com" },
  ];
  const splits = possibleSplits(commits, { emails: ["ada.lovelace@example.com"], names: ["Ada Lovelace"] });
  assert.equal(splits.length, 1);
  assert.equal(splits[0]!.category, "GitHub login matches");
});

test("predicate: the in-toto predicate carries the subject's author names", async () => {
  const dir = await makeRepo();
  try {
    const report = buildReport([await analyseRepo(dir, params)], params, meta);
    const names = predicateFor(report).repositories[0]!.identity.names;
    assert.deepEqual(names, report.repositories[0]!.identity.names);
    assert.ok(names.length > 0, "at least one author name is written");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("narration: the request carries the figure values, including the blame sample seed, and no email", async () => {
  const seed = "seed-for-narration-test";
  const dir = await makeRepo();
  try {
    const p = { ...params, seed, emails: false };
    const report = buildReport([await analyseRepo(dir, p)], p, meta);
    let body = "";
    const fakeFetch = (async (_url: string, init: { body: string }) => {
      body = init.body;
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    await narrate(report, { url: "http://127.0.0.1:1/v1", key: "k", model: "m" }, fakeFetch);
    assert.ok(body.includes("survivingLines"), "figure ids are sent");
    assert.ok(body.includes(seed), "the sample seed is sent, as the threat model says");
    assert.ok(!body.includes("ada@example.com"), "the author's email is not sent");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("verify without a fingerprint key says the fingerprint was not compared", async () => {
  const dir = await makeRepo();
  try {
    const cli = join(process.cwd(), "dist/src/cli.js");
    const out = join(dir, "r");
    execFileSync("node", [cli, "--repo", dir, "--author", "ada@example.com", "--out", out], { encoding: "utf8", stdio: ["ignore", "ignore", "ignore"] });
    const v = execFileSync("node", [cli, "verify", `${out}.json`, "--repo", dir], { encoding: "utf8" });
    assert.match(v, /fingerprint not compared/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the Action's Sigstore step signs the report file with the predicate, not the in-toto statement", async () => {
  const action = await readFile(join(root, "action.yml"), "utf8");
  const start = action.indexOf("- name: Attest the report with Sigstore");
  const end = action.indexOf("- name: Comment on the pull request");
  assert.ok(start >= 0 && end > start, "the Sigstore step is found in action.yml");
  const step = action.slice(start, end);
  assert.ok(step.includes("cosign attest-blob workproof-report.json"), "cosign attests the report file");
  assert.ok(step.includes("--predicate workproof-report.predicate.json"), "the predicate file is the predicate");
  assert.ok(!step.includes("intoto"), "the in-toto statement is not the signed object");
});

test("known mismatches: the section exists and says there are none while the README and the code agree", async () => {
  const s = sections(await doc());
  const body = s.get("Known mismatches with the README");
  assert.ok(body !== undefined, "the Known mismatches section exists");
  const readme = (await readFile(join(root, "README.md"), "utf8")).replace(/\s+/g, " ");
  assert.ok(!readme.includes("signs the same statement keylessly with"), "the README sentence this section once listed has returned: list it again");
  assert.ok(body.replace(/\s+/g, " ").includes("The README and the code agree on everything this page checks."));
});
