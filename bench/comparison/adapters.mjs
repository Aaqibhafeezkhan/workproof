// How each tool is started, and how its output is read. Third-party tools are only run; their
// output is read as data. Parsers know the JSON shapes measured on 2026-10-20 for the pinned versions.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ROOT, UPSTREAM, binaryPath } from "./fetch.mjs";

export const EMAIL = /[\w.+-]+@[\w-]+\.[A-Za-z][\w.-]*/;
export const BOT = /\[bot\]|dependabot/i;

const jsonFrom = (text) => JSON.parse(text.slice(text.indexOf("{")));

/** git-fame --format json: { total: { loc }, columns: [...], data: [[author, loc, coms, ...]] } */
export function parseGitFame(stdout) {
  const j = jsonFrom(stdout);
  const at = (name) => j.columns.indexOf(name);
  return {
    authors: j.data.map((r) => ({ name: r[at("Author")], loc: r[at("loc")], commits: r[at("coms")] })),
    totalLoc: j.total.loc,
  };
}

/** gitinspector -F json: gitinspector.blame.authors[{name, lines}], gitinspector.changes.authors[{name, commits}] */
export function parseGitinspector(stdout) {
  const g = jsonFrom(stdout).gitinspector;
  const lines = new Map(g.blame.authors.map((a) => [a.name, a.lines]));
  const commits = new Map(g.changes.authors.map((a) => [a.name, a.commits]));
  const names = [...new Set([...lines.keys(), ...commits.keys()])];
  const authors = names.map((name) => ({ name, loc: lines.get(name) ?? 0, commits: commits.get(name) ?? 0 }));
  return { authors, totalLoc: authors.reduce((s, a) => s + a.loc, 0) };
}

/** workproof --format json for one author. */
export function parseOurs(stdout) {
  const r = jsonFrom(stdout).repositories[0];
  const f = (id) => r.figures.find((x) => x.id === id).value;
  return {
    authors: [{ name: r.identity.names[0], loc: f("survivingLines").lines, commits: f("commitShare").author }],
    totalLoc: f("survivingLines").linesAttributed,
    excludedBots: r.excluded.botCommits,
  };
}

export const PARSERS = { workproof: parseOurs, "git-fame": parseGitFame, gitinspector: parseGitinspector };

/**
 * The command for a tool. `tuned` adds the best flags that tool offers for the rows measured, so a
 * tool is never judged on its defaults alone. fingerprint-key is fixed so workproof output is
 * repeatable.
 */
export function commandFor(name, { tuned = false, repo, author } = {}) {
  switch (name) {
    case "workproof":
      return { cmd: process.execPath, args: [join(ROOT, "dist/src/cli.js"), "--repo", repo, "--author", author, "--format", "json", "--fingerprint-key", "00".repeat(16)] };
    case "git-fame":
      return { cmd: binaryPath(name), args: ["-s", "--format", "json", ...(tuned ? ["-w", "-M", "--ignore-revs-file", ".git-blame-ignore-revs", "--excl", "(^|/)gen/|package-lock\\.json"] : [])] };
    case "gitinspector":
      // gitinspector has no ignore-revs file. -x revision:SHA is accepted, but on the fixture it lowers
      // the count (it drops the reformatted lines instead of giving them back to the previous author),
      // so it is not in the tuned command. -x file:<regex> excludes generated files and the lock file.
      return { cmd: "python3", args: [join(UPSTREAM, "gitinspector/gitinspector.py"), "-F", "json", ...(tuned ? ["-x", "file:package-lock.json", "-x", "file:gen/out.ts"] : [])] };
    case "git-who":
      // -nauthor is a regular expression: [bot] would be a character class, so the brackets are escaped.
      return { cmd: binaryPath(name), args: ["table", "-csv", ...(tuned ? ["-nauthor", "dependabot\\[bot\\]"] : [])] };
    case "onefetch":
      return { cmd: binaryPath(name), args: ["-o", "json"] };
    case "git-quick-stats":
      return { cmd: join(UPSTREAM, "git-quick-stats/git-quick-stats"), args: ["-a"] };
    default:
      throw new Error(`no command for ${name}`);
  }
}

/** The same executables with their help flag, read for the presence rows. */
export function helpCommandFor(name) {
  const c = commandFor(name, { repo: ".", author: "x" });
  if (name === "workproof") return { cmd: c.cmd, args: [c.args[0], "--help"] };
  if (name === "git-who") return { cmd: c.cmd, args: ["table", "--help"] };
  if (name === "gitinspector") return { cmd: c.cmd, args: [c.args[0], "--help"] };
  return { cmd: c.cmd, args: ["--help"] };
}

/** Runs a command in a repository. Never throws: a tool that cannot run is reported, not hidden. */
export function run(spec, cwd, { timeoutMs = 600000 } = {}) {
  const t0 = process.hrtime.bigint();
  const r = spawnSync(spec.cmd, spec.args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: timeoutMs, env: { ...process.env, NO_COLOR: "1" } });
  const ms = Number((process.hrtime.bigint() - t0) / 1000000n);
  const stdout = r.stdout ?? "";
  const stderr = r.stderr ?? "";
  if (r.error) return { ok: false, ms, stdout, stderr, why: String(r.error.message) };
  if (/GNU date is required/.test(stdout + stderr)) return { ok: false, ms, stdout, stderr, why: "GNU date is not installed on this machine" };
  return { ok: r.status === 0, ms, stdout, stderr, why: r.status === 0 ? "" : `exit ${r.status}` };
}
