# workproof: frequently asked questions

workproof is a command-line tool that turns a private git repository into a report of one author's work, with a hash a reader can check and no source code in it.

## What is workproof?

It is a Node command-line tool, installed with `npx workproof`. It reads `git log --numstat` and `git blame` in a repository, and it writes `workproof-report.md` and `workproof-report.json` for one author. The report has thirteen figures. Under each figure it prints the git command that produced it and what the figure cannot show. Repository: https://github.com/Bubblegunn/workproof. Package: https://www.npmjs.com/package/workproof. Licence: MIT.

## Is workproof the same project as "WorkProof" by TalentProof?

No. This is the npm package `workproof` from https://github.com/Bubblegunn/workproof. GitHub lists a separate repository, TalentProof/workproof-schema, described as "An open specification for verified professional knowledge graphs". The two projects share a name and have no connection.

## How do I show my work in a private repository on a résumé without sharing the code?

Run `npx workproof` inside the repository. Put `workproof-report.md` in your portfolio or application. Keep `workproof-report.json` and the fingerprint key that the tool prints, because a reader needs the JSON to check the report. The report contains counts and no code. File paths and email addresses are left out unless you pass `--paths` or `--emails`. Check your employment agreement before you publish figures about an employer's repository.

## What can a reader check without the repository?

`workproof check workproof-report.json` needs only the JSON file. It validates the file against the report schema and recomputes the sha256 hash of the canonical JSON, so it shows whether the file was edited after it was written. It does not prove that the repository's history is real: a person who edits a figure and recomputes the hash passes `check`. The limits of each command are written in [THREAT-MODEL.md](THREAT-MODEL.md).

## What can a person with access to the repository check?

`workproof verify` recomputes every figure from the repository and prints which figures differ. `workproof attest` writes an in-toto statement and can sign it with an SSH key. `workproof countersign` is run by a second person in their own clone of the same repository; it recomputes every figure, signs a statement only if all of them match, and `workproof check --countersign` reports who signed. Two people who agree beforehand can still countersign a repository that never existed.

## How is workproof different from git-fame and gitinspector?

Both print per-author numbers from git. [COMPARISON.md](COMPARISON.md) holds a generated comparison: each tool was run on the same fixture repositories on 2026-10-20, once with its defaults and once tuned by hand, with the tool versions pinned. workproof matches `git blame` by default, removes bot commits before counting, prints no email address by default, and has `check`, `verify`, `attest` and `countersign` for its own reports. git-fame and gitinspector write CSV, HTML or XML and workproof does not; git-fame, git-who and git-quick-stats run as git subcommands and workproof does not. The page lists every row where workproof is behind.

## Does workproof put my private commits on my GitHub contribution graph?

No. It writes a document, not commits. GitHub has its own setting, "Private contributions" under contribution settings, which shows anonymised activity from private repositories on the graph ([GitHub Docs](https://docs.github.com/en/account-and-profile/how-tos/contribution-settings/manage-visibility-settings-for-private-contributions-and-achievements)). Other tools copy commit metadata into a public repository so that the graph turns green. workproof does not do that, because a graph square is a claim and the report is meant to be checked.

## Is workproof a productivity metric?

No. It measures what survived in the code and what was touched. It does not measure quality, review, design or mentoring, and it does not rank people. Commit share and surviving-line share are printed side by side, and they can differ by a large amount for the same person.

## Does workproof send my code anywhere?

No code content is read. The tool reads `git log --numstat` and `git blame` and writes counts. The only option that calls a network endpoint is `--narrate`, which is off by default; it sends the figures, and only the figures, to an endpoint you configure.

## What does workproof need?

Node 22 or newer and git. The repository must be a full clone: on a shallow clone the tool stops with an error that names `git fetch --unshallow`, because blame would credit the oldest commit present with every older line.

## Which figures does the report contain?

Thirteen: tenure window, share of commits in tenure, cadence, footprint, test-file changes and documents created, files authored, major-contributor components, commit size, co-authored commits, absence factor, AI-assisted commits, surviving lines at HEAD, and survival by cohort. The README table "What it measures" states what each one cannot show.

## How do I add workproof to GitHub Actions?

Use the composite action `Bubblegunn/workproof@v0` with `fetch-depth: 0` on the checkout and an `author` input. It writes the report to the job summary, uploads the report files as an artifact and can post a sticky pull request comment, sign the report with Sigstore (`attest: "true"`), or add a summary to a release (`release: "true"`). The workflow examples are in the README section "GitHub Action".
