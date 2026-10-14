// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const script = () => JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts.test;

// This has now gone wrong twice across these repositories: a test file was added and never
// named in the script, so it never ran and CI stayed green without it. A TypeScript test
// compiles to dist/test/<name>.test.js and must be named there; an .mjs test runs from
// test/ directly. Either way, a file that exists and is not run is a defect.
test("every TypeScript test is named in the npm test script", () => {
  const s = script();
  const onDisk = readdirSync(join(root, "test")).filter((f) => f.endsWith(".test.ts"));
  const missing = onDisk.filter((f) => !s.includes(`dist/test/${f.replace(/\.ts$/, ".js")}`));
  assert.deepEqual(missing, [], `not run by npm test: ${missing.join(", ")}`);
});

test("every .mjs test is named in the npm test script", () => {
  const s = script();
  const onDisk = readdirSync(join(root, "test")).filter((f) => f.endsWith(".test.mjs"));
  const missing = onDisk.filter((f) => !s.includes(`test/${f}`));
  assert.deepEqual(missing, [], `not run by npm test: ${missing.join(", ")}`);
});

// engines.node is what users are told they can run; the CI matrix is what is actually tested.
// When Node 20 was dropped both had to move together, so the lowest tested major must be the floor.
test("the lowest Node in the CI test matrix is the engines.node floor", () => {
  const floor = Number(/^>=(\d+)$/.exec(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).engines.node)?.[1]);
  const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  const matrix = /^\s+node: \[([\d, ]+)\]/m.exec(ci)?.[1];
  assert.ok(floor && matrix, "engines.node is >=N and ci.yml has a node: [...] matrix");
  assert.equal(Math.min(...matrix.split(",").map(Number)), floor);
});
