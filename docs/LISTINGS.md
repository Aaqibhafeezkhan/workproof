# Store and directory text

Text for each place where workproof is listed or can be listed. Submitting or changing a listing is a separate step done by the maintainer; this page only holds the text.

## npm

Package: workproof

Title: workproof

Short description (package.json `description`; 161 characters): workproof is a command-line tool that turns a private git repository into a report of one author's work, with a hash a reader can check and no source code in it.

Keywords: git, git-blame, git-stats, git-authorship, engineering-report, contribution-report, private-repository, private-contributions, verifiable, proof-of-work, portfolio, developer-portfolio, resume, hiring, career, authorship, code-ownership, surviving-lines, engineering-evidence, in-toto, sigstore, attestation, github-action, cli

The npm page shows README.md. Its first screen is the problem, `npx workproof`, a recording and the comparison.

## GitHub Marketplace (Action)

Name: workproof report

Marketplace description (122 characters): Writes a verifiable report of one author's work in this repository, with a job summary and an optional signed attestation.

This is the current `description` in `action.yml`. Marketplace accepts fewer than 125 characters, and `action.yml` is not changed in this plan, so a change to the Marketplace text is made at the next release together with its test.

Suggested categories to choose in the Marketplace form: Utilities, Code quality. The maintainer confirms the available options in the form.

## GitHub repository (set by the maintainer with `gh repo edit`)

Description: workproof is a command-line tool that turns a private git repository into a report of one author's work, with a hash a reader can check and no source code in it.

Topics: git, git-blame, git-stats, authorship, engineering-report, private-repository, resume, developer-portfolio, cli, github-action, in-toto, sigstore, typescript, nodejs

Homepage: https://www.npmjs.com/package/workproof (there is no docs site or hosted verifier yet; issue #13 is the hosted verifier).

## Stores that do not apply

- VS Code Marketplace: there is no extension.
- skills.sh and the Claude Code, Codex and Cursor plugin directories: there is no skill or plugin.
- MCP registries: there is no MCP server.
- Homebrew: a formula is prepared in `packaging/homebrew/`, but the tap repository does not exist yet, so nothing is listed.
