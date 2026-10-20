import type { Commit } from "../git.js";
import { configuredEmail, configuredName } from "../git.js";
import { isBotIdentity } from "./bot.js";
import type { Identity } from "./types.js";


/**
 * Fold a name or address for matching. Two things defeat a plain `toLowerCase()`:
 *
 * Normalization. A repository authored on Linux can carry "José" decomposed while the same name
 * typed on macOS arrives precomposed. They are the same name and compared unequal, and the error
 * then listed an author that looked identical to what was typed, which nobody can debug.
 *
 * The Turkish dotted and dotless i. `"İ".toLowerCase()` is "i" followed by a combining dot above,
 * and `"I".toLowerCase()` is "i" rather than "ı", so "İSMAİL YILMAZ" matched neither "İsmail
 * Yılmaz" nor itself lowercased. A locale-aware fold cannot be applied globally, because it would
 * turn English "I" into "ı", so the four i forms collapse to one instead. The cost is that two
 * names differing only in dotted and dotless i match each other; the benefit is that a Turkish
 * name matches itself in any case, and the error message prints the folded form that was tried.
 *
 * The German sharp s. `"WEISS".toLowerCase()` is "weiss" and `"Weiß".toLowerCase()` is "weiß",
 * because JavaScript's `toLowerCase` is Unicode's simple case fold. The full fold maps ß to ss
 * (CaseFolding.txt, status F, https://www.unicode.org/Public/UCD/latest/ucd/CaseFolding.txt), so
 * ß and capital ẞ are mapped before it runs. Without this, one person who signs both ways was two
 * people, and half their commits were left out of every figure.
 *
 * Compatibility spellings. A name typed in fullwidth Latin letters, which is what a Japanese or
 * Korean keyboard produces without switching modes, is the same name typed in ASCII; NFKC is what
 * says so. It folds the ﬁ ligature and the compatibility ideographs with it.
 *
 * This fold decides which commits are counted, so a gap in it is a wrong figure rather than a
 * cosmetic problem. It is never a display form: the report prints the name git holds.
 */
export function foldIdentity(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\u0130\u0131Ii]/g, "i")
    .replace(/\u0307/g, "")
    .replace(/[\u00df\u1e9e]/g, "ss")
    .toLowerCase()
    .normalize("NFKC")
    .trim();
}

/**
 * Resolve the author to report on. `author` entries match mailmapped emails or
 * names, case-insensitively; with none given, the repository's configured
 * user.email is used.
 */
export async function resolveIdentity(commits: Commit[], author: string[] | undefined, cwd: string): Promise<Identity> {
  const explicit = author && author.length ? author : [];
  // Without --author, try the configured email, then the configured name.
  const wanted = (explicit.length ? explicit : [await configuredEmail(cwd), await configuredName(cwd)]).filter(Boolean).map(foldIdentity).filter(Boolean);
  if (!wanted.length) throw new Error(`no author given and git config has no user.email or user.name; pass --author. ${authorsHint(commits)}`);
  const emails = new Set<string>();
  const names = new Set<string>();
  for (const c of commits) {
    if (wanted.includes(foldIdentity(c.email)) || wanted.includes(foldIdentity(c.name))) {
      emails.add(c.email);
      names.add(c.name);
    }
  }
  if (!emails.size) throw new Error(`no commits by ${wanted.join(" or ")} in this repository, comparing names and addresses folded to that form. ${authorsHint(commits)}`);
  return { emails: [...emails].sort(), names: [...names].sort() };
}

/** The most frequent author names, so the error tells the user what to pass. */
function authorsHint(commits: Commit[]): string {
  const counts = new Map<string, number>();
  for (const c of commits) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => `"${name}" (${n})`);
  return top.length ? `Authors here: ${top.join(", ")}. Pass one with --author.` : "The repository has no commits.";
}

export const isMine = (c: Commit, id: Identity): boolean => id.emails.includes(c.email);

/** Local parts that belong to a role rather than a person, so sharing one proves nothing. */
const GENERIC_LOCAL = new Set(["dev", "admin", "info", "me", "git", "hello", "mail", "noreply", "no-reply", "contact", "support", "team", "root", "user", "build", "ci", "bot", "test", "email", "work", "home"]);


/** The GitHub login inside `12345+login@users.noreply.github.com`, or the older form. */
const githubLogin = (mail: string): string | null => {
  const m = /^(?:\d+\+)?([^@+]+)@users\.noreply\.github\.com$/i.exec(mail);
  return m ? m[1]!.toLowerCase() : null;
};

const localPart = (mail: string) => mail.split("@")[0]!.replace(/^\d+\+/, "");
const loose = (s: string) => foldIdentity(s).replace(/[\s._-]/g, "");

/**
 * Fixed strings that say why an address was flagged, with nothing taken from the other
 * identity. These are what a report written without `--emails` carries, so none of them may
 * be built from a name, login, local part or address.
 */
export const SPLIT_HINT = "Re-run with --emails to see which addresses.";

export const SPLIT_CATEGORY = {
  sameName: "same name on another address",
  login: "GitHub login matches",
  local: "address name matches",
  otherDomain: "same address name on another domain",
} as const;

/**
 * Addresses in this repository that look like the subject but were not counted as them.
 *
 * A person who commits from a laptop and a work machine is two authors to git, so a report
 * describes half of their work and says nothing about the other half. That is a silent wrong
 * number in a tool whose whole claim is that its numbers can be checked, so the report
 * discloses the suspicion rather than quietly resolving it: only the author knows whether two
 * addresses are one person, and `--author` takes both when they are.
 */
export function possibleSplits(
  commits: { name: string; email: string }[],
  identity: { emails: string[]; names: string[] },
): { name: string; email: string; reason: string; category: string }[] {
  const mine = new Set(identity.emails.map(foldIdentity));
  const myNames = identity.names.map(foldIdentity);
  const myLogins = identity.emails.map(githubLogin).filter((l): l is string => l !== null);
  const myLocals = identity.emails.map(localPart);

  const seen = new Set<string>();
  const out: { name: string; email: string; reason: string; category: string }[] = [];
  for (const c of commits) {
    const email = c.email;
    if (mine.has(foldIdentity(email)) || seen.has(foldIdentity(email)) || isBotIdentity(email)) continue;
    let reason = "";
    let category = "";
    if (myNames.includes(foldIdentity(c.name))) {
      reason = `the same name, "${c.name}", on another address`;
      category = SPLIT_CATEGORY.sameName;
    } else {
      const theirLogin = githubLogin(email);
      const theirLocal = localPart(email);
      if (theirLogin && (myLocals.some((l) => loose(l) === loose(theirLogin)) || myNames.some((n) => loose(n) === loose(theirLogin)))) {
        reason = `the GitHub login "${theirLogin}" matches yours`;
        category = SPLIT_CATEGORY.login;
      } else if (myLogins.some((l) => loose(l) === loose(theirLocal) || myNames.some((n) => loose(n) === loose(theirLocal)))) {
        reason = `the address name "${theirLocal}" matches your GitHub login`;
        category = SPLIT_CATEGORY.local;
      } else if (!theirLogin && myLocals.some((l) => l === theirLocal && l.length >= 3 && !GENERIC_LOCAL.has(l))) {
        reason = `the same address name, "${theirLocal}", on another domain`;
        category = SPLIT_CATEGORY.otherDomain;
      }
    }
    if (reason) {
      seen.add(foldIdentity(email));
      out.push({ name: c.name, email, reason, category });
    }
  }
  return out;
}
