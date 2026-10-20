import { test } from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { makeRepo } from "../dist/test/fixture.js";
import { analyseRepo } from "../dist/src/analyse.js";
import { groundTruth } from "../bench/comparison/fixtures.mjs";
import { parseGitFame, parseGitinspector, parseOurs, EMAIL, BOT } from "../bench/comparison/adapters.mjs";
import { verdict, timingVerdict, buildResults, CLAIMABLE } from "../bench/comparison/rows.mjs";

const pass = (shown = "x") => ({ pass: true, shown });
const fail = (shown = "x") => ({ pass: false, shown });
const none = { pass: null, shown: "n/a: x" };

test("the verdict rule compares workproof with a tool's tuned result", () => {
  assert.equal(verdict(pass(), pass()), "tie");
  assert.equal(verdict(pass(), fail()), "ours ahead");
  assert.equal(verdict(fail(), pass()), "ours behind");
  assert.equal(verdict(fail(), fail()), "neither");
  assert.equal(verdict(pass(), none), "not comparable");
  assert.deepEqual(CLAIMABLE, ["ours ahead", "tie"]);
});

test("timing is a tie within 20 and 25 percent, and a win or a loss outside it", () => {
  assert.equal(timingVerdict(100, 200), "ours ahead");
  assert.equal(timingVerdict(100, 110), "tie");
  assert.equal(timingVerdict(130, 100), "ours behind");
});

test("git-fame JSON is parsed into authors with surviving lines", () => {
  const out = JSON.stringify({ total: { files: 2, loc: 31, commits: 3 }, columns: ["Author", "loc", "coms", "fils", "%loc"], data: [["Ada", 16, 3, 1, 51.6], ["dependabot[bot]", 0, 1, 0, 0]] });
  const p = parseGitFame(out);
  assert.equal(p.totalLoc, 31);
  assert.deepEqual(p.authors.map((a) => [a.name, a.loc, a.commits]), [["Ada", 16, 3], ["dependabot[bot]", 0, 1]]);
});

test("gitinspector JSON is parsed, ignoring any text printed before the object", () => {
  const body = { gitinspector: { blame: { authors: [{ name: "Ada", lines: 7 }, { name: "Bob", lines: 16 }] }, changes: { authors: [{ name: "Ada", commits: 3 }, { name: "Bob", commits: 3 }] } } };
  const p = parseGitinspector(`warning text\n${JSON.stringify(body)}`);
  assert.equal(p.totalLoc, 23);
  assert.deepEqual(p.authors.map((a) => [a.name, a.loc, a.commits]), [["Ada", 7, 3], ["Bob", 16, 3]]);
});

test("workproof JSON is parsed into the subject's lines and the bots it removed", () => {
  const report = { repositories: [{ identity: { names: ["Ada"] }, excluded: { botCommits: 1 }, figures: [{ id: "survivingLines", value: { lines: 16, linesAttributed: 31 } }, { id: "commitShare", value: { author: 3 } }] }] };
  const p = parseOurs(`progress\n${JSON.stringify(report)}`);
  assert.deepEqual(p.authors, [{ name: "Ada", loc: 16, commits: 3 }]);
  assert.equal(p.totalLoc, 31);
  assert.equal(p.excludedBots, 1);
});

test("the email and bot detectors", () => {
  assert.ok(EMAIL.test("a ada@example.com b"));
  assert.ok(!EMAIL.test("ada at example dot com"));
  assert.ok(BOT.test("dependabot[bot]"));
  assert.ok(BOT.test("x[bot]"));
  assert.ok(!BOT.test("Bob (aider)"));
});

test("ground truth from git blame agrees with workproof on the fixture", async () => {
  const dir = await makeRepo();
  try {
    const truth = groundTruth(dir, "ada@example.com");
    const ours = await analyseRepo(dir, { author: ["ada@example.com"], depth: 2, threshold: 0.5, minCommits: 1, paths: false, emails: false, sample: 1 });
    const sl = ours.figures.find((f) => f.id === "survivingLines").value;
    // Two independent implementations (git blame run directly here, and workproof) must agree,
    // otherwise the harness itself is wrong and no comparison made with it can be trusted.
    assert.equal(truth.lines, sl.lines);
    assert.equal(truth.total, sl.linesAttributed);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const run = (stdout, ok = true) => ({ ok, stdout, stderr: "", ms: 1, why: ok ? "" : "exit 1" });
const baseCtx = () => ({
  truth: { author: "Ada", lines: 16, total: 31 },
  tools: ["git-fame", "gitinspector", "git-who", "onefetch", "git-quick-stats"],
  runs: {},
  parsed: {},
  help: {},
  bin: { workproof: ["workproof"], "git-fame": ["git-fame"], gitinspector: ["gitinspector.py"], "git-who": ["git-who"], onefetch: ["onefetch"], "git-quick-stats": ["git-quick-stats"] },
  timing: { workproof: 100, "git-fame": 400, gitinspector: 100, "git-who": 50, onefetch: 100, "git-quick-stats": null },
});

test("rows: a tool that is wrong by default and right once tuned ties; workproof's losses are kept", () => {
  const c = baseCtx();
  const good = { authors: [{ name: "Ada", loc: 16, commits: 3 }], totalLoc: 31 };
  const bad = { authors: [{ name: "Ada", loc: 10, commits: 3 }], totalLoc: 59 };
  c.parsed.workproof = { default: { ...good, excludedBots: 1 }, tuned: { ...good, excludedBots: 1 } };
  c.parsed["git-fame"] = { default: bad, tuned: good };
  c.parsed.gitinspector = { default: bad, tuned: bad };
  c.runs.workproof = { default: run("{}"), tuned: run("{}") };
  c.runs["git-fame"] = { default: run('{"data":["dependabot[bot]"]}'), tuned: run('{"data":["dependabot[bot]"]}') };
  c.runs.gitinspector = { default: run("{}"), tuned: run("{}") };
  c.runs["git-who"] = { default: run("name\nBob\n"), tuned: run("name\nBob\n") };
  c.runs.onefetch = { default: run("{}"), tuned: run("{}") };
  c.runs["git-quick-stats"] = { default: { ok: false, stdout: "", stderr: "", ms: 1, why: "GNU date is not installed on this machine" }, tuned: { ok: false, stdout: "", stderr: "", ms: 1, why: "GNU date is not installed on this machine" } };
  c.help.workproof = "usage: workproof [options]\n  --format <mode>  output markdown, json, or both\nverify attest";
  c.help["git-fame"] = "usage: git-fame --format {json,csv,html}";
  c.help.gitinspector = "-F, --format=FORMAT html xml json";
  c.help["git-who"] = "-csv Output as csv";
  c.help.onefetch = "-o, --output <FORMAT> yaml json";
  c.help["git-quick-stats"] = "";
  const rows = buildResults(c);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(byId.survivingLines.tools["git-fame"].default.pass, false);
  assert.equal(byId.survivingLines.tools["git-fame"].tuned.pass, true);
  assert.equal(byId.survivingLines.tools["git-fame"].verdict, "tie");
  assert.equal(byId.survivingLines.tools.gitinspector.verdict, "ours ahead");
  assert.equal(byId.hasVerify.ours.tuned.pass, true);
  assert.equal(byId.hasVerify.tools["git-fame"].verdict, "ours ahead");
  // workproof has no CSV, HTML or XML output: a stated loss against three tools.
  assert.equal(byId.spreadsheetOrWebFormats.ours.tuned.pass, false);
  assert.equal(byId.spreadsheetOrWebFormats.tools["git-fame"].verdict, "ours behind");
  assert.equal(byId.spreadsheetOrWebFormats.tools.gitinspector.verdict, "ours behind");
  assert.equal(byId.spreadsheetOrWebFormats.tools["git-who"].verdict, "ours behind");
  // the bot appears as an author row in git-fame's output
  assert.equal(byId.botsNotAnAuthor.tools["git-fame"].verdict, "ours ahead");
  // a tool that could not run is not compared, and says why
  assert.equal(byId.botsNotAnAuthor.tools["git-quick-stats"].verdict, "not comparable");
  assert.match(byId.botsNotAnAuthor.tools["git-quick-stats"].tuned.shown, /GNU date/);
  assert.equal(byId.timeOnRealRepo.tools["git-fame"].verdict, "ours ahead");
  assert.equal(byId.timeOnRealRepo.tools["git-who"].verdict, "ours behind");
  assert.equal(byId.contributionGraph.tools["contributions-importer"].verdict, "ours behind");
});

test("a tool's verdict uses the better of its default and tuned results", () => {
  const c = baseCtx();
  const good = { authors: [{ name: "Ada", loc: 16, commits: 3 }], totalLoc: 31 };
  const bad = { authors: [{ name: "Ada", loc: 10, commits: 3 }], totalLoc: 59 };
  c.parsed.workproof = { default: { ...good, excludedBots: 1 }, tuned: { ...good, excludedBots: 1 } };
  // git-fame is right by default and wrong once "tuned": the tuned run must not make it look worse.
  c.parsed["git-fame"] = { default: good, tuned: bad };
  c.parsed.gitinspector = { default: bad, tuned: bad };
  c.runs.workproof = { default: run("{}"), tuned: run("{}") };
  c.runs["git-fame"] = { default: run("{}"), tuned: run("{}") };
  c.runs.gitinspector = { default: run("{}"), tuned: run("{}") };
  c.runs["git-who"] = { default: run("name\nBob\n"), tuned: run("name\nBob\n") };
  c.runs.onefetch = { default: run("{}"), tuned: run("{}") };
  c.runs["git-quick-stats"] = { default: run("", false), tuned: run("", false) };
  c.help.workproof = "verify attest csv html xml";
  const byId = Object.fromEntries(buildResults(c).map((r) => [r.id, r]));
  assert.equal(byId.survivingLines.tools["git-fame"].verdict, "tie");
});

test("a default run whose total matches only because generated lines are counted is not a pass", () => {
  const c = baseCtx();
  const expected = c.truth.total;
  const ours = { authors: [{ name: "Ada", loc: 16, commits: 3 }], totalLoc: expected };
  // gitinspector-like: its default total equals the expected total, but excluding the generated file moves it.
  const counted = { authors: [{ name: "Ada", loc: 7, commits: 3 }], totalLoc: expected };
  const excluded = { authors: [{ name: "Ada", loc: 7, commits: 3 }], totalLoc: expected - 8 };
  c.parsed.workproof = { default: { ...ours, excludedBots: 1 }, tuned: { ...ours, excludedBots: 1 } };
  c.parsed.gitinspector = { default: counted, tuned: excluded };
  c.totalMoved = { gitinspector: true };
  c.runs.workproof = { default: run("{}"), tuned: run("{}") };
  c.runs.gitinspector = { default: run("{}"), tuned: run("{}") };
  c.runs["git-fame"] = { default: run("{}", false), tuned: run("{}", false) };
  c.runs["git-who"] = { default: run("{}", false), tuned: run("{}", false) };
  c.runs.onefetch = { default: run("{}", false), tuned: run("{}", false) };
  c.runs["git-quick-stats"] = { default: run("{}", false), tuned: run("{}", false) };
  c.help.workproof = "verify";
  c.help.gitinspector = "html xml json";
  const byId = Object.fromEntries(buildResults(c).map((r) => [r.id, r]));
  assert.equal(byId.generatedExcluded.tools.gitinspector.default.pass, false);
  assert.match(byId.generatedExcluded.tools.gitinspector.default.shown, /coincidence/);
  assert.equal(byId.generatedExcluded.tools.gitinspector.verdict, "ours ahead");
});
