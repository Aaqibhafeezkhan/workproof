// Builds the sticky pull-request comment the Action posts, from a workproof report JSON.
// Usage: node scripts/action-comment.mjs workproof-report.json > comment.md
//
// This was a `node -e` string inside action.yml that nothing executed, so a renamed figure field
// would have broken every user's comment step with no failing test, or printed "undefined" into
// the comment. It is a file now so the test suite and CI run it, and every field it reads goes
// through need(), which stops with the figure and field name instead of printing "undefined".
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/action-comment.mjs <report.json>");
  process.exit(2);
}
const r = JSON.parse(readFileSync(path, "utf8"));
const repo = r.repositories?.[0];
if (!repo) throw new Error(`${path} has no repositories`);
const figures = Object.fromEntries((repo.figures ?? []).map((x) => [x.id, x.value]));

const need = (id, key) => {
  const figure = figures[id];
  if (figure === undefined) throw new Error(`the report has no ${id} figure; the comment script and the report disagree`);
  const value = figure[key];
  if (value === undefined || value === null) throw new Error(`the report's ${id} figure has no ${key}; the comment script and the report disagree`);
  return value;
};
const num = (id, key) => {
  const value = need(id, key);
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`the report's ${id}.${key} is ${JSON.stringify(value)}, not a number`);
  return value;
};
const pct = (x) => (x * 100).toFixed(1) + "%";
const n = (x) => x.toLocaleString("en-US");

const lines = [
  "<!-- workproof-summary -->",
  "### workproof · " + repo.identity.names.join(", "),
  "",
  "| figure | value |",
  "|---|---|",
  "| Surviving lines | " + n(num("survivingLines", "lines")) + " of " + n(num("survivingLines", "linesAttributed")) + ", " + pct(num("survivingLines", "share")) + " |",
  "| Files authored | " + num("filesAuthored", "authored") + " of " + num("filesAuthored", "total") + " alive at HEAD, " + pct(num("filesAuthored", "share")) + " |",
  "| Tenure window | " + need("tenure", "first") + " to " + need("tenure", "last") + " (" + num("tenure", "days") + " days) |",
  "| Share of commits | " + num("commitShare", "author") + " of " + num("commitShare", "total") + ", " + pct(num("commitShare", "share")) + " |",
  "| Cadence | " + num("cadence", "activeWeeks") + " active weeks of " + num("cadence", "weeksInTenure") + ", " + num("cadence", "commitsPerActiveWeek") + " commits per active week |",
  "| Footprint | " + num("footprint", "filesTouched") + " files touched, " + need("footprint", "ownedDirectories").length + " directories at or above the threshold |",
  "| Test-file changes and documents | " + pct(num("testsAndDocs", "testShare")) + " of test-file changes, " + num("testsAndDocs", "docsCreated") + " documents created |",
  "| AI-assisted commits | " + num("aiAssisted", "commits") + ", " + pct(num("aiAssisted", "share")) + " of the author's commits |",
  "",
  "excluded " + repo.excluded.botCommits + " bot commits and " + repo.excluded.files + " generated, vendored or lock files · HEAD `" + repo.head.slice(0, 12) + "` · report hash `" + r.hash.slice(0, 16) + "` · `npx workproof check workproof-report.json` recomputes the hash offline, `verify` recomputes the figures. Every figure has a limit; see the report.",
];
process.stdout.write(lines.join("\n"));
