import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyLicence, mayAdapt } from "../bench/comparison/licence.mjs";
import { ROOT, pins, platformKey, sha256Hex, assertSha256, checkLicence } from "../bench/comparison/fetch.mjs";

const GPL3 = "                    GNU GENERAL PUBLIC LICENSE\n                       Version 3, 29 June 2007\n";
const MPL = "Mozilla Public License Version 2.0\n==================================\n\nThis Source Code Form is subject to the terms of the\nMozilla Public License, v. 2.0.\n";
const MIT = "MIT License\n\nCopyright (c) 2025 Someone\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\n";
const BSD = "Redistribution and use in source and binary forms, with or without\nmodification, are permitted provided that the following conditions are met:\n";
const APACHE = "                                 Apache License\n                           Version 2.0, January 2004\n";

test("licence text is classified, and the most restrictive licence in a mixed file wins", () => {
  assert.equal(classifyLicence(GPL3), "GPL-3.0");
  // The real GPL-3.0 text mentions the Lesser and Affero licences; it must not read as either.
  const GPL3_TAIL = "use the GNU Lesser General Public License instead of this License. under version 3 of the GNU Affero General Public License into a single combined work";
  assert.equal(classifyLicence(`${GPL3}\n${GPL3_TAIL}`), "GPL-3.0");
  assert.equal(classifyLicence("GNU LESSER GENERAL PUBLIC LICENSE\n Version 3, 29 June 2007"), "LGPL");
  assert.equal(classifyLicence("GNU AFFERO GENERAL PUBLIC LICENSE\n Version 3, 19 November 2007"), "AGPL-3.0");
  assert.equal(classifyLicence(MPL), "MPL-2.0");
  assert.equal(classifyLicence(MIT), "MIT");
  assert.equal(classifyLicence(BSD), "BSD");
  assert.equal(classifyLicence(APACHE), "Apache-2.0");
  assert.equal(classifyLicence("all rights reserved"), "unknown");
  // git-fame ships an MPL-2.0 notice next to MIT text: it must read as MPL, never as MIT.
  assert.equal(classifyLicence(`${MIT}\n${MPL}`), "MPL-2.0");
});

test("only permissive licences may be adapted", () => {
  for (const id of ["MIT", "Apache-2.0", "BSD"]) assert.equal(mayAdapt(id), true, id);
  for (const id of ["GPL-3.0", "GPL-2.0", "AGPL-3.0", "LGPL", "MPL-2.0", "unknown"]) assert.equal(mayAdapt(id), false, id);
});

test("checkLicence stops a pin that disagrees with the licence text, or that allows adapting a copyleft tool", () => {
  assert.equal(checkLicence("t", { licence: "MIT", policy: "adapt-ok" }, MIT), "MIT");
  assert.equal(checkLicence("t", { licence: "GPL-3.0", policy: "run-only" }, GPL3), "GPL-3.0");
  assert.throws(() => checkLicence("t", { licence: "MIT", policy: "adapt-ok" }, GPL3), /reads as GPL-3.0, pins.json says MIT/);
  assert.throws(() => checkLicence("t", { licence: "GPL-3.0", policy: "adapt-ok" }, GPL3), /may not be adapted/);
  assert.throws(() => checkLicence("t", { licence: "MIT", policy: "maybe" }, MIT), /policy must be/);
});

test("a download whose sha256 differs from the pin is refused", () => {
  const buf = Buffer.from("hello");
  assertSha256(buf, sha256Hex(buf), "ok");
  assert.throws(() => assertSha256(buf, "0".repeat(64), "asset"), /asset: sha256 is [0-9a-f]{64}, the pin says 0{64}/);
});

test("platform keys name the pinned release assets", () => {
  assert.equal(platformKey("darwin", "arm64"), "darwin_arm64");
  assert.equal(platformKey("linux", "x64"), "linux_amd64");
  assert.throws(() => platformKey("win32", "x64"), /darwin\/linux/);
});

test("pins.json is complete, and no copyleft or unknown tool is marked adaptable", () => {
  const p = pins();
  const names = Object.keys(p.tools).sort();
  assert.deepEqual(names, ["contributions-importer", "git-fame", "git-quick-stats", "git-who", "gitinspector", "onefetch"]);
  for (const [name, t] of Object.entries(p.tools)) {
    assert.ok(["pip", "git", "release"].includes(t.kind), `${name}: kind`);
    assert.ok(["adapt-ok", "run-only"].includes(t.policy), `${name}: policy`);
    assert.ok(t.licence && t.version, `${name}: licence and version`);
    if (!mayAdapt(t.licence)) assert.equal(t.policy, "run-only", `${name} is ${t.licence}, so it is run-only`);
    if (t.kind === "git") assert.match(t.commit, /^[0-9a-f]{40}$/, `${name}: commit`);
    if (t.kind === "release") {
      assert.ok(Object.keys(t.assets).length >= 2, `${name}: assets for at least two platforms`);
      for (const [k, a] of Object.entries(t.assets)) assert.match(a.sha256, /^[0-9a-f]{64}$/, `${name}/${k}: sha256`);
    }
  }
  assert.equal(p.tools["git-fame"].policy, "run-only");
  assert.equal(p.tools["gitinspector"].policy, "run-only");
});

test("_upstream is ignored by git", () => {
  const ignore = readFileSync(join(ROOT, ".gitignore"), "utf8").split("\n").map((l) => l.trim());
  assert.ok(ignore.includes("_upstream/"));
});
