import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { Report } from "./report.js";
import { verifyReport } from "./verify.js";
import { STATEMENT_TYPE, PAYLOAD_TYPE } from "./attest.js";
import type { DsseEnvelope } from "./attest.js";

/** The page that describes the predicate; docs/countersignature-v1.md in this repository. */
export const COUNTERSIGN_PREDICATE_TYPE = "https://github.com/Bubblegunn/workproof/blob/main/docs/countersignature-v1.md";
/** Not "workproof", the namespace attest --local signs in: a signature made for one purpose cannot be replayed as the other. */
export const COUNTERSIGN_NAMESPACE = "workproof-countersign";
export const COUNTERSIGN_CLAIM = "the figures of the subject report were recomputed from the signer's own clone of the same repository, at the same commit, and came out the same";

export const COUNTERSIGN_PROVES =
  "What a countersignature proves: the holder of that key ran workproof in their own clone of this repository, at the same commit and with the same repository fingerprint, and every figure in this report came out the same.";
export const COUNTERSIGN_DOES_NOT_PROVE =
  "What it does not prove: who holds the key (list keys you trust with --allowed-signers, for example the ones GitHub serves at https://github.com/<user>.keys), that the colleague and the author did not agree beforehand, that the history is honest, or that the figures measure anything worth measuring. A report with no countersignature is normal and is not suspect.";

export interface CountersignOptions {
  toolVersion: string;
  /** The key the author's run printed; the report does not carry it. */
  fingerprintKey?: string;
  /** What the signer calls themselves. Shown by check as unverified. */
  label?: string;
  /** ISO timestamp; defaults to now. */
  now?: string;
}

export interface CounterPredicate {
  tool: { name: "workproof"; version: string };
  countersignedAt: string;
  claim: typeof COUNTERSIGN_CLAIM;
  report: { hash: string; generatedAt: string; toolVersion: string };
  repositories: { head: string; fingerprint: string; figuresRecomputed: number }[];
  signer: { label?: string };
}

export interface CounterStatement {
  _type: typeof STATEMENT_TYPE;
  subject: { name: string; digest: { sha256: string } }[];
  predicateType: typeof COUNTERSIGN_PREDICATE_TYPE;
  predicate: CounterPredicate;
}

/** ssh-keygen with stdin closed (or fed `input`); never throws, never waits on a prompt. */
function ssh(args: string[], input?: Buffer): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = execFile("ssh-keygen", args, { encoding: "utf8" }, (err, stdout, stderr) => {
      if (err && (err as NodeJS.ErrnoException).code === "ENOENT") return resolve({ ok: false, stdout: "", stderr: "ssh-keygen was not found on PATH" });
      resolve({ ok: !err, stdout, stderr });
    });
    child.stdin?.on("error", () => {});
    child.stdin?.end(input);
  });
}

const firstLine = (text: string) => text.trim().split("\n")[0] ?? "";
const stem = (reportPath: string) => join(dirname(reportPath), basename(reportPath).replace(/\.json$/, ""));

/** "SHA256:..." for an OpenSSH public key line, computed the way ssh-keygen -l prints it. */
export function sshKeyFingerprint(publicKeyLine: string): string {
  const blob = publicKeyLine.trim().split(/\s+/)[1];
  if (!blob) throw new Error("not an OpenSSH public key line");
  return `SHA256:${createHash("sha256").update(Buffer.from(blob, "base64")).digest("base64").replace(/=+$/, "")}`;
}

/**
 * Recomputes every figure of the report from the signer's own clone and returns the statement to
 * sign. It throws, and signs nothing, unless the report checks, the fingerprint was compared and
 * matches, the clone is at the report's commit, and every figure came out the same.
 */
export async function countersignStatement(report: Report, repoDirs: string[], opts: CountersignOptions): Promise<CounterStatement> {
  const key = opts.fingerprintKey ?? report.params.fingerprintKey;
  if (key === undefined && report.repositories.some((r) => r.fingerprintKeyed === true)) {
    throw new Error(
      "this report's fingerprint is keyed, so countersign needs the key the author used: pass --fingerprint-key <hex> (the author's run printed it once). Without it the fingerprint is not compared, and the signature could not say this is the same repository.",
    );
  }
  const result = await verifyReport(report, repoDirs, key === undefined ? {} : { fingerprintKey: key });
  if (!result.integrity.ok) throw new Error(`refusing to countersign a report that does not check: ${result.integrity.problems[0]}`);
  const wrong = result.fingerprints.find((f) => !f.compared || !f.match);
  if (wrong) {
    throw new Error(`refusing to countersign: the fingerprint of ${wrong.repo} does not match this clone, so it is a different repository (or a different remote URL) than the one the report describes`);
  }
  if (result.headMoved.length) {
    throw new Error(`refusing to countersign: this clone is not at the commit the report was made at (${result.headMoved[0]}). Check out that commit and run again`);
  }
  const differ = result.rows.filter((r) => !r.match);
  if (differ.length) {
    throw new Error(`refusing to countersign: ${differ.length} of ${result.rows.length} figures differ in this clone, first ${differ[0]!.repo}/${differ[0]!.figure}`);
  }
  if (result.rows.length === 0) throw new Error("refusing to countersign: no figure was recomputed");
  return {
    _type: STATEMENT_TYPE,
    subject: [{ name: "workproof-report", digest: { sha256: report.hash } }],
    predicateType: COUNTERSIGN_PREDICATE_TYPE,
    predicate: {
      tool: { name: "workproof", version: opts.toolVersion },
      countersignedAt: opts.now ?? new Date().toISOString(),
      claim: COUNTERSIGN_CLAIM,
      report: { hash: report.hash, generatedAt: report.generatedAt, toolVersion: report.version },
      repositories: report.repositories.map((r) => ({
        head: r.head,
        fingerprint: r.fingerprint,
        figuresRecomputed: result.rows.filter((row) => row.repo === r.name).length,
      })),
      signer: opts.label === undefined ? {} : { label: opts.label },
    },
  };
}

/**
 * Writes the statement next to the report, signs it with ssh-keygen -Y sign in the countersign
 * namespace, keeps the detached .sig, and wraps both in a DSSE envelope. The file names carry the
 * first ten letters and digits of the key's fingerprint, so two colleagues never overwrite each other.
 */
export async function signCountersignature(
  statement: CounterStatement,
  reportPath: string,
  keyPath: string,
): Promise<{ statement: string; signature: string; envelope: string; keyFingerprint: string }> {
  const pub = await ssh(["-y", "-f", keyPath]);
  if (!pub.ok) throw new Error(`ssh-keygen -y failed: ${firstLine(pub.stderr) || "no output"}`);
  const keyFingerprint = sshKeyFingerprint(pub.stdout);
  const id = keyFingerprint.slice("SHA256:".length).replace(/[^A-Za-z0-9]/g, "").slice(0, 10);
  // Absolute, so a report named "-r.json" cannot make ssh-keygen read the statement path as an option.
  const base = resolve(`${stem(reportPath)}.countersign-${id}`);
  const statementPath = `${base}.intoto.json`;
  await writeFile(statementPath, JSON.stringify(statement, null, 2) + "\n");
  const signature = `${statementPath}.sig`;
  await rm(signature, { force: true });
  const signed = await ssh(["-Y", "sign", "-f", keyPath, "-n", COUNTERSIGN_NAMESPACE, statementPath]);
  if (!signed.ok) throw new Error(`ssh-keygen -Y sign failed: ${firstLine(signed.stderr) || "no output"}`);
  const envelope: DsseEnvelope = {
    payloadType: PAYLOAD_TYPE,
    payload: (await readFile(statementPath)).toString("base64"),
    signatures: [{ keyid: keyFingerprint, sig: (await readFile(signature)).toString("base64") }],
  };
  const envelopePath = `${base}.dsse.json`;
  await writeFile(envelopePath, JSON.stringify(envelope, null, 2) + "\n");
  return { statement: statementPath, signature, envelope: envelopePath, keyFingerprint };
}

export interface CountersignatureReading {
  file: string;
  ok: boolean;
  problems: string[];
  keyType?: string;
  keyFingerprint?: string;
  /** The name the reader's own allowed_signers file gives the key; absent when no file was given. */
  principal?: string;
  /** What the signer called themselves. Not verified. */
  label?: string;
  countersignedAt?: string;
}

/**
 * Reads a countersignature envelope against a report: the statement must be about this report's hash,
 * commit and fingerprint, and the signature must verify over exactly the statement bytes in the
 * countersign namespace. With allowedSigners, the key must also be listed there.
 */
export async function readCountersignature(envelopePath: string, report: Report, opts: { allowedSigners?: string } = {}): Promise<CountersignatureReading> {
  const out: CountersignatureReading = { file: envelopePath, ok: false, problems: [] };
  let env: DsseEnvelope;
  try {
    env = JSON.parse(await readFile(envelopePath, "utf8")) as DsseEnvelope;
  } catch (e) {
    out.problems.push(`cannot read the envelope: ${e instanceof Error ? e.message : String(e)}`);
    return out;
  }
  const sig = env?.signatures?.[0]?.sig;
  if (env?.payloadType !== PAYLOAD_TYPE || typeof env.payload !== "string" || typeof sig !== "string") {
    out.problems.push("this is not a workproof countersignature envelope");
    return out;
  }
  const payload = Buffer.from(env.payload, "base64");
  let statement: CounterStatement;
  try {
    statement = JSON.parse(payload.toString("utf8")) as CounterStatement;
  } catch {
    out.problems.push("the envelope payload is not JSON");
    return out;
  }
  if (statement.predicateType !== COUNTERSIGN_PREDICATE_TYPE) out.problems.push("the statement is not a workproof countersignature");
  if (statement.subject?.[0]?.digest?.sha256 !== report.hash) {
    out.problems.push(`it signs report ${String(statement.subject?.[0]?.digest?.sha256).slice(0, 16)}, not this report ${report.hash.slice(0, 16)}`);
  }
  const p = statement.predicate;
  if (p?.claim !== COUNTERSIGN_CLAIM) out.problems.push("the statement makes a different claim than a workproof countersignature");
  const signed = p?.repositories ?? [];
  if (signed.length !== report.repositories.length) out.problems.push("the statement covers a different number of repositories than this report");
  report.repositories.forEach((r, i) => {
    if (signed[i]?.head !== r.head || signed[i]?.fingerprint !== r.fingerprint) out.problems.push(`repository ${i + 1}: the signed commit or fingerprint differs from this report's`);
  });
  if (typeof p?.signer?.label === "string") out.label = p.signer.label;
  if (typeof p?.countersignedAt === "string") out.countersignedAt = p.countersignedAt;

  const dir = await mkdtemp(join(tmpdir(), "workproof-sig-"));
  try {
    const sigPath = join(dir, "countersignature.sig");
    await writeFile(sigPath, Buffer.from(sig, "base64"));
    const checked = await ssh(["-Y", "check-novalidate", "-n", COUNTERSIGN_NAMESPACE, "-s", sigPath], payload);
    if (!checked.ok) {
      out.problems.push(`the signature does not match the statement: ${firstLine(checked.stderr || checked.stdout)}`);
    } else {
      const m = /signature with (\S+) key (SHA256:\S+)/.exec(checked.stdout);
      if (m) {
        out.keyType = m[1]!;
        out.keyFingerprint = m[2]!;
      }
      if (opts.allowedSigners !== undefined) {
        const found = await ssh(["-Y", "find-principals", "-f", opts.allowedSigners, "-s", sigPath]);
        const principal = firstLine(found.stdout);
        if (!found.ok || !principal) {
          out.problems.push(`the signing key is not listed in ${opts.allowedSigners}`);
        } else {
          const verified = await ssh(["-Y", "verify", "-f", opts.allowedSigners, "-I", principal, "-n", COUNTERSIGN_NAMESPACE, "-s", sigPath], payload);
          if (verified.ok) out.principal = principal;
          else out.problems.push(`the key is listed as ${principal} in ${opts.allowedSigners}, but the signature did not verify for that entry: ${firstLine(verified.stderr)}`);
        }
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  out.ok = out.problems.length === 0;
  return out;
}
