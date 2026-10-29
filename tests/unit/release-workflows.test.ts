import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// REQ-281: the publish workflows decide the dist-tag and the image tags from
// the version. The decision is a shell step; run it as the runner would.
const ROOT = path.resolve(__dirname, "..", "..", "..");
const workflow = (name: string) =>
  fs.readFileSync(path.join(ROOT, ".github", "workflows", name), "utf8");

/** The `run:` body of the step named `name`, unindented. */
function stepScript(yaml: string, name: string): string {
  const start = yaml.indexOf(`- name: ${name}`);
  assert.ok(start >= 0, `no step named ${name}`);
  const run = yaml.indexOf("run: |", start);
  const lines = yaml
    .slice(run + "run: |".length)
    .split("\n")
    .slice(1);
  const body: string[] = [];
  const indent = /^(\s*)/.exec(lines[0])![1].length;
  for (const line of lines) {
    if (line.trim() && /^(\s*)/.exec(line)![1].length < indent) break;
    body.push(line.slice(indent));
  }
  return body.join("\n");
}

/** What the step writes to GITHUB_OUTPUT for a pushed tag of this version. */
function publishSettings(file: string, version: string): Record<string, string> {
  const dir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "specgate-rel-"));
  const out = path.join(dir, "out");
  fs.writeFileSync(out, "");
  const script = stepScript(workflow(file), "Set publish settings")
    // The expressions GitHub fills in before the shell runs.
    .replace(/\$\{\{ steps\.package_metadata\.outputs\.version \}\}/g, version)
    .replace(/\$\{\{ github\.event\.inputs\.[a-z_]+ \}\}/g, "");
  const run = spawnSync("bash", ["-c", script], {
    encoding: "utf8",
    env: { ...process.env, GITHUB_EVENT_NAME: "push", GITHUB_OUTPUT: out },
  });
  assert.equal(run.status, 0, run.stderr);
  return Object.fromEntries(
    fs
      .readFileSync(out, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split("=", 2) as [string, string])
  );
}

const bash = spawnSync("bash", ["-c", "true"]).status === 0;

test("REQ-281 SCN-281a: the first 1.0 release candidate", { skip: !bash && "no bash" }, () => {
  for (const file of ["publish-npm.yml", "publish-github-packages.yml"]) {
    assert.equal(publishSettings(file, "1.0.0-rc.1").dist_tag, "next", file);
  }
  const docker = workflow("publish-docker.yml");
  assert.match(
    docker,
    /type=raw,value=latest,enable=\$\{\{ !contains\(github\.ref_name, '-'\) \}\}/
  );
  assert.doesNotMatch(
    docker,
    /specgate:latest --version/,
    "the smoke test runs the version it built"
  );
});

test("REQ-281 SCN-281b: a final version", { skip: !bash && "no bash" }, () => {
  for (const file of ["publish-npm.yml", "publish-github-packages.yml"]) {
    assert.equal(publishSettings(file, "0.27.9").dist_tag, "latest", file);
  }
  const docker = workflow("publish-docker.yml");
  assert.match(docker, /type=semver,pattern=\{\{version\}\}/);
  assert.match(docker, /type=semver,pattern=\{\{major\}\}\.\{\{minor\}\}/);
});
