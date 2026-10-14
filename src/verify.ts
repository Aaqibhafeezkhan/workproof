import { analyseRepo, fingerprint } from "./analyse.js";
import { headSha, rootCommit, remoteUrl, assertRepository, assertNotShallow } from "./git.js";
import { hashOf } from "./report.js";
import { validateReport } from "./schema.js";
import type { Report } from "./report.js";

const show = (v: unknown) => JSON.stringify(v);

export interface VerifyRow { repo: string; figure: string; match: boolean; expected: string; actual: string }

export interface Integrity { ok: boolean; problems: string[]; hash: { stated: string; computed: string } }

/**
 * Offline: does the document have the 0.2 shape, and does its content hash to the hash it
 * states? No git, no repository. An edited report fails here before anything is recomputed.
 */
export function checkReport(report: unknown): Integrity {
  const problems = validateReport(report);
  const r = report as Partial<Report>;
  const stated = typeof r?.hash === "string" ? r.hash : "";
  let computed = "";
  if (problems.length === 0) {
    computed = hashOf(r.params, r.repositories);
    if (computed !== stated) problems.push(`hash mismatch: report says ${stated}, content hashes to ${computed}`);
  }
  return { ok: problems.length === 0, problems, hash: { stated, computed } };
}

export interface VerifyResult {
  ok: boolean;
  integrity: Integrity;
  /** Per repository: whether the fingerprint was compared, and whether it matched. */
  fingerprints: { repo: string; compared: boolean; match: boolean }[];
  rows: VerifyRow[];
  headMoved: string[];
}

/**
 * check first, then the repository: fingerprint and HEAD, then every figure recomputed
 * and compared. A fingerprint mismatch is a different repository and stops before figures.
 */
export async function verifyReport(report: Report, repoDirs: string[], opts: { fingerprintKey?: string } = {}): Promise<VerifyResult> {
  const integrity = checkReport(report);
  const rows: VerifyRow[] = [];
  const headMoved: string[] = [];
  const fingerprints: VerifyResult["fingerprints"] = [];
  if (!integrity.ok) return { ok: false, integrity, fingerprints, rows, headMoved };
  for (const [i, expected] of report.repositories.entries()) {
    const dir = repoDirs[i] ?? repoDirs[0] ?? process.cwd();
    // Before the fingerprint: a shallow clone's root is its boundary commit, so the fingerprint
    // would differ and the message would wrongly say it is a different repository.
    await assertRepository(dir);
    await assertNotShallow(dir);
    const key = opts.fingerprintKey ?? report.params.fingerprintKey;
    const compared = !expected.fingerprintKeyed || key !== undefined;
    const match = compared ? fingerprint(await rootCommit(dir), await remoteUrl(dir), expected.fingerprintKeyed ? key : undefined) === expected.fingerprint : false;
    fingerprints.push({ repo: expected.name, compared, match });
    if (compared && !match) continue;
    const head = await headSha(dir);
    if (head !== expected.head) headMoved.push(`${expected.name}: report at ${expected.head.slice(0, 12)}, repository at ${head.slice(0, 12)}`);
    // Emails are hidden from the report by default, so resolve the identity from what it does carry.
    const author = expected.identity.emails.length ? expected.identity.emails : expected.identity.names;
    const actual = await analyseRepo(dir, { ...report.params, author, ...(key ? { fingerprintKey: key } : {}) });
    for (const f of expected.figures) {
      const a = actual.figures.find((x) => x.id === f.id);
      const e = show(f.value);
      const g = show(a?.value);
      rows.push({ repo: expected.name, figure: f.id, match: e === g, expected: e, actual: g });
    }
  }
  const ok = fingerprints.every((f) => !f.compared || f.match) && rows.every((r) => r.match) && headMoved.length === 0;
  return { ok, integrity, fingerprints, rows, headMoved };
}
