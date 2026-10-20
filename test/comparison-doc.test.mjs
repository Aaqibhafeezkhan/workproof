import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, pins } from "../bench/comparison/fetch.mjs";
import { CLAIMABLE } from "../bench/comparison/rows.mjs";
import { renderComparison } from "../bench/comparison/render.mjs";

const results = () => JSON.parse(readFileSync(join(ROOT, "bench/comparison/results.json"), "utf8"));
const page = () => readFileSync(join(ROOT, "docs/COMPARISON.md"), "utf8");

test("docs/COMPARISON.md is exactly what results.json renders to", () => {
  assert.equal(page(), renderComparison(results()), "run: node bench/comparison/render.mjs");
});

test("results.json was produced with the tool versions and licences pins.json states now", () => {
  const r = results();
  const p = pins();
  assert.deepEqual(Object.keys(r.tools).sort(), Object.keys(p.tools).sort());
  for (const [name, t] of Object.entries(r.tools)) {
    assert.equal(t.version, p.tools[name].version, `${name}: version`);
    assert.equal(t.licence, p.tools[name].licence, `${name}: licence`);
    assert.equal(t.policy, p.tools[name].policy, `${name}: policy`);
  }
  assert.match(r.runDate, /^\d{4}-\d{2}-\d{2}$/);
});

test("the page states its run date and tool versions, and names every row workproof loses", () => {
  const r = results();
  const text = page();
  assert.ok(text.includes(r.runDate));
  for (const [name, t] of Object.entries(r.tools)) assert.ok(text.includes(`${name} | ${t.version}`), `${name} ${t.version} is in the tools table`);
  const losses = [];
  for (const row of r.rows) for (const [tool, res] of Object.entries(row.tools)) if (res.verdict === "ours behind") losses.push(`${row.title} (against ${tool})`);
  assert.ok(losses.length > 0, "the harness found no loss at all, which is more likely a broken harness than a perfect tool");
  const stated = text.split("## Stated losses")[1] ?? "";
  for (const l of losses) assert.ok(stated.includes(l), `loss not stated: ${l}`);
});

test("only rows workproof wins or ties are listed as claimable", () => {
  const r = results();
  const claimable = (page().split("## What can be claimed")[1] ?? "").split("## Stated losses")[0];
  for (const row of r.rows) {
    for (const [tool, res] of Object.entries(row.tools)) {
      const line = `${row.title} (against ${tool})`;
      assert.equal(claimable.includes(line), CLAIMABLE.includes(res.verdict), `${line}: ${res.verdict}`);
    }
  }
});

test("the page has no em dash", () => {
  assert.ok(!page().includes("—"));
});
