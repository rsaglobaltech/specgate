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

test("REQ-556 SCN-556a: the publish job is ready for OIDC", () => {
  const yaml = workflow("publish-npm.yml");
  const job = yaml.slice(yaml.indexOf("\n  publish:"));
  assert.match(job, /id-token: write/, "OIDC needs id-token: write");
  const npmStep = job.indexOf("npm install -g npm@^11.5.1");
  assert.ok(npmStep > 0, "npm 11.5.1+ is installed in the job");
  assert.ok(npmStep < job.indexOf("- name: Publish\n"), "before publishing");
  // The token reaches only the steps that talk to the registry as the publisher.
  const steps = job.split(/\n {6}- name: /).slice(1);
  const withToken = steps
    .filter((s) => s.includes("secrets.NPM_TOKEN"))
    .map((s) => s.split("\n")[0].trim());
  assert.deepEqual(withToken.sort(), [
    "Check package version availability",
    "Publish",
    "Publish (dry run)",
  ]);
  const doc = fs.readFileSync(path.join(ROOT, "docs", "release-process.md"), "utf8");
  assert.match(doc, /## Trusted publishing/);
  assert.match(doc, /disallow tokens/);
});

test("REQ-571 SCN-571a: the version is checked against the public surface before it is published", () => {
  const yaml = workflow("publish-npm.yml");
  const job = yaml.slice(yaml.indexOf("\n  publish:"), yaml.indexOf("\n  smoke:"));
  const check = job.indexOf(
    'npm run contract:check -- --release "${{ steps.package_metadata.outputs.version }}"'
  );
  assert.ok(check > 0, "the publish job runs contract:check --release");
  assert.ok(check < job.indexOf("- name: Publish\n"), "before publishing");
  assert.ok(job.indexOf("npm run test:all") < check, "after the build the suite runs");
});

test("REQ-572 SCN-572a: the published package is installed and used, under its dist-tag", () => {
  const yaml = workflow("publish-npm.yml");
  const smoke = yaml.slice(yaml.indexOf("\n  smoke:"));
  assert.match(smoke, /needs: publish/);
  assert.match(smoke, /if: needs\.publish\.outputs\.dry_run != 'true'/);
  assert.match(smoke, /npm view "\$\{PACKAGE\}" "dist-tags\.\$\{DIST_TAG\}"/);
  assert.match(smoke, /npm install --no-audit --no-fund "\$\{PACKAGE\}@\$\{VERSION\}"/);
  assert.match(smoke, /npx --no-install specgate --version/);
  assert.match(smoke, /npx --no-install sgate --version/);
  assert.match(smoke, /npx --no-install specgate init --yes/);
  assert.match(smoke, /specgate status --json/);
  for (const out of ["name", "version", "dist_tag", "dry_run"]) {
    assert.match(yaml, new RegExp(`\\n      ${out}: \\$\\{\\{ steps\\.`), `publish exposes ${out}`);
  }
});
