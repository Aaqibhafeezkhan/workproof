#!/usr/bin/env node
// Adds the workproof summary to a release body, or replaces it if it is already there.
// Usage: node scripts/action-release.mjs <current-release-body.md> <summary.md> > new-body.md
//
// The summary is the text scripts/action-comment.mjs builds for the pull request comment. It goes
// between two HTML comment markers so a second run replaces the block instead of adding another, and
// so the author's own release notes outside the markers are never touched.
import { readFileSync, realpathSync } from "node:fs";

export const START = "<!-- workproof-release-summary -->";
export const END = "<!-- /workproof-release-summary -->";

export function withSummary(body, summary) {
  const inner = summary.replace(/^<!-- workproof-summary -->\r?\n?/, "").trim();
  if (inner.includes(START) || inner.includes(END)) throw new Error("the summary contains a workproof marker; refusing to write it into a release");
  const block = `${START}\n${inner}\n${END}`;
  const s = body.indexOf(START);
  const e = body.indexOf(END);
  if (s !== -1 && e > s) return body.slice(0, s) + block + body.slice(e + END.length);
  if (s !== -1 && e !== -1 && e < s) throw new Error("the release body has the workproof markers in the wrong order: the end marker comes before the start marker; fix or remove them by hand");
  if (s !== -1 || e !== -1) throw new Error("the release body has one workproof marker but not the other; fix or remove it by hand");
  const trimmed = body.replace(/\s+$/, "");
  return (trimmed ? `${trimmed}\n\n` : "") + block + "\n";
}

// realpath on both sides: a symlinked temp directory otherwise makes the paths differ and the script
// exits 0 without printing anything.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(import.meta.filename)) {
  const [bodyPath, summaryPath] = process.argv.slice(2);
  if (!bodyPath || !summaryPath) {
    console.error("usage: node scripts/action-release.mjs <current-release-body.md> <summary.md>");
    process.exit(2);
  }
  try {
    process.stdout.write(withSummary(readFileSync(bodyPath, "utf8"), readFileSync(summaryPath, "utf8")));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
