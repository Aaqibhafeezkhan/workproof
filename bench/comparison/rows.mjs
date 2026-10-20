// The rows of the comparison and the rule that turns two results into a verdict.
// A verdict compares workproof with a tool's TUNED result. Where workproof loses, the row stays.
import { BOT, EMAIL } from "./adapters.mjs";

export const CLAIMABLE = ["ours ahead", "tie"];

const na = (why) => ({ pass: null, shown: `n/a: ${why}` });

export function verdict(ours, theirs) {
  if (ours.pass === null || theirs.pass === null) return "not comparable";
  if (ours.pass && theirs.pass) return "tie";
  if (ours.pass && !theirs.pass) return "ours ahead";
  if (!ours.pass && theirs.pass) return "ours behind";
  return "neither";
}

/** Faster by more than 20 percent is a win, slower by more than 25 percent is a loss. */
export function timingVerdict(oursMs, theirMs) {
  if (oursMs < 0.8 * theirMs) return "ours ahead";
  if (oursMs > 1.25 * theirMs) return "ours behind";
  return "tie";
}

const runOf = (c, t, m) => c.runs[t]?.[m];
const cantRun = (c, t, m) => na(runOf(c, t, m)?.why || "no output");

const lineRow = (pick, describe) => (t, m, c) => {
  const p = c.parsed[t]?.[m];
  if (!runOf(c, t, m)?.ok || !p) return cantRun(c, t, m);
  return { pass: pick(p, c.truth), shown: describe(p, c.truth) };
};

// A default run that matches the expected total is not evidence when the tool's own generated or lock
// file exclusion moves that total: the default run was counting lines it should not have counted.
const generatedCell = (t, m, c) => {
  const base = lineRow((p, tr) => p.totalLoc === tr.total, (p, tr) => `${p.totalLoc} lines in total (expected ${tr.total})`)(t, m, c);
  if (m === "default" && base.pass === true && c.totalMoved?.[t]) {
    return { pass: false, shown: `${base.shown}; a coincidence: the generated or lock-file lines are counted in this run` };
  }
  return base;
};

export const ROWS = [
  {
    id: "survivingLines",
    title: "One author's surviving lines equal what git blame says (honouring .git-blame-ignore-revs)",
    applies: ["workproof", "git-fame", "gitinspector"],
    cell: lineRow(
      (p, tr) => (p.authors.find((a) => a.name === tr.author)?.loc ?? 0) === tr.lines,
      (p, tr) => `${p.authors.find((a) => a.name === tr.author)?.loc ?? 0} lines (git blame: ${tr.lines})`,
    ),
  },
  {
    id: "generatedExcluded",
    title: "Lock files and files marked linguist-generated add no lines to anyone",
    applies: ["workproof", "git-fame", "gitinspector"],
    cell: generatedCell,
  },
  {
    id: "botsNotAnAuthor",
    title: "A bot is not listed as an author",
    applies: ["workproof", "git-fame", "gitinspector", "git-who", "git-quick-stats"],
    cell: (t, m, c) => {
      const r = runOf(c, t, m);
      if (!r?.ok) return cantRun(c, t, m);
      const listed = BOT.test(r.stdout);
      if (t === "workproof") {
        const removed = c.parsed.workproof?.[m]?.excludedBots ?? 0;
        return { pass: !listed && removed >= 1, shown: `${removed} bot commits removed before counting` };
      }
      return { pass: !listed, shown: listed ? "a bot appears in the output" : "no bot in the output" };
    },
  },
  {
    id: "privateByDefault",
    title: "The default output contains no email address",
    applies: ["workproof", "git-fame", "gitinspector", "git-who", "onefetch", "git-quick-stats"],
    cell: (t, m, c) => {
      const r = runOf(c, t, m);
      if (!r?.ok) return cantRun(c, t, m);
      const has = EMAIL.test(r.stdout);
      return { pass: !has, shown: has ? "an email address is printed" : "no email address printed" };
    },
  },
  {
    id: "hasVerify",
    title: "The tool can check a report it wrote earlier (a verify or attest command)",
    applies: ["workproof", "git-fame", "gitinspector", "git-who", "onefetch", "git-quick-stats"],
    cell: (t, m, c) => {
      const h = c.help[t];
      if (!h) return na("no help text could be read");
      const has = /\b(verify|attest)\b/i.test(h);
      return { pass: has, shown: has ? "help mentions verify or attest" : "no verify or attest in the help" };
    },
  },
  {
    id: "gitSubcommand",
    title: "Runs as a git subcommand (git <name>)",
    applies: ["workproof", "git-fame", "git-who", "git-quick-stats"],
    cell: (t, m, c) => {
      const names = c.bin[t] ?? [];
      const has = names.some((n) => n.startsWith("git-"));
      return { pass: has, shown: `executables: ${names.join(", ") || "none"}` };
    },
  },
  {
    id: "spreadsheetOrWebFormats",
    title: "Writes CSV, HTML or XML besides JSON",
    applies: ["workproof", "git-fame", "gitinspector", "git-who", "onefetch"],
    cell: (t, m, c) => {
      const h = c.help[t];
      if (!h) return na("no help text could be read");
      const found = ["csv", "html", "xml"].filter((f) => new RegExp(`\\b${f}\\b`, "i").test(h));
      return { pass: found.length > 0, shown: found.length ? found.join(", ") : "none of csv, html, xml" };
    },
  },
];

const STATIC_ROW = {
  id: "contributionGraph",
  title: "Puts private work on the GitHub contribution graph",
  tool: "contributions-importer",
  ours: { pass: false, shown: "no, by design: workproof writes a document a reader can check, not commits (README: a badge is a claim, not evidence)" },
  theirs: { pass: true, shown: "yes: copies commit metadata into a target repository (not run here: it needs a GitHub token and writes commits)" },
};

export function buildResults(ctx) {
  const rows = [];
  for (const row of ROWS) {
    const ours = { default: row.cell("workproof", "default", ctx), tuned: row.cell("workproof", "tuned", ctx) };
    const tools = {};
    for (const t of row.applies.filter((x) => x !== "workproof")) {
      const d = row.cell(t, "default", ctx);
      const u = row.cell(t, "tuned", ctx);
      // The tool is judged on its better result. A tuned run must never make a tool look worse.
      const best = d.pass === true && u.pass !== true ? d : u;
      tools[t] = { default: d, tuned: u, verdict: verdict(ours.tuned, best) };
    }
    rows.push({ id: row.id, title: row.title, kind: "check", ours, tools });
  }
  const oursMs = ctx.timing.workproof;
  const timed = {};
  for (const t of ctx.tools) {
    const ms = ctx.timing[t];
    if (ms === null || ms === undefined) timed[t] = { ms: null, verdict: "not comparable" };
    else timed[t] = { ms, verdict: timingVerdict(oursMs, ms) };
  }
  rows.push({ id: "timeOnRealRepo", title: "Wall-clock time on a real history (median of three runs, fixture B)", kind: "timing", ours: { ms: oursMs }, tools: timed });
  rows.push({
    id: STATIC_ROW.id,
    title: STATIC_ROW.title,
    kind: "static",
    ours: { default: STATIC_ROW.ours, tuned: STATIC_ROW.ours },
    tools: { [STATIC_ROW.tool]: { default: STATIC_ROW.theirs, tuned: STATIC_ROW.theirs, verdict: verdict(STATIC_ROW.ours, STATIC_ROW.theirs) } },
  });
  return rows;
}
