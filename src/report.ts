import { createHash } from "node:crypto";
import type { Params, RepoReport } from "./analyse.js";
import { canonicalize } from "./canonical.js";
import { publicEmail } from "./analyse.js";
import { plainSummary } from "./summary.js";
import { isolate } from "./text.js";

export interface Report {
  tool: "workproof";
  /** Shape of the document; check and verify refuse other versions. */
  schemaVersion: 2;
  version: string;
  generatedAt: string;
  params: Params;
  repositories: RepoReport[];
  /** sha256 of the RFC 8785 canonical JSON of { params, repositories }. */
  hash: string;
}

/** The hash a report with these parameters and repositories must carry. */
/**
 * What of a repository the hash covers: everything a stranger with the same repository at
 * the same commit can reproduce, and nothing else.
 *
 * Two fields are recorded in the report and deliberately left out. `name` is the local
 * directory's basename, so the same repository cloned to a different folder hashed
 * differently. `environment.git` is the local git version string, so two people with the
 * same repository and different git hashed differently. Both were reproduced with real
 * runs before 0.4.0. They stay in the document because they explain why two runs might
 * legitimately differ; they are not something a verifier can be asked to reproduce.
 *
 * The blame flags, the ignore-revs file and the seed stay in, because those are the
 * question the caller asked, not the machine they asked it on.
 */
function forHash(repositories: unknown): unknown {
  if (!Array.isArray(repositories)) return repositories;
  return repositories.map((repo) => {
    if (repo === null || typeof repo !== "object") return repo;
    const { name: _name, environment, ...rest } = repo as Record<string, unknown>;
    if (environment === null || typeof environment !== "object") return rest;
    const { git: _git, ...restEnvironment } = environment as Record<string, unknown>;
    return { ...rest, environment: restEnvironment };
  });
}

export const hashOf = (params: unknown, repositories: unknown): string =>
  createHash("sha256").update(canonicalize({ params, repositories: forHash(repositories) })).digest("hex");

/**
 * What of the parameters the report may carry: never the fingerprint key, never a GitHub
 * noreply login, and without --emails no author given as an email address.
 */
function publicParams(params: Params): Params {
  const { fingerprintKey: _key, ...rest } = params;
  if (!rest.author) return rest;
  return { ...rest, author: rest.author.map((a) => (a.includes("@") ? (params.emails ? publicEmail(a) : "(email hidden)") : a)) };
}

export function buildReport(repositories: RepoReport[], params: Params, meta: { version: string; generatedAt: string }): Report {
  const shown = publicParams(params);
  return { tool: "workproof", schemaVersion: 2, version: meta.version, generatedAt: meta.generatedAt, params: shown, repositories, hash: hashOf(shown, repositories) };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const n = (x: number) => x.toLocaleString("en-US");
const plural = (x: number, one: string, many: string) => `${n(x)} ${x === 1 ? one : many}`;

function figureLines(f: RepoReport["figures"][number]): string[] {
  const v = f.value;
  switch (f.id) {
    case "tenure":
      return [`${v.first} to ${v.last} (${n(v.days)} days)`];
    case "commitShare":
      return [`${n(v.author)} of ${n(v.total)} non-merge commits, ${pct(v.share)}`];
    case "cadence":
      return [
        `${v.activeWeeks} active weeks of ${v.weeksInTenure}, ${v.commitsPerActiveWeek} commits per active week, longest streak ${v.longestStreakWeeks} weeks`,
        `${v.authorTags} of ${v.tagsInTenure} release tags in tenure`,
      ];
    case "footprint": {
      const hidden = v.ownedDirectories.length > 0 && String(v.ownedDirectories[0].path).startsWith("(hidden");
      return [
        `${n(v.filesTouched)} files touched`,
        `${v.ownedDirectories.length} directories with a commit share at or above the threshold${hidden ? " (paths hidden; run with --paths)" : ""}`,
        ...(hidden ? [] : v.ownedDirectories.slice(0, 12).map((d: { path: string; author: number; total: number; share: number }) => `  ${d.path}: ${d.author} of ${d.total} commits, ${pct(d.share)}`)),
        "languages by lines added: " + (v.languages.length ? v.languages.map((l: { language: string; share: number }) => `${l.language} ${pct(l.share)}`).join(", ") : "none recognised"),
      ];
    }
    case "testsAndDocs":
      return [`${n(v.testChangesAuthor)} of ${n(v.testChangesTotal)} test-file changes, ${pct(v.testShare)}`, `${n(v.docsCreated)} documents created`];
    case "filesAuthored":
      return [`${n(v.authored)} of ${n(v.total)} files alive at HEAD, ${pct(v.share)} (degree of authorship)`];
    case "majorContributor":
      return [`major contributor in ${n(v.major)} of ${n(v.dirs)} directories (at least ${v.threshold * 100}% of commits)`];
    case "commitSize":
      return [`median ${n(v.median)} lines, 90th percentile ${n(v.p90)}, ${plural(v.huge, "commit", "commits")} over 10,000 lines`];
    case "coAuthored":
      return [`${plural(v.trailerCommits, "commit", "commits")} by others naming the author in a Co-authored-by trailer`];
    case "absenceFactor":
      return [`${n(v.authorsToHalf)} author${v.authorsToHalf === 1 ? "" : "s"} cover half the commits; the author ranks ${n(v.authorRank)} of ${n(v.authors)} by commit count`];
    case "aiAssisted":
      return [`${plural(v.commits, "commit declares", "commits declare")} an AI tool in a trailer, ${pct(v.share)} of the author's commits`];
    case "survivalByCohort":
      return v.length ? (v as { year: number; lines: number }[]).map((c) => `${c.year}: ${n(c.lines)} lines`) : ["no surviving lines in the sample"];
    case "survivingLines":
      return [`${n(v.lines)} of ${n(v.linesAttributed)} surviving lines, ${pct(v.share)} (files ${v.filesSampled}/${v.filesTotal}, sample 1 in ${v.sample}${v.seed ? `, seed "${v.seed}"` : ""})`];
    default:
      return [JSON.stringify(v)];
  }
}

type SplitRecord = NonNullable<Report["repositories"][number]["identity"]["possiblySplit"]>;

/** The paragraph about addresses that may be the subject. Without --emails the record holds no names, so it states a count only. */
function splitNotice(split: SplitRecord): string {
  const n = split.count ?? split.names.length;
  const reasons = split.reasons.map((r, i) => (i === 0 ? r.charAt(0).toUpperCase() + r.slice(1) : r)).join("; ");
  const tail = "Every figure below therefore describes only the work under the identities named above. If they are the same person, re-run with each address passed to `--author`, or merge them in a `.mailmap`.";
  if (split.names.length === 0) {
    return `**${plural(n, "other address", "other addresses")} in this repository may be the same person and ${n === 1 ? "was" : "were"} not counted here.** ${split.hint ?? ""} Why: ${reasons}. ${tail}`;
  }
  return `**${plural(n, "other identity", "other identities")} in this repository look${n === 1 ? "s" : ""} like the same person and ${n === 1 ? "was" : "were"} not counted here**: ${split.names.map(isolate).join(", ")}${split.emails?.length ? ` (${split.emails.join(", ")})` : ""}. ${reasons}. ${tail}`;
}

export function renderMarkdown(report: Report, narrative?: string): string {
  const out: string[] = [
    `# Engineering report`,
    ``,
    `Generated by workproof ${report.version} on ${report.generatedAt}. Every figure below names the command that produced it and what it cannot show. Verify with \`npx workproof verify <this report>.json\` in the same repository.`,
    ``,
  ];
  for (const repo of report.repositories) {
    out.push(
      `## ${isolate(repo.name)}`,
      ``,
      `HEAD \`${repo.head.slice(0, 12)}\` · fingerprint \`${repo.fingerprint.slice(0, 16)}\` · identities: ${repo.identity.names.map(isolate).join(", ")}${repo.identity.emails.length ? ` (${repo.identity.emails.join(", ")})` : ""}`,
      ``,
      ...(repo.identity.possiblySplit ? [splitNotice(repo.identity.possiblySplit), ``] : []),
      repo.excluded.enabled
        ? `excluded ${plural(repo.excluded.botCommits, "bot commit", "bot commits")} and ${plural(repo.excluded.files, "generated, vendored or lock file", "generated, vendored or lock files")} (${pct(repo.excluded.linesAddedShare)} of lines added)`
        : `exclusions off (--no-exclusions): bot commits and generated files are counted`,
      ``,
      `### In plain language`,
      ``,
      plainSummary(repo),
      ``,
      `That paragraph is assembled from the figures below by a fixed rule, with no model involved, so it says nothing the numbers do not.`,
      ``,
    );
    for (const f of repo.figures) {
      out.push(`### ${f.title}`, ``);
      for (const line of figureLines(f)) out.push(line.startsWith("  ") ? `- ${line.trim()}` : line);
      out.push(``, `How: \`${f.command}\``, ``, `What this cannot show: ${f.limits.join(" ")}`, ``);
    }
  }
  out.push(
    `## Integrity`,
    ``,
    `Report hash \`${report.hash}\` (sha256 over the RFC 8785 canonical JSON of parameters and figures; \`npx workproof check\` recomputes it offline). Repository fingerprints are keyed hashes of the root commit and remote; they identify a repository without naming it, and only someone holding the key printed when the report was made can compare them.`,
    ``,
  );
  if (narrative) {
    out.push(`## Generated narrative (not verified)`, ``, `The paragraph below was produced by a language model from the figures above and is not part of the hash.`, ``, narrative.trim(), ``);
  }
  return out.join("\n");
}
