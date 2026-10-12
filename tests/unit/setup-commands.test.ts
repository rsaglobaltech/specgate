/**
 * Unit tests for the Phase 2 setup commands' pure helpers:
 * config init (TEMPLATE) and completion (COMMANDS / script generators).
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import { TEMPLATE } from "../../scripts/config_init.js";
import { COMMANDS, SUBCOMMANDS, bashScript, zshScript } from "../../scripts/completion.js";

const { commandNames, subcommandNames } = require("../../scripts/lib/surface");

test("config init TEMPLATE contains every required key", () => {
  for (const key of [
    "PROJECT_NAME",
    "PROJECT_SLUG",
    "PROJECT_TYPE",
    "DOMAIN",
    "STACK",
    "API_STYLE",
    "TESTING",
  ]) {
    assert.match(TEMPLATE, new RegExp(`^${key}:`, "m"), `${key} should be present`);
  }
});

test("completion COMMANDS lists the user-facing commands", () => {
  for (const cmd of ["init", "validate", "status", "req", "fix", "doctor", "completion"]) {
    assert.ok(COMMANDS.includes(cmd), `${cmd} should be completable`);
  }
});

test("bash completion script names the commands and registers the function", () => {
  const s = bashScript();
  assert.match(s, /complete -F _specgate specgate create-spec-driven-app/);
  assert.match(s, /status/);
  // sub-command case arms are present
  for (const sub of SUBCOMMANDS.req) assert.match(s, new RegExp(sub));
});

test("zsh completion script is compdef-tagged and registers the function", () => {
  const s = zshScript();
  assert.match(s, /#compdef specgate create-spec-driven-app/);
  assert.match(s, /compdef _specgate specgate create-spec-driven-app/);
  assert.match(s, /doctor/);
});

test("completion COMMANDS is the surface registry, not a second list", () => {
  // This used to scrape `command === "…"` out of the dispatcher with a regex,
  // which is why it only ever compared top-level names and let four
  // sub-commands ship uncompletable. The dispatcher now routes from the
  // registry, so the guarantee is structural — what is left to check is that
  // completion did not grow a copy of its own again.
  assert.deepEqual(COMMANDS, commandNames());
  assert.deepEqual(SUBCOMMANDS, subcommandNames());
});
