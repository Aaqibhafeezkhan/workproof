// Runs the test suite under Node's built-in coverage, with the floors given on the command line.
// Usage (after npm run build): node scripts/coverage.mjs --test-coverage-lines=N --test-coverage-branches=N ...
//
// The test files are read from the `test` script in package.json rather than listed again here,
// so there is one list and test/suite.test.mjs already polices it. Node only honours test-runner
// flags placed before the file list, which is why `npm test -- --experimental-test-coverage`
// silently printed no coverage at all. Coverage counts dist/src only: the compiled code people
// install, not the tests or the scripts.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const script = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts.test;
const marker = "node --test ";
const at = script.indexOf(marker);
if (at < 0) throw new Error(`the test script has no "${marker}": ${script}`);
const files = script.slice(at + marker.length).trim().split(/\s+/);
if (!files.length || files.some((f) => !/\.test\.(m?js)$/.test(f))) throw new Error(`could not read the test files from: ${script}`);

const floors = process.argv.slice(2);
if (!floors.some((a) => a.startsWith("--test-coverage-lines="))) throw new Error("pass at least --test-coverage-lines=N; a coverage run without a floor cannot fail");
const result = spawnSync(process.execPath, ["--test", "--experimental-test-coverage", "--test-coverage-include=dist/src/**", ...floors, ...files], { cwd: root, stdio: "inherit" });
process.exit(result.status ?? 1);
