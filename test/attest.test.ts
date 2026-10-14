import { test } from "node:test";
import assert from "node:assert/strict";
import { rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { makeRepo } from "./fixture.js";
import { analyseRepo, buildReport, checkReport } from "../src/index.js";
import { statementFor, writeStatement, signLocal, PREDICATE_TYPE } from "../src/attest.js";

const params = { author: ["ada@example.com"], depth: 2, threshold: 0.5, minCommits: 1, paths: true, emails: false, sample: 1, fingerprintKey: "ab".repeat(16) };

const keysNamed = (value: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) value.forEach((v) => keysNamed(v, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) { out.add(k); keysNamed(v, out); }
  return out;
};

test("the statement's subject is the report hash and the predicate carries no paths or figures", async () => {
  const dir = await makeRepo();
  try {
    // A user-supplied ignore-revs path is a path on the signer's machine; it must not reach the predicate.
    const revs = join(dir, ".git-blame-ignore-revs");
    const withPath = { ...params, ignoreRevsFile: revs };
    const report = buildReport([await analyseRepo(dir, withPath)], withPath, { version: "0.2.0", generatedAt: "2026-09-05T00:00:00Z" });
    const s = statementFor(report);
    assert.equal(s._type, "https://in-toto.io/Statement/v1");
    assert.equal(s.predicateType, PREDICATE_TYPE);
    assert.deepEqual(s.subject, [{ name: "workproof-report", digest: { sha256: report.hash } }]);
    const keys = keysNamed(s.predicate);
    assert.ok(!JSON.stringify(s).includes("@"), "no email addresses in the statement");
    for (const k of ["path", "ownedDirectories", "figures", "ignoreRevsFile", "fingerprintKey", "remote"]) assert.ok(!keys.has(k), k);
    assert.equal(s.predicate.repositories[0]!.fingerprintKeyed, true);
    assert.deepEqual(s.predicate.repositories[0]!.identity, { names: ["Ada"] });
    assert.ok(!JSON.stringify(s).includes("src/"), "no directory names in the statement");
    const edited = JSON.parse(JSON.stringify(report));
    edited.repositories[0].head = "0".repeat(40);
    assert.throws(() => statementFor(edited), /refusing to attest/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("attest writes the statement and an ssh-keygen signature that check-novalidate accepts", async () => {
  const dir = await makeRepo();
  try {
    const report = buildReport([await analyseRepo(dir, params)], params, { version: "0.2.0", generatedAt: "2026-09-05T00:00:00Z" });
    await writeFile(join(dir, "r.json"), JSON.stringify(report));
    const { statement, predicate } = await writeStatement(join(dir, "r.json"));
    assert.equal(statement, join(dir, "r.intoto.json"));
    assert.equal(JSON.parse(await readFile(predicate, "utf8")).tool.name, "workproof");
    execFileSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", "test", "-f", join(dir, "key")]);
    await assert.rejects(signLocal(statement, join(dir, "missing-key")), /ssh-keygen -Y sign failed/);
    await signLocal(statement, join(dir, "key"));
    // Signing twice must not wait on ssh-keygen's overwrite prompt.
    const { signature, envelope } = await signLocal(statement, join(dir, "key"));
    assert.equal(signature, `${statement}.sig`);
    assert.equal(envelope, join(dir, "r.dsse.json"));
    const env = JSON.parse(await readFile(envelope, "utf8"));
    assert.equal(env.payloadType, "application/vnd.in-toto+json");
    assert.equal(Buffer.from(env.payload, "base64").toString(), await readFile(statement, "utf8"));
    assert.equal(Buffer.from(env.signatures[0].sig, "base64").toString(), await readFile(signature, "utf8"));
    execFileSync("ssh-keygen", ["-Y", "check-novalidate", "-n", "workproof", "-s", signature], { input: await readFile(statement) });
    // The same key, listed as an allowed signer, verifies it end to end.
    await writeFile(join(dir, "allowed"), `test ${await readFile(join(dir, "key.pub"), "utf8")}`);
    execFileSync("ssh-keygen", ["-Y", "verify", "-f", join(dir, "allowed"), "-I", "test", "-n", "workproof", "-s", signature], { input: await readFile(statement) });
    // A touched statement no longer verifies.
    assert.throws(() => execFileSync("ssh-keygen", ["-Y", "check-novalidate", "-n", "workproof", "-s", signature], { input: Buffer.from("{}"), stdio: "pipe" }));
    const cli = join(process.cwd(), "dist/src/cli.js");
    const out = execFileSync("node", [cli, "attest", join(dir, "r.json"), "--local", join(dir, "key")], { encoding: "utf8" });
    assert.match(out, /wrote .*r\.intoto\.json, .*r\.predicate\.json, .*r\.intoto\.json\.sig and .*r\.dsse\.json/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the predicate type and the schema $id are URIs under the project's own GitHub repository", async () => {
  // workproof.dev was never registered; anyone could have bought it and served a different
  // predicate definition or schema at those URIs. Both identifiers now live under
  // github.com/Bubblegunn/workproof, which only the project can write to.
  const owned = /^https:\/\/(github\.com|raw\.githubusercontent\.com)\/Bubblegunn\/workproof\//;
  assert.match(PREDICATE_TYPE, owned);
  const schema = JSON.parse(await readFile(join(process.cwd(), "schema/report.schema.json"), "utf8"));
  assert.match(schema.$id, owned);
  // The predicate type must resolve to a file in this repository that describes the predicate.
  const doc = PREDICATE_TYPE.replace(/^https:\/\/github\.com\/Bubblegunn\/workproof\/blob\/main\//, "");
  assert.notEqual(doc, PREDICATE_TYPE, "predicate type is a blob URL on main");
  assert.match(await readFile(join(process.cwd(), doc), "utf8"), /predicateType/);
  // No shipped identifier may point back at the unregistered domain.
  for (const f of ["src/attest.ts", "schema/report.schema.json", "action.yml"]) {
    const text = await readFile(join(process.cwd(), f), "utf8");
    assert.ok(!text.includes("workproof.dev"), `${f} still names workproof.dev`);
  }
});

test("a statement written before 0.6.0, with the old predicate type, still binds to a report that checks", async () => {
  const dir = await makeRepo();
  try {
    const report = buildReport([await analyseRepo(dir, params)], params, { version: "0.5.1", generatedAt: "2026-10-14T00:00:00Z" });
    // Only the predicate type moved; the subject is the report hash, and the hash covers neither URI.
    const old = { ...statementFor(report), predicateType: "https://workproof.dev/attestation/v1" };
    assert.equal(checkReport(report).ok, true);
    assert.equal(old.subject[0]!.digest.sha256, report.hash);
    assert.equal(old.subject[0]!.digest.sha256, checkReport(report).hash.computed);
    assert.deepEqual(old.predicate, statementFor(report).predicate);
    await writeFile(join(dir, "r.json"), JSON.stringify(report));
    const cli = join(process.cwd(), "dist/src/cli.js");
    assert.match(execFileSync("node", [cli, "check", join(dir, "r.json")], { encoding: "utf8" }), new RegExp(`hash ok ${report.hash}`));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
