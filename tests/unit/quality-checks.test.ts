"use strict";

/**
 * REQ-218, REQ-219, REQ-232 — the quality checks of the gate: read and
 * validated, run by stage in `check`, and run in their container.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const { readQuality } = require("../../packages/core/src/domain/QualityChecks");
const quality = () => require("../../scripts/lib/quality-run");

/** A freshly adopted project — its own gate passes — with the given checks. */
function project(config: string) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-quality-"));
  madeDirs.push(parent);
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"d","version":"1.0.0"}');
  fs.writeFileSync(path.join(dir, "lib/index.js"), "module.exports = {};\n");
  const adopt = spawnSync(
    process.execPath,
    [CLI, "adopt", "--project-dir", dir, "--no-capabilities"],
    { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }
  );
  assert.equal(adopt.status, 0, adopt.stdout + adopt.stderr);
  const file = path.join(dir, "harness.config.yaml");
  const kept = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "harness_version: 1\n";
  fs.writeFileSync(file, `${kept.trimEnd()}\n${config}`);
  return dir;
}

function cli(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

const json = (r: { stdout: string }) => JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));

// ── REQ-218 ─────────────────────────────────────────────────────────────────

test("REQ-218 SCN-218a: a valid list of checks is listed with the level's thresholds", () => {
  const dir = project(
    [
      "quality: strict",
      "checks:",
      "  - name: spotbugs",
      '    run: "./mvnw -B spotbugs:check"',
      "    when: attempt",
      "  - name: pit",
      '    run: "./mvnw -B pitest:mutationCoverage"',
      "    when: end",
      "    gate: false",
      "",
    ].join("\n")
  );
  const r = cli(dir, "quality", "list", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const q = json(r).quality;
  assert.equal(q.level, "strict");
  assert.equal(q.diffCoverage, 85);
  assert.equal(q.mutationScore, 70);
  assert.deepEqual(
    q.checks.map((c: { name: string; when: string; gate: boolean }) => [c.name, c.when, c.gate]),
    [
      ["spotbugs", "attempt", true],
      ["pit", "end", false],
    ]
  );
});

test("REQ-218 SCN-218b: a secret written into the file is refused", () => {
  const { errors } = readQuality({
    checks: [{ name: "sonar", run: "sonar-scanner", env: ["SONAR_TOKEN=abc"] }],
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /env` lists names only/);
  const dir = project(
    'checks:\n  - name: sonar\n    run: "sonar-scanner"\n    env: [SONAR_TOKEN=abc]\n'
  );
  const r = cli(dir, "quality", "list");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /names only/);
});

test("REQ-218 SCN-218c: a host folder mounted into a container is refused", () => {
  const { errors } = readQuality({
    checks: [
      {
        name: "semgrep",
        run: "semgrep scan",
        runner: "docker",
        image: "semgrep/semgrep",
        volumes: ["/home/me:/data"],
      },
    ],
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /never a host folder/);
});

// ── REQ-219 ─────────────────────────────────────────────────────────────────

const failing = (gate: boolean, when = "attempt") =>
  [
    "checks:",
    "  - name: lint",
    `    run: 'node -e "process.exit(1)"'`,
    "    runner: local",
    `    when: ${when}`,
    `    gate: ${gate}`,
    "",
  ].join("\n");

test("REQ-219 SCN-219a: a failing gating check fails the gate", () => {
  const dir = project(failing(true));
  const r = cli(dir, "check", "--json");
  assert.notEqual(r.status, 0, r.stdout);
  assert.match(r.stdout + r.stderr, /check_quality_failed/);
  assert.match(r.stdout + r.stderr, /lint/);
});

test("REQ-219 SCN-219b: an advisory check never fails it", () => {
  const dir = project(failing(false));
  const r = cli(dir, "check", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const lint = json(r).check.quality.find((o: { name: string }) => o.name === "lint");
  assert.equal(lint.ok, false);
  assert.equal(lint.gate, false);
});

test("REQ-219 SCN-219c: the ci stage runs only with --ci", () => {
  const dir = project(failing(true, "ci"));
  const plain = cli(dir, "check", "--json");
  assert.equal(plain.status, 0, plain.stdout + plain.stderr);
  assert.deepEqual(json(plain).check.quality, []);
  const ci = cli(dir, "check", "--ci", "--json");
  assert.notEqual(ci.status, 0);
  assert.match(ci.stdout + ci.stderr, /lint/);
  const run = cli(dir, "quality", "run", "--stage", "ci", "--json");
  assert.notEqual(run.status, 0, "quality run runs a stage on its own");
});

// ── REQ-232 ─────────────────────────────────────────────────────────────────

test("REQ-232 SCN-232a: the container's command line", () => {
  const { config } = readQuality({
    checks: [
      {
        name: "semgrep",
        run: "semgrep scan --sarif",
        runner: "docker",
        image: "semgrep/semgrep",
        network: false,
        env: ["SONAR_TOKEN"],
        volumes: ["specgate-cache:/cache"],
      },
    ],
  });
  const args = quality().dockerArgs(config.checks[0], "/work/app", "semgrep scan --sarif", "c1");
  const at = (flag: string) => args[args.indexOf(flag) + 1];
  assert.equal(at("-w"), "/src");
  assert.ok(args.includes(`${path.resolve("/work/app")}:/src`));
  assert.equal(at("--network"), "none");
  assert.equal(at("-e"), "SONAR_TOKEN", "the name only, never a value");
  assert.ok(args.includes("specgate-cache:/cache"));
  assert.deepEqual(args.slice(-5, -1), ["--entrypoint", "sh", "semgrep/semgrep", "-c"]);
  // With a cache volume on Linux and macOS the command is wrapped to hand
  // its files back to the person; it is still the command that runs.
  assert.ok(args[args.length - 1].includes("semgrep scan --sarif"));
  assert.ok(!args.some((a: string) => /SONAR_TOKEN=/.test(a)));
});

test("REQ-232 SCN-232a: a check run as the person has a home it can write", () => {
  const { config } = readQuality({
    checks: [{ name: "semgrep", run: "semgrep scan", runner: "docker", image: "semgrep/semgrep" }],
  });
  const args = quality().dockerArgs(config.checks[0], "/work/app", "semgrep scan", "c1");
  // An image's own user owns its home; anyone else, such as uid 1001 on a CI
  // runner, gets "/" and cannot write a cache there.
  if (args.includes("--user")) assert.ok(args.includes("HOME=/tmp"), args.join(" "));
  else assert.ok(!args.includes("HOME=/tmp"), "the image's own user keeps its home");
});

// ── REQ-238 ─────────────────────────────────────────────────────────────────

test("REQ-238 SCN-238a: a check that reaches Docker, and one that does not", () => {
  const { config } = readQuality({
    checks: [
      { name: "coverage", run: "mvn test", runner: "docker", image: "maven:3.9", docker: true },
      { name: "pmd", run: "mvn pmd:pmd", runner: "docker", image: "maven:3.9" },
    ],
  });
  const withDocker = quality().dockerArgs(config.checks[0], "/work/app", "mvn test", "c1");
  assert.ok(withDocker.includes("/var/run/docker.sock:/var/run/docker.sock"), withDocker.join(" "));
  assert.ok(withDocker.includes("TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal"));
  assert.ok(withDocker.includes("host.docker.internal:host-gateway"));
  const without = quality().dockerArgs(config.checks[1], "/work/app", "mvn pmd:pmd", "c2");
  assert.ok(!without.some((a: string) => a.includes("docker.sock")), without.join(" "));
});

// ── REQ-239 ─────────────────────────────────────────────────────────────────

test("REQ-239 SCN-239a: the JSON says why a check failed", () => {
  const dir = project(
    ["checks:", "  - name: noisy", '    run: "node fail.js"', "    runner: local", ""].join("\n")
  );
  fs.writeFileSync(path.join(dir, "fail.js"), "console.log('boom'); process.exit(1);");
  const r = cli(dir, "quality", "run", "--json");
  assert.notEqual(r.status, 0);
  const outcome = json(r).quality.outcomes[0];
  assert.equal(outcome.ok, false);
  assert.match(outcome.output, /boom/);
});

test("REQ-254 SCN-254a: Docker Desktop on Windows containers", () => {
  const { dockerVerdict } = quality();
  assert.equal(dockerVerdict({ status: 0, stdout: "linux\n" }), null);
  assert.match(
    String(dockerVerdict({ status: 0, stdout: "windows\n" })),
    /switch Docker Desktop to Linux containers/
  );
  assert.match(String(dockerVerdict({ status: 1, stdout: "" })), /not running/);
});

const docker = quality().dockerAvailable();

test(
  "REQ-232 SCN-232b: a check really runs in Docker",
  { skip: docker ? false : "Docker is not running on this machine" },
  () => {
    const check = [
      "checks:",
      "  - name: marker",
      '    run: "test -f /src/marker.txt"',
      "    runner: docker",
      "    image: alpine:3.20",
      "    network: false",
      "",
    ].join("\n");
    const withMarker = project(check);
    fs.writeFileSync(path.join(withMarker, "marker.txt"), "x\n");
    const ok = cli(withMarker, "quality", "run", "--json");
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.equal(json(ok).quality.outcomes[0].runner, "docker");
    const without = project(check);
    const ko = cli(without, "quality", "run", "--json");
    assert.notEqual(ko.status, 0);
  }
);
