// Reads licence text so a third-party tool is only ever run, or adapted, as its licence allows.
// Copyleft is checked first and wins: a file that carries both an MIT text and an MPL notice
// (git-fame does) reads as MPL, because the stricter terms apply to the code in that notice.
const COPYLEFT = [
  // The version must follow the title: the GPL-3.0 text itself mentions the Affero and Lesser licences
  // in its last section and in section 13, and must still read as GPL-3.0.
  ["AGPL-3.0", /GNU\s+AFFERO\s+GENERAL\s+PUBLIC\s+LICENSE\s+Version\s+\d/i],
  ["LGPL", /GNU\s+LESSER\s+GENERAL\s+PUBLIC\s+LICENSE\s+Version\s+\d/i],
  ["GPL-3.0", /GNU\s+GENERAL\s+PUBLIC\s+LICENSE\s+Version\s+3/i],
  ["GPL-2.0", /GNU\s+GENERAL\s+PUBLIC\s+LICENSE\s+Version\s+2/i],
  ["MPL-2.0", /Mozilla\s+Public\s+License,?\s+(?:Version|v\.?)\s*2\.0/i],
];
const PERMISSIVE = [
  ["Apache-2.0", /Apache\s+License\s+Version\s+2\.0/i],
  ["MIT", /Permission\s+is\s+hereby\s+granted,\s+free\s+of\s+charge,\s+to\s+any\s+person\s+obtaining\s+a\s+copy/i],
  ["BSD", /Redistribution\s+and\s+use\s+in\s+source\s+and\s+binary\s+forms/i],
];

export function classifyLicence(text) {
  for (const [id, re] of COPYLEFT) if (re.test(text)) return id;
  for (const [id, re] of PERMISSIVE) if (re.test(text)) return id;
  return "unknown";
}

/** Code under these licences may be adapted, keeping the copyright line the licence requires. */
export const mayAdapt = (id) => ["MIT", "Apache-2.0", "BSD"].includes(id);
