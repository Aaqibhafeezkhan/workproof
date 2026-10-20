import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { makeRepo } from "./fixture.js";
import { analyseRepo, buildReport } from "../src/index.js";

const root = process.cwd();
const action = readFileSync(join(root, "action.yml"), "utf8").replace(/\r\n/g, "\n");
const readme = readFileSync(join(root, "README.md"), "utf8").replace(/\r\n/g, "\n");
const START = "<!-- workproof-release-summary -->";
const END = "<!-- /workproof-release-summary -->";

const merge = (dir: string, body: string, summary: string) => {
  const a = join(dir, "body.md");
  const b = join(dir, "summary.md");
  return writeFile(a, body).then(() => writeFile(b, summary)).then(() => spawnSync("node", [join(root, "scripts/action-release.mjs"), a, b], { encoding: "utf8" }));
};

const SUMMARY = "<!-- workproof-summary -->\n### workproof · Ada\n\n| figure | value |\n|---|---|\n| Surviving lines | 16 of 31, 51.6% |";

test("the summary is appended to release notes once, and replaced, not duplicated, on a second run", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wp-release-"));
  try {
    const first = await merge(dir, "## What changed\n\n- a fix\n", SUMMARY);
    assert.equal(first.status, 0, first.stderr);
    assert.ok(first.stdout.startsWith("## What changed\n\n- a fix\n\n" + START));
    assert.ok(first.stdout.trimEnd().endsWith(END));
    assert.equal(first.stdout.split(START).length - 1, 1);
    assert.ok(!first.stdout.includes("<!-- workproof-summary -->"), "the pull request marker does not leak into the release");
    // Run again on the body we just produced, with a newer summary.
    const second = await merge(dir, first.stdout, SUMMARY.replace("16 of 31", "20 of 31"));
    assert.equal(second.stdout.split(START).length - 1, 1, "one block, not two");
    assert.ok(second.stdout.includes("20 of 31") && !second.stdout.includes("16 of 31"));
    assert.ok(second.stdout.startsWith("## What changed"), "the author's own notes are untouched");
    // Running it twice with the same input is a no-op.
    const third = await merge(dir, second.stdout, SUMMARY.replace("16 of 31", "20 of 31"));
    assert.equal(third.stdout, second.stdout);
    // An empty release body works.
    const empty = await merge(dir, "", SUMMARY);
    assert.ok(empty.stdout.startsWith(START));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a body with only one marker, or a summary that contains a marker, is refused", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wp-release-"));
  try {
    const half = await merge(dir, `notes\n${START}\nhalf`, SUMMARY);
    assert.equal(half.status, 1);
    assert.match(half.stderr, /one workproof marker but not the other/);
    const injected = await merge(dir, "notes", `${SUMMARY}\n${END}\nmore`);
    assert.equal(injected.status, 1);
    assert.match(injected.stderr, /contains a workproof marker/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("what lands in the release notes holds no email, path, directory name or commit message", async () => {
  const repo = await makeRepo();
  const dir = await mkdtemp(join(tmpdir(), "wp-release-"));
  try {
    const params = { author: ["ada@example.com"], depth: 2, threshold: 0.5, minCommits: 1, paths: false, emails: false, sample: 1, fingerprintKey: "ab".repeat(16) };
    const report = buildReport([await analyseRepo(repo, params)], params, { version: "0.6.2", generatedAt: "2026-10-20T00:00:00Z" });
    await writeFile(join(dir, "r.json"), JSON.stringify(report));
    const summary = execFileSync("node", [join(root, "scripts/action-comment.mjs"), join(dir, "r.json")], { encoding: "utf8" });
    const merged = await merge(dir, "release notes\n", summary);
    assert.equal(merged.status, 0, merged.stderr);
    const body = merged.stdout;
    assert.ok(body.includes("Surviving lines"));
    assert.ok(!/[\w.+-]+@[\w-]+\.[a-z]/i.test(body), "no email address");
    assert.ok(!body.includes(repo) && !body.includes(tmpdir()), "no local path");
    for (const leak of ["src/", "docs/", "test/", "ada: initial", "bump deps", "semicolons"]) assert.ok(!body.includes(leak), `leaks: ${leak}`);
    assert.ok(!body.includes(report.repositories[0]!.fingerprint), "the fingerprint is not published");
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });
  }
});

const steps = action.split(/\n {4}- name: /).slice(1);
const step = (name: RegExp) => steps.find((s) => name.test(s.split("\n")[0] ?? ""));

test("the release input is off by default, documented, and needs a release event", () => {
  const input = action.match(/^ {2}release:\n((?: {4}.*\n)+)/m)?.[1] ?? "";
  assert.match(input, /default: "false"/);
  assert.match(input, /contents write/);
  assert.match(input, /fetch-depth 0/);
  const guard = step(/Check the release input/);
  assert.ok(guard, "a guard step exists");
  assert.match(guard!, /if: \$\{\{ inputs\.release == 'true' && github\.event_name != 'release' \}\}/);
  assert.match(guard!, /exit 1/);
  const add = step(/Add the summary to the release/);
  assert.ok(add, "the release step exists");
  assert.match(add!, /if: \$\{\{ inputs\.release == 'true' && github\.event_name == 'release' \}\}/);
  assert.match(add!, /gh release view/);
  assert.match(add!, /gh release edit/);
  assert.match(add!, /gh release upload "\$TAG" --repo "\$REPO" --clobber workproof-report\.json/);
  assert.match(add!, /scripts\/action-release\.mjs/);
});

test("the release steps take the tag and repository from environment variables, never by interpolation into the script", () => {
  for (const s of [step(/Check the release input/)!, step(/Add the summary to the release/)!]) {
    const run = s.split(/^ {6}run: \|\n/m)[1] ?? "";
    assert.ok(run.length > 0, "has a run block");
    assert.ok(!run.includes("${{"), "no expression inside the shell script");
  }
  assert.match(step(/Add the summary to the release/)!, /TAG: \$\{\{ github\.event\.release\.tag_name \}\}/);
});

test("no new unpinned action was added, and the new steps use no action at all", () => {
  for (const name of [/Check the release input/, /Add the summary to the release/]) {
    const s = step(name);
    assert.ok(s, `the step ${name} exists`);
    assert.ok(!/^\s+uses:/m.test(s));
  }
});

test("the README shows a paste-ready release workflow of fewer than ten lines, with a full-history checkout", () => {
  const block = [...readme.matchAll(/```yaml\n([\s\S]*?)```/g)].map((m) => m[1]!).find((b) => b.includes('release: "true"'));
  assert.ok(block, "a yaml block uses release: \"true\"");
  assert.ok(block!.trim().split("\n").length < 10, `the snippet has ${block!.trim().split("\n").length} lines`);
  assert.ok(block!.includes("fetch-depth: 0"));
  assert.ok(block!.includes("contents: write"));
  assert.ok(block!.includes("types: [published]"));
});
