import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = join(import.meta.dirname, "..");
const read = (f) => readFileSync(join(root, f), "utf8");
const flat = (s) => s.replace(/\s+/g, " ");

test("the README usage block lists every command that --help lists", () => {
  const help = spawnSync(process.execPath, [join(root, "dist/src/cli.js"), "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  const firstBlock = help.stdout.split(/\n\s*\n/)[0].split("\n");
  const usage = firstBlock.map((l) => l.replace(/^usage: /, "").trim()).filter((l) => l.startsWith("workproof"));
  assert.ok(usage.length >= 5, usage.join("\n"));
  const readme = read("README.md");
  const options = readme.slice(readme.indexOf("## Options"));
  const open = options.indexOf("```\n");
  const block = options.slice(open + 4, options.indexOf("```", open + 4));
  for (const line of usage) assert.ok(block.includes(line), `README Options block lacks: ${line}`);
});

test("the README says what the Action signs, in line with action.yml", () => {
  const readme = flat(read("README.md"));
  assert.ok(!readme.includes("signs the same statement keylessly with"), "the old sentence is back");
  assert.ok(readme.includes("cosign attest-blob"), "the README names the command the Action runs");
  assert.ok(flat(read("action.yml")).includes("cosign attest-blob workproof-report.json"), "action.yml still signs the report file");
});

test("the threat model lists no known mismatch with the README", () => {
  const doc = read("docs/THREAT-MODEL.md");
  const at = doc.indexOf("## Known mismatches with the README");
  assert.ok(at >= 0);
  const body = doc.slice(at, doc.indexOf("\n## ", at + 5));
  assert.ok(flat(body).includes("The README and the code agree on everything this page checks."), body);
});

test("the roadmap no longer lists the release summary Action as a next step", () => {
  const next = read("ROADMAP.md").split("Done:")[0];
  assert.ok(!/attaches a workproof summary to a release/.test(next), "release summary is built (issue #12)");
});
