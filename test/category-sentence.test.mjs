import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (f) => readFileSync(join(root, f), "utf8");
const pkg = () => JSON.parse(read("package.json"));

export const SENTENCE =
  "workproof is a command-line tool that turns a private git repository into a report of one author's work, with a hash a reader can check and no source code in it.";

// Files that must repeat the sentence word for word. Tasks 5, 6 and 7 add files here.
const FILES = ["README.md", "docs/FAQ.md", "llms.txt"];

test("package.json description is the category sentence", () => {
  assert.equal(pkg().description, SENTENCE);
});

test("package.json keywords carry the phrases people search for, with no duplicates", () => {
  const k = pkg().keywords;
  for (const word of ["git-stats", "git-authorship", "private-repository", "private-contributions", "developer-portfolio", "contribution-report"]) {
    assert.ok(k.includes(word), `keyword missing: ${word}`);
  }
  assert.equal(new Set(k).size, k.length, "duplicate keyword");
});

for (const file of FILES) {
  test(`${file} repeats the category sentence word for word`, () => {
    assert.ok(read(file).replace(/\s+/g, " ").includes(SENTENCE), `${file} does not contain the sentence`);
  });
}
