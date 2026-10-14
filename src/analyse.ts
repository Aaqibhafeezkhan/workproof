import { createHash, createHmac, randomBytes } from "node:crypto";
import { basename } from "node:path";
import { createRequire } from "node:module";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { listCommits, listTags, rootCommit, headSha, remoteUrl, assertRepository, assertNotShallow, gitVersion, checkAttr, listHeadFiles } from "./git.js";
import type { Commit } from "./git.js";
import { isBot, excludedSet } from "./exclusions.js";
// surviving-lines ships plain ESM JavaScript without type declarations.
// @ts-ignore
import { globToRegExp } from "surviving-lines/bin/surviving-lines.js";
import { resolveIdentity, possibleSplits } from "./figures/identity.js";
import { tenure, commitShare } from "./figures/commits.js";
import { cadence } from "./figures/cadence.js";
import { footprint, testsAndDocs } from "./figures/footprint.js";
import { survivingLines, blameFlags } from "./figures/surviving.js";
import { filesAuthored, majorContributor, commitSize, coAuthored, absenceFactor, aiAssisted, survivalByCohort } from "./figures/authorship.js";
import type { Figure } from "./figures/types.js";

export interface Params {
  author?: string[];
  since?: string;
  until?: string;
  sample?: number;
  depth: number;
  threshold: number;
  minCommits: number;
  paths: boolean;
  emails: boolean;
  /** Escape hatch for enormous histories: read only the newest n commits. */
  maxCommits?: number;
  /** Drop bot commits and generated, vendored, lock and snapshot files (default true). */
  exclusions?: boolean;
  /** Extra globs to drop, with surviving-lines semantics. */
  exclude?: string[];
  /** Salt for the blame file sample. */
  seed?: string;
  /** Pass -C to git blame so copied lines follow their origin. */
  copies?: boolean;
  /** A blame ignore-revs file other than .git-blame-ignore-revs at the root. */
  ignoreRevsFile?: string;
  /** Key for the repository fingerprint; generated per report when absent. */
  fingerprintKey?: string;
}

export interface AnalyseHooks {
  /** Called with short status lines while history is read and files are blamed. */
  progress?: (message: string) => void;
}

export interface RepoReport {
  name: string;
  head: string;
  fingerprint: string;
  /** True when the fingerprint is an HMAC under a key the report does not carry. */
  fingerprintKeyed?: boolean;
  identity: {
    emails: string[];
    names: string[];
    count: number;
    /** Addresses here that look like the subject and were not counted as them. */
    possiblySplit?: { names: string[]; emails?: string[]; reasons: string[] };
  };
  /** What the figures were computed with, so a verifier can tell a drift from an edit. */
  environment: { git: string; blame: string[]; ignoreRevs: string | null; seed: string };
  /** What left the denominators before any figure was computed. */
  excluded: { botCommits: number; files: number; linesAddedShare: number; enabled: boolean };
  figures: Figure<any>[];
}

/** A fresh 16-byte fingerprint key as hex. Printed once, stored nowhere. */
export const newFingerprintKey = (): string => randomBytes(16).toString("hex");

const NOREPLY = /@users\.noreply\.github\.com$/i;
/** GitHub noreply addresses carry the login in the local part, so they are never written out. */
export const publicEmail = (email: string): string => (NOREPLY.test(email) ? "(github noreply)" : email);

/**
 * Identifies a repository without naming it. Keyed: HMAC-SHA256 under a per-report key of
 * the root commit and the normalised remote, so a reader cannot look a public repository
 * up from its fingerprint. Unkeyed (no key given): plain sha256, kept for callers that
 * want a stable public identifier.
 */
export function fingerprint(root: string, remote: string, key?: string): string {
  let r = remote.trim().toLowerCase().replace(/\.git$/, "");
  r = r.replace(/^[a-z+]+:\/\//, "").replace(/^git@([^:]+):/, "$1/");
  const text = `${root}\n${r}`;
  return key === undefined ? createHash("sha256").update(text).digest("hex") : createHmac("sha256", Buffer.from(key, "hex")).update(text).digest("hex");
}

const require = createRequire(import.meta.url);
const survivingVersion = (): string => {
  try {
    return require("surviving-lines/package.json").version as string;
  } catch {
    return "unknown";
  }
};

async function ignoreRevsFor(cwd: string, params: Params): Promise<string | null> {
  if (params.ignoreRevsFile) return params.ignoreRevsFile;
  try {
    await access(join(cwd, ".git-blame-ignore-revs"));
    return ".git-blame-ignore-revs";
  } catch {
    return null;
  }
}

/** Bot commits out, excluded paths out of every commit's file list; the untouched copy stays for the share. */
async function applyExclusions(cwd: string, all: Commit[], params: Params) {
  const enabled = params.exclusions !== false;
  const extra = (params.exclude ?? []).map((g: string) => globToRegExp(g) as RegExp);
  const botCommits = enabled ? all.filter(isBot).length : 0;
  const human = enabled ? all.filter((c) => !isBot(c)) : all;
  const headFiles = await listHeadFiles(cwd);
  const paths = new Set<string>(headFiles);
  for (const c of human) for (const f of c.files) paths.add(f.path);
  const attrs = enabled ? await checkAttr(cwd, [...paths]) : new Map();
  const excluded = excludedSet(paths, attrs, extra);
  if (!enabled) for (const p of [...excluded]) if (!extra.some((re) => re.test(p))) excluded.delete(p);
  const commits = human.map((c) => ({ ...c, files: c.files.filter((f) => !excluded.has(f.path)) }));
  return { commits, raw: human, excluded, botCommits, enabled, headFiles: new Set(headFiles.filter((p) => !excluded.has(p))) };
}

export async function analyseRepo(cwd: string, params: Params, hooks: AnalyseHooks = {}): Promise<RepoReport> {
  const say = hooks.progress ?? (() => {});
  await assertRepository(cwd);
  await assertNotShallow(cwd);
  const key = params.fingerprintKey ?? newFingerprintKey();
  if (!params.fingerprintKey) say(`fingerprint key ${key} (keep it to compare reports; it is not stored)`);
  say(`${basename(cwd)}: reading history${params.maxCommits ? ` (newest ${params.maxCommits} commits)` : ""}...`);
  const everything = await listCommits(cwd, params.maxCommits ? { max: params.maxCommits } : {});
  say(`${basename(cwd)}: ${everything.length.toLocaleString("en-US")} commits read`);
  const ex = await applyExclusions(cwd, everything, params);
  const all = ex.commits;
  const id = await resolveIdentity(all, params.author, cwd);
  // Before any figure is computed: does someone else here look like the same person? A split
  // identity makes every figure below describe half the work, silently.
  const splits = possibleSplits(all, id);
  const t = tenure(all, id, { ...(params.since ? { since: params.since } : {}), ...(params.until ? { until: params.until } : {}) });
  const start = new Date(t.value.first + "T00:00:00Z");
  const end = new Date(t.value.last + "T23:59:59Z");
  const inTenure = all.filter((c) => c.localDate >= start && c.localDate <= end);
  let addedAll = 0;
  let addedExcluded = 0;
  for (const c of ex.raw) {
    if (c.localDate < start || c.localDate > end || c.parents > 1) continue;
    for (const f of c.files) {
      if (f.added === null) continue;
      addedAll += f.added;
      if (ex.excluded.has(f.path)) addedExcluded += f.added;
    }
  }
  const tags = await listTags(cwd);
  const sample = params.sample ?? (all.reduce((n, c) => n + c.files.length, 0) > 50000 ? 7 : 1);
  const ignoreRevs = await ignoreRevsFor(cwd, params);
  const blame = blameFlags(params.copies ?? false, ignoreRevs);
  const fp = footprint(inTenure, id, { depth: params.depth, threshold: params.threshold, minCommits: params.minCommits });
  if (!params.paths) {
    fp.value = { ...fp.value, ownedDirectories: fp.value.ownedDirectories.map((d) => ({ ...d, path: "(hidden; run with --paths)" })) };
  }
  const figures: Figure<any>[] = [
    t,
    commitShare(inTenure, id),
    cadence(inTenure, tags, id, { first: t.value.first, last: t.value.last }),
    fp,
    testsAndDocs(inTenure, id),
    filesAuthored(all, id, ex.headFiles),
    majorContributor(inTenure, id, params.depth),
    commitSize(inTenure, id),
    coAuthored(inTenure, id),
    absenceFactor(inTenure, id),
    aiAssisted(inTenure, id),
  ];
  say(`${basename(cwd)}: blaming files (1 in ${sample} sample)...`);
  const surviving = await survivingLines(cwd, id, {
    sample,
    seed: params.seed ?? "",
    exclude: params.exclude ?? [],
    copies: params.copies ?? false,
    ignoreRevsFile: ignoreRevs,
    excluded: ex.excluded,
    version: survivingVersion(),
  });
  say(`${basename(cwd)}: blamed ${surviving.value.filesSampled} of ${surviving.value.filesTotal} files`);
  figures.push(surviving, survivalByCohort(surviving.value.byYear, sample));
  return {
    name: basename(cwd),
    head: await headSha(cwd),
    fingerprint: fingerprint(await rootCommit(cwd), await remoteUrl(cwd), key),
    fingerprintKeyed: true,
    identity: {
      emails: params.emails ? [...new Set(id.emails.map(publicEmail))] : [],
      names: id.names,
      count: id.emails.length,
      ...(splits.length
        ? {
            possiblySplit: {
              names: [...new Set(splits.map((sp) => sp.name))],
              ...(params.emails ? { emails: [...new Set(splits.map((sp) => publicEmail(sp.email)))] } : {}),
              reasons: [...new Set(splits.map((sp) => sp.reason))],
            },
          }
        : {}),
    },
    environment: { git: await gitVersion(cwd), blame, ignoreRevs, seed: params.seed ?? "" },
    excluded: { botCommits: ex.botCommits, files: ex.excluded.size, linesAddedShare: addedAll ? addedExcluded / addedAll : 0, enabled: ex.enabled },
    figures,
  };
}
