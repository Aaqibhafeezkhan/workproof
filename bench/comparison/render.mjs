#!/usr/bin/env node
// Renders docs/COMPARISON.md from bench/comparison/results.json. The page is generated, never typed:
// test/comparison-doc.test.mjs fails if the two ever differ.
// Usage: node bench/comparison/render.mjs
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./fetch.mjs";
import { CLAIMABLE } from "./rows.mjs";

const cell = (c) => (c.pass === null ? c.shown : `${c.pass ? "pass" : "fail"}: ${c.shown}`);
const esc = (s) => String(s).replace(/\|/g, "\\|");

// Reading notes for rows whose raw cell text could be misread. They describe what a row measures,
// and they stay on the page next to the table they explain.
const ROW_NOTES = {
  generatedExcluded:
    "gitinspector's total never matches the expected total in these runs. The row records that mismatch. It does not show that gitinspector cannot exclude generated files.",
};

const MEASUREMENT_NOTES = [
  "git-quick-stats is not comparable on this machine: it needs GNU date, which the macOS run did not have. Every git-quick-stats cell is n/a. That is a missing dependency on the run machine, not a finding about git-quick-stats.",
  "The Linux sha256 checksums in pins.json for git-who and onefetch are unverified. No Linux run has checked them.",
  "Timing comes from one machine and one history (fixture B), each run three times and the median kept. Treat the milliseconds as a single observation.",
];

export function renderComparison(r) {
  const L = [];
  L.push("# How workproof compares", "");
  L.push(
    `Generated on ${r.runDate} on ${r.machine.os}/${r.machine.arch} with Node ${r.machine.node} and git ${r.machine.git}, by \`node bench/comparison/run.mjs\` and \`node bench/comparison/render.mjs\`. Do not edit this page by hand: \`test/comparison-doc.test.mjs\` renders it again from \`bench/comparison/results.json\` and fails on any difference.`,
    "",
  );
  L.push(
    "Every tool is run twice on the same repository: once with its defaults, and once tuned by hand with the best flags it offers for the row. The verdict compares workproof with the tuned result, so a tool that does the job once tuned is a tie even when workproof needs no flags. Third-party code is run, never copied.",
    "",
  );
  L.push("## Tools run", "", "| tool | version | licence | policy |", "|---|---|---|---|");
  for (const [name, t] of Object.entries(r.tools)) L.push(`| ${name} | ${t.version} | ${t.licence} | ${t.policy} |`);
  L.push("");
  L.push("## Repositories", "");
  L.push(`- Fixture A: ${r.fixtures.A.description}. Reference answer from \`git blame\` itself for ${r.truth.author}: ${r.truth.lines} surviving lines of ${r.truth.total}.`);
  L.push(`- Fixture B: ${r.fixtures.B.url} at ${r.fixtures.B.sha}, used for timing only.`, "");
  L.push("## Results", "");
  for (const row of r.rows) {
    L.push(`### ${row.title}`, "");
    if (row.kind === "timing") {
      L.push("| tool | milliseconds | vs workproof |", "|---|---|---|", `| workproof | ${row.ours.ms} | |`);
      for (const [t, x] of Object.entries(row.tools)) if (t !== "workproof") L.push(`| ${t} | ${x.ms === null ? "did not run" : x.ms} | ${x.verdict} |`);
    } else {
      L.push("| tool | default | tuned by hand | vs workproof |", "|---|---|---|---|", `| workproof | ${esc(cell(row.ours.default))} | ${esc(cell(row.ours.tuned))} | |`);
      for (const [t, x] of Object.entries(row.tools)) L.push(`| ${t} | ${esc(cell(x.default))} | ${esc(cell(x.tuned))} | ${x.verdict} |`);
    }
    L.push("");
    if (ROW_NOTES[row.id]) L.push(ROW_NOTES[row.id], "");
  }
  L.push("## Measurement notes", "", ...MEASUREMENT_NOTES.map((n) => `- ${n}`), "");
  const lines = (pick) => {
    const out = [];
    for (const row of r.rows) for (const [t, x] of Object.entries(row.tools)) if (pick(x.verdict)) out.push(`- ${row.title} (against ${t}): ${x.verdict}`);
    return out.length ? out : ["- none"];
  };
  L.push("## What can be claimed", "", "Launch text may claim only these rows, which workproof wins or ties.", "", ...lines((v) => CLAIMABLE.includes(v)), "");
  L.push("## Stated losses", "", "Rows where workproof is behind. They stay on this page.", "", ...lines((v) => v === "ours behind"), "");
  L.push("## Not compared", "", "Rows where a tool could not run on this machine, or does not report the figure.", "", ...lines((v) => v === "not comparable" || v === "neither"), "");
  return L.join("\n");
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(import.meta.filename)) {
  const results = JSON.parse(readFileSync(join(ROOT, "bench/comparison/results.json"), "utf8"));
  writeFileSync(join(ROOT, "docs/COMPARISON.md"), renderComparison(results));
  console.log("wrote docs/COMPARISON.md");
}
