import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { makeRepo } from "./fixture.js";

// The composite action is YAML the test suite cannot execute; these checks pin the contract
// the README promises: every step is SHA-pinned, the Markdown report reaches the job summary,
// and the report files are uploaded as one artifact.
const action = readFileSync(new URL("../../action.yml", import.meta.url), "utf8").replace(/\r\n/g, "\n"); // Windows checkouts may carry CRLF

test("every action the composite uses is pinned to a full commit SHA", () => {
  const uses = [...action.matchAll(/^\s+uses:\s+(\S+)/gm)].map((m) => m[1] ?? "");
  assert.ok(uses.length >= 2, `expected at least two uses:, found ${uses.length}`);
  for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${u} is not pinned to a 40-hex SHA`);
});

test("the Markdown report is appended to the job summary", () => {
  assert.match(action, /cat workproof-report\.md >> "\$GITHUB_STEP_SUMMARY"/);
});

test("the report files are uploaded as the workproof-report artifact", () => {
  const upload = action.match(/uses: actions\/upload-artifact@[0-9a-f]{40}[\s\S]*?if-no-files-found: error/);
  assert.ok(upload, "upload-artifact step with if-no-files-found: error");
  const uploadText = upload[0];
  assert.match(uploadText, /name: workproof-report\n/);
  for (const f of ["workproof-report.md", "workproof-report.json", "workproof-report.intoto.json", "workproof-report.predicate.json"]) {
    assert.ok(uploadText.includes(f), `${f} is uploaded`);
  }
});

test("every key a step writes to $GITHUB_OUTPUT is a declared output mapped to that step's id", () => {
  // In a composite action a step's outputs reach the caller only through the top-level outputs
  // block, by step id. Before 0.6.0 report= and bundle= were written and unreachable.
  const outputsBlock = action.match(/^outputs:\n((?: {2}.*\n|\n)*)/m)?.[1] ?? "";
  const declared = new Map([...outputsBlock.matchAll(/^ {2}([\w-]+):\n(?: {4}.*\n)*? {4}value: \$\{\{ steps\.([\w-]+)\.outputs\.([\w-]+) \}\}/gm)].map((m) => [m[1]!, { step: m[2]!, key: m[3]! }]));
  const steps = action.split(/\n {4}- name: /).slice(1);
  const written: { key: string; id: string | undefined }[] = [];
  for (const step of steps) {
    const id = step.match(/^ {6}id: ([\w-]+)$/m)?.[1];
    for (const m of step.matchAll(/echo "([\w-]+)=[^"]*" >> "\$GITHUB_OUTPUT"/g)) written.push({ key: m[1]!, id });
  }
  assert.ok(written.length >= 2, `expected report and bundle to be written, found ${written.map((w) => w.key).join(", ")}`);
  for (const w of written) {
    assert.ok(w.id, `the step writing ${w.key} has no id, so its output cannot be read`);
    assert.deepEqual(declared.get(w.key), { step: w.id, key: w.key }, `outputs.${w.key} must be declared with value \${{ steps.${w.id}.outputs.${w.key} }}`);
  }
});

test("the comment is built by scripts/action-comment.mjs, the file the tests run", () => {
  assert.match(action, /node "\$GITHUB_ACTION_PATH\/scripts\/action-comment\.mjs" workproof-report\.json/);
  assert.ok(!/node -e/.test(action), "no inline node -e script left in the action");
});

test("users get the registry version by default; a local package is opt-in", () => {
  const input = action.match(/^ {2}package:\n((?: {4}.*\n)+)/m)?.[1] ?? "";
  assert.match(input, /default: ""/);
  assert.match(action, /npx --yes "workproof@\$\{WP_VERSION\}"/);
});

const cli = join(process.cwd(), "dist/src/cli.js");
const commentScript = join(process.cwd(), "scripts/action-comment.mjs");

test("the comment script renders every row from a real report, and stops on a renamed field", async () => {
  const dir = await makeRepo();
  try {
    execFileSync("node", [cli, "--repo", dir, "--author", "ada@example.com", "--out", join(dir, "r")], { encoding: "utf8", stdio: "pipe" });
    const body = execFileSync("node", [commentScript, join(dir, "r.json")], { encoding: "utf8" });
    assert.ok(body.startsWith("<!-- workproof-summary -->\n### workproof · Ada\n"));
    for (const row of ["Surviving lines", "Files authored", "Tenure window", "Share of commits", "Cadence", "Footprint", "Test-file changes and documents", "AI-assisted commits"]) assert.match(body, new RegExp(`^\\| ${row} \\| `, "m"));
    assert.ok(!/undefined|NaN/.test(body), body);
    // A figure field renamed in src/ must fail the comment, not print "undefined" into it.
    const report = JSON.parse(await readFile(join(dir, "r.json"), "utf8"));
    const cadence = report.repositories[0].figures.find((f: { id: string }) => f.id === "cadence");
    cadence.value.activeWeekCount = cadence.value.activeWeeks;
    delete cadence.value.activeWeeks;
    await writeFile(join(dir, "broken.json"), JSON.stringify(report));
    const r = spawnSync("node", [commentScript, join(dir, "broken.json")], { encoding: "utf8" });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /cadence figure has no activeWeeks/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// GitHub Marketplace refuses an action.yml whose description is 125 characters or longer, and a name
// that equals an existing action, user or organization: "workproof" is a GitHub user, so the listing
// was refused on 2026-10-14 until the name and the description changed.
test("action.yml's name and description fit what GitHub Marketplace accepts", () => {
  const yml = readFileSync(join(process.cwd(), "action.yml"), "utf8");
  const unquote = (v: string) => (/^'.*'$/.test(v) ? v.slice(1, -1).replaceAll("''", "'") : v.replace(/^"|"$/g, ""));
  const name = unquote(/^name: (.+)$/m.exec(yml)?.[1] ?? "");
  const description = unquote(/^description: (.+)$/m.exec(yml)?.[1] ?? "");
  assert.ok(name.length > 0 && description.length > 0, "action.yml needs a top-level name and description on one line each");
  assert.ok(description.length < 125, `description is ${description.length} characters; Marketplace needs fewer than 125`);
  assert.notEqual(name, "workproof", "a GitHub user is called workproof, so Marketplace refuses that name");
});
