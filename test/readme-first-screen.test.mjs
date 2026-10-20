import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (f) => readFileSync(join(root, f), "utf8");
const pins = () => JSON.parse(read("bench/comparison/pins.json"));
const PAIN = "> Most of my work is in private repositories, and I cannot show anyone what I did there without showing the code.";

// The text with fenced code blocks removed, so a "## x" line inside an example is not a heading.
const outsideFences = (t) => t.split(/^```.*$/m).filter((_, i) => i % 2 === 0).join("\n");
const headings = (t) => outsideFences(t).split("\n").filter((l) => l.startsWith("## ")).map((l) => l.slice(3).trim());

test("the first line of text is the pain sentence", () => {
  const first = read("README.md").split("\n").find((l) => l.trim() !== "" && !l.trim().startsWith("<"));
  assert.equal(first, PAIN);
});

test("the install command comes right after the first paragraph and before the recording", () => {
  const t = read("README.md");
  const pain = t.indexOf(PAIN);
  const cmd = t.indexOf("```\ncd your-private-repo\nnpx workproof\n```");
  const gif = t.indexOf("![Terminal recording");
  const differs = t.indexOf("## How this differs");
  assert.ok(pain >= 0 && cmd > pain && gif > cmd && differs > gif, `order wrong: ${[pain, cmd, gif, differs]}`);
  assert.ok(t.slice(pain, cmd).includes("Node 22 or newer and git"), "Node requirement is stated before the command");
});

test("the recording and its tape exist and the GIF is small", () => {
  assert.ok(statSync(join(root, "docs/demo.tape")).size > 0);
  const size = statSync(join(root, "docs/demo.gif")).size;
  assert.ok(size > 10_000 && size <= 400_000, `docs/demo.gif is ${size} bytes`);
  assert.ok(read("README.md").includes("](docs/demo.gif)"));
});

test("no star or download badge in either README", () => {
  for (const f of ["README.md", "README.tr.md"]) {
    const t = read(f);
    assert.ok(!/img\.shields\.io\/github\/stars/.test(t), `${f} has a stars badge`);
    assert.ok(!/img\.shields\.io\/npm\/(dm|dw|dt|dy)\//.test(t), `${f} has a downloads badge`);
  }
});

test("How this differs links the comparison, names pinned versions and uses no unsupported comparison words", () => {
  const t = read("README.md");
  const at = t.indexOf("## How this differs");
  assert.ok(at >= 0);
  const body = t.slice(at, t.indexOf("\n## ", at + 5));
  assert.ok(body.includes("](docs/COMPARISON.md)"));
  const p = pins().tools;
  for (const name of ["git-fame", "gitinspector", "onefetch"]) {
    assert.ok(body.includes(`${name} ${p[name].version}`), `${name} ${p[name].version} not in the section`);
    // Every mention of the tool with a version must carry the pinned one, not only the first.
    const named = [...body.matchAll(new RegExp(`${name} v?\\d[\\d.]*`, "g"))].map((m) => m[0]);
    for (const n of named) assert.equal(n, `${name} ${p[name].version}`, `stale version in the section: ${n}`);
  }
  for (const word of [/\bfaster\b/i, /\bfastest\b/i, /\bbetter\b/i, /\bbest\b/i, /\bsuperior\b/i, /\bunlike\b/i]) {
    assert.ok(!word.test(body), `the section uses ${word}`);
  }
});

test("headings appear in the planned order and none was lost", () => {
  assert.deepEqual(headings(read("README.md")), [
    "How this differs",
    "What the run prints",
    "What a report looks like",
    "In plain language",
    "What it measures",
    "How verification works",
    "Privacy",
    "Options",
    "Badge",
    "GitHub Action",
    "When someone reformatted the code",
    "When you are two people",
    "Names that are not ASCII",
    "Gaming and bias",
    "For candidates",
    "For hiring managers",
    "For visa and immigration evidence",
    "What it does not do",
    "What the research says about numbers like these",
    "Where it comes from",
    "Thanks",
    "Cite this",
    "Development",
  ]);
});
