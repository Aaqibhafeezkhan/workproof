import { test } from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { makeRepo } from "./fixture.js";
import { analyseRepo, buildReport, renderMarkdown, fingerprint, newFingerprintKey, publicEmail } from "../src/index.js";

const params = { author: ["ada@example.com"], depth: 2, threshold: 0.5, minCommits: 1, paths: false, emails: false, sample: 1 };

test("fingerprint normalises remotes and is stable; keyed fingerprints match only under the same key", () => {
  const a = fingerprint("abc", "git@github.com:Acme/App.git");
  const b = fingerprint("abc", "https://github.com/acme/app");
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.notEqual(a, fingerprint("abd", "https://github.com/acme/app"));
  const k1 = "00".repeat(16);
  const k2 = "ff".repeat(16);
  assert.equal(fingerprint("abc", "git@github.com:Acme/App.git", k1), fingerprint("abc", "https://github.com/acme/app", k1));
  assert.notEqual(fingerprint("abc", "https://github.com/acme/app", k1), fingerprint("abc", "https://github.com/acme/app", k2));
  assert.notEqual(fingerprint("abc", "https://github.com/acme/app", k1), a);
  assert.match(newFingerprintKey(), /^[0-9a-f]{32}$/);
  assert.notEqual(newFingerprintKey(), newFingerprintKey());
  assert.equal(publicEmail("49699333+someone@users.noreply.github.com"), "(github noreply)");
  assert.equal(publicEmail("ada@example.com"), "ada@example.com");
});

test("the key is printed once, never stored, and two reports of one repository match only under it", async () => {
  const dir = await makeRepo();
  try {
    const seen: string[] = [];
    const generated = await analyseRepo(dir, params, { progress: (m) => seen.push(m) });
    assert.ok(seen.some((m) => /^fingerprint key [0-9a-f]{32} \(keep it/.test(m)));
    const key = seen.find((m) => m.startsWith("fingerprint key"))!.split(" ")[2]!;
    const again = await analyseRepo(dir, { ...params, fingerprintKey: key });
    const other = await analyseRepo(dir, { ...params, fingerprintKey: "ab".repeat(16) });
    assert.equal(generated.fingerprint, again.fingerprint);
    assert.notEqual(generated.fingerprint, other.fingerprint);
    assert.equal(generated.fingerprintKeyed, true);
    const report = buildReport([again], { ...params, fingerprintKey: key }, { version: "0.2.0", generatedAt: "2026-09-05T00:00:00Z" });
    assert.ok(!JSON.stringify(report).includes(key), "the key must not be stored in the report");
    assert.ok(!("fingerprintKey" in report.params));
    // A GitHub noreply address never appears, even with --emails and exclusions off.
    const noreply = await analyseRepo(dir, { ...params, author: ["dependabot[bot]"], emails: true, exclusions: false });
    assert.deepEqual(noreply.identity.emails, ["(github noreply)"]);
    const rep = buildReport([noreply], { ...params, author: ["49699333+dependabot[bot]@users.noreply.github.com"], emails: true, exclusions: false }, { version: "0.2.0", generatedAt: "2026-09-05T00:00:00Z" });
    // Checked as an address (the "@" is part of it): no email at the noreply domain is in the report.
    assert.ok(!JSON.stringify(rep).includes("@users.noreply.github.com"), "a GitHub noreply address leaked into the report");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("analyseRepo produces every figure and buildReport hashes without emails by default", async () => {
  const dir = await makeRepo();
  try {
    const repo = await analyseRepo(dir, params);
    assert.deepEqual(repo.figures.map((f) => f.id), ["tenure", "commitShare", "cadence", "footprint", "testsAndDocs", "filesAuthored", "majorContributor", "commitSize", "coAuthored", "absenceFactor", "aiAssisted", "survivingLines", "survivalByCohort"]);
    for (const f of repo.figures) assert.ok(f.limits.length >= 1 && f.command.length > 10, f.id);
    assert.equal(repo.identity.count, 1);
    const report = buildReport([repo], params, { version: "0.1.0", generatedAt: "2026-09-05T00:00:00Z" });
    assert.equal(report.hash.length, 64);
    const text = JSON.stringify(report);
    assert.ok(!text.includes("ada@example.com"), "emails must not leak by default");
    assert.ok(!text.includes("src/a.ts"), "file paths must not leak");
    assert.ok(!text.includes('"src"'), "directory paths must not leak without --paths");
    const md = renderMarkdown(report, "Narrative here.");
    assert.match(md, /# Engineering report/);
    assert.match(md, /Surviving lines at HEAD/);
    assert.match(md, /Generated narrative \(not verified\)/);
    assert.match(md, /What this cannot show/);
    assert.ok(!md.includes("—"), "no em dashes in the report");
    const withPaths = await analyseRepo(dir, { ...params, paths: true, emails: true });
    const rep2 = buildReport([withPaths], { ...params, paths: true, emails: true }, { version: "0.1.0", generatedAt: "2026-09-05T00:00:00Z" });
    assert.ok(JSON.stringify(rep2).includes("ada@example.com"));
    assert.match(renderMarkdown(rep2), /- src: 2 of 2 commits, 100\.0%/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
