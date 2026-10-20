import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (f) => readFileSync(join(root, f), "utf8");
const flat = (s) => s.replace(/\s+/g, " ");

test("llms.txt uses absolute links only", () => {
  const links = [...read("llms.txt").matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(links.length >= 8, `only ${links.length} links`);
  for (const l of links) assert.match(l, /^https:\/\//, `relative link in llms.txt: ${l}`);
});

test("llms.txt keeps the name collision and the limits an agent must not misstate", () => {
  const t = flat(read("llms.txt"));
  assert.ok(t.includes("TalentProof"), "name collision is not stated");
  assert.ok(t.includes("does not prove"), "the limit of check is not stated");
  assert.ok(t.includes("countersign"));
});

test("the FAQ is question and answer, answers every question, and states the limits", () => {
  const t = read("docs/FAQ.md");
  const parts = t.split(/^## /m).slice(1);
  assert.ok(parts.length >= 10, `only ${parts.length} questions`);
  for (const p of parts) {
    const [q, ...rest] = p.split("\n");
    assert.ok(q.trim().endsWith("?"), `heading is not a question: ${q}`);
    assert.ok(rest.join("\n").trim().length > 60, `no answer under: ${q}`);
  }
  const f = flat(t);
  assert.ok(f.includes("does not prove"), "FAQ does not state what check does not prove");
  assert.ok(f.includes("](COMPARISON.md)") && f.includes("](THREAT-MODEL.md)"));
  assert.ok(f.includes("TalentProof"));
});

test("GEO-PROMPTS has five fixed prompts and a record table", () => {
  const t = read("docs/GEO-PROMPTS.md");
  const prompts = [...t.matchAll(/^\d\. Prompt: (.+)$/gm)].map((m) => m[1]);
  assert.equal(prompts.length, 5);
  assert.equal(new Set(prompts).size, 5);
  assert.ok(t.includes("| date | model | prompt number | workproof named | what the answer said |"));
});

test("LISTINGS carries the npm keywords exactly and the Marketplace description limit", () => {
  const t = read("docs/LISTINGS.md");
  const pkg = JSON.parse(read("package.json"));
  assert.ok(t.includes("Keywords: " + pkg.keywords.join(", ")), "npm keywords differ from package.json");
  const action = read("action.yml");
  const name = /^name: (.+)$/m.exec(action)[1].trim();
  assert.ok(t.includes(`Name: ${name}`), "Marketplace name differs from action.yml");
  const m = /Marketplace description \((\d+) characters\): (.+)/.exec(t);
  assert.ok(m, "no Marketplace description line");
  assert.equal(m[2].trim().length, Number(m[1]), "stated length is wrong");
  assert.ok(m[2].trim().length < 125, "Marketplace accepts fewer than 125 characters");
});
