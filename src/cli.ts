#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { analyseRepo, buildReport, renderMarkdown, verifyReport, checkReport, narrate, badgeFor, newFingerprintKey, writeStatement, signLocal, countersignStatement, signCountersignature, readCountersignature, COUNTERSIGN_PROVES, COUNTERSIGN_DOES_NOT_PROVE, cardFor } from "./index.js";
import type { Params, Report, RepoReport, CountersignatureReading } from "./index.js";

const HELP = `usage: workproof [options] [--repo <dir>]...
       workproof check <report.json> [--countersign <file.dsse.json>]... [--allowed-signers <file>]
       workproof countersign <report.json> --key <ssh-key> [--repo <dir>] [--fingerprint-key <hex>] [--as <label>]
       workproof verify <report.json> [--repo <dir>]... [--fingerprint-key <hex>]
       workproof attest <report.json> [--local <ssh-key>]

Turn a git repository into a verifiable engineering report for one author, without showing code.

  --author <email|name>  identity to report on (repeatable; default: git config user.email)
  --repo <dir>           repository to analyse (repeatable; default: current directory)
  --since / --until      override the tenure window (dates git understands)
  --sample <n>           blame every n-th file (default: 1, or 7 for very large repositories)
  --max-commits <n>      read only the newest n commits (escape hatch for enormous histories)
  --depth <n>            directory depth for ownership (default: 2)
  --no-exclusions        count bot commits and generated, vendored, lock and snapshot files
  --exclude <glob>       also drop files matching the glob (repeatable)
  --seed <text>          salt for the blame file sample
  --copies               pass -C to git blame so copied lines follow their origin
  --ignore-revs-file <f> blame ignore-revs file (default: .git-blame-ignore-revs at the root)
  --fingerprint-key <hex> reuse a fingerprint key so two reports of one repository match
  --paths                include directory paths in the report (off by default)
  --emails               include author emails in the report (off by default)
  --narrate              append a model-written paragraph; needs WORKPROOF_API_URL, WORKPROOF_API_KEY, WORKPROOF_MODEL
  --badge                also write <out>.badge.json, a shields.io endpoint document
  --card                 write light and dark SVG cards alongside the report
  --out <basename>       output basename (default: workproof-report)
  --format <mode>        output markdown, json, or both (default: both)
  --json                 print the JSON to stdout instead of writing files (legacy alias)
  -h, --help             this text
  --version              print the version

check validates the document and recomputes its hash offline; verify does that, then
compares the fingerprint and HEAD and recomputes every figure in the repository; attest
writes an in-toto statement whose subject is the report hash, and with --local signs it
with ssh-keygen -Y sign (namespace workproof) into a DSSE envelope. countersign is run by a second
person in their own clone of the same repository: it recomputes every figure, refuses unless they
all match, and signs a statement about the report with --key (namespace workproof-countersign);
check --countersign reads that file and says who signed and what that does and does not prove.`;

type OutputFormat = "both" | "markdown" | "json";

interface Cli { params: Params; repos: string[]; out: string; format: OutputFormat; json: boolean; doNarrate: boolean; badge: boolean; card: boolean; verifyFile: string | undefined; checkFile: string | undefined; attestFile: string | undefined; localKey: string | undefined; countersignFile: string | undefined; signKey: string | undefined; signLabel: string | undefined; countersigns: string[]; allowedSigners: string | undefined }

export function parse(argv: string[]): Cli {
  const params: Params = { depth: 2, threshold: 0.5, minCommits: 5, paths: false, emails: false, exclusions: true, exclude: [], seed: "", copies: false };
  const repos: string[] = [];
  const authors: string[] = [];
  let out = "workproof-report";
  let format: OutputFormat = "both";
  let json = false;
  let doNarrate = false;
  let badge = false;
  let card = false;
  let verifyFile: string | undefined;
  let checkFile: string | undefined;
  let attestFile: string | undefined;
  let localKey: string | undefined;
  let countersignFile: string | undefined;
  let signKey: string | undefined;
  let signLabel: string | undefined;
  const countersigns: string[] = [];
  let allowedSigners: string | undefined;
  if (argv[0] === "attest") {
    attestFile = argv[1];
    if (!attestFile) throw new Error("attest needs a report.json");
    argv = argv.slice(2);
    if (argv[0] === "--local") {
      localKey = argv[1];
      if (!localKey) throw new Error("--local needs an ssh private key path");
      argv = argv.slice(2);
    }
    if (argv.length) throw new Error(`unknown option ${argv[0]} (attest takes only --local <ssh-key>)`);
  }
  if (argv[0] === "check") {
    checkFile = argv[1];
    if (!checkFile) throw new Error("check needs a report.json");
    const rest = argv.slice(2);
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i]!;
      const value = () => {
        const v = rest[++i];
        if (v === undefined) throw new Error(`${a} needs a value`);
        return v;
      };
      if (a === "--countersign") countersigns.push(value());
      else if (a === "--allowed-signers") allowedSigners = value();
      else throw new Error("check takes only the report, --countersign and --allowed-signers; it never reads a repository");
    }
    argv = [];
  }
  if (argv[0] === "countersign") {
    countersignFile = argv[1];
    if (!countersignFile) throw new Error("countersign needs a report.json");
    argv = argv.slice(2);
  }
  if (argv[0] === "verify") {
    verifyFile = argv[1];
    if (!verifyFile) throw new Error("verify needs a report.json");
    argv = argv.slice(2);
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--author") authors.push(next());
    else if (a === "--repo") repos.push(resolve(next()));
    else if (a === "--since") params.since = next();
    else if (a === "--until") params.until = next();
    else if (a === "--sample") params.sample = Number(next());
    else if (a === "--max-commits") { params.maxCommits = Number(next()); if (!Number.isInteger(params.maxCommits) || params.maxCommits < 1) throw new Error("--max-commits must be an integer >= 1"); }
    else if (a === "--depth") params.depth = Number(next());
    else if (a === "--no-exclusions") params.exclusions = false;
    else if (a === "--exclude") params.exclude!.push(next());
    else if (a === "--seed") params.seed = next();
    else if (a === "--copies") params.copies = true;
    else if (a === "--ignore-revs-file") params.ignoreRevsFile = next();
    else if (a === "--fingerprint-key") params.fingerprintKey = next();
    else if (a === "--paths") params.paths = true;
    else if (a === "--emails") params.emails = true;
    else if (a === "--key") signKey = next();
    else if (a === "--as") signLabel = next();
    else if (a === "--narrate") doNarrate = true;
    else if (a === "--badge") badge = true;
    else if (a === "--card") card = true;
    else if (a === "--out") out = next();
    else if (a === "--format") {
      const value = next();
      if (value !== "both" && value !== "markdown" && value !== "json") throw new Error("--format must be markdown, json, or both");
      format = value;
    }
    else if (a === "--json") { json = true; format = "json"; }
    else if (a === "-h" || a === "--help") {
      console.log(HELP);
      process.exit(0);
    } else throw new Error(`unknown option ${a} (see --help)`);
  }
  if ((signKey !== undefined || signLabel !== undefined) && !countersignFile) throw new Error("--key and --as belong to countersign");
  if (countersignFile && !signKey) throw new Error("countersign needs --key <ssh private key>");
  if (authors.length) params.author = authors;
  if (!repos.length) repos.push(process.cwd());
  return { params, repos, out, format, json, doNarrate, badge, card, verifyFile, checkFile, attestFile, localKey, countersignFile, signKey, signLabel, countersigns, allowedSigners };
}

async function main() {
  if (process.argv.includes("--version")) {
    console.log(createRequire(import.meta.url)("../../package.json").version as string);
    return;
  }
  const started = Date.now();
  const { params, repos, out, format, json, doNarrate, badge, card, verifyFile, checkFile, attestFile, localKey, countersignFile, signKey, signLabel, countersigns, allowedSigners } = parse(process.argv.slice(2));
  if (card && format !== "both") throw new Error("--card requires --format both");

  const progress = (m: string) => process.stderr.write(`${m}\n`);
  const printIntegrity = (i: ReturnType<typeof checkReport>) => {
    const schemaProblems = i.problems.filter((p) => !p.startsWith("hash mismatch"));
    console.log(schemaProblems.length ? `schema: ${schemaProblems.length} problem${schemaProblems.length === 1 ? "" : "s"}` : "schema ok");
    for (const p of schemaProblems) console.log(`  ${p}`);
    if (!schemaProblems.length) console.log(i.ok ? `hash ok ${i.hash.computed}` : i.problems.find((p) => p.startsWith("hash mismatch"))!);
  };
  const printCountersignature = (r: CountersignatureReading, listed: boolean) => {
    console.log(`countersignature ${r.file}`);
    if (r.keyFingerprint) {
      const trust = r.principal ? `, listed in your allowed signers as ${r.principal}` : listed ? "" : ", not checked against any list of keys you trust (pass --allowed-signers)";
      console.log(`  signed with key type ${r.keyType ?? "unknown"}, ${r.keyFingerprint}${trust}`);
    }
    if (r.label !== undefined) console.log(`  the signer's own label, not verified: ${JSON.stringify(r.label)}`);
    if (r.countersignedAt !== undefined) console.log(`  countersigned at ${r.countersignedAt}`);
    console.log(r.ok ? "  signature valid and bound to this report" : "  NOT VALID");
    for (const p of r.problems) console.log(`  ${p}`);
  };
  if (countersignFile) {
    const report = JSON.parse(await readFile(countersignFile, "utf8")) as Report;
    const toolVersion = createRequire(import.meta.url)("../../package.json").version as string;
    const statement = await countersignStatement(report, repos, {
      toolVersion,
      ...(params.fingerprintKey ? { fingerprintKey: params.fingerprintKey } : {}),
      ...(signLabel ? { label: signLabel } : {}),
    });
    const written = await signCountersignature(statement, countersignFile, signKey!);
    console.log(`wrote ${written.statement}, ${written.signature} and ${written.envelope}`);
    console.log(`Send back only the .dsse.json file: ${written.envelope}`);
    console.log(`\n${COUNTERSIGN_PROVES}\n${COUNTERSIGN_DOES_NOT_PROVE}`);
    return;
  }
  if (attestFile) {
    const { statement, predicate } = await writeStatement(attestFile);
    const files = [statement, predicate];
    if (localKey) {
      const { signature, envelope } = await signLocal(statement, localKey);
      files.push(signature, envelope);
    }
    console.log(`wrote ${files.slice(0, -1).join(", ")} and ${files[files.length - 1]}`);
    return;
  }
  if (checkFile) {
    const checked = JSON.parse(await readFile(checkFile, "utf8")) as Report;
    const result = checkReport(checked);
    printIntegrity(result);
    let failed = !result.ok;
    if (countersigns.length) {
      if (!result.ok) {
        console.log("countersignatures were not read: the report itself does not check");
      } else {
        for (const file of countersigns) {
          const reading = await readCountersignature(file, checked, allowedSigners === undefined ? {} : { allowedSigners });
          printCountersignature(reading, allowedSigners !== undefined);
          if (!reading.ok) failed = true;
        }
        console.log(`\n${COUNTERSIGN_PROVES}\n${COUNTERSIGN_DOES_NOT_PROVE}`);
      }
    }
    process.exit(failed ? 1 : 0);
  }
  if (verifyFile) {
    const report = JSON.parse(await readFile(verifyFile, "utf8")) as Report;
    const result = await verifyReport(report, repos, params.fingerprintKey ? { fingerprintKey: params.fingerprintKey } : {});
    printIntegrity(result.integrity);
    if (!result.integrity.ok) {
      console.log("the report was edited or damaged after it was written; figures were not recomputed");
      process.exit(1);
    }
    for (const f of result.fingerprints) {
      if (!f.compared) console.log(`${f.repo}: fingerprint not compared (pass --fingerprint-key)`);
      else if (!f.match) console.log(`${f.repo}: fingerprint differs; this is a different repository, figures were not recomputed`);
      else console.log(`${f.repo}: fingerprint ok`);
    }
    for (const h of result.headMoved) console.log(`HEAD moved: ${h}`);
    for (const r of result.rows) if (!r.match) console.log(`mismatch ${r.repo}/${r.figure}\n  report:     ${r.expected}\n  repository: ${r.actual}`);
    const differ = result.rows.filter((r) => !r.match).length;
    if (result.fingerprints.some((f) => f.compared && !f.match)) process.exit(1);
    console.log(result.ok ? "all figures reproduce" : `${differ} figures differ`);
    console.log(
      result.ok
        ? "\nWhat this proves: every figure in the report was recomputed from this repository just now and came out the same, and the document has not been edited since it was written.\nWhat it does not prove: that the repository itself is honest history, that the figures measure anything worth measuring, or that the work was good. A repository whose history was rewritten before the report was made reproduces perfectly."
        : "\nA figure that differs is not proof of dishonesty. HEAD moves, and every figure except tenure is computed at HEAD; check the HEAD line above before concluding anything.",
    );
    process.exit(result.ok ? 0 : 1);
  }
  const version = createRequire(import.meta.url)("../../package.json").version as string;
  if (!params.fingerprintKey) {
    // One key per report, so the repositories in a combined report share it; printed once, stored nowhere.
    params.fingerprintKey = newFingerprintKey();
    progress(`fingerprint key ${params.fingerprintKey} (keep it to compare reports or to verify the fingerprint; it is not stored)`);
  }
  const repositories: RepoReport[] = [];
  for (const dir of repos) repositories.push(await analyseRepo(dir, params, { progress }));
  const report = buildReport(repositories, params, { version, generatedAt: new Date().toISOString() });
  let narrative: string | undefined;
  if (doNarrate) {
    const url = process.env.WORKPROOF_API_URL;
    const key = process.env.WORKPROOF_API_KEY;
    const model = process.env.WORKPROOF_MODEL;
    if (!url || !key || !model) throw new Error("--narrate needs WORKPROOF_API_URL, WORKPROOF_API_KEY and WORKPROOF_MODEL");
    narrative = await narrate(report, { url, key, model });
  }
  if (format === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const written: string[] = [];
  if (format === "markdown" || format === "both") {
    await writeFile(`${out}.md`, renderMarkdown(report, narrative));
    written.push(`${out}.md`);
  }
  if (format === "both") {
    await writeFile(`${out}.json`, JSON.stringify(report, null, 2));
    written.push(`${out}.json`);
  }
  if (badge) {
    await writeFile(`${out}.badge.json`, JSON.stringify(badgeFor(report), null, 2));
    written.push(`${out}.badge.json`);
  }
  if (card) {
    const reportFilename = basename(`${out}.json`);
    await writeFile(`${out}.card.svg`, cardFor(report, "light", reportFilename));
    await writeFile(`${out}.card-dark.svg`, cardFor(report, "dark", reportFilename));
    written.push(`${out}.card.svg`, `${out}.card-dark.svg`);
  }

  for (const repo of report.repositories) {
    const split = repo.identity.possiblySplit;
    if (!split) continue;
    const n = split.count ?? split.names.length;
    const who = split.names.length ? ` (${split.names.join(", ")})` : ` ${split.hint ?? ""}`;
    progress(`${repo.name}: warning, ${n} other ${n === 1 ? "address" : "addresses"} in this repository may be the same person and ${n === 1 ? "is" : "are"} not in these figures${who}. Pass every address to --author, or merge them in a .mailmap.`);
  }
  console.log(`wrote ${written.join(" and ")} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entry === import.meta.url || entry.endsWith("/workproof")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
