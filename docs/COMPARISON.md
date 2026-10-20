# How workproof compares

Generated on 2026-10-20 on darwin/arm64 with Node v24.13.0 and git 2.50.1 (Apple Git-155), by `node bench/comparison/run.mjs` and `node bench/comparison/render.mjs`. Do not edit this page by hand: `test/comparison-doc.test.mjs` renders it again from `bench/comparison/results.json` and fails on any difference.

Every tool is run twice on the same repository: once with its defaults, and once tuned by hand with the best flags it offers for the row. The verdict compares workproof with the tuned result, so a tool that does the job once tuned is a tie even when workproof needs no flags. Third-party code is run, never copied.

## Tools run

| tool | version | licence | policy |
|---|---|---|---|
| git-fame | 4.2.1 | MPL-2.0 | run-only |
| gitinspector | v0.5.1 | GPL-3.0 | run-only |
| git-quick-stats | 2.11.0 | MIT | adapt-ok |
| contributions-importer | 2.0.2 | MIT | adapt-ok |
| git-who | v1.3 | MIT | adapt-ok |
| onefetch | 3.1.0 | MIT | adapt-ok |

## Repositories

- Fixture A: the deterministic test fixture: two people, a bot, a generated file, a reformat commit in .git-blame-ignore-revs. Reference answer from `git blame` itself for Ada: 16 surviving lines of 31.
- Fixture B: https://github.com/Bubblegunn/workproof.git at cd47e6e621f1ea6d7a39bfcd2a16fc0fedc0895e, used for timing only.

## Results

### One author's surviving lines equal what git blame says (honouring .git-blame-ignore-revs)

| tool | default | tuned by hand | vs workproof |
|---|---|---|---|
| workproof | pass: 16 lines (git blame: 16) | pass: 16 lines (git blame: 16) | |
| git-fame | fail: 10 lines (git blame: 16) | pass: 16 lines (git blame: 16) | tie |
| gitinspector | fail: 7 lines (git blame: 16) | fail: 7 lines (git blame: 16) | ours ahead |

### Lock files and files marked linguist-generated add no lines to anyone

| tool | default | tuned by hand | vs workproof |
|---|---|---|---|
| workproof | pass: 31 lines in total (expected 31) | pass: 31 lines in total (expected 31) | |
| git-fame | fail: 59 lines in total (expected 31) | pass: 31 lines in total (expected 31) | tie |
| gitinspector | fail: 31 lines in total (expected 31); a coincidence: the generated or lock-file lines are counted in this run | fail: 23 lines in total (expected 31) | ours ahead |

gitinspector's default total equals the expected total only by coincidence: generated lines are still counted in that run. Its tuned run excludes them and does not equal the expected total either. So the row never passes for gitinspector. It does not show that gitinspector cannot exclude generated files.

### A bot is not listed as an author

| tool | default | tuned by hand | vs workproof |
|---|---|---|---|
| workproof | pass: 1 bot commits removed before counting | pass: 1 bot commits removed before counting | |
| git-fame | fail: a bot appears in the output | fail: a bot appears in the output | ours ahead |
| gitinspector | pass: no bot in the output | pass: no bot in the output | tie |
| git-who | fail: a bot appears in the output | pass: no bot in the output | tie |
| git-quick-stats | n/a: GNU date is not installed on this machine | n/a: GNU date is not installed on this machine | not comparable |

### The default output contains no email address

| tool | default | tuned by hand | vs workproof |
|---|---|---|---|
| workproof | pass: no email address printed | pass: no email address printed | |
| git-fame | pass: no email address printed | pass: no email address printed | tie |
| gitinspector | fail: an email address is printed | fail: an email address is printed | ours ahead |
| git-who | pass: no email address printed | pass: no email address printed | tie |
| onefetch | fail: an email address is printed | fail: an email address is printed | ours ahead |
| git-quick-stats | n/a: GNU date is not installed on this machine | n/a: GNU date is not installed on this machine | not comparable |

### The tool can check a report it wrote earlier (a verify or attest command)

| tool | default | tuned by hand | vs workproof |
|---|---|---|---|
| workproof | pass: help mentions verify or attest | pass: help mentions verify or attest | |
| git-fame | fail: no verify or attest in the help | fail: no verify or attest in the help | ours ahead |
| gitinspector | fail: no verify or attest in the help | fail: no verify or attest in the help | ours ahead |
| git-who | fail: no verify or attest in the help | fail: no verify or attest in the help | ours ahead |
| onefetch | fail: no verify or attest in the help | fail: no verify or attest in the help | ours ahead |
| git-quick-stats | n/a: no help text could be read | n/a: no help text could be read | not comparable |

### Runs as a git subcommand (git <name>)

| tool | default | tuned by hand | vs workproof |
|---|---|---|---|
| workproof | fail: executables: workproof | fail: executables: workproof | |
| git-fame | pass: executables: git-fame | pass: executables: git-fame | ours behind |
| git-who | pass: executables: git-who | pass: executables: git-who | ours behind |
| git-quick-stats | pass: executables: git-quick-stats | pass: executables: git-quick-stats | ours behind |

### Writes CSV, HTML or XML besides JSON

| tool | default | tuned by hand | vs workproof |
|---|---|---|---|
| workproof | fail: none of csv, html, xml | fail: none of csv, html, xml | |
| git-fame | pass: csv, html | pass: csv, html | ours behind |
| gitinspector | pass: html, xml | pass: html, xml | ours behind |
| git-who | pass: csv | pass: csv | ours behind |
| onefetch | fail: none of csv, html, xml | fail: none of csv, html, xml | neither |

### Wall-clock time on a real history (median of three runs, fixture B)

| tool | milliseconds | vs workproof |
|---|---|---|
| workproof | 521 | |
| git-fame | 364 | ours behind |
| gitinspector | 478 | tie |
| git-who | 53 | ours behind |
| onefetch | 61 | ours behind |
| git-quick-stats | did not run | not comparable |

### Puts private work on the GitHub contribution graph

| tool | default | tuned by hand | vs workproof |
|---|---|---|---|
| workproof | fail: no, by design: workproof writes a document a reader can check, not commits (README: a badge is a claim, not evidence) | fail: no, by design: workproof writes a document a reader can check, not commits (README: a badge is a claim, not evidence) | |
| contributions-importer | pass: yes: copies commit metadata into a target repository (not run here: it needs a GitHub token and writes commits) | pass: yes: copies commit metadata into a target repository (not run here: it needs a GitHub token and writes commits) | ours behind |

## Measurement notes

- git-quick-stats is not comparable on this machine: it needs GNU date, which the macOS run did not have. Every git-quick-stats cell is n/a. That is a missing dependency on the run machine, not a finding about git-quick-stats.
- The Linux sha256 checksums in pins.json for git-who and onefetch are unverified. No Linux run has checked them.
- Timing comes from one machine and one history (fixture B), each run three times and the median kept. Treat the milliseconds as a single observation.

## What can be claimed

Launch text may claim only these rows, which workproof wins or ties.

- One author's surviving lines equal what git blame says (honouring .git-blame-ignore-revs) (against git-fame): tie
- One author's surviving lines equal what git blame says (honouring .git-blame-ignore-revs) (against gitinspector): ours ahead
- Lock files and files marked linguist-generated add no lines to anyone (against git-fame): tie
- Lock files and files marked linguist-generated add no lines to anyone (against gitinspector): ours ahead
- A bot is not listed as an author (against git-fame): ours ahead
- A bot is not listed as an author (against gitinspector): tie
- A bot is not listed as an author (against git-who): tie
- The default output contains no email address (against git-fame): tie
- The default output contains no email address (against gitinspector): ours ahead
- The default output contains no email address (against git-who): tie
- The default output contains no email address (against onefetch): ours ahead
- The tool can check a report it wrote earlier (a verify or attest command) (against git-fame): ours ahead
- The tool can check a report it wrote earlier (a verify or attest command) (against gitinspector): ours ahead
- The tool can check a report it wrote earlier (a verify or attest command) (against git-who): ours ahead
- The tool can check a report it wrote earlier (a verify or attest command) (against onefetch): ours ahead
- Wall-clock time on a real history (median of three runs, fixture B) (against gitinspector): tie

## Stated losses

Rows where workproof is behind. They stay on this page.

- Runs as a git subcommand (git <name>) (against git-fame): ours behind
- Runs as a git subcommand (git <name>) (against git-who): ours behind
- Runs as a git subcommand (git <name>) (against git-quick-stats): ours behind
- Writes CSV, HTML or XML besides JSON (against git-fame): ours behind
- Writes CSV, HTML or XML besides JSON (against gitinspector): ours behind
- Writes CSV, HTML or XML besides JSON (against git-who): ours behind
- Wall-clock time on a real history (median of three runs, fixture B) (against git-fame): ours behind
- Wall-clock time on a real history (median of three runs, fixture B) (against git-who): ours behind
- Wall-clock time on a real history (median of three runs, fixture B) (against onefetch): ours behind
- Puts private work on the GitHub contribution graph (against contributions-importer): ours behind

## Not compared

Rows where a tool could not run on this machine, or does not report the figure.

- A bot is not listed as an author (against git-quick-stats): not comparable
- The default output contains no email address (against git-quick-stats): not comparable
- The tool can check a report it wrote earlier (a verify or attest command) (against git-quick-stats): not comparable
- Writes CSV, HTML or XML besides JSON (against onefetch): neither
- Wall-clock time on a real history (median of three runs, fixture B) (against git-quick-stats): not comparable
