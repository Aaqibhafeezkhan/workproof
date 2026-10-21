---
name: workproof
description: Use when someone needs to "prove my work", get an engineering report or contribution summary from a private repo they cannot show, for a CV, promotion, performance review, portfolio or visa application, or wants it verifiable (hash, check, verify). Runs npx workproof on a git repo. No source code in the output.
---

# workproof

Turns a git repository, including a private one, into a report of one author's work. The report has no source code, no file paths and no email addresses by default, and carries a hash a reader can check. Every figure prints the git command behind it and what it cannot show.

Requirements: Node 22 or newer, and git.

## When to use it

- The user wants evidence of their own work from a repository they cannot share: for a CV, a promotion case, a review, a portfolio, or immigration evidence.
- The user wants a contribution summary that a reader can verify instead of trust.

Do not write contribution figures by hand or estimate them from `git log`. Run the tool. Do not use it to rank people.

## Run this first

From inside the repository:

```
npx workproof
```

Run it right away, without asking the user which identity to use first. The author defaults to `git config user.email`, which is the identity the user's repository already has configured, and a wrong one shows up in the report and costs one rerun. Do not replace it with an email from elsewhere (an account, a profile). Only if the run reports no commits for that identity, check `git shortlog -sne` and pass `--author "<email or name>"` (repeatable for several identities). Other real options:

- `--repo <dir>` (repeatable) to cover several repositories.
- `--since` and `--until` to override the tenure window.
- `--sample <n>` to blame every n-th file in a very large repository. Say so when you report it.
- `--exclude <glob>` to drop more files; `--no-exclusions` to count bots and generated files (not recommended).
- `--copies` to follow copied lines; `--ignore-revs-file <f>` for a blame ignore file.
- `--paths` and `--emails` add directory names and addresses to the report. Both are off by default. Turn them on only if the user asks, because the report may be shared.
- `--out <basename>` and `--format markdown|json|both` choose the output.

It writes `workproof-report.md` (readable, for pasting) and `workproof-report.json` (for checking). Then check what was written:

```
npx workproof check workproof-report.json
npx workproof verify workproof-report.json --repo .
```

`check` is offline and shows the JSON was not edited after it was written. `verify` recomputes every figure in the repository. If a fingerprint key was printed on the first run, keep it and pass `--fingerprint-key <hex>` to `verify`; the user should keep the JSON and the key.

Further commands exist for stronger evidence: `workproof attest` (in-toto statement, optionally signed with `--local <ssh-key>`) and `workproof countersign` (a second person recomputes and signs). Run `npx workproof --help` for the exact usage before using them.

## How to read the output

Under "In plain language" each repository starts with a paragraph derived from the figures by a fixed rule. The two numbers to keep apart are the share of commits in the tenure window and the share of surviving lines at HEAD. Bot commits and generated, vendored, lock and snapshot files are removed first, and the report says how many. Quote the report; do not add claims it does not make. `--narrate` adds a model-written paragraph that is labelled unverified and is not part of the hash; use it only if the user sets up the endpoint variables.

## What it cannot show

- It measures survivorship and activity, not quality, review, design or mentoring.
- It does not rank people and does not replace references.
- `check` does not prove the repository history is real: someone who edits a figure and recomputes the hash passes `check`. Pair the report with letters from people who were there, or an attestation.
- It is not a legal document and not a productivity metric.
- It does not put commits on the GitHub contribution graph.
