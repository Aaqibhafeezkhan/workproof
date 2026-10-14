// Writes package.json and package-lock.json for the empty project smoke-tarball.sh installs
// into, so the install is `npm ci`: every runtime dependency is pinned to the version and
// integrity in this repository's own package-lock.json, the versions the test suite ran
// against, and npm refuses a registry tarball whose sha512 differs (EINTEGRITY). The packed
// tarball's own sha512 is recorded too; npm reads a file: tarball as it is.
// Usage: node scripts/smoke-lockfile.mjs <project dir> <tarball file name inside it>
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir, tgz] = process.argv.slice(2);
if (!dir || !tgz) throw new Error("usage: smoke-lockfile.mjs <project dir> <tarball file name>");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const spec = `file:${tgz}`;
const integrity = `sha512-${createHash("sha512").update(readFileSync(join(dir, tgz))).digest("base64")}`;

const packages = {
  "": { name: "smoke", version: "1.0.0", dependencies: { [pkg.name]: spec } },
  [`node_modules/${pkg.name}`]: {
    version: pkg.version,
    resolved: spec,
    integrity,
    ...(pkg.license && { license: pkg.license }),
    ...(pkg.dependencies && { dependencies: pkg.dependencies }),
    ...(pkg.bin && { bin: pkg.bin }),
    ...(pkg.engines && { engines: pkg.engines }),
  },
};
// The runtime part of the repository lockfile: every installed entry not marked dev.
for (const [path, entry] of Object.entries(lock.packages)) {
  if (path === "" || entry.dev || entry.link) continue;
  if (!entry.resolved || !entry.integrity) throw new Error(`${path} has no resolved/integrity in package-lock.json`);
  packages[path] = entry;
}
for (const name of Object.keys(pkg.dependencies ?? {})) {
  if (!packages[`node_modules/${name}`]) throw new Error(`runtime dependency ${name} is not in package-lock.json`);
}

writeFileSync(join(dir, "package.json"), `${JSON.stringify({ name: "smoke", version: "1.0.0", private: true, dependencies: { [pkg.name]: spec } }, null, 2)}\n`);
writeFileSync(join(dir, "package-lock.json"), `${JSON.stringify({ name: "smoke", version: "1.0.0", lockfileVersion: 3, requires: true, packages }, null, 2)}\n`);
