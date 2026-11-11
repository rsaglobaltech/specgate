/**
 * studio-phase3-json: `config` says the file each setting lives in (REQ-505),
 * lists every key (REQ-506), and writes agent profiles (REQ-507), quality
 * checks and ALM settings (REQ-508) — never a credential.
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";
import { cliJson, newProject, removeProject, write } from "../helpers/project";
import { runCli } from "../helpers/cli";
import {
  readTokenPrices,
  resolveProfileAgent,
} from "../../packages/core/src/infrastructure/HarnessConfigFile";
import { setYamlListItem, setYamlValue } from "../../packages/core/src/domain/YamlEdit";

const set = (dir: string, ...args: string[]) =>
  runCli(["config", "set", ...args, "--project-dir", dir]);
const read = (dir: string, rel: string) =>
  fs.readFileSync(path.join(dir, ...rel.split("/")), "utf8");

test("REQ-505 SCN-505a: list and get say the file each key is kept in", () => {
  const dir = newProject("sg-config-");
  try {
    assert.equal(set(dir, "test_cmd", "npm test").status, 0);
    assert.equal(set(dir, "pet", "off").status, 0);
    const list = cliJson(dir, "config", "list").doc;
    assert.equal(list.files.test_cmd, "harness.config.yaml");
    assert.equal(list.files.pet, ".specgate/config.json");
    const get = cliJson(dir, "config", "get", "pet").doc;
    assert.deepEqual(get, {
      config: { pet: "off" },
      files: { pet: ".specgate/config.json" },
      status: [],
    });
    const setAnswer = cliJson(dir, "config", "set", "arch_cmd", "node arch.js").doc;
    assert.deepEqual(setAnswer.files, { arch_cmd: "harness.config.yaml" });
  } finally {
    removeProject(dir);
  }
});

test("REQ-506 SCN-506a: the catalog gives each key its values, default, current value and file, a profile's once per name", () => {
  const dir = newProject("sg-config-");
  try {
    write(dir, "harness.config.yaml", 'harness_version: 1\ntest_cmd: "npm test"\n');
    write(
      dir,
      ".harness/profiles.yaml",
      'profiles:\n  fast:\n    agent: "claude -p < {prompt_file}"\n'
    );
    const { status, doc } = cliJson(dir, "config", "keys");
    assert.equal(status, 0);
    const key = (k: string) => doc.keys.find((x: { key: string }) => x.key === k);
    assert.equal(key("test_cmd").current, "npm test");
    assert.equal(key("test_cmd").file, "harness.config.yaml");
    assert.deepEqual(key("pet").values, ["on", "off"]);
    assert.equal(key("pet").default, "on");
    assert.equal(key("profiles.<name>.agent").file, ".harness/profiles.yaml");
    assert.equal(key("profiles.<name>.agent").current, null);
    assert.equal(key("profiles.fast.agent").current, "claude -p < {prompt_file}");
    assert.equal(key("profiles.fast.agent").file, ".harness/profiles.yaml");
    assert.equal(key("alm.token_env").pattern, "^[A-Z_][A-Z0-9_]*$");
    for (const k of doc.keys) {
      assert.deepEqual(
        Object.keys(k).sort(),
        ["current", "default", "description", "file", "key", "pattern", "values"],
        k.key
      );
    }
  } finally {
    removeProject(dir);
  }
});

test("REQ-507 SCN-507a: a profile written into .harness/profiles.yaml, read by the harness; a bad price refused, the file unchanged", () => {
  const dir = newProject("sg-config-");
  try {
    assert.equal(set(dir, "profiles.fast.agent", "claude -p < {prompt_file}").status, 0);
    assert.equal(set(dir, "profiles.fast.price_per_input_token", "0.000003").status, 0);
    assert.equal(resolveProfileAgent(dir, "fast"), "claude -p < {prompt_file}");
    const before = read(dir, ".harness/profiles.yaml");

    const bad = cliJson(dir, "config", "set", "profiles.fast.price_per_output_token", "cheap");
    assert.equal(bad.status, 2);
    assert.equal(bad.doc.status[0].code, "config_value_invalid");
    assert.ok(bad.doc.status[0].fix);
    assert.equal(read(dir, ".harness/profiles.yaml"), before);

    assert.equal(set(dir, "profiles.fast.price_per_output_token", "0.000015").status, 0);
    assert.deepEqual(readTokenPrices(dir).fast, {
      input: 0.000003,
      output: 0.000015,
      cacheRead: 0.000003,
      cacheWrite: 0.000003,
    });

    for (const [k, v] of [
      ["profiles.fast.agent", "claude -p"],
      ["profiles.fast.advisory", "yes"],
      ["profiles.fast.cost_per_run_hint", "-1"],
      ["profiles.no way.agent", "x {prompt_file}"],
      ["agent_profile", "slow"],
    ]) {
      const r = cliJson(dir, "config", "set", k, v);
      assert.equal(r.status, 2, `${k} ${v}`);
      assert.equal(r.doc.status[0].code, "config_value_invalid", `${k} ${v}`);
    }
    assert.equal(set(dir, "agent_profile", "fast").status, 0);
    assert.match(read(dir, "harness.config.yaml"), /^agent_profile: "fast"$/m);
  } finally {
    removeProject(dir);
  }
});

test("REQ-508 SCN-508a: a check and the Jira settings written; a token and a stage that does not exist refused", () => {
  const dir = newProject("sg-config-");
  try {
    write(
      dir,
      "harness.config.yaml",
      'harness_version: 1\n# the gate\'s commands\ntest_cmd: "npm test"\n'
    );
    assert.equal(set(dir, "checks.lint.run", "npm run lint").status, 0);
    assert.equal(set(dir, "checks.lint.when", "end").status, 0);
    assert.equal(set(dir, "alm.provider", "jira").status, 0);
    assert.equal(set(dir, "alm.token_env", "JIRA_TOKEN").status, 0);

    const quality = cliJson(dir, "quality", "list").doc;
    const lint = JSON.stringify(quality);
    assert.match(lint, /"lint"/);
    assert.match(lint, /"end"/);
    assert.match(read(dir, "harness.config.yaml"), /# the gate's commands/, "comments are kept");
    const alm = read(dir, "alm.config.yaml");
    assert.match(alm, /^alm_version: 1$/m);
    assert.match(alm, /^provider: "jira"$/m);
    assert.match(alm, /^token_env: "JIRA_TOKEN"$/m);

    const harnessBefore = read(dir, "harness.config.yaml");
    const token = cliJson(dir, "config", "set", "alm.token_env", "ATATT3xFfGF0abc=123");
    assert.equal(token.status, 2);
    assert.equal(token.doc.status[0].code, "config_value_invalid");
    assert.match(token.doc.status[0].fix, /environment variable/);
    const stage = cliJson(dir, "config", "set", "checks.lint.when", "later");
    assert.equal(stage.status, 2);
    assert.equal(stage.doc.status[0].code, "config_value_invalid");
    assert.ok(stage.doc.status[0].fix);
    assert.equal(read(dir, "alm.config.yaml"), alm);
    assert.equal(read(dir, "harness.config.yaml"), harnessBefore);

    // No key stores a credential.
    const secret = cliJson(dir, "config", "set", "alm.token", "abc");
    assert.equal(secret.status, 2);
    assert.equal(secret.doc.status[0].code, "config_key_unknown");
    assert.match(secret.doc.status[0].fix, /never stored/);

    // A field of a check that does not exist yet: add it with run first.
    const orphan = cliJson(dir, "config", "set", "checks.audit.when", "ci");
    assert.equal(orphan.status, 2);
    assert.match(orphan.doc.status[0].fix, /checks\.audit\.run/);

    // What the reader would refuse is not written: a docker check needs its image.
    const docker = cliJson(dir, "config", "set", "checks.lint.runner", "docker");
    assert.equal(docker.status, 2);
    assert.equal(read(dir, "harness.config.yaml"), harnessBefore);

    assert.equal(set(dir, "alm.pr.base", "main").status, 0);
    assert.match(read(dir, "alm.config.yaml"), /^pr:\r?\n {2}base: "main"$/m);
    assert.equal(cliJson(dir, "config", "get", "alm.pr.base").doc.config["alm.pr.base"], "main");
  } finally {
    removeProject(dir);
  }
});

test("REQ-507 REQ-508: the YAML is edited line by line, CRLF and comments kept", () => {
  const crlf = 'profiles:\r\n  # the fast one\r\n  fast:\r\n    agent: "a {prompt_file}"\r\n';
  assert.equal(
    setYamlValue(crlf, ["profiles", "fast", "advisory"], "true"),
    'profiles:\r\n  # the fast one\r\n  fast:\r\n    agent: "a {prompt_file}"\r\n    advisory: true\r\n'
  );
  assert.equal(
    setYamlValue('profiles:\n  fast:\n    agent: "a"\n', ["profiles", "slow", "agent"], '"b"'),
    'profiles:\n  fast:\n    agent: "a"\n  slow:\n    agent: "b"\n'
  );
  const checks = 'checks:\n  - name: lint\n    run: "npm run lint"\n# after\nother: 1\n';
  assert.equal(
    setYamlListItem(checks, "checks", "lint", "when", "end"),
    'checks:\n  - name: lint\n    run: "npm run lint"\n    when: end\n# after\nother: 1\n'
  );
  assert.equal(
    setYamlListItem(checks, "checks", "audit", "run", '"npm audit"'),
    'checks:\n  - name: lint\n    run: "npm run lint"\n  - name: "audit"\n    run: "npm audit"\n# after\nother: 1\n'
  );
});
