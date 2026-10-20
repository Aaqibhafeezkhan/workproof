import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = join(import.meta.dirname, "..");
const read = (f) => readFileSync(join(root, f), "utf8");
const sample = () => JSON.parse(read("docs/sample/openwiki-report.json"));

// First fenced block after a heading, as lines without blanks.
function blockAfter(text, heading) {
  const start = text.indexOf(heading);
  assert.ok(start >= 0, `README has no "${heading}" heading`);
  const open = text.indexOf("```\n", start);
  const close = text.indexOf("\n```", open + 4);
  assert.ok(open >= 0 && close > open, `no fenced block after "${heading}"`);
  return text.slice(open + 4, close).split("\n").filter((l) => l.trim() !== "");
}

// The fenced block after a heading that contains a line starting with `prefix`.
function blockAfterContaining(text, heading, prefix) {
  const start = text.indexOf(heading);
  assert.ok(start >= 0, `README has no "${heading}" heading`);
  let at = start;
  for (;;) {
    const open = text.indexOf("```\n", at);
    assert.ok(open >= 0, `no fenced block containing "${prefix}" after "${heading}"`);
    const close = text.indexOf("\n```", open + 4);
    assert.ok(close > open, `unclosed fenced block after "${heading}"`);
    const lines = text.slice(open + 4, close).split("\n").filter((l) => l.trim() !== "");
    if (lines.some((l) => l.startsWith(prefix))) return lines;
    at = close + 4;
  }
}

const normaliseTime = (l) => l.replace(/ in \d+(\.\d+)?s$/, " in Ns");

test("the sample report passes workproof check", () => {
  const r = spawnSync(process.execPath, [join(root, "dist/src/cli.js"), "check", join(root, "docs/sample/openwiki-report.json")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /hash ok/);
});

test("every hash the README prints is the sample's hash", () => {
  const hash = sample().hash;
  const found = read("README.md").match(/hash ok [0-9a-f]{64}/g) ?? [];
  assert.ok(found.length >= 2, "the README transcript prints the hash for check and for verify");
  for (const f of found) assert.equal(f, `hash ok ${hash}`);
});

test("the transcript in docs/sample says the same hash as the sample", () => {
  const hash = sample().hash;
  const found = read("docs/sample/transcript.txt").match(/hash ok [0-9a-f]{64}/g) ?? [];
  assert.equal(found.length, 2);
  for (const f of found) assert.equal(f, `hash ok ${hash}`);
});

test("every line of the example report in the README is a line of the sample report", () => {
  const block = blockAfter(read("README.md"), "## What a report looks like");
  const report = new Set(read("docs/sample/openwiki-report.md").replaceAll("`", "").split("\n").map((l) => l.trim()));
  const missing = block.filter((l) => !report.has(l.trim()));
  assert.deepEqual(missing, []);
});

test("every line of the README transcript is a line of docs/sample/transcript.txt, timings aside", () => {
  const readme = read("README.md");
  const heading = readme.includes("## What the run prints") ? "## What the run prints" : "## 30 seconds";
  const block = blockAfterContaining(readme, heading, "$ npx workproof --author");
  const lines = new Set(read("docs/sample/transcript.txt").split("\n").map((l) => normaliseTime(l.trim())));
  const missing = block.filter((l) => !lines.has(normaliseTime(l.trim())));
  assert.deepEqual(missing, []);
});
