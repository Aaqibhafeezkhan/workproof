#!/usr/bin/env node
// Runs workproof and every fetched tool on the same fixtures and writes bench/comparison/results.json.
// Usage (after `npm run build` and `node bench/comparison/fetch.mjs`): node bench/comparison/run.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, UPSTREAM, pins } from "./fetch.mjs";
import { fixtureA, fixtureB, groundTruth, FIXTURE_B } from "./fixtures.mjs";
import { PARSERS, commandFor, helpCommandFor, run } from "./adapters.mjs";
import { buildResults } from "./rows.mjs";

const TOOLS = ["git-fame", "gitinspector", "git-who", "onefetch", "git-quick-stats"];
const ALL = ["workproof", ...TOOLS];

if (!existsSync(UPSTREAM)) throw new Error("run `node bench/comparison/fetch.mjs` first");
if (!existsSync(join(ROOT, "dist/src/cli.js"))) throw new Error("run `npm run build` first");

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const p = pins();

const A = await fixtureA();
const truth = { author: A.name, ...groundTruth(A.dir, A.author) };
const ctx = { truth: { author: truth.author, lines: truth.lines, total: truth.total }, tools: TOOLS, runs: {}, parsed: {}, help: {}, bin: {}, timing: {}, totalMoved: {} };

try {
  for (const t of ALL) {
    ctx.runs[t] = {};
    ctx.parsed[t] = {};
    const modes = t === "workproof" ? ["default"] : ["default", "tuned"];
    for (const m of modes) {
      const r = run(commandFor(t, { tuned: m === "tuned", repo: A.dir, author: A.author }), A.dir);
      ctx.runs[t][m] = r;
      ctx.parsed[t][m] = null;
      if (r.ok && PARSERS[t]) {
        try {
          ctx.parsed[t][m] = PARSERS[t](r.stdout);
        } catch (e) {
          r.ok = false;
          r.why = `output could not be read: ${e.message}`;
        }
      }
    }
    if (t === "workproof") {
      ctx.runs[t].tuned = ctx.runs[t].default;
      ctx.parsed[t].tuned = ctx.parsed[t].default;
    }
    // If the tool's own exclusion flags change its total, its default total counted lines it should not have.
    const dp = ctx.parsed[t].default;
    const tp = ctx.parsed[t].tuned;
    ctx.totalMoved[t] = Boolean(dp && tp && dp.totalLoc !== tp.totalLoc);
    const h = run(helpCommandFor(t), A.dir);
    ctx.help[t] = h.ok ? `${h.stdout}\n${h.stderr}` : "";
  }
  ctx.bin.workproof = Object.keys(pkg.bin);
  ctx.bin["git-fame"] = ["git-fame"];
  ctx.bin.gitinspector = ["gitinspector.py"];
  ctx.bin["git-who"] = ["git-who"];
  ctx.bin.onefetch = ["onefetch"];
  ctx.bin["git-quick-stats"] = ["git-quick-stats"];

  const B = fixtureB();
  for (const t of ALL) {
    const spec = commandFor(t, { repo: B, author: FIXTURE_B.author });
    const times = [];
    for (let i = 0; i < 3; i++) {
      const r = run(spec, B);
      if (!r.ok) {
        times.length = 0;
        break;
      }
      times.push(r.ms);
    }
    ctx.timing[t] = times.length ? median(times) : null;
  }
} finally {
  rmSync(A.dir, { recursive: true, force: true });
}

const results = {
  schema: 1,
  runDate: new Date().toISOString().slice(0, 10),
  machine: { os: process.platform, arch: process.arch, node: process.version, git: execFileSync("git", ["--version"], { encoding: "utf8" }).trim().replace(/^git version /, "") },
  tools: Object.fromEntries(Object.entries(p.tools).map(([n, t]) => [n, { version: t.version, licence: t.licence, policy: t.policy }])),
  fixtures: {
    A: { description: "the deterministic test fixture: two people, a bot, a generated file, a reformat commit in .git-blame-ignore-revs" },
    B: { url: FIXTURE_B.url, sha: FIXTURE_B.sha },
  },
  truth: ctx.truth,
  rows: buildResults(ctx),
};
writeFileSync(join(ROOT, "bench/comparison/results.json"), JSON.stringify(results, null, 2) + "\n");
console.log(`wrote bench/comparison/results.json (${results.rows.length} rows, run ${results.runDate})`);
for (const row of results.rows) for (const [t, r] of Object.entries(row.tools)) console.log(`${row.id} vs ${t}: ${r.verdict}`);
