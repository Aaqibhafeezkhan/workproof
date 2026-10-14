import { execFile } from "node:child_process";

/**
 * Settings that change what diff and blame attribute, pinned so two machines with different
 * defaults produce the same figures. indentHeuristic became the default in git 2.14 and
 * rename detection in 2.9; a report records the git version it ran under as well.
 *
 * `core.precomposeunicode` is true in every repository git creates on macOS, and it rewrites
 * command-line arguments from decomposed to precomposed form. Paths here are read out of the
 * tree and handed back as pathspecs, so a stored decomposed path came back as a different
 * string and matched nothing: "fatal: no such path café.ts in HEAD", and the run ended with no
 * report. Pinning it off keeps the path sent identical to the path git stored. A checkout
 * authored on Linux carrying Korean, French, Turkish, Vietnamese, Portuguese or Spanish
 * filenames was affected; ASCII repositories are unchanged either way.
 */
export const PINNED_CONFIG = ["-c", "diff.renames=true", "-c", "diff.algorithm=myers", "-c", "diff.indentHeuristic=true", "-c", "core.autocrlf=false", "-c", "core.precomposeunicode=false"];

export function git(args: string[], cwd: string, input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("git", [...PINNED_CONFIG, ...args], { cwd, encoding: "utf8", maxBuffer: 1024 * 1024 * 512 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
    if (input !== undefined) child.stdin?.end(input);
  });
}

export const gitVersion = async (cwd: string): Promise<string> => (await git(["--version"], cwd)).trim();

export interface FileChange {
  path: string;
  added: number | null;
  deleted: number | null;
  /** The previous path when git detected a rename in this commit. */
  from?: string;
}
export interface Commit {
  sha: string;
  email: string;
  name: string;
  date: Date;
  /**
   * The author's wall clock, as a Date whose UTC fields are the local calendar date and time
   * that `%aI` reports. Calendar figures (which week, which day) must use this; anything
   * ordering commits in time must use `date`, which is the instant.
   */
  localDate: Date;
  parents: number;
  files: FileChange[];
  /** Lower-cased emails from Co-authored-by trailers. */
  coAuthors: string[];
  /** Names from Co-authored-by trailers, as written. */
  coAuthorNames: string[];
  /** Values of Assisted-by trailers, as written. */
  assistedBy: string[];
}

const RS = "\x1e";
const US = "\x1f";
const GS = "\x1d";

function splitTrailers(field: string | undefined): string[] {
  return (field ?? "").split(GS).map((s) => s.trim()).filter(Boolean);
}

/** All commits reachable from HEAD, newest first, with per-file numstat and trailers. One git call. */
export async function listCommits(cwd: string, opts: { since?: string; until?: string; max?: number }): Promise<Commit[]> {
  const args = [
    "log",
    "--numstat",
    "--format=%x1e%H%x1f%aE%x1f%aN%x1f%aI%x1f%P%x1f%(trailers:key=Co-authored-by,valueonly,separator=%x1d)%x1f%(trailers:key=Assisted-by,valueonly,separator=%x1d)",
    "-M",
  ];
  if (opts.since) args.push(`--since=${opts.since}`);
  if (opts.until) args.push(`--until=${opts.until}`);
  if (opts.max) args.push(`--max-count=${opts.max}`);
  const out = await git(args, cwd);
  const commits: Commit[] = [];
  for (const block of out.split(RS)) {
    if (!block.trim()) continue;
    // Trailer values may contain newlines only if a trailer does, which git folds; the header ends at the first newline.
    const [header, ...rest] = block.split("\n");
    const [sha, email, name, iso, parents, coAuthorField, assistedField] = header!.split(US);
    const coAuthorValues = splitTrailers(coAuthorField);
    const files: FileChange[] = [];
    for (const line of rest) {
      if (!line.trim()) continue;
      const [a, d, ...pathParts] = line.split("\t");
      let path = pathParts.join("\t");
      let from: string | undefined;
      // rename entries look like "old => new" or "dir/{old => new}/file"
      const brace = path.match(/^(.*)\{(.*) => (.*)\}(.*)$/);
      if (brace) {
        from = `${brace[1]}${brace[2]}${brace[4]}`;
        path = `${brace[1]}${brace[3]}${brace[4]}`;
      } else if (path.includes(" => ")) {
        [from, path] = path.split(" => ") as [string, string];
      }
      files.push({ path, added: a === "-" ? null : Number(a), deleted: d === "-" ? null : Number(d), ...(from ? { from } : {}) });
    }
    commits.push({
      sha: sha!,
      email: email!.toLowerCase(),
      name: name!,
      date: new Date(iso!),
      localDate: wallClock(iso!),
      parents: parents ? parents.trim().split(" ").filter(Boolean).length : 0,
      files,
      coAuthors: coAuthorValues.map((v) => (v.match(/<([^>]+)>/)?.[1] ?? "").toLowerCase()).filter(Boolean),
      coAuthorNames: coAuthorValues.map((v) => v.replace(/\s*<[^>]*>\s*$/, "").trim()).filter(Boolean),
      assistedBy: splitTrailers(assistedField),
    });
  }
  return commits;
}

/**
 * `%aI` carries the author's offset, for example 2026-03-02T00:30:00+13:00. `new Date` keeps the
 * instant and drops the offset, so a commit made on Monday morning in Auckland lands in the
 * previous UTC week. This shifts the instant by the stated offset so the UTC getters read back
 * the author's own calendar.
 */
export function wallClock(iso: string): Date {
  const m = iso.match(/([+-])(\d{2}):?(\d{2})$/);
  const instant = new Date(iso);
  if (!m || /[Zz]$/.test(iso)) return instant;
  const minutes = (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
  return new Date(instant.getTime() + minutes * 60000);
}

export interface Tag { name: string; date: Date; email: string }

export async function listTags(cwd: string): Promise<Tag[]> {
  const out = await git(["for-each-ref", "--format=%(refname:short)%09%(creatordate:iso-strict)%09%(taggeremail)%09%(*authoremail)%09%(authoremail)", "refs/tags"], cwd);
  const tags: Tag[] = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const [name, iso, tagger, tagged, direct] = line.split("\t");
    const email = (tagger || tagged || direct || "").replace(/^<|>$/g, "").toLowerCase();
    tags.push({ name: name!, date: new Date(iso!), email });
  }
  return tags.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Every path in the HEAD tree. */
export async function listHeadFiles(cwd: string): Promise<string[]> {
  const out = await git(["ls-tree", "-r", "-z", "--name-only", "HEAD"], cwd);
  return out.split("\0").filter(Boolean);
}

export const rootCommit = async (cwd: string) => (await git(["rev-list", "--max-parents=0", "HEAD"], cwd)).trim().split("\n").pop()!;
export const headSha = async (cwd: string) => (await git(["rev-parse", "HEAD"], cwd)).trim();
export async function remoteUrl(cwd: string): Promise<string> {
  try { return (await git(["config", "--get", "remote.origin.url"], cwd)).trim(); } catch { return ""; }
}
export async function configuredName(cwd: string): Promise<string> {
  try { return (await git(["config", "--get", "user.name"], cwd)).trim(); } catch { return ""; }
}
/** Throws a plain sentence when the directory is not inside a git repository. */
export async function assertRepository(cwd: string): Promise<void> {
  try { await git(["rev-parse", "--is-inside-work-tree"], cwd); } catch { throw new Error(`${cwd} is not inside a git repository (use --repo to point at one)`); }
}
/**
 * A shallow clone ends at a boundary commit that appears to add every line it did not see
 * change, so blame credits that commit's author with all of them, and tenure starts at the
 * boundary instead of the first commit. Which way the figures move depends on who wrote the
 * boundary commit. Measured on this repository at 0.5.1 (2026-10-14), --depth 8 against a
 * full clone: surviving lines 32 of 8,572 against 7,776 of 8,572, files authored 0 of 83
 * against 78 of 83, tenure from 2026-09-22 against 2026-09-05. No figure is right, so
 * nothing is reported.
 */
export async function assertNotShallow(cwd: string): Promise<void> {
  const shallow = (await git(["rev-parse", "--is-shallow-repository"], cwd)).trim();
  if (shallow === "true") {
    throw new Error(
      `${cwd} is a shallow clone, so the history is cut off and every figure would be wrong (blame credits the oldest commit present with every line older than it). Fetch the full history with \`git fetch --unshallow\` and run again; in GitHub Actions, check out with \`fetch-depth: 0\`.`,
    );
  }
}
/** linguist-generated and linguist-vendored from .gitattributes, for the given paths. */
export async function checkAttr(cwd: string, paths: string[]): Promise<Map<string, { generated: boolean; vendored: boolean }>> {
  const out = new Map<string, { generated: boolean; vendored: boolean }>();
  if (!paths.length) return out;
  const raw = await git(["check-attr", "-z", "--stdin", "linguist-generated", "linguist-vendored"], cwd, paths.join("\0") + "\0");
  const parts = raw.split("\0");
  for (let i = 0; i + 2 < parts.length; i += 3) {
    const [path, attr, value] = [parts[i]!, parts[i + 1]!, parts[i + 2]!];
    const entry = out.get(path) ?? { generated: false, vendored: false };
    const set = value === "set" || value === "true";
    if (attr === "linguist-generated") entry.generated = set;
    if (attr === "linguist-vendored") entry.vendored = set;
    out.set(path, entry);
  }
  return out;
}

export async function configuredEmail(cwd: string): Promise<string> {
  try { return (await git(["config", "--get", "user.email"], cwd)).trim().toLowerCase(); } catch { return ""; }
}
