// The repositories every tool is run on, and the answer git itself gives.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { UPSTREAM } from "./fetch.mjs";

/** Fixture B: a real history, this project's own, at a pinned commit. Used for timing only. */
export const FIXTURE_B = {
  url: "https://github.com/Bubblegunn/workproof.git",
  sha: "cd47e6e621f1ea6d7a39bfcd2a16fc0fedc0895e",
  author: "Efe Genc",
};

/**
 * Fixture A: the deterministic repository the tests use (needs `npm run build` first). Two people, a
 * bot that adds a lock file, a file marked linguist-generated, a reformat commit listed in
 * .git-blame-ignore-revs, a Co-authored-by trailer and an AI trailer.
 */
export async function fixtureA() {
  const { makeRepo } = await import("../../dist/test/fixture.js");
  return { dir: await makeRepo(), author: "ada@example.com", name: "Ada" };
}

export function fixtureB() {
  const dir = join(UPSTREAM, "fixtures", "workproof");
  if (!existsSync(dir)) {
    mkdirSync(join(UPSTREAM, "fixtures"), { recursive: true });
    execFileSync("git", ["clone", "--quiet", FIXTURE_B.url, dir], { stdio: "inherit" });
  }
  execFileSync("git", ["-C", dir, "checkout", "--quiet", "--detach", FIXTURE_B.sha], { stdio: "inherit" });
  return dir;
}

/**
 * What `git blame` itself says: lines alive at HEAD per author email, with -w -M, honouring
 * .git-blame-ignore-revs, over text files only, leaving out lock files and files marked
 * linguist-generated. This is the reference the tools are judged against; it does not call any of
 * them. Returns { byEmail, total, lines } where lines is the count for `email`.
 */
export function groundTruth(dir, email) {
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const files = git("grep", "-I", "--name-only", "", "HEAD", "--").split("\n").filter(Boolean).map((f) => f.replace(/^HEAD:/, ""));
  const ignore = existsSync(join(dir, ".git-blame-ignore-revs")) ? ["--ignore-revs-file=.git-blame-ignore-revs"] : [];
  const counts = new Map();
  for (const f of files) {
    if (/(^|\/)package-lock\.json$/.test(f)) continue;
    if (/: set$/.test(git("check-attr", "linguist-generated", "--", f).trim())) continue;
    for (const line of git("blame", "-w", "-M", ...ignore, "--line-porcelain", "HEAD", "--", f).split("\n")) {
      if (!line.startsWith("author-mail ")) continue;
      const mail = line.slice("author-mail ".length).replace(/[<>]/g, "");
      counts.set(mail, (counts.get(mail) ?? 0) + 1);
    }
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  return { byEmail: Object.fromEntries(counts), total, lines: counts.get(email) ?? 0 };
}
