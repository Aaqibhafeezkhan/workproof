<p align="center"><img src="assets/wordmark.svg" width="480" alt="workproof"></p>

<p align="center">English | <a href="README.tr.md">Türkçe</a></p>

> Most of my work is in private repositories, and I cannot show anyone what I did there without showing the code.

workproof is a command-line tool that turns a private git repository into a report of one author's work, with a hash a reader can check and no source code in it. It is the npm package `workproof` from github.com/Bubblegunn/workproof, and it has no connection to the `workproof-schema` repository of TalentProof.

It needs Node 22 or newer and git. Run it inside the repository:

```
cd your-private-repo
npx workproof
```

That writes `workproof-report.md` (paste it into a résumé, a portfolio or a visa application) and `workproof-report.json` (for tools and for checking). The recording runs it on a public repository, [langchain-ai/openwiki](https://github.com/langchain-ai/openwiki) at `1e6d54c`; the output is committed as a [sample report](docs/sample/openwiki-report.md).

![Terminal recording: workproof writes a report, check prints hash ok, verify prints all figures reproduce, then the two shares are shown](docs/demo.gif)

It is not a productivity metric and does not rank people. It reports what survived and what was touched, and under every figure it prints the git command behind it and what the figure cannot show. A reader who has only the JSON file can run `workproof check` and learn whether it was edited after it was written; that does not prove the repository's history is real ([threat model](docs/THREAT-MODEL.md)). Candidates run it; for a hiring manager, see [For hiring managers](#for-hiring-managers).

<p align="center">
  <img src="https://img.shields.io/npm/v/workproof?style=flat-square&color=111111&label=npm" alt="npm">
  <img src="https://img.shields.io/github/actions/workflow/status/Bubblegunn/workproof/ci.yml?style=flat-square&color=111111&label=ci" alt="ci">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT">
  <a href="https://doi.org/10.5281/zenodo.22394558"><img src="https://img.shields.io/badge/DOI-10.5281%2Fzenodo.22394558-111111?style=flat-square" alt="DOI"></a>
  <a href="https://github.com/marketplace/actions/workproof-report"><img src="https://img.shields.io/badge/GitHub_Marketplace-workproof--report-111111?style=flat-square&logo=github" alt="GitHub Marketplace"></a>
  <a href="https://www.bestpractices.dev/projects/15493"><img src="https://img.shields.io/cii/level/15493?style=flat-square&color=111111&label=openssf%20best%20practices" alt="OpenSSF Best Practices"></a>
</p>

### As a Claude Code plugin

```
/plugin install workproof --marketplace Bubblegunn/workproof
```

That one-step form works on Claude Code 2.1.275 or newer. On an older version, use two steps:

```
/plugin marketplace add Bubblegunn/workproof
/plugin install workproof@workproof
```

The plugin adds one skill. When you ask the agent the question this tool answers, it runs `npx workproof` itself instead of estimating.

## How this differs

git-fame and gitinspector also report per-author numbers from git. [docs/COMPARISON.md](docs/COMPARISON.md) holds the measured comparison: each tool was run on the same fixture repositories on 2026-10-21, once with its defaults and once tuned by hand. These are the rows where workproof is ahead or ties:

- Surviving lines: git-fame 4.2.1 matches `git blame` once it is given `-w -M --ignore-revs-file`; workproof reads `.git-blame-ignore-revs` by default. gitinspector v0.5.1 did not match `git blame` in either run.
- Bots: workproof removes bot commits before counting. git-fame 4.2.1 listed a bot as an author in both runs.
- Email addresses: the default output of workproof has none. gitinspector v0.5.1 and onefetch 3.1.0 print one.
- Checking a report: workproof has `check`, `verify`, `attest` and `countersign` for a report it wrote. The help text of git-fame, gitinspector, git-who and onefetch mentions no verify or attest command.

The rows where workproof is behind are on the same page: running as a git subcommand, writing CSV, HTML or XML, speed against git-fame, git-who and onefetch, and putting private work on the GitHub contribution graph.

## What the run prints

The recording shows the commands below. They run on a public repository, so anyone can repeat them. `--fingerprint-key` is passed so that the hash is the same on every machine; without it the tool makes a random key, prints it once and stores it nowhere, and `verify` needs that key later. The two paragraphs `verify` prints after "all figures reproduce", which say what it proves and what it does not, are left out here and are in [docs/sample/transcript.txt](docs/sample/transcript.txt). The report is committed as [docs/sample/openwiki-report.md](docs/sample/openwiki-report.md) and [docs/sample/openwiki-report.json](docs/sample/openwiki-report.json). `scripts/make-sample.sh` regenerates both, and a test fails when this page and the sample disagree.

```
$ npx workproof --author "Colin Francis" --sample 5 --fingerprint-key 9dc900a6227a1faaaa17d774565afbf3
openwiki: reading history...
openwiki: 369 commits read
openwiki: blaming files (1 in 5 sample)...
openwiki: blamed 123 of 547 files
wrote workproof-report.md and workproof-report.json in 1.0s

$ npx workproof check workproof-report.json
schema ok
hash ok f0fc23197ef76c471c06bccaa57e1e711440635a7e4af8634f5f711f7819a911

$ npx workproof verify workproof-report.json --fingerprint-key 9dc900a6227a1faaaa17d774565afbf3
schema ok
hash ok f0fc23197ef76c471c06bccaa57e1e711440635a7e4af8634f5f711f7819a911
openwiki: fingerprint ok
all figures reproduce
```

`check` needs the JSON and nothing else. `verify` needs the repository.

## What a report looks like

Real output for one maintainer of openwiki at `1e6d54c`, run on 20 October 2026 with
`--author "Colin Francis" --sample 5`, paths and emails hidden (the defaults). The block is
from `docs/sample/openwiki-report.md`. Under every
figure the full report also prints `How:` with the git command and `What this cannot show:`;
they are cut here for length.

```
## openwiki

HEAD 1e6d54cdfeec · fingerprint a1b19a27aab4a577 · identities: Colin Francis

excluded 64 bot commits and 1 generated, vendored or lock file (2.6% of lines added)

### Tenure window
2026-07-06 to 2026-09-03 (60 days)

### Share of commits in tenure
71 of 235 non-merge commits, 30.2%

### Cadence
9 active weeks of 9, 7.9 commits per active week, longest streak 9 weeks
1 of 21 release tags in tenure

### Footprint
693 files touched
16 directories with a commit share at or above the threshold (paths hidden; run with --paths)
languages by lines added: TypeScript 81.4%, JSON 9.7%, Markdown 7.1%, JavaScript 1.6%, YAML 0.2%

### Test-file changes and documents created
393 of 657 test-file changes, 59.8%
101 documents created

### Files authored
455 of 555 files alive at HEAD, 82.0% (degree of authorship)

### Major-contributor components
major contributor in 59 of 65 directories (at least 5% of commits)

### Commit size
median 166 lines, 90th percentile 9,234, 6 commits over 10,000 lines

### Co-authored commits
119 commits by others naming the author in a Co-authored-by trailer

### Absence factor
4 authors cover half the commits; the author ranks 1 of 73 by commit count

### AI-assisted commits
1 commit declares an AI tool in a trailer, 1.4% of the author's commits

### Surviving lines at HEAD
23,317 of 33,038 surviving lines, 70.6% (files 123/547, sample 1 in 5)

### Survival by cohort
2026: 23,317 lines
```

Read the first line and the two shares together. Sixty-four bot commits left the
denominator before anything was counted, which moved this person's commit share from the
24.1% an older version reported to 30.2%. They wrote 30.2% of the human commits in their
window and 70.6% of the lines that are still alive. A commit count alone would have called
them one contributor among seventy-three. That gap, in either direction, is usually the most
honest thing a report can say about someone's work.

## In plain language

Each repository section of the Markdown report opens with a paragraph a non-engineer can
read, assembled from the figures by a fixed rule with no model call, so it is deterministic
and says nothing the numbers do not:

> Ada worked in app from 5 January 2026 to 19 January 2026, a span of 15 days. They made 3
> of the 3 changes recorded in that period (100%), and 16 of the 31 lines of code still in
> the project today are theirs (52%). The second number is the one that lasts: it counts the
> work that survived everything written since. 5 of the 8 files in the project were started
> by them (63%). They were active in 3 of the 3 weeks in that period. Before any of this was
> counted, 1 automated change and 2 machine-written or copied files were removed, so none of
> them inflate the figures.

It states no opinion about quality, keeps the two shares apart, and ends with the command
that recomputes it. `--narrate` is a different thing: that one asks a model, is labelled as
unverified in the report, and is not part of the hash. So is this paragraph, which is
derived from the hashed figures rather than added to them.

## What it measures

Every figure comes from git and nothing else. Bot commits and generated, vendored, lock and
snapshot files are removed before any of them is computed (see Gaming and bias).

| figure | what it is | what it cannot show |
|---|---|---|
| Tenure window | first to last commit by the author, or `--since/--until` | work before the first commit or after the last |
| Share of commits | non-merge commits by the author over all human non-merge commits in the window | what survived; a typo and a subsystem count the same |
| Cadence | active weeks, commits per active week, longest streak, release tags in tenure and the author's | a week with one commit and a week with forty both count as active; weeks are the author's own, read from the offset each commit records |
| Footprint | files touched, directories at or above a commit-share threshold, languages by lines added | anything the exclusion lists miss still counts |
| Test-file changes and documents created | share of test-file changes; `.md`, `.mdx`, `.rst` files whose oldest commit is the author's | test cases, coverage, or the quality of a document |
| Files authored | files alive at HEAD where the author's degree of authorship (Avelino et al.) is at least 3.293 and above 75% of the file's maximum | coefficients fitted on other systems; first authorship outweighs later rewrites |
| Major-contributor components | directories where the author has at least 5% of the commits (Bird et al.) | commit exposure treats a typo and a subsystem alike |
| Commit size | median and 90th percentile of added plus deleted lines per commit; commits over 10,000 lines | size is not value; imports and reformats dominate the 90th percentile |
| Co-authored commits | other people's commits naming the author in a `Co-authored-by` trailer | trailers are written by the merger and can be absent or wrong |
| Absence factor | the smallest set of authors covering half the commits (CHAOSS), and the author's rank | several unmerged emails count as several people |
| AI-assisted commits | author commits whose trailers or name declare Claude, Cursor, Copilot, Codex, Gemini, ChatGPT, Aider, Devin or Windsurf | a missing trailer is not evidence of unassisted work |
| Surviving lines | share of lines alive at HEAD, one `git blame -w -M` pass over a deterministic file sample, honouring `.git-blame-ignore-revs` | merit; code deleted on purpose counts for nobody |
| Survival by cohort | the author's surviving lines by the year of the commit that last touched them | newer cohorts have had less time to die |

## How verification works

Four commands, in increasing order of what the reader needs to have.

- `workproof check report.json` needs only the file. It validates the document against
  [schema/report.schema.json](schema/report.schema.json) and recomputes the hash: sha256
  over the [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) canonical JSON of the
  parameters and figures. An edited figure prints `hash mismatch: report says X, content
  hashes to Y` and exits 1. No git, no network.
- `workproof verify report.json` needs the repository. It runs `check`, compares the
  fingerprint (with `--fingerprint-key`; without it the comparison is skipped and says so),
  compares HEAD, then recomputes every figure and prints what differs. A report from another
  repository stops at the fingerprint. If HEAD moved since the report, it says so and shows
  which figures changed.
The hash is reproducible **across operating systems, git versions, locales and directory
names**, for the same repository at the same commit with the same command and the same
`--fingerprint-key`. It is not reproducible across a rewritten history, a different sample
or a different seed, and it is not meant to be: those change the measurement. Two fields
in the report are deliberately outside the hash, because a verifier on another machine
cannot reproduce them: the local directory name, and the git version. They stay in the
document, where they explain why two runs might legitimately differ. Before 0.4.0 both
were inside it, so the same repository in a folder with a different name hashed
differently; a test now pins all of this, and CI checks it on Linux, macOS and Windows.

- `workproof attest report.json` writes `report.intoto.json`, an
  [in-toto](https://in-toto.io) v1 Statement whose subject is the report hash and whose
  predicate carries the tool version, parameters, HEAD, keyed fingerprint, git version and
  exclusion counts, and nothing else: no figures, no remote, no paths, no emails.
  `--local ~/.ssh/id_ed25519` signs it with `ssh-keygen -Y sign` in the `workproof`
  namespace and writes the detached signature plus a DSSE envelope. Anyone with your public
  key checks it with:

  ```
  ssh-keygen -Y verify -f allowed_signers -I you@example.com -n workproof \
    -s workproof-report.intoto.json.sig < workproof-report.intoto.json
  ```

  where `allowed_signers` is one line, `you@example.com ssh-ed25519 AAAA...`, and the key is
  the one GitHub serves at `https://github.com/<you>.keys`.

- `workproof countersign report.json --key ~/.ssh/id_ed25519 --fingerprint-key <hex>` is run by a
  second person who worked in the same repository, in their own full clone at the commit the
  report names. It recomputes every figure, refuses unless the fingerprint, the commit and every
  figure match, and then signs a statement about the report in the `workproof-countersign`
  namespace. The author sends the report and the fingerprint key (printed once when the report was
  made); the colleague sends back one `.dsse.json` file. A reader runs
  `workproof check report.json --countersign file.dsse.json --allowed-signers allowed_signers`.
  This moves the claim from "issued by the person it flatters" to "recomputed by someone else".
  It does not stop two people who agree beforehand from countersigning a repository that never
  existed, and it says who signed only for keys the reader lists. A report with no
  countersignature is normal. The predicate is described in
  [docs/countersignature-v1.md](docs/countersignature-v1.md).

What `verify` proves: every figure was recomputed from that repository at that moment and
came out the same, and the document was not edited after it was written. What it does not
prove: that the repository is honest history, that the figures measure anything worth
measuring, or that the work was good. A repository whose history was rewritten before the
report was made reproduces perfectly. The command prints both halves of that after its
result, so a reader who never opens this README still sees the limit.

A figure that differs is not proof of dishonesty either. Every figure except tenure is
computed at HEAD, and HEAD moves; `verify` prints the HEAD line first for that reason.

What each command proves, and what none of them protects against, is written down in
[docs/THREAT-MODEL.md](docs/THREAT-MODEL.md).

In the GitHub Action, `attest: "true"` signs the report file keylessly with
[Sigstore](https://www.sigstore.dev): cosign is installed from a SHA-pinned action and
`cosign attest-blob workproof-report.json` writes `workproof-report.sigstore.json`, using
the predicate file as its predicate. The signed object is the report file, not the in-toto
statement that `workproof attest` writes. A reader verifies it with:

```
cosign verify-blob-attestation workproof-report.json \
  --bundle workproof-report.sigstore.json \
  --type https://github.com/Bubblegunn/workproof/blob/main/docs/attestation-v1.md \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github.com/<owner>/<repo>/'
```

The predicate type is described in [docs/attestation-v1.md](docs/attestation-v1.md). Bundles
written before 0.6.0 carry the older type `https://workproof.dev/attestation/v1`; pass that value
to `--type` to verify them.

What that proves: this exact JSON was produced by a workflow run in that repository, at
that commit, and has not changed since. What it does not prove: that the figures are
right (run `verify` for that) or that the workflow was honest about which repository it
checked out. Two warnings before you turn it on. The Fulcio certificate names the
repository the workflow ran in, and the Rekor transparency log is public and permanent. For
private code the documented pattern is a small public repository that holds the report and
runs the attest step, so the private repository's name never reaches the log.

## Privacy

- No code content, ever. The tool reads `git log --numstat` and `git blame` and emits counts.
- No file paths by default. `--paths` adds directory names at the configured `--depth`
  (default 2), never files.
- No email addresses by default. `--emails` adds them; without it, even the `--author` you
  typed is replaced by `(email hidden)` in the stored parameters. GitHub noreply addresses
  (`<id>+<login>@users.noreply.github.com`) are never written, with or without the flag,
  because the login is in the local part.
- Non-subject names are never written. The absence-factor figure carries counts only.
- The fingerprint is `HMAC-SHA256(key, root commit + remote)` under a 16-byte key generated
  per report. The key is printed once and stored nowhere, so a public repository cannot be
  looked up from its fingerprint. Pass `--fingerprint-key` to reuse a key across reports of
  the same repository.
- The optional narrative (`--narrate`) sends the figures, and only the figures, to a model
  endpoint you choose (`WORKPROOF_API_URL`, `WORKPROOF_API_KEY`, `WORKPROOF_MODEL`;
  OpenAI-compatible or Anthropic). The paragraph is appended under "Generated narrative
  (not verified)" and is excluded from the hash.

## Options

```
workproof [options] [--repo <dir>]...
workproof check <report.json> [--countersign <file.dsse.json>]... [--allowed-signers <file>]
workproof countersign <report.json> --key <ssh-key> [--repo <dir>] [--fingerprint-key <hex>] [--as <label>]
workproof verify <report.json> [--repo <dir>]... [--fingerprint-key <hex>]
workproof attest <report.json> [--local <ssh-key>]

--author <email|name>   identity to report on (repeatable; default: git config user.email)
--repo <dir>            repository to analyse (repeatable; several produce one combined report)
--since / --until       override the tenure window
--sample <n>            blame every n-th file (default: 1; 7 for very large repositories)
--seed <text>           salt for the blame file sample
--exclude <glob>        also drop files matching the glob (repeatable)
--no-exclusions         count bot commits and generated, vendored, lock and snapshot files
--copies                pass -C to git blame so copied lines follow their origin
--ignore-revs-file <f>  blame ignore-revs file (default: .git-blame-ignore-revs at the root)
--fingerprint-key <hex> reuse a fingerprint key so two reports of one repository match
--max-commits <n>       read only the newest n commits (escape hatch for enormous histories)
--depth <n>             directory depth for ownership (default: 2)
--paths                 include directory paths
--emails                include author emails
--narrate               append a model-written paragraph
--badge                 also write <out>.badge.json, a shields.io endpoint document
--out <basename>        output basename (default: workproof-report)
--format <mode>         write markdown, json, or both (default: both); json prints to stdout
--json                  same as --format json
```

A `.mailmap` in the repository merges an author's several addresses. Progress lines go to
stderr while history is read and files are blamed. Every git call runs with
`diff.renames=true`, `diff.algorithm=myers`, `diff.indentHeuristic=true` and
`core.autocrlf=false`, and the report records the git version, the blame flags, the
ignore-revs file and the seed, so two machines with different defaults agree, and `verify`
can tell an environment drift from an edit.

## Badge

`--badge` writes `workproof-report.badge.json` next to the report, in the
[shields.io endpoint format](https://shields.io/badges/endpoint-badge):

```json
{ "schemaVersion": 1, "label": "workproof", "message": "70.6% surviving lines · 60 days", "color": "1f3fbf" }
```

Commit it to a public repository (your portfolio, a gist) and point shields at the raw URL:

```
![workproof](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/<you>/<repo>/main/workproof-report.badge.json&style=flat-square)
```

A badge is a claim, not evidence. Keep the JSON report next to it; the report is what a
reader verifies, the badge is only how they find it.

## GitHub Action

The repository ships a composite action that runs workproof on a checkout, runs `check`,
writes the in-toto statement, puts the Markdown report in the job summary, uploads the
report files as one artifact, and posts one sticky comment on the pull request with the
headline figures. `fetch-depth: 0` is required: on a shallow clone the oldest commit
present takes credit for every line older than it, so workproof (the CLI, `verify` and the
action alike) stops with an error naming `git fetch --unshallow` instead of writing a report.
`author` is required because a GitHub login does not map reliably onto commit identities.

```yaml
name: workproof
on:
  pull_request:
permissions:
  contents: read
  pull-requests: write
  id-token: write # only for attest: "true"
jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - uses: Bubblegunn/workproof@v0
        with:
          author: ada@example.com
          sample: "1"
          attest: "false"
```

`@v0` is a moving tag the maintainer points at the newest 0.x release; pin a commit SHA if
you want the action to never change under you. Inputs reach the shell through environment
variables, never by interpolation into the script. The comment is updated in place on later
pushes (it carries a marker). The full Markdown report appears on the run's summary page,
and `workproof-report.md`, `.json`, `.intoto.json` and `.predicate.json` are uploaded as the
`workproof-report` artifact, so a report survives the workspace and can be downloaded from
the run. Set `comment: "false"` to skip the comment and keep the summary and the artifact.

The action declares two outputs: `report`, the path of the JSON report, and `bundle`, the
path of the Sigstore bundle when `attest: "true"` (empty otherwise). Give the step an `id` to
read them:

```yaml
      - uses: Bubblegunn/workproof@v0
        id: workproof
        with:
          author: ada@example.com
      - run: npx workproof check "$REPORT"
        env:
          REPORT: ${{ steps.workproof.outputs.report }}
```

To put the summary on a release instead, run the action on the `release` event with `release: "true"`. It adds
the headline-figures block to the release notes (replacing its own block on later runs, never touching your notes)
and attaches `workproof-report.json` to the release. It fails on any other event rather than doing nothing, and
like every run it needs `fetch-depth: 0`, because a shallow clone cannot produce honest figures. The block holds
the same figures as the pull request comment: no paths, no emails, no commit messages.

```yaml
on: { release: { types: [published] } }
permissions: { contents: write }
jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - { uses: actions/checkout@v4, with: { fetch-depth: 0 } }
      - { uses: Bubblegunn/workproof@v0, with: { author: ada@example.com, release: "true" } }
```

The `package` input runs a local npm pack tarball instead of `workproof@<version>` from the
registry. This repository's CI uses it to run the action on the package built from the commit
under test; leave it empty to get the released version.

## When someone reformatted the code

A repository-wide formatter run rewrites lines it did not write. Plain `git blame` then
credits every one of them to whoever ran the formatter. workproof reads
`.git-blame-ignore-revs` at the root by default, so those commits are skipped and the
lines keep their real author; `-w` handles whitespace-only changes on its own, so the
file matters when a formatter changed quotes, line breaks or trailing commas.

[guidance-ai/guidance](https://github.com/guidance-ai/guidance) at `21b1d90` (21 May 2026)
lists its black and ruff runs in that file. Two runs per author on 5 September 2026 with
`--sample 1`; the second passes an empty `--ignore-revs-file`, which is the only way to
turn the default off:

| author | honouring `.git-blame-ignore-revs` (default) | ignoring it |
|---|---|---|
| Harsha Nori, who ran black over the tree in April 2024 | 2,185 of 49,267 surviving lines, 4.4% | 2,476 of 49,267, 5.0% |
| Scott Lundberg, who wrote most of what black reformatted | 12,368 of 49,267, 25.1% | 12,152 of 49,267, 24.7% |

Without the file, 291 lines of other people's code would have counted for the person who
ran the formatter, 216 of them taken from one author. The report prints the file it used
in every `How:` line and under `environment.ignoreRevs` in the JSON, so two reports are
only comparable when that line matches:

```
How: `git blame --line-porcelain -w -M --ignore-revs-file .git-blame-ignore-revs HEAD -- <file> over a deterministic 1-in-1 file sample (surviving-lines 0.1.1: FNV-1a on path); generated, vendored and lock files excluded`
```

## When you are two people

Git has no idea that the address on your laptop and the address on your work machine belong to
one person. It counts them as two authors, so a report about one of them describes half your
work and says nothing about the rest, and every figure in it is quietly too small. This is the
most common way these numbers go wrong and nothing normally tells you.

The report tells you:

```
**1 other identity in this repository looks like the same person and was not counted here**:
Efe Genc. The same name, "Efe Genc", on another address. Every figure below therefore describes
only the work under the identities named above. If they are the same person, re-run with each
address passed to `--author`, or merge them in a `.mailmap`.
```

The same line appears as a warning on stderr while the run is happening, and as
`identity.possiblySplit` in the JSON. Three signals raise it: the same name on another address,
a GitHub noreply login that matches your address or your name, and the same address name on
another domain. Role addresses like `dev@` and bot addresses are ignored, because sharing one
proves nothing.

Without `--emails` the line states only how many other addresses may be the same person and
tells you to re-run with `--emails`; the reasons are fixed phrases, and no name, login or address
is written. With `--emails` the names, public emails and reasons are listed.

It is a disclosure, not a correction. The tool cannot know whether two addresses are one person,
so it never merges them for you: pass each address to `--author`, or write a `.mailmap`, which
`git log`, `git blame` and `git shortlog` all read as well.
[`surviving-lines --identities`](https://github.com/Bubblegunn/surviving-lines) prints the
`.mailmap` lines for a whole repository if you want to fix it once for everyone.

The addresses themselves stay out of the document unless you pass `--emails`, the same rule the
rest of the report follows.

## Names that are not ASCII

The identity fold decides which commits are yours, so a gap in it is a missing figure rather than
an ugly one. Two gaps were closed against Unicode 17.0, and both changed counts:

- `Weiß` and `WEISS` are one person. JavaScript's `toLowerCase` is Unicode's simple case fold and
  leaves ß alone, so the two spellings never met and half of one person's commits fell outside
  every figure. The full fold maps ß to ss
  ([CaseFolding.txt](https://www.unicode.org/Public/UCD/latest/ucd/CaseFolding.txt), status `F`),
  which is what the tool does now.
- A name typed in fullwidth Latin letters, which is what a Japanese or Korean keyboard produces
  without switching modes, is the same name typed in ASCII. Matching normalises to NFKC, so the
  two forms meet, along with the ﬁ ligature and the compatibility ideographs.

Turkish dotted and dotless i and decomposed accents were already folded. The fold is for matching
only. The report always prints the name git holds.

Display is separate. An Arabic or Hebrew name is the first strong character of the plain-language
paragraph, and without an isolate it turns the whole paragraph right to left: the English after it
reverses and the figures land in the wrong order. Names and repository names are wrapped in U+2068
and U+2069 in the Markdown report, the isolates [UAX #9](https://www.unicode.org/reports/tr9/)
defines for this. They are invisible, they are added only where a strong right-to-left character
appears, and they are never written into the JSON, so the hash over a report is unchanged and a
report written before this still verifies.

Three things here are deliberate:

- Numbers are printed in the `en-US` format wherever a person reads them, so `12,345` is twelve
  thousand for every reader. The hash is taken over the RFC 8785 canonical JSON, where numbers
  are not formatted at all, so this cannot affect `workproof verify`. It is about the document:
  two reports are meant to be read side by side, and a thousands separator that follows the
  reader's machine makes that harder for no gain.
- Weeks are ISO weeks, starting on Monday. That is not the local week for most of the world: of
  the twenty most populous countries, CLDR gives Monday to seven, Sunday to eleven and Saturday
  to two, which `Intl.Locale.prototype.getWeekInfo` reports in Node 24. Cadence counts weeks a
  person was active, and that figure is only worth reading next to another report, so it uses one
  definition everywhere rather than the reader's. The days inside a week are already the author's
  own local dates, which is what decides whether a Sunday commit belongs to this week or the next.
- A `.mailmap` name is matched by git, not by this tool. git compares those names ignoring case
  for ASCII letters only, verified on git 2.50.1: an entry written `josÉ Álvarez` matches a commit
  by `JOSÉ ÁLVAREZ`, and one written `josé álvarez` does not. Map by address wherever you can.

## Gaming and bias

Partly gameable, and built so the gaming shows. `npm run bench:adversarial` applies four
strategies to copies of the same fixture repository, dates every gaming commit inside the
subject's existing tenure so the window itself does not move, and recomputes every figure
with identical parameters:

| figure | baseline | commit padding | whitespace churn | generated file | generated, marked | Bob alone | Bob credits Ada |
|---|---|---|---|---|---|---|---|
| commits per week | 1.0 | **21.0** | 1.3 | 1.3 | 1.3 | 1.0 | 1.0 |
| median commit | 4 lines | **2 lines** | 4 lines | 4 lines | 2 lines | 4 lines | 4 lines |
| surviving lines | 51.6% | 53.1% | 51.6% | **99.3%** | 53.1% | 6.9% | 6.9% |
| surviving count | 16 | 17 | 16 | **2,016** | 17 | 16 | 16 |
| co-authored | 0 | 0 | 0 | 0 | 0 | 0 | **8** |
| excluded files | 2 | 2 | 2 | 2 | **3** | 2 | 2 |

Sixty padding commits take the cadence from 1.0 to 21.0 a week and buy one surviving line,
16 to 17, while the median commit falls from 4 lines to 2: loud in the rows that count
commits, silent in the row that counts code, and the median is the tell in the same report.
Re-indenting every source line moves nothing, because blame runs with `-w`.

The generated file is the real hole, and the table says so: 2,000 machine-written lines
under a name the built-in lists do not match take surviving lines from 51.6% to 99.3%. The
same file marked `linguist-generated` in `.gitattributes` leaves every count and shows up
in the excluded column instead. The defence is a repository convention, not a detector.

The co-author trailer buys nothing. Bob's eight commits move the subject's shares down
either way because Bob wrote that code; naming the subject as co-author changes the
co-authored count and no other row. `test/adversarial.test.ts` pins the last two of those
so they cannot regress quietly.

These are the thirteen things a reader should know before trusting a number.

1. Commit spam moves commit share and cadence, and nothing else. Surviving lines come from
   `git blame` at HEAD, so a thousand empty commits add zero surviving lines, and the two
   shares are printed side by side.
2. Vendoring a library inflates lines added. Vendored directories, lock files, snapshots,
   minified assets and generated outputs are excluded by built-in lists and by
   `linguist-generated` or `linguist-vendored` in `.gitattributes`, and the report prints how
   much was excluded. Anything the lists miss still counts; `--exclude` covers it, and the
   glob is recorded in the parameters.
3. Bot commits (`[bot]@users.noreply.github.com`, Renovate, GitLab and Gitea bot
   identities) leave every denominator. Bot detection uses commit email identities,
   not author names. Bot-like author names without recognized bot email identities
   are counted as contributors rather than excluded.
4. A reformat commit takes every line it touched unless it is listed in
   `.git-blame-ignore-revs`. The report says which file was used, or that none was.
5. `--since`, `--until`, `--sample`, `--seed` and `--exclude` are all ways to choose a
   flattering window or sample. Every one of them is stored in the parameters and hashed.
6. Rewriting history to change authorship changes the root commit or HEAD, so the fingerprint
   and HEAD in an older report stop matching.
7. Degree of authorship uses coefficients fitted on other systems. First authorship weighs
   more than later rewrites, so a file rewritten from scratch by someone else can stay with
   its creator.
8. `Co-authored-by` trailers are written by whoever merges. They can be missing, wrong, or
   added by a squash-merge UI, and pairing without a trailer is invisible.
9. AI-assisted means a trailer or author name said so. The absence of a trailer is not
   evidence of unassisted work; blame credits the human for every line, so authorship no
   longer implies comprehension. These commits are never excluded from any other figure.
10. The absence factor counts email addresses. An author with several unmerged addresses
    counts as several people; add a `.mailmap`.
11. Documents created counts files whose oldest commit is the author's. A one-line README
    and a design document count the same.
12. Test-file changes are file changes matching test paths, not test cases, assertions or
    coverage.
13. The verifier runs against the same repository. A report that does not reproduce is worse
    than no report, which is the incentive the tool relies on. What no figure catches is a
    genuinely large, low-value contribution. That is what references are for.

### Bot identities

Bot detection currently recognises commit identities from:

- GitHub
- GitLab
- Gitea

GitHub bot identities use the `users.noreply.github.com` `[bot]` address form.

Known additional identities include `bot@renovateapp.com`, `gitlab-bot@gitlab.com`,
and `teabot@gitea.io`.

Detection is based on commit email addresses, not author names.

## For candidates

Run it in each repository you are proud of and cannot show. Put the Markdown in your
portfolio next to the sentence you would have written anyway ("I built the frontend"), and
let the numbers carry the sentence. Keep the JSON and the fingerprint key; the JSON is what
a reviewer verifies.

## For hiring managers

Ask for the JSON. `npx workproof check` tells you in a second whether it was edited. Then
ask someone inside the candidate's former company to run `npx workproof verify` on it. The
table either reproduces or it does not. If the repository has moved on, the tool says which
figures changed and why that is expected.

## For visa and immigration evidence

workproof was built for a UK Global Talent application, where the strongest work was in
private repositories and "trust me" is not evidence. A report is a measurement with its
method attached, not an endorsement; pair it with letters from people who were there, and
with an attestation if the reader cannot reach the repository.

## What it does not do

It measures survivorship and activity, not quality, review, design or mentoring. It does
not rank people. It does not replace references. It is not a legal document.

## What the research says about numbers like these

Repository-derived figures have a literature, and most of it is a warning. Kalliamvakou,
Gousios and Blincoe catalogued the traps in mining a forge, including that most repositories
are personal and inactive and that a large share of merged pull requests are not recorded as
merged ([MSR 2014](https://doi.org/10.1145/2597073.2597074), extended in [EMSE
2015](https://doi.org/10.1007/s10664-015-9393-5)). Bird and colleagues related ownership
concentration to defects rather than to credit, which is a different question from this one
and is not evidence that a high share means good work. On survival, Spinellis, Louridas and
Kechagia put the median line lifespan at about 2.4 years across 89 repositories ([PeerJ CS
7:e372, 2021](https://doi.org/10.7717/peerj-cs.372)), and Gurov found over half of all lines
are never deleted in 120 TypeScript repositories ([arXiv
2606.04993](https://arxiv.org/abs/2606.04993)).

None of that work measures a person's share of the surviving code, which is what the
surviving-lines figure here reports. A first measurement of how far that share diverges from
commit share, over twelve repositories, is in
[surviving-lines/research](https://github.com/Bubblegunn/surviving-lines/tree/main/research):
the same person tops both in 25 of 36 runs, and among substantial contributors the two
differ by a median of 7.5 percentage points. That is the honest size of the effect this
report exists to expose, measured rather than asserted.

## Where it comes from

The method is written up in
[How to show engineering ownership when the repositories are private](https://efegenc.me/writing/showing-ownership-private-repositories/).
The sampler and glob helpers are [surviving-lines](https://github.com/Bubblegunn/surviving-lines),
workproof's only dependency. Degree of authorship follows Avelino, Hora and Valente
(2016), major contributors follow Bird et al. (2011), and the absence factor is the CHAOSS
Contributor Absence Factor.

## Thanks

[@edwardsong08](https://github.com/edwardsong08) sent two pull requests on the day this was
published, without knowing me: `--format markdown|json|both`, so a pipeline can ask for one file
instead of two ([#9](https://github.com/Bubblegunn/workproof/pull/9)), and a language map that
covers Elixir, Scala, Haskell, Lua, R, Objective-C and Zig
([#3](https://github.com/Bubblegunn/workproof/pull/3)). Both shipped in 0.1.3 and are in every
release since. The second one is why the footprint figure names the right language for anyone
outside the handful I had thought to list.

[@shivam-070208](https://github.com/shivam-070208) asked whether the two bot definitions should be
one before writing any of it, which is why the answer could be measured first. The shared
`isBotIdentity` above, and the removal of four name prefixes that had been classifying people as bots,
are his ([#26](https://github.com/Bubblegunn/workproof/pull/26)).

## Cite this

Every release is archived on Zenodo with a DOI, so a paper or a report can point at the
exact code it ran.

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22394558.svg)](https://doi.org/10.5281/zenodo.22394558)

That is the **concept** DOI: it always resolves to the newest version. To cite the exact
version you ran, open that page, pick the version in the sidebar, and use the DOI shown
there. `CITATION.cff` in this repository carries the same identifier, so GitHub's "Cite this
repository" button produces correct BibTeX and APA without any copying by hand.

## Development

```
npm ci
npm test        # tsc build, then node:test over the compiled tests (fixture repositories built in a temp dir)
```

MIT.
