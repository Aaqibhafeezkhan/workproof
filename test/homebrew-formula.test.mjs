import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderFormula } from "../scripts/homebrew-formula.mjs";
import { compareVersions } from "../scripts/version.mjs";

const root = join(import.meta.dirname, "..");
const SHA = "a".repeat(64);
const committed = () => readFileSync(join(root, "packaging/homebrew/workproof.rb"), "utf8");

test("the formula installs the published npm tarball for one version, pinned by sha256", () => {
  const f = renderFormula({ version: "1.2.3", sha256: SHA });
  assert.match(f, /^class Workproof < Formula$/m);
  assert.match(f, /^  url "https:\/\/registry\.npmjs\.org\/workproof\/-\/workproof-1\.2\.3\.tgz"$/m);
  assert.match(f, new RegExp(`^  sha256 "${SHA}"$`, "m"));
  assert.match(f, /^  license "MIT"$/m);
  assert.match(f, /^  depends_on "node"$/m);
  assert.match(f, /system "npm", "install", \*std_npm_args/);
  assert.match(f, /bin\.install_symlink Dir\["#\{libexec\}\/bin\/\*"\]/);
  assert.match(f, /shell_output\("#\{bin\}\/workproof --version"\)/);
  assert.ok(!f.includes("\u2014"));
});

test("a version or checksum that is not well formed is refused", () => {
  assert.throws(() => renderFormula({ version: "1.2", sha256: SHA }), /X\.Y\.Z/);
  assert.throws(() => renderFormula({ version: "1.2.3", sha256: "xyz" }), /64 lowercase hex/);
  assert.throws(() => renderFormula({ version: "1.2.3", sha256: SHA.toUpperCase() }), /64 lowercase hex/);
});

test("the CLI hashes a local tarball, and reads the version from package.json by default", () => {
  const dir = mkdtempSync(join(tmpdir(), "wp-brew-"));
  try {
    const tgz = join(dir, "x.tgz");
    writeFileSync(tgz, "not really a tarball");
    const want = createHash("sha256").update("not really a tarball").digest("hex");
    const out = execFileSync("node", [join(root, "scripts/homebrew-formula.mjs"), "--version", "4.5.6", "--tarball", tgz], { encoding: "utf8" });
    assert.equal(out, renderFormula({ version: "4.5.6", sha256: want }));
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const dflt = execFileSync("node", [join(root, "scripts/homebrew-formula.mjs"), "--sha256", SHA], { encoding: "utf8" });
    assert.ok(dflt.includes(`workproof-${pkg.version}.tgz`));
    const both = spawnSync("node", [join(root, "scripts/homebrew-formula.mjs"), "--sha256", SHA, "--tarball", join(dir, "x.tgz")], { encoding: "utf8" });
    assert.equal(both.status, 1);
    assert.match(both.stderr, /either --sha256 or --tarball/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the committed formula is exactly what the generator renders from its own version and checksum", () => {
  const text = committed();
  const version = /workproof-(\d+\.\d+\.\d+)\.tgz/.exec(text)?.[1];
  const sha256 = /^  sha256 "([0-9a-f]{64})"$/m.exec(text)?.[1];
  assert.ok(version && sha256, "the formula names a version and a checksum");
  assert.equal(text, renderFormula({ version, sha256 }));
});

test("the committed formula never names a version newer than the package", () => {
  const version = /workproof-(\d+\.\d+\.\d+)\.tgz/.exec(committed())[1];
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.ok(compareVersions(version, pkg.version) <= 0, `formula ${version} is ahead of package.json ${pkg.version}`);
});

test("the committed formula is valid Ruby", { skip: process.platform === "win32" ? "ruby is not guaranteed on the Windows runner; the Linux and macOS legs run this" : false }, () => {
  const r = spawnSync("ruby", ["-c", join(root, "packaging/homebrew/workproof.rb")], { encoding: "utf8" });
  assert.equal(r.error, undefined, "ruby must be installed on Linux and macOS to check the formula");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Syntax OK/);
});
