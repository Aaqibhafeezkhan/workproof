#!/usr/bin/env node
// Prints the Homebrew formula for one published workproof version.
//
//   node scripts/homebrew-formula.mjs                      version from package.json, tarball downloaded from the registry
//   node scripts/homebrew-formula.mjs --version 0.6.2      a specific published version
//   node scripts/homebrew-formula.mjs --sha256 <hex>       use this checksum instead of downloading
//   node scripts/homebrew-formula.mjs --tarball x.tgz      hash a local tarball (npm pack output) instead
//   node scripts/homebrew-formula.mjs --check [file]       fetch the registry tarball for the formula's own
//                                                          version and fail unless its sha256 matches the
//                                                          checksum in the formula (default file:
//                                                          packaging/homebrew/workproof.rb). Needs network.
//
// The output is meant for Formula/workproof.rb in a tap repository (Bubblegunn/homebrew-tap, not yet
// created: that is the maintainer's decision). The formula installs the tarball npm serves, pinned by
// its sha256.
//
// Release process, in this order, before the formula is copied into a tap:
//   1. node scripts/homebrew-formula.mjs --check        must print "matches the registry tarball"
//   2. copy packaging/homebrew/workproof.rb to <tap>/Formula/workproof.rb
//   3. brew audit --strict --new <tap>/workproof, then brew test <tap>/workproof
// The default test run is offline. WORKPROOF_NETWORK_TESTS=1 runs the same --check as a test.
// Node built-ins only; not shipped in the npm package.
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

export function renderFormula({ version, sha256 }) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`version must be X.Y.Z, got ${version}`);
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("sha256 must be 64 lowercase hex characters");
  return `class Workproof < Formula
  desc "Verifiable engineering report from git history, without showing code"
  homepage "https://github.com/Bubblegunn/workproof"
  url "https://registry.npmjs.org/workproof/-/workproof-${version}.tgz"
  sha256 "${sha256}"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/workproof --version")
    assert_match "usage: workproof", shell_output("#{bin}/workproof --help")
  end
end
`;
}

// Keeps the committed formula honest against the registry, which is the only independent source for
// its checksum. `fetchImpl` is injectable so the failure paths can run offline.
export async function checkFormula(text, fetchImpl = fetch) {
  const version = /^  url "https:\/\/registry\.npmjs\.org\/workproof\/-\/workproof-(\d+\.\d+\.\d+)\.tgz"$/m.exec(text)?.[1];
  const sha256 = /^  sha256 "([0-9a-f]{64})"$/m.exec(text)?.[1];
  if (!version || !sha256) throw new Error("the formula must name a registry url with an X.Y.Z version and a 64-hex sha256");
  const url = `https://registry.npmjs.org/workproof/-/workproof-${version}.tgz`;
  const res = await fetchImpl(url);
  if (res.status === 404) throw new Error(`workproof ${version} is not in the npm registry (${url})`);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const actual = createHash("sha256").update(Buffer.from(await res.arrayBuffer())).digest("hex");
  if (actual !== sha256) {
    throw new Error(`formula sha256 ${sha256} does not match the registry tarball for ${version} (registry: ${actual})`);
  }
  return version;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--check")) {
    const i = args.indexOf("--check");
    const file = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : join(import.meta.dirname, "..", "packaging/homebrew/workproof.rb");
    const version = await checkFormula(readFileSync(file, "utf8"));
    process.stdout.write(`ok: ${file} matches the registry tarball for workproof ${version}\n`);
    return;
  }
  const flag = (name) => {
    const i = args.indexOf(name);
    if (i === -1) return undefined;
    const v = args[i + 1];
    if (v === undefined) throw new Error(`${name} needs a value`);
    return v;
  };
  const root = join(import.meta.dirname, "..");
  const version = flag("--version") ?? JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  const given = flag("--sha256");
  const tarball = flag("--tarball");
  if (given !== undefined && tarball !== undefined) throw new Error("pass either --sha256 or --tarball, not both");
  let sha256;
  if (given !== undefined) sha256 = given;
  else if (tarball !== undefined) sha256 = createHash("sha256").update(readFileSync(tarball)).digest("hex");
  else {
    const url = `https://registry.npmjs.org/workproof/-/workproof-${version}.tgz`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}; is ${version} published?`);
    sha256 = createHash("sha256").update(Buffer.from(await res.arrayBuffer())).digest("hex");
  }
  process.stdout.write(renderFormula({ version, sha256 }));
}

// realpath on both sides: a symlinked temp directory (macOS /var -> /private/var) otherwise makes the
// two paths differ and the script exits 0 without printing anything.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(import.meta.filename)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
