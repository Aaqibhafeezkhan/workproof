import { test } from "node:test";
import assert from "node:assert/strict";
import { rm, writeFile, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { makeRepo } from "./fixture.js";
import { analyseRepo, buildReport, verifyReport, narrate, renderMarkdown, badgeFor } from "../src/index.js";

const params = { author: ["ada@example.com"], depth: 2, threshold: 0.5, minCommits: 1, paths: false, emails: false, sample: 1 };

test("verify reproduces on the same HEAD and reports mismatches after a new commit", async () => {
  const dir = await makeRepo();
  try {
    const report = buildReport([await analyseRepo(dir, params)], params, { version: "0.1.0", generatedAt: "2026-09-05T00:00:00Z" });
    const same = await verifyReport(report, [dir]);
    assert.equal(same.ok, true);
    assert.equal(same.rows.every((r) => r.match), true);
    await writeFile(join(dir, "src/new.ts"), "x\n");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["-c", "user.name=Bob", "-c", "user.email=bob@example.com", "commit", "-q", "-m", "bob: more"], {
      cwd: dir,
      env: { ...process.env, GIT_AUTHOR_DATE: "2026-03-01T10:00:00Z", GIT_COMMITTER_DATE: "2026-03-01T10:00:00Z" },
    });
    const moved = await verifyReport(report, [dir]);
    assert.equal(moved.ok, false);
    assert.equal(moved.headMoved.length, 1);
    assert.ok(moved.rows.some((r) => r.figure === "survivingLines" && !r.match));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("narrate posts figures only and returns the model text", async () => {
  const seen: string[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      seen.push(body);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { content: "Ada wrote most of it." } }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const dir = await makeRepo();
  try {
    const report = buildReport([await analyseRepo(dir, { ...params, paths: true })], { ...params, paths: true }, { version: "0.1.0", generatedAt: "2026-09-05T00:00:00Z" });
    const text = await narrate(report, { url: `http://127.0.0.1:${port}/v1/chat/completions`, key: "k", model: "m" });
    assert.equal(text, "Ada wrote most of it.");
    assert.ok(seen[0]!.includes("survivingLines"));
    assert.ok(!seen[0]!.includes("src/a.ts"));
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("the CLI writes both files and verify exits 0", async () => {
  const dir = await makeRepo();
  try {
    const cli = join(process.cwd(), "dist/src/cli.js");
    const out = execFileSync("node", [cli, "--repo", dir, "--author", "ada@example.com", "--out", join(dir, "r")], { encoding: "utf8" });
    assert.match(out, /wrote .*r\.md and .*r\.json in \d+\.\ds/);
    const json = JSON.parse(await readFile(join(dir, "r.json"), "utf8"));
    assert.equal(json.tool, "workproof");
    const v = execFileSync("node", [cli, "verify", join(dir, "r.json"), "--repo", dir], { encoding: "utf8" });
    assert.match(v, /all figures reproduce/);
    const help = execFileSync("node", [cli, "--help"], { encoding: "utf8" });
    assert.match(help, /usage: workproof/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the CLI can write markdown only", async () => {
  const dir = await makeRepo();
  try {
    const cli = join(process.cwd(), "dist/src/cli.js");
    execFileSync("node", [cli, "--repo", dir, "--author", "ada@example.com", "--format", "markdown", "--out", join(dir, "markdown")], { encoding: "utf8" });
    await readFile(join(dir, "markdown.md"), "utf8");
    await assert.rejects(() => readFile(join(dir, "markdown.json"), "utf8"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the CLI rejects an unknown output format", async () => {
  const dir = await makeRepo();
  try {
    const cli = join(process.cwd(), "dist/src/cli.js");
    assert.throws(() => execFileSync("node", [cli, "--format", "yaml"], { encoding: "utf8", stdio: "pipe" }), /--format must be markdown, json, or both/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--max-commits reads only the newest commits and is recorded in the parameters", async () => {
  const dir = await makeRepo();
  try {
    const seen: string[] = [];
    const repo = await analyseRepo(dir, { ...params, maxCommits: 9 }, { progress: (m) => seen.push(m) });
    const t = repo.figures.find((f) => f.id === "tenure")!;
    assert.equal(t.value.first, "2026-01-12");
    const share = repo.figures.find((f) => f.id === "commitShare")!;
    assert.deepEqual(share.value, { author: 2, total: 2, share: 1 });
    assert.ok(seen.some((m) => /newest 9 commits/.test(m)));
    assert.ok(seen.some((m) => /9 commits read/.test(m)));
    assert.ok(seen.some((m) => /blamed \d+ of \d+ files/.test(m)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("two repositories make one report with two sections, and verify checks both", async () => {
  const a = await makeRepo();
  const b = await makeRepo();
  try {
    const report = buildReport([await analyseRepo(a, params), await analyseRepo(b, params)], params, { version: "0.1.2", generatedAt: "2026-09-05T00:00:00Z" });
    assert.equal(report.repositories.length, 2);
    const md = renderMarkdown(report);
    assert.equal((md.match(/^## workproof-/gm) ?? []).length, 2);
    const v = await verifyReport(report, [a, b]);
    assert.equal(v.ok, true);
    assert.equal(v.rows.length, 26);
  } finally {
    await rm(a, { recursive: true, force: true });
    await rm(b, { recursive: true, force: true });
  }
});

test("--badge writes a shields.io endpoint document built from the first repository", async () => {
  const dir = await makeRepo();
  try {
    const cli = join(process.cwd(), "dist/src/cli.js");
    const out = execFileSync("node", [cli, "--repo", dir, "--author", "ada@example.com", "--out", join(dir, "b"), "--badge"], { encoding: "utf8" });
    assert.match(out, /wrote .*b\.md and .*b\.json and .*b\.badge\.json/);
    const badge = JSON.parse(await readFile(join(dir, "b.badge.json"), "utf8"));
    assert.deepEqual(badge, { schemaVersion: 1, label: "workproof", message: "51.6% surviving lines · 15 days", color: "1f3fbf" });
    const report = buildReport([await analyseRepo(dir, params)], params, { version: "0.1.3", generatedAt: "2026-09-05T00:00:00Z" });
    assert.equal(badgeFor(report).message, "51.6% surviving lines · 15 days");
    assert.throws(() => badgeFor({ ...report, repositories: [] }), /no repositories/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a shallow clone is refused by analyse, verify and the CLI, naming the fix", async () => {
  const full = await makeRepo();
  const shallow = `${full}-shallow`;
  try {
    // A shallow clone's boundary commit owns every line it did not see change, so the
    // figures come out inflated and the tenure starts late. It must stop, not report.
    execFileSync("git", ["clone", "-q", "--depth", "9", `file://${full}`, shallow]);
    assert.equal(execFileSync("git", ["rev-parse", "--is-shallow-repository"], { cwd: shallow, encoding: "utf8" }).trim(), "true");
    await assert.rejects(analyseRepo(shallow, params), /shallow clone[\s\S]*git fetch --unshallow[\s\S]*fetch-depth: 0/);
    const report = buildReport([await analyseRepo(full, params)], params, { version: "0.6.0", generatedAt: "2026-10-14T00:00:00Z" });
    await assert.rejects(verifyReport(report, [shallow]), /shallow clone[\s\S]*git fetch --unshallow/);
    const cli = join(process.cwd(), "dist/src/cli.js");
    let failed: { status?: number; stderr?: string } | undefined;
    try {
      execFileSync("node", [cli, "--repo", shallow, "--author", "ada@example.com", "--out", join(shallow, "r")], { encoding: "utf8", stdio: "pipe" });
    } catch (err) {
      failed = err as { status?: number; stderr?: string };
    }
    assert.ok(failed, "the CLI exited 0 on a shallow clone");
    assert.equal(failed.status, 1);
    assert.match(failed.stderr ?? "", /git fetch --unshallow/);
    assert.match(failed.stderr ?? "", /fetch-depth: 0/);
  } finally {
    await rm(full, { recursive: true, force: true });
    await rm(shallow, { recursive: true, force: true });
  }
});
