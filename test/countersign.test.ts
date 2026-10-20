import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { makeRepo, makeTzRepo } from "./fixture.js";
import { analyseRepo, buildReport, checkReport, hashOf } from "../src/index.js";
import type { Report } from "../src/index.js";
import { countersignStatement, signCountersignature, readCountersignature, sshKeyFingerprint, COUNTERSIGN_PREDICATE_TYPE } from "../src/countersign.js";

const KEY = "ab".repeat(16);
const params = { author: ["ada@example.com"], depth: 2, threshold: 0.5, minCommits: 1, paths: false, emails: false, sample: 1, fingerprintKey: KEY };
const meta = { version: "0.6.2", generatedAt: "2026-10-20T00:00:00Z" };
const opts = { toolVersion: "0.6.2", now: "2026-10-21T00:00:00Z" };

const reportOf = async (dir: string): Promise<Report> => buildReport([await analyseRepo(dir, params)], params, meta);

/** What a colleague has: a full clone of the same repository, with the same remote URL the author's has. */
async function cloneOf(dir: string): Promise<{ clone: string; base: string }> {
  const base = await mkdtemp(join(tmpdir(), "workproof-colleague-"));
  const clone = join(base, "repo");
  execFileSync("git", ["clone", "-q", "--no-local", dir, clone]);
  execFileSync("git", ["remote", "set-url", "origin", "git@example.com:acme/app.git"], { cwd: clone });
  return { clone, base };
}

const keygen = (path: string, comment: string) => execFileSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", comment, "-f", path]);

test("a matching clone is countersigned, and the statement binds hash, commit and fingerprint and nothing else", async () => {
  const dir = await makeRepo();
  const { clone, base } = await cloneOf(dir);
  try {
    const report = await reportOf(dir);
    const s = await countersignStatement(report, [clone], { ...opts, fingerprintKey: KEY, label: "Cem" });
    assert.equal(s.predicateType, COUNTERSIGN_PREDICATE_TYPE);
    assert.deepEqual(s.subject, [{ name: "workproof-report", digest: { sha256: report.hash } }]);
    assert.equal(s.predicate.report.hash, report.hash);
    assert.equal(s.predicate.countersignedAt, "2026-10-21T00:00:00Z");
    assert.equal(s.predicate.repositories[0]!.head, report.repositories[0]!.head);
    assert.equal(s.predicate.repositories[0]!.fingerprint, report.repositories[0]!.fingerprint);
    assert.equal(s.predicate.repositories[0]!.figuresRecomputed, report.repositories[0]!.figures.length);
    assert.equal(s.predicate.signer.label, "Cem");
    const text = JSON.stringify(s);
    assert.ok(!text.includes("@"), "no email address");
    assert.ok(!text.includes(clone) && !text.includes(base), "no local path");
    assert.ok(!text.includes("src/"), "no directory names");
    for (const k of ["figures", "value", "ownedDirectories", "fingerprintKey", "remote"]) assert.ok(!text.includes(`"${k}"`), k);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(base, { recursive: true, force: true });
  }
});

test("a report that does not check is refused", async () => {
  const dir = await makeRepo();
  const { clone, base } = await cloneOf(dir);
  try {
    const edited = JSON.parse(JSON.stringify(await reportOf(dir))) as Report;
    (edited.repositories[0]!.figures[0] as { value: unknown }).value = { forged: true };
    await assert.rejects(countersignStatement(edited, [clone], { ...opts, fingerprintKey: KEY }), /refusing to countersign a report that does not check/);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(base, { recursive: true, force: true });
  }
});

test("a consistent forgery is refused: the author edits a figure and recomputes the hash, so check passes, but the colleague's clone disagrees", async () => {
  const dir = await makeRepo();
  const { clone, base } = await cloneOf(dir);
  try {
    const forged = JSON.parse(JSON.stringify(await reportOf(dir))) as Report;
    const figure = forged.repositories[0]!.figures.find((f) => f.id === "survivingLines")!;
    (figure.value as { lines: number }).lines += 100;
    forged.hash = hashOf(forged.params, forged.repositories);
    assert.equal(checkReport(forged).ok, true, "the forgery passes check, which is why countersign exists");
    await assert.rejects(countersignStatement(forged, [clone], { ...opts, fingerprintKey: KEY }), /refusing to countersign[\s\S]*survivingLines/);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(base, { recursive: true, force: true });
  }
});

test("a keyed fingerprint without the key is refused, not skipped", async () => {
  const dir = await makeRepo();
  const { clone, base } = await cloneOf(dir);
  try {
    const report = await reportOf(dir);
    assert.equal(report.repositories[0]!.fingerprintKeyed, true);
    await assert.rejects(countersignStatement(report, [clone], opts), /--fingerprint-key/);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(base, { recursive: true, force: true });
  }
});

test("a different repository is refused at the fingerprint", async () => {
  const dir = await makeRepo();
  const other = await makeTzRepo();
  try {
    await assert.rejects(countersignStatement(await reportOf(dir), [other], { ...opts, fingerprintKey: KEY }), /different repository/);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  }
});

test("a clone that is not at the report's commit is refused and told which commit to check out", async () => {
  const dir = await makeRepo();
  const { clone, base } = await cloneOf(dir);
  try {
    const report = await reportOf(dir);
    execFileSync("git", ["-c", "user.name=Bob", "-c", "user.email=bob@example.com", "commit", "-q", "--allow-empty", "-m", "later"], { cwd: clone });
    await assert.rejects(countersignStatement(report, [clone], { ...opts, fingerprintKey: KEY }), /not at the commit the report was made at/);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(base, { recursive: true, force: true });
  }
});

test("a clone behind the report's commit is refused and names the commit the report was made at", async () => {
  const dir = await makeRepo();
  const { clone, base } = await cloneOf(dir);
  try {
    // The author moves on after the clone was taken, then reports: the clone is now behind.
    execFileSync("git", ["-c", "user.name=Ada", "-c", "user.email=ada@example.com", "commit", "-q", "--allow-empty", "-m", "newer"], { cwd: dir });
    const report = await reportOf(dir);
    await assert.rejects(countersignStatement(report, [clone], { ...opts, fingerprintKey: KEY }), (e: Error) => {
      assert.match(e.message, /not at the commit the report was made at/);
      assert.ok(e.message.includes(report.repositories[0]!.head.slice(0, 12)), "names the report's commit");
      return true;
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(base, { recursive: true, force: true });
  }
});

test("a shallow clone is refused with the unshallow advice", async () => {
  const dir = await makeRepo();
  const base = await mkdtemp(join(tmpdir(), "workproof-shallow-"));
  const shallow = join(base, "repo");
  try {
    execFileSync("git", ["clone", "-q", "--depth", "1", pathToFileURL(dir).href, shallow]);
    execFileSync("git", ["remote", "set-url", "origin", "git@example.com:acme/app.git"], { cwd: shallow });
    await assert.rejects(countersignStatement(await reportOf(dir), [shallow], { ...opts, fingerprintKey: KEY }), /shallow clone[\s\S]*git fetch --unshallow/);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(base, { recursive: true, force: true });
  }
});

test("a countersignature reads back as valid, and fails when it is moved, edited, signed for another purpose or not trusted", async () => {
  const dir = await makeRepo();
  const { clone, base } = await cloneOf(dir);
  try {
    const report = await reportOf(dir);
    const reportPath = join(base, "r.json");
    await writeFile(reportPath, JSON.stringify(report));
    keygen(join(base, "key"), "cem");
    const pub = await readFile(join(base, "key.pub"), "utf8");
    const statement = await countersignStatement(report, [clone], { ...opts, fingerprintKey: KEY, label: "Cem" });
    const out = await signCountersignature(statement, reportPath, join(base, "key"));
    assert.match(out.envelope, /r\.countersign-[A-Za-z0-9]{10}\.dsse\.json$/);
    const listed = execFileSync("ssh-keygen", ["-lf", join(base, "key.pub")], { encoding: "utf8" }).split(" ")[1];
    assert.equal(sshKeyFingerprint(pub), listed, "the fingerprint is computed the way ssh-keygen -l does");
    assert.equal(out.keyFingerprint, listed);

    const ok = await readCountersignature(out.envelope, report);
    assert.deepEqual(ok.problems, []);
    assert.equal(ok.ok, true);
    assert.equal(ok.keyFingerprint, listed);
    assert.equal(ok.keyType, "ED25519");
    assert.equal(ok.label, "Cem");
    assert.equal(ok.countersignedAt, "2026-10-21T00:00:00Z");
    assert.equal(ok.principal, undefined, "without an allowed_signers file nobody is named");

    // A reader who lists the key gets the name they gave it.
    await writeFile(join(base, "allowed"), `cem@example.com ${pub}`);
    const named = await readCountersignature(out.envelope, report, { allowedSigners: join(base, "allowed") });
    assert.equal(named.ok, true);
    assert.equal(named.principal, "cem@example.com");

    // A reader whose list does not contain the key does not get a pass.
    keygen(join(base, "eve"), "eve");
    await writeFile(join(base, "allowed-eve"), `eve@example.com ${await readFile(join(base, "eve.pub"), "utf8")}`);
    const unlisted = await readCountersignature(out.envelope, report, { allowedSigners: join(base, "allowed-eve") });
    assert.equal(unlisted.ok, false);
    assert.match(unlisted.problems.join("\n"), /not listed/);

    // The same envelope presented with a different report is not about that report.
    const bobParams = { ...params, author: ["bob@example.com"] };
    const other = buildReport([await analyseRepo(dir, bobParams)], bobParams, meta);
    const moved = await readCountersignature(out.envelope, other);
    assert.equal(moved.ok, false);
    assert.match(moved.problems.join("\n"), /not this report/);

    // An edited payload no longer matches its signature.
    const envelope = JSON.parse(await readFile(out.envelope, "utf8"));
    const original = Buffer.from(envelope.payload, "base64");
    const edited = JSON.parse(original.toString("utf8"));
    edited.predicate.countersignedAt = "2020-01-01T00:00:00Z";
    await writeFile(join(base, "edited.dsse.json"), JSON.stringify({ ...envelope, payload: Buffer.from(JSON.stringify(edited, null, 2) + "\n").toString("base64") }));
    const tampered = await readCountersignature(join(base, "edited.dsse.json"), report);
    assert.equal(tampered.ok, false);
    assert.match(tampered.problems.join("\n"), /does not match the statement/);
    assert.match(tampered.problems.join("\n"), /incorrect signature/, "ssh-keygen's reason: the bytes changed");
    assert.doesNotMatch(tampered.problems.join("\n"), /namespace does not match/);

    // A signature made for the author's attest namespace is not a countersignature.
    await writeFile(join(base, "ns.json"), original);
    execFileSync("ssh-keygen", ["-Y", "sign", "-f", join(base, "key"), "-n", "workproof", join(base, "ns.json")], { stdio: "pipe" });
    const wrongNamespace = { ...envelope, signatures: [{ keyid: "ssh", sig: (await readFile(join(base, "ns.json.sig"))).toString("base64") }] };
    await writeFile(join(base, "ns.dsse.json"), JSON.stringify(wrongNamespace));
    const replay = await readCountersignature(join(base, "ns.dsse.json"), report);
    assert.equal(replay.ok, false);
    assert.match(replay.problems.join("\n"), /does not match the statement/);
    assert.match(replay.problems.join("\n"), /namespace does not match/, "ssh-keygen's reason: signed for another namespace");
    assert.doesNotMatch(replay.problems.join("\n"), /incorrect signature/);

    // A file that is not an envelope, and a file that does not exist.
    await writeFile(join(base, "junk.json"), "{}");
    assert.equal((await readCountersignature(join(base, "junk.json"), report)).ok, false);
    assert.equal((await readCountersignature(join(base, "missing.json"), report)).ok, false);
    await copyFile(out.envelope, join(base, "keep.dsse.json"));
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(base, { recursive: true, force: true });
  }
});


const cli = join(process.cwd(), "dist/src/cli.js");

test("the CLI countersigns in one command, check reports it, and check without one prints exactly what it printed before", async () => {
  const dir = await makeRepo();
  const { clone, base } = await cloneOf(dir);
  try {
    const report = await reportOf(dir);
    const reportPath = join(base, "r.json");
    await writeFile(reportPath, JSON.stringify(report));
    keygen(join(base, "key"), "cem");
    const pub = await readFile(join(base, "key.pub"), "utf8");

    const plain = execFileSync("node", [cli, "check", reportPath], { encoding: "utf8" });
    assert.equal(plain, `schema ok\nhash ok ${report.hash}\n`, "a report with no countersignature prints what it always did");

    const signed = spawnSync("node", [cli, "countersign", reportPath, "--key", join(base, "key"), "--repo", clone, "--fingerprint-key", KEY, "--as", "Cem"], { encoding: "utf8" });
    assert.equal(signed.status, 0, signed.stderr);
    assert.match(signed.stdout, /wrote \S+\.intoto\.json, \S+\.sig and \S+\.dsse\.json/);
    assert.match(signed.stdout, /send back only the \.dsse\.json file/i);
    assert.match(signed.stdout, /What a countersignature proves/);
    const envelope = /(\S+\.dsse\.json)/.exec(signed.stdout)![1]!;

    const checked = spawnSync("node", [cli, "check", reportPath, "--countersign", envelope], { encoding: "utf8" });
    assert.equal(checked.status, 0, checked.stdout + checked.stderr);
    assert.match(checked.stdout, /^schema ok\nhash ok /);
    assert.match(checked.stdout, /signature valid and bound to this report/);
    assert.match(checked.stdout, /signer's own label, not verified: "Cem"/);
    assert.match(checked.stdout, /not checked against any list of keys you trust/);
    assert.match(checked.stdout, /What it does not prove[\s\S]*agree beforehand/);

    await writeFile(join(base, "allowed"), `cem@example.com ${pub}`);
    const named = spawnSync("node", [cli, "check", reportPath, "--countersign", envelope, "--allowed-signers", join(base, "allowed")], { encoding: "utf8" });
    assert.equal(named.status, 0, named.stdout + named.stderr);
    assert.match(named.stdout, /listed in your allowed signers as cem@example\.com/);

    // A tampered envelope fails check and the exit code says so.
    const env = JSON.parse(await readFile(envelope, "utf8"));
    const statement = JSON.parse(Buffer.from(env.payload, "base64").toString("utf8"));
    statement.predicate.countersignedAt = "2020-01-01T00:00:00Z";
    await writeFile(join(base, "tampered.dsse.json"), JSON.stringify({ ...env, payload: Buffer.from(JSON.stringify(statement, null, 2) + "\n").toString("base64") }));
    const bad = spawnSync("node", [cli, "check", reportPath, "--countersign", join(base, "tampered.dsse.json")], { encoding: "utf8" });
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /NOT VALID/);

    // An edited report is stopped before any countersignature is read.
    const edited = JSON.parse(JSON.stringify(report));
    edited.repositories[0].figures[0].value = { forged: true };
    await writeFile(join(base, "edited.json"), JSON.stringify(edited));
    const stopped = spawnSync("node", [cli, "check", join(base, "edited.json"), "--countersign", envelope], { encoding: "utf8" });
    assert.equal(stopped.status, 1);
    assert.match(stopped.stdout, /countersignatures were not read/);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(base, { recursive: true, force: true });
  }
});

test("countersign names what is missing or wrong instead of failing silently", async () => {
  const dir = await makeRepo();
  const { clone, base } = await cloneOf(dir);
  try {
    const report = await reportOf(dir);
    const reportPath = join(base, "r.json");
    await writeFile(reportPath, JSON.stringify(report));
    const noKey = spawnSync("node", [cli, "countersign", reportPath], { encoding: "utf8" });
    assert.equal(noKey.status, 1);
    assert.match(noKey.stderr, /countersign needs --key/);
    keygen(join(base, "key"), "cem");
    const noFingerprintKey = spawnSync("node", [cli, "countersign", reportPath, "--key", join(base, "key"), "--repo", clone], { encoding: "utf8" });
    assert.equal(noFingerprintKey.status, 1);
    assert.match(noFingerprintKey.stderr, /--fingerprint-key/);
    const stray = spawnSync("node", [cli, "--key", join(base, "key")], { encoding: "utf8" });
    assert.equal(stray.status, 1);
    assert.match(stray.stderr, /--key and --as belong to countersign/);
    const repoOnCheck = spawnSync("node", [cli, "check", reportPath, "--repo", clone], { encoding: "utf8" });
    assert.equal(repoOnCheck.status, 1);
    assert.match(repoOnCheck.stderr, /never reads a repository/);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(base, { recursive: true, force: true });
  }
});

test("the countersignature predicate type resolves to a page in this repository that describes it", async () => {
  const owned = /^https:\/\/github\.com\/Bubblegunn\/workproof\/blob\/main\//;
  assert.match(COUNTERSIGN_PREDICATE_TYPE, owned);
  const doc = COUNTERSIGN_PREDICATE_TYPE.replace(owned, "");
  const text = await readFile(join(process.cwd(), doc), "utf8");
  assert.match(text, /predicateType/);
  assert.ok(text.includes(COUNTERSIGN_PREDICATE_TYPE));
  assert.ok(text.includes("workproof-countersign"));
  assert.ok(!text.includes("\u2014"), "no em dash");
});
