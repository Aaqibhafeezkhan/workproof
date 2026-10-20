# Threat model

workproof makes a security-shaped claim: a reader can decide how far to trust figures about work in a
repository they cannot see. This page says, in order, what is protected, from whom, what each command
guarantees, and what none of them does. Every statement points at the code or the test that backs it.
Where the honest answer is "this does not protect against that", it says so in those words.

## What is being protected

Two things.

1. **A reader's decision.** Someone deciding whether to believe a number about another person's work in a
   private repository: a hiring manager, a caseworker, a client. They can see the report and nothing else.
2. **The author's privacy.** The code, the file paths, the email addresses and the identity of the
   repository stay out of the report by default (`src/analyse.ts`, `src/report.ts`). The defaults have
   gaps, listed under Privacy defaults.

The tool is not a productivity metric and does not rank people. It reports what survived and what was
touched, with the git command and the limits under every figure.

## Who the adversaries are

- **The report author** is the main adversary. They generate the report from a repository only they can see,
  they have every incentive to inflate it, and they control every input: the repository, the author
  identity, the flags and the file the reader receives. This is named as the adversary rather than implied.
- **The reader** is not malicious but cannot see the repository. The risk is over-trust: reading "hash ok"
  as "this is true".
- **A colluding colleague** who countersigns a report they have agreed to.
- **A third party who holds the report file** and wants to learn about the repository or the person
  (privacy).
- **A model provider** that receives figures when `--narrate` is used.
- **Someone editing the file in transit**, between the author and the reader.

## check

`workproof check report.json` checks the shape of the document by hand, with no dependency and no network
(`validateReport` in `src/schema.ts`; the same shape is published as `schema/report.schema.json` for other
tools), then recomputes the hash (`checkReport` in `src/verify.ts`, `hashOf` in `src/report.ts`, the
canonical JSON in `src/canonical.ts`). It runs no git command.

**Proves.** The file has the report shape and its content hashes to the hash it states. An edited figure that
leaves the stated hash alone is caught, and the message names both hashes (`test/integrity.test.ts`).

**Does not protect against.** An edit by someone who also recomputes the hash. The hash is a checksum, not a
signature, and recomputing it needs no secret. `test/threat-model.test.ts` edits a figure, recomputes the
hash, and shows `check` still passes. `check` also does not protect against a report generated from a
repository that was made up or rewritten (see Rewritten history). It says nothing about the Markdown file:
only the JSON is hashed, so a reader handed only `workproof-report.md` has nothing to check.

## verify

`workproof verify report.json` runs the `check` steps first. Then, for each repository, it compares the
repository fingerprint (only when the verifier passes the key with `--fingerprint-key`; a published report
does not carry it), compares HEAD, recomputes every figure from the repository in front of the verifier and
prints what differs (`verifyReport` in `src/verify.ts`, the output in `src/cli.ts`).

**Proves.** Every figure was recomputed from the repository the verifier pointed at, at that moment, and came
out the same, and the document was not edited since it was written. Edited figures, a different repository (at
the fingerprint) and a moved HEAD are each reported separately (`test/integrity.test.ts`, `test/cli.test.ts`).
The "same repository" part holds only when the fingerprint was compared. Without a key, `verify` prints
"fingerprint not compared" and still recomputes the figures from whatever repository it was given.

**Does not protect against.** A repository whose history was rewritten before the report was made: it
reproduces perfectly. It does not protect against a repository fabricated for the purpose, against a verifier
who does not have the repository (the usual case for a reader), against a verifier who trusts the author's
copy of the repository because the author supplied it, or against a verifier who runs without the fingerprint
key, in which case the repository identity is not checked at all.

## attest

`workproof attest report.json` writes an in-toto statement whose subject is the report hash and a separate
predicate file. With `--local <ssh-key>` it signs the statement with `ssh-keygen -Y sign` in the `workproof`
namespace. In the GitHub Action, `attest: "true"` runs `cosign attest-blob` over the report file, with the
predicate file as its predicate, to produce a keyless Sigstore bundle. The Action does not sign the in-toto
statement that `attest` writes; its subject is the digest of the report file bytes, not the report hash
(`src/attest.ts`, `action.yml`, `docs/attestation-v1.md`, `test/attest.test.ts`).

**Proves.** For a local signature: the statement, and through its subject digest the report hash, has not
changed since the key signed it. For a Sigstore bundle: the report file and its predicate were signed by the
keyless identity of a workflow run, and the certificate names the repository the run belonged to. The
predicate carries no figures, no paths, no remote URL, and by default no email addresses (`test/attest.test.ts`).
It does carry the subject's author names (`identity.names`) and the parameters the report was made with.

**Does not protect against.** A signer who signs a dishonest report: a signature binds a key to a document,
not the document to the truth. It does not protect against a stolen or borrowed key. It does not say whose
key it is unless the reader obtains the public key from a channel they trust, such as the keys GitHub serves
at `https://github.com/<user>.keys`. With Sigstore it does not protect against a workflow that was dishonest
about which repository it checked out. The Fulcio certificate names the repository and the Rekor transparency
log entry is public and permanent, so a private repository's name must not be signed in public.

## countersign

`workproof countersign report.json --key <ssh-key>` is run by a second person in their own full clone. It
recomputes every figure with the code `verify` uses, refuses unless the report checks, the keyed fingerprint
matches, the clone is at the report's commit and every figure is equal, and then signs a statement in the
`workproof-countersign` namespace (`src/countersign.ts`, `docs/countersignature-v1.md`,
`test/countersign.test.ts`).

**Proves.** Someone holding that key ran workproof in their own clone of the same repository, at the same
commit, and got the same figures. It is the one command here that checks the report against another human
being. A consistent forgery (a figure edited and the hash recomputed, which `check` accepts) is refused
because the colleague's clone gives different figures (`test/countersign.test.ts`).

**Does not protect against.** Collusion. Two people who agree beforehand can build a repository that never
existed, and both can countersign it. It does not protect against a colleague who never saw the real history,
against a key whose owner the reader cannot identify (`check --allowed-signers` names a person only for keys
the reader lists), or against a colleague who shares an employer, a grudge or a household with the author.
It does not prove that the history is honest or that the figures measure anything worth measuring. A report
with no countersignature is normal and is not suspect.

## What the hash covers

The hash is sha256 over the RFC 8785 canonical JSON of `{ params, repositories }` (`hashOf` in
`src/report.ts`; the serialisation in `src/canonical.ts`).

- **In the hash:** the parameters (without the fingerprint key), every figure with its command and limits, the
  fingerprint, the HEAD commit, the exclusion counts, the identity (names, emails when written, and the
  possible-split record), and the blame environment (flags, ignore-revs file name, sample seed).
- **Out of the hash, on purpose:** the repository's local directory name and the local git version. They
  stayed in until 0.4.0, and the same repository in a folder with a different name hashed differently.
  `forHash` in `src/report.ts` removes them, and `test/integrity.test.ts` and `scripts/hash-reproducibility.mjs`
  pin that the hash does not depend on the machine.
- **Out of the hash, and not on purpose to hide anything:** `generatedAt`, the tool `version`, the `hash`
  field itself, the optional narrative paragraph and the Markdown rendering. Editing `generatedAt` or
  `version` passes `check` (`test/threat-model.test.ts`). The timestamp is therefore the author's own
  clock and it does not protect against a back-dated report, unless a Sigstore attestation adds a log time.

## The fingerprint

The fingerprint identifies a repository without naming it: `HMAC-SHA256(key, root commit + normalised
remote URL)` under a random 16-byte key (`fingerprint` in `src/analyse.ts`). The key is printed once on
stderr when the report is written and is not stored in it (`src/cli.ts`).

**What it gives.** A verifier who has the key can tell whether their clone has the same root commit and the
same remote URL as the author's. Without the key nobody can look the fingerprint up from a public repository.

**Does not protect against.** A repository that shares a root commit (a fork) and carries the same remote
string, because the remote URL is a configuration value anyone can set. It does not protect against a lost
key: without it `verify` does not compare the fingerprint and says so. Reports whose `fingerprintKeyed` is
false carry a plain sha256 of root commit and remote, which anyone who can guess both can test. The 0.6.2
code always writes `fingerprintKeyed: true`; the unkeyed form is read only so that older reports still check.

## Privacy defaults

By default the report contains no code content, no file paths (directory paths become
`(hidden; run with --paths)`), no email addresses (the `--author` you typed is stored as `(email hidden)`),
and no GitHub noreply address (`src/analyse.ts`, `src/report.ts`, `src/figures/identity.ts`).

**Protects against.** A casual reader, a search engine or a scraper learning code, paths or addresses from the
file, in the cases listed above.

**Does not protect against, and the defaults do not cover:**

- What the figures themselves say: the tenure window, the number of commits and files, the languages by lines
  added, and the author's name are all in the report. A small team can be re-identified from tenure and commit
  counts.
- The repository name field is the local directory name and is not hidden (`test/threat-model.test.ts`). A
  directory called after the client is a disclosure; rename it before running.
- The possible-split record (`identity.possiblySplit`) writes the names of other identities in the repository
  that look like the subject, whether or not they are the same person. Its reason text can contain a GitHub
  login taken from a noreply address, for example `the GitHub login "adalovelace" matches yours`. This happens
  without `--emails`, so a login can reach the report even though the README says noreply addresses are never
  written. It reproduces with `possibleSplits` (`src/figures/identity.ts`): the subject's identity with the
  name "Ada Lovelace" and the email `ada.lovelace@example.com`, and a commit by `99+adalovelace@users.noreply.github.com`
  under the name "A. L." returns a reason containing `"adalovelace"`.
- The fingerprint key, if it is shared along with the report.
- Whether the employer, client or agreement allows these figures to be published. The tool cannot check that;
  check the agreement first.

## Rewritten history

Every figure is computed from the commit graph. Author names, author dates and the graph itself can be set at
will (`GIT_AUTHOR_NAME`, `GIT_AUTHOR_DATE`, `git rebase`, `git filter-repo`), and a report made afterwards
reproduces perfectly under `verify`. Nothing in a report distinguishes honest history from rewritten history.

**Does not protect against.** This. The only mitigation is an independent copy of the history made before the
rewrite: a colleague's clone, a server's copy. `countersign` helps exactly as far as the colleague's clone
predates the rewrite. The adversarial benchmark (`bench/adversarial.mjs`, `test/adversarial.test.ts`) measures
which figures move under padding, churn and generated files; it does not measure rewriting.

## Narration

`--narrate` sends text to a model endpoint the user chooses (`WORKPROOF_API_URL`, `WORKPROOF_API_KEY`,
`WORKPROOF_MODEL`). The request body is a fixed instruction plus, for every repository, its `name` (the local
directory name) and each figure's `id`, `title` and `value` (`narrate` in `src/narrate.ts`,
`test/cli.test.ts`). The values include the sample seed of the blame sample, and directory names only when the
report was made with `--paths`. Emails are not sent, and no code is sent. The API key is sent as a header to
the endpoint. The paragraph that comes back is appended under "Generated narrative (not verified)" and is
outside the hash.

**Does not protect against.** The model provider keeping or logging the figures, the repository name and the
seed. The narrative can say anything; the reader must treat it as unverified, which the heading says.

## Attacks nothing here stops

None of the four commands does protect against these. They are listed so a reader does not assume otherwise.

- A repository fabricated to flatter, with authors and dates set by script. Every command passes on it.
- A history rewritten before the report was made.
- The author and a countersigner agreeing beforehand.
- An author who chooses favourable parameters (`--since`, `--until`, `--sample`, `--seed`, `--exclude`,
  `--author`). They are recorded in the hashed `params`, so they are visible, but nothing stops a reader who
  does not read them. A generated file under a name the built-in lists miss inflates surviving lines
  (`README.md` "Gaming and bias", `bench/adversarial.mjs`); the defence is the `.gitattributes` convention.
- A false timestamp: `generatedAt` is outside the hash.
- Using another person's name and email in a made-up repository.
- Any judgement about quality. The figures measure survival and touch, not merit.
- Leakage through the figures themselves, and a breach of confidentiality that the author's employer
  forbids. These are legal and personal risks the tool cannot remove.
