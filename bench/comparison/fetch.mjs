#!/usr/bin/env node
// Fetches the tools workproof is compared with into _upstream/ (gitignored), at the versions,
// commits and checksums in pins.json, and checks each licence text against the pin.
//
// Usage: node bench/comparison/fetch.mjs [toolname ...]
// Needs network, python3 (for git-fame), git and tar. Linux and macOS only.
// Third-party code is only run from _upstream/. It is never copied into this repository.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { classifyLicence, mayAdapt } from "./licence.mjs";

const here = import.meta.dirname;
export const ROOT = join(here, "..", "..");
export const UPSTREAM = join(ROOT, "_upstream");
export const pins = () => JSON.parse(readFileSync(join(here, "pins.json"), "utf8"));

export function platformKey(platform = process.platform, arch = process.arch) {
  const os = { darwin: "darwin", linux: "linux" }[platform];
  const cpu = { arm64: "arm64", x64: "amd64" }[arch];
  if (!os || !cpu) throw new Error(`the comparison tools are pinned for darwin/linux on arm64 or x64, not ${platform}/${arch}`);
  return `${os}_${cpu}`;
}

export const sha256Hex = (buf) => createHash("sha256").update(buf).digest("hex");

export function assertSha256(buf, expected, label) {
  const got = sha256Hex(buf);
  if (got !== expected) throw new Error(`${label}: sha256 is ${got}, the pin says ${expected}`);
}

export function checkLicence(name, pin, text) {
  if (pin.policy !== "adapt-ok" && pin.policy !== "run-only") throw new Error(`${name}: policy must be adapt-ok or run-only`);
  const found = classifyLicence(text);
  if (found !== pin.licence) throw new Error(`${name}: the licence text reads as ${found}, pins.json says ${pin.licence}`);
  if (pin.policy === "adapt-ok" && !mayAdapt(found)) throw new Error(`${name}: ${found} may not be adapted, only run`);
  return found;
}

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...opts });

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchTool(name, pin) {
  let licenceText;
  if (pin.kind === "pip") {
    mkdirSync(UPSTREAM, { recursive: true });
    const venv = join(UPSTREAM, "venv");
    if (!existsSync(venv)) sh("python3", ["-m", "venv", venv]);
    sh(join(venv, "bin", "pip"), ["install", "--quiet", "--disable-pip-version-check", `${pin.package}==${pin.version}`]);
    const said = sh(join(UPSTREAM, pin.bin), ["--version"]).trim();
    if (!said.includes(pin.version)) throw new Error(`${name}: --version printed "${said}", expected ${pin.version}`);
    const lib = join(venv, "lib");
    const py = readdirSync(lib).find((d) => d.startsWith("python"));
    licenceText = readFileSync(join(lib, py, "site-packages", pin.licenceGlob), "utf8");
  } else if (pin.kind === "git") {
    const dir = join(UPSTREAM, name);
    if (!existsSync(dir)) sh("git", ["clone", "--quiet", "--depth", "1", "--branch", pin.version, `https://github.com/${pin.repo}.git`, dir]);
    const head = sh("git", ["-C", dir, "rev-parse", "HEAD"]).trim();
    if (head !== pin.commit) throw new Error(`${name}: tag ${pin.version} is at ${head}, the pin says ${pin.commit}`);
    licenceText = readFileSync(join(dir, pin.licencePath), "utf8");
  } else {
    const key = platformKey();
    const asset = pin.assets[key];
    if (!asset) throw new Error(`${name}: no pinned asset for ${key}; add one with its sha256 to pins.json`);
    const dir = join(UPSTREAM, name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const buf = await fetchBuffer(asset.url);
    assertSha256(buf, asset.sha256, `${name} ${key}`);
    const file = join(dir, "asset.tar.gz");
    writeFileSync(file, buf);
    sh("tar", ["-xzf", file, "-C", dir]);
    licenceText = (await fetchBuffer(pin.licenceUrl)).toString("utf8");
  }
  const found = checkLicence(name, pin, licenceText);
  console.log(`ok ${name} ${pin.version} ${found} ${pin.policy}`);
}

/** Absolute path of an executable inside _upstream/, from the pins. */
export function binaryPath(name) {
  const pin = pins().tools[name];
  if (pin.kind === "release") return join(UPSTREAM, pin.assets[platformKey()].binary.replace(/^[^/]+\//, `${name}/`));
  return join(UPSTREAM, pin.bin);
}

async function main() {
  const p = pins();
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : Object.keys(p.tools);
  for (const n of names) if (!p.tools[n]) throw new Error(`unknown tool ${n}; known: ${Object.keys(p.tools).join(", ")}`);
  mkdirSync(UPSTREAM, { recursive: true });
  for (const n of names) await fetchTool(n, p.tools[n]);
  console.log(`fetched ${names.length} tools into ${UPSTREAM}`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(import.meta.filename)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
