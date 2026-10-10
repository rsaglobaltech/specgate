"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");
const PKG = require(path.join(ROOT_DIR, "package.json"));

function cli(...args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });
}

function withTmp(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "csda-ci-"));
  try {
    return fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const CASES = [
  { provider: "github", dest: ".github/workflows/spec-gate.yml", marker: "actions/checkout@v4" },
  { provider: "gitlab", dest: ".gitlab-ci.yml", marker: "spec-gate:" },
  { provider: "azure", dest: "azure-pipelines.yml", marker: "vmImage: ubuntu-latest" },
  { provider: "jenkins", dest: "Jenkinsfile", marker: "pipeline {" },
];

for (const { provider, dest, marker } of CASES) {
  test(`ci init --provider ${provider} writes ${dest} with the gate`, () => {
    withTmp((tmp) => {
      const r = cli("ci", "init", "--provider", provider, "--project-dir", tmp);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const file = path.join(tmp, dest);
      assert.ok(fs.existsSync(file), `missing ${dest}`);
      const content = fs.readFileSync(file, "utf8");
      assert.ok(content.includes(marker), `missing marker '${marker}'`);
      assert.match(content, /validate \. --strict\b/);
      assert.match(content, /plan --project-dir \. --format json/);
      // The pack-drift gate, guarded so a project without packs is unaffected.
      assert.match(content, /validate \. --against-lock/);
      assert.match(content, /\.specops\.lock/);
      // Version is pinned, not 'latest', for reproducible CI.
      assert.ok(content.includes(`${PKG.name}@${PKG.version}`));
      // No unresolved template tokens.
      assert.ok(!/\{\{[A-Z_]+\}\}/.test(content));
    });
  });
}

test("ci init refuses to overwrite an existing config and points to --stdout", () => {
  withTmp((tmp) => {
    fs.writeFileSync(path.join(tmp, ".gitlab-ci.yml"), "existing: config\n", "utf8");
    const r = cli("ci", "init", "--provider", "gitlab", "--project-dir", tmp);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /refusing to overwrite/);
    assert.match(r.stderr, /--stdout/);
    assert.equal(fs.readFileSync(path.join(tmp, ".gitlab-ci.yml"), "utf8"), "existing: config\n");
  });
});

test("ci init --stdout prints the config without touching disk", () => {
  withTmp((tmp) => {
    const r = cli("ci", "init", "--provider", "jenkins", "--project-dir", tmp, "--stdout");
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /pipeline \{/);
    assert.ok(!fs.existsSync(path.join(tmp, "Jenkinsfile")));
  });
});

test("ci init rejects an unknown provider with the supported list", () => {
  const r = cli("ci", "init", "--provider", "bamboo");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Unknown provider: bamboo/);
  assert.match(r.stderr, /github, gitlab, azure, jenkins/);
});

test("ci without init subcommand fails clearly", () => {
  const r = cli("ci");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Unknown ci sub-command: \(none\)\. Expected: init/);
});

// ── The gate has to run what its own comment promises ────────────────────────
//
// The generated workflow opens by saying "no PR merges if a requirement loses
// its feature file, its test artifact, or its traceability row". It ran
// `validate . --strict-tdd`, which never touches the filesystem — so a matrix
// pointing at a deleted test file passed, exit 0. `--strict-links` is the flag
// that checks the paths, and it was in neither the generated file nor the docs.
// Two of three cold adoptions found this independently.

for (const { provider, dest } of CASES) {
  test(`ci init --provider ${provider} runs the link check it promises`, () => {
    withTmp((tmp) => {
      const r = cli("ci", "init", "--provider", provider, "--project-dir", tmp);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const body = fs.readFileSync(path.join(tmp, dest), "utf8");
      assert.match(
        body,
        // One name for the gate: round 2 found nine other places still saying
        // `--strict-tdd`, which made this one look like the mistake.
        /validate \. --strict\b/,
        `${provider}: the gate claims to catch a lost test artifact, so it must run --strict-links`
      );
    });
  });
}

test("ci init without --provider uses the one the origin remote names", () => {
  // `init` ends by suggesting `specgate ci init`; it used to be a usage error.
  withTmp((tmp) => {
    spawnSync("git", ["init", "-q"], { cwd: tmp });
    spawnSync("git", ["remote", "add", "origin", "git@github.com:acme/shop.git"], { cwd: tmp });
    const r = cli("ci", "init", "--project-dir", tmp);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /provider: github \(detected from the origin remote\)/);
    assert.ok(fs.existsSync(path.join(tmp, ".github/workflows/spec-gate.yml")));
  });
});

test("ci init without --provider prefers the CI file already in the repo", () => {
  withTmp((tmp) => {
    fs.writeFileSync(path.join(tmp, "Jenkinsfile"), "pipeline {}\n");
    const r = cli("ci", "init", "--project-dir", tmp, "--stdout");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /pipeline \{/);
    assert.doesNotMatch(r.stdout, /detected/, "--stdout is the file and nothing else");
    assert.match(r.stderr, /provider: jenkins/);
  });
});

test("ci init without --provider and nothing to detect still asks for one", () => {
  withTmp((tmp) => {
    const r = cli("ci", "init", "--project-dir", tmp);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--provider is required/);
  });
});

// ── #70: the job runs the project's tests, with the project's toolchain ──────
// A Spring Boot project with a class deleted stayed green in CI: the job had
// Node and `validate . --strict`, no JDK and no `mvn test`.

const SPRING_POM =
  "<project><modelVersion>4.0.0</modelVersion>" +
  "<parent><groupId>org.springframework.boot</groupId>" +
  "<artifactId>spring-boot-starter-parent</artifactId><version>3.3.4</version></parent>" +
  "<artifactId>tienda</artifactId><properties><java.version>17</java.version></properties>" +
  "</project>\n";

function render(tmp, provider) {
  const r = cli("ci", "init", "--provider", provider, "--project-dir", tmp, "--stdout");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!/\{\{[A-Z_]+\}\}/.test(r.stdout), "no unresolved template tokens");
  return r.stdout;
}

test("a Maven project gets a JDK and a gate that runs its tests", () => {
  withTmp((tmp) => {
    fs.writeFileSync(path.join(tmp, "pom.xml"), SPRING_POM);
    const gh = render(tmp, "github");
    assert.match(gh, /actions\/setup-java@v4/);
    assert.match(gh, /java-version: '17'/);
    assert.match(gh, /cache: maven/);
    assert.match(gh, /specgate@\S+ check \. --test-cmd 'mvn -B test'/);

    const gl = render(tmp, "gitlab");
    assert.match(gl, /image: maven:3-eclipse-temurin-17/);
    // The JDK image has no Node: it is fetched and its checksum verified.
    assert.match(gl, /sha256sum -c --ignore-missing SHASUMS256\.txt/);
    assert.match(gl, /check \. --test-cmd 'mvn -B test'/);

    assert.match(render(tmp, "azure"), /JavaToolInstaller@0[\s\S]*versionSpec: '17'/);
    assert.match(render(tmp, "jenkins"), /image 'maven:3-eclipse-temurin-17'/);
  });
});

test("a configured test_cmd is read by check, not copied into the job", () => {
  withTmp((tmp) => {
    fs.writeFileSync(path.join(tmp, "pom.xml"), SPRING_POM);
    fs.writeFileSync(
      path.join(tmp, "harness.config.yaml"),
      'harness_version: 1\ntest_cmd: "mvn -q -B verify"\n'
    );
    const gh = render(tmp, "github");
    assert.match(gh, /specgate@\S+ check \.\n/);
    assert.doesNotMatch(gh, /--test-cmd/);
  });
});

test("a Gradle Kotlin project gets its Java version and the Gradle cache", () => {
  withTmp((tmp) => {
    fs.writeFileSync(
      path.join(tmp, "build.gradle.kts"),
      "plugins { java }\njava { toolchain { languageVersion = JavaLanguageVersion.of(17) } }\n"
    );
    fs.writeFileSync(path.join(tmp, "gradlew"), "#!/bin/sh\n");
    const gh = render(tmp, "github");
    assert.match(gh, /java-version: '17'/);
    assert.match(gh, /cache: gradle/);
    assert.match(gh, /check \. --test-cmd '\.\/gradlew test'/);
    assert.match(render(tmp, "gitlab"), /image: gradle:jdk17/);
  });
});

test("a Node project installs its dependencies before the gate", () => {
  withTmp((tmp) => {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ name: "shop", scripts: { test: "node --test" } })
    );
    fs.writeFileSync(path.join(tmp, "package-lock.json"), "{}");
    const gh = render(tmp, "github");
    assert.match(gh, /- run: npm ci/);
    assert.doesNotMatch(gh, /setup-java/);
    assert.match(gh, /check \. --test-cmd 'npm test'/);
    assert.match(render(tmp, "gitlab"), /image: node:22[\s\S]*- npm ci/);
  });
});

test("ci init says which tests the job runs", () => {
  withTmp((tmp) => {
    fs.writeFileSync(path.join(tmp, "pom.xml"), SPRING_POM);
    const r = cli("ci", "init", "--provider", "github", "--project-dir", tmp);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /specgate check/);
    assert.match(r.stdout, /mvn -B test/);
  });
});
