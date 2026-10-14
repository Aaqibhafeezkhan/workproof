import { execFile } from "node:child_process";
import { readFile, writeFile, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { Report } from "./report.js";
import { checkReport } from "./verify.js";

/** ssh-keygen asks on stdin before overwriting a signature; stdin is closed so it can never wait. */
const run = (cmd: string, args: string[]) =>
  new Promise<string>((resolve, reject) => {
    const child = execFile(cmd, args, { encoding: "utf8" }, (err, stdout, stderr) => (err ? reject(new Error(`${cmd} ${args[0]} ${args[1]} failed: ${String(stderr || err.message).trim()}`)) : resolve(stdout)));
    child.stdin?.end();
  });

export const STATEMENT_TYPE = "https://in-toto.io/Statement/v1";
/**
 * A URI the project controls, describing the predicate. Statements written before 0.6.0 carry a
 * predicate type on a domain the project never registered (CHANGELOG 0.6.0 names it); nothing in
 * check or verify reads a statement, so those older statements and their reports still check.
 */
export const PREDICATE_TYPE = "https://github.com/Bubblegunn/workproof/blob/main/docs/attestation-v1.md";
export const PAYLOAD_TYPE = "application/vnd.in-toto+json";

export interface InTotoStatement {
  _type: typeof STATEMENT_TYPE;
  subject: { name: string; digest: { sha256: string } }[];
  predicateType: typeof PREDICATE_TYPE;
  predicate: Predicate;
}

export interface Predicate {
  tool: { name: "workproof"; version: string };
  generatedAt: string;
  params: Record<string, unknown>;
  repositories: {
    head: string;
    fingerprint: string;
    fingerprintKeyed: boolean;
    identity: { names: string[] };
    environment: Report["repositories"][number]["environment"];
    excluded: Report["repositories"][number]["excluded"];
  }[];
}

/**
 * The predicate says what was measured and under which environment, nothing more: no
 * figures (they are behind the subject digest), no remote URL, no paths of any kind.
 */
export function predicateFor(report: Report): Predicate {
  const { ignoreRevsFile: _ignore, ...params } = report.params as unknown as Record<string, unknown>;
  return {
    tool: { name: "workproof", version: report.version },
    generatedAt: report.generatedAt,
    params,
    repositories: report.repositories.map((r) => ({
      head: r.head,
      fingerprint: r.fingerprint,
      fingerprintKeyed: r.fingerprintKeyed === true,
      identity: { names: r.identity.names },
      environment: r.environment,
      excluded: r.excluded,
    })),
  };
}

/** An in-toto v1 Statement whose subject is the report's own hash. */
export function statementFor(report: Report): InTotoStatement {
  const integrity = checkReport(report);
  if (!integrity.ok) throw new Error(`refusing to attest a report that does not check: ${integrity.problems[0]}`);
  return {
    _type: STATEMENT_TYPE,
    subject: [{ name: "workproof-report", digest: { sha256: report.hash } }],
    predicateType: PREDICATE_TYPE,
    predicate: predicateFor(report),
  };
}

const stem = (reportPath: string) => join(dirname(reportPath), basename(reportPath).replace(/\.json$/, ""));

/** Writes <basename>.intoto.json and <basename>.predicate.json next to the report. */
export async function writeStatement(reportPath: string): Promise<{ statement: string; predicate: string }> {
  const report = JSON.parse(await readFile(reportPath, "utf8")) as Report;
  const statement = statementFor(report);
  const paths = { statement: `${stem(reportPath)}.intoto.json`, predicate: `${stem(reportPath)}.predicate.json` };
  await writeFile(paths.statement, JSON.stringify(statement, null, 2) + "\n");
  await writeFile(paths.predicate, JSON.stringify(statement.predicate, null, 2) + "\n");
  return paths;
}

export interface DsseEnvelope { payloadType: typeof PAYLOAD_TYPE; payload: string; signatures: { keyid: string; sig: string }[] }

/**
 * Signs the statement with an SSH key (ssh-keygen -Y sign, namespace "workproof"), keeps
 * the detached .sig ssh-keygen wrote, and wraps both in a DSSE envelope as
 * <basename>.dsse.json. The signature covers the statement bytes as written.
 */
export async function signLocal(statementPath: string, keyPath: string): Promise<{ signature: string; envelope: string }> {
  const signature = `${statementPath}.sig`;
  await rm(signature, { force: true });
  await run("ssh-keygen", ["-Y", "sign", "-f", keyPath, "-n", "workproof", statementPath]);
  const envelope: DsseEnvelope = {
    payloadType: PAYLOAD_TYPE,
    payload: (await readFile(statementPath)).toString("base64"),
    signatures: [{ keyid: "ssh", sig: (await readFile(signature)).toString("base64") }],
  };
  const envelopePath = statementPath.replace(/\.intoto\.json$/, ".dsse.json");
  await writeFile(envelopePath, JSON.stringify(envelope, null, 2) + "\n");
  return { signature, envelope: envelopePath };
}
