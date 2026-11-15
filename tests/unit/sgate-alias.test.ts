"use strict";

/**
 * REQ-555 — `sgate` is a short alias of `specgate` (ADR-0042): the same entry
 * point, and completion for it in every shell (change sgate-alias).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
const { BINARIES, GENERATORS } = require("../../scripts/cli/commands/config/CompletionCommand");

test("REQ-555 SCN-555a: the short alias", () => {
  assert.equal(pkg.bin.sgate, pkg.bin.specgate, "sgate runs the same entry point");
  const version = (bin: string) =>
    spawnSync(process.execPath, [path.join(ROOT_DIR, pkg.bin[bin]), "--version"], {
      encoding: "utf8",
    }).stdout.trim();
  assert.equal(version("sgate"), version("specgate"));
  assert.ok(version("sgate").includes(pkg.version), version("sgate"));

  for (const shell of ["bash", "zsh", "fish"]) {
    const script = GENERATORS[shell]();
    assert.match(script, /\bsgate\b/, `${shell} completion does not register sgate`);
  }
  assert.match(GENERATORS.bash(), /complete -F _specgate specgate sgate /);
  assert.match(
    GENERATORS.fish(),
    /complete -c sgate -n "__fish_seen_subcommand_from apply"|complete -c sgate -n __fish_use_subcommand/
  );
});

test("REQ-555: completion names exactly what the package installs", () => {
  assert.deepEqual([...BINARIES].sort(), Object.keys(pkg.bin).sort());
  // One line per binary, not two for the first: the fish script repeated `specgate`.
  const fish = GENERATORS.fish().split("\n");
  assert.equal(new Set(fish).size, fish.length, "a fish completion line is repeated");
});
