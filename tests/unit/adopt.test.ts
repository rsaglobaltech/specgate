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

function cli(args, options = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    ...options,
  });
}

function withTmp(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "csda-adopt-"));
  try {
    return fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Brownfield fixture: a Spring Boot / HAPI FHIR Maven project with code. */
function makeMavenProject(tmp) {
  const dir = path.join(tmp, "hie-his-platform");
  fs.mkdirSync(path.join(dir, "src", "main", "java", "com", "hie"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "pom.xml"),
    `<?xml version="1.0"?>
<project>
  <name>HIE/HIS Platform</name>
  <artifactId>hie-his-platform</artifactId>
  <properties><java.version>21</java.version></properties>
  <dependencies>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
    <dependency><groupId>ca.uhn.hapi.fhir</groupId><artifactId>hapi-fhir-base</artifactId></dependency>
    <dependency><groupId>org.testcontainers</groupId><artifactId>testcontainers</artifactId></dependency>
  </dependencies>
</project>
`,
    "utf8"
  );
  fs.writeFileSync(path.join(dir, "README.md"), "# Existing README — do not touch\n", "utf8");
  fs.writeFileSync(
    path.join(dir, "src", "main", "java", "com", "hie", "App.java"),
    "public class App {}\n",
    "utf8"
  );
  return dir;
}

test("adopt on a Maven project detects the stack and passes validate", () => {
  withTmp((tmp) => {
    const dir = makeMavenProject(tmp);
    const readmeBefore = fs.readFileSync(path.join(dir, "README.md"), "utf8");
    const javaBefore = fs.readFileSync(
      path.join(dir, "src", "main", "java", "com", "hie", "App.java"),
      "utf8"
    );

    const r = cli([
      "adopt",
      "--project-dir",
      dir,
      "--keep-matrix",
      "--var",
      "DOMAIN=health information exchange",
    ]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Stack detection: pom\.xml/);
    assert.match(r.stdout, /Java 21, Spring Boot, HAPI FHIR, Maven/);
    assert.match(r.stdout, /mvn -B test/);

    // SDD artifacts generated.
    for (const f of [
      "spec.md",
      "AGENTS.md",
      "features/adoption/baseline.feature",
      "docs/specs/traceability.md",
      "docs/specs/adr/README.md",
    ]) {
      assert.ok(fs.existsSync(path.join(dir, f)), `missing ${f}`);
    }
    assert.match(fs.readFileSync(path.join(dir, "spec.md"), "utf8"), /HIE\/HIS Platform/);
    assert.match(fs.readFileSync(path.join(dir, "spec.md"), "utf8"), /health information exchange/);

    // Existing files untouched.
    assert.equal(fs.readFileSync(path.join(dir, "README.md"), "utf8"), readmeBefore);
    assert.equal(
      fs.readFileSync(path.join(dir, "src", "main", "java", "com", "hie", "App.java"), "utf8"),
      javaBefore
    );

    // The adopted project validates immediately — the A1 acceptance criterion.
    const v = cli(["validate", dir]);
    assert.equal(v.status, 0, v.stdout + v.stderr);
    const strict = cli(["validate", dir, "--strict-tdd"]);
    assert.equal(strict.status, 0, strict.stdout + strict.stderr);
  });
});

test("adopt on a Node project reads package.json facts", () => {
  withTmp((tmp) => {
    const dir = path.join(tmp, "web-api");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: "@acme/web-api",
        scripts: { test: "vitest run" },
        devDependencies: { typescript: "^5", vitest: "^2" },
        dependencies: { express: "^4" },
      }),
      "utf8"
    );

    const r = cli(["adopt", "--project-dir", dir, "--keep-matrix"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Stack detection: package\.json/);
    assert.match(r.stdout, /Node\.js, TypeScript, express/);
    const rules = fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8");
    assert.match(rules, /web-api/);
    assert.match(rules, /Vitest/);
    assert.match(rules, /npm test/);
    // README was missing → adopt creates a stub so validate passes.
    assert.ok(fs.existsSync(path.join(dir, "README.md")));

    const v = cli(["validate", dir]);
    assert.equal(v.status, 0, v.stdout + v.stderr);
  });
});

test("#44: after adoption, check names the test command it found and how to turn it on", () => {
  withTmp((tmp) => {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ name: "booking", scripts: { test: "node -e 0" } }),
      "utf8"
    );
    const a = cli(["adopt", "--project-dir", tmp]);
    assert.equal(a.status, 0, a.stdout + a.stderr);
    assert.match(a.stdout, /Test command: npm test/);

    // Adoption does not switch the tests on: the first gate stays the
    // specification, as documented. But it no longer contradicts adoption.
    const c = cli(["check"], { cwd: tmp });
    assert.equal(c.status, 0, c.stdout + c.stderr);
    assert.match(c.stdout, /looks like `npm test`/);
    assert.match(c.stdout, /specgate config set test_cmd/);

    assert.equal(cli(["harness", "init", "--project-dir", tmp]).status, 0);
    const after = cli(["check"], { cwd: tmp });
    assert.match(after.stdout, /the specification and `npm test`/, after.stdout + after.stderr);
  });
});

test("#60: init passes --no-capabilities to the adoption it runs", () => {
  withTmp((tmp) => {
    fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "fresh" }), "utf8");
    fs.mkdirSync(path.join(tmp, "packages/core/src"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "packages/core/src/a.ts"), "export {};\n", "utf8");
    const r = cli(["init", "--no-capabilities"], { cwd: tmp });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const spec = fs.readFileSync(path.join(tmp, "spec.md"), "utf8");
    assert.deepEqual(spec.match(/^## REQ-\d+/gm), ["## REQ-001"], "no folder-named proposals");
  });
});

test("adopt refuses a project that already has spec.md", () => {
  withTmp((tmp) => {
    const dir = path.join(tmp, "already");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n", "utf8");
    const r = cli(["adopt", "--project-dir", dir, "--keep-matrix"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /already exists/);
    assert.match(r.stderr, /specgate status/);
  });
});

test("adopt --dry-run writes nothing", () => {
  withTmp((tmp) => {
    const dir = makeMavenProject(tmp);
    const r = cli(["adopt", "--project-dir", dir, "--keep-matrix", "--dry-run"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /\[dry-run\] write spec\.md/);
    assert.ok(!fs.existsSync(path.join(dir, "spec.md")));
    assert.ok(!fs.existsSync(path.join(dir, "features")));
  });
});

test("adopt never overwrites an existing artifact", () => {
  withTmp((tmp) => {
    const dir = makeMavenProject(tmp);
    fs.writeFileSync(path.join(dir, "AI_RULES.md"), "# My custom rules\n", "utf8");
    fs.writeFileSync(path.join(dir, "AGENTS.md"), "# Our agent notes\n\nUse pnpm.\n", "utf8");
    const r = cli(["adopt", "--project-dir", dir, "--keep-matrix"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    // AI_RULES.md stays the team's until `specgate update` moves it (ADR-0031).
    assert.equal(fs.readFileSync(path.join(dir, "AI_RULES.md"), "utf8"), "# My custom rules\n");
    // The team's AGENTS.md keeps its text; the contract arrives in a marked block.
    const agents = fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8");
    assert.match(agents, /specgate:begin/);
    assert.match(agents, /# Our agent notes\n\nUse pnpm\./);
    assert.match(r.stdout, /add the specgate block to AGENTS\.md \(your text kept\)/);
  });
});

test("adopt with no build manifest warns but still validates", () => {
  withTmp((tmp) => {
    const dir = path.join(tmp, "bare");
    fs.mkdirSync(dir, { recursive: true });
    const r = cli(["adopt", "--project-dir", dir, "--keep-matrix"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Could not detect the stack/);
    const v = cli(["validate", dir]);
    assert.equal(v.status, 0, v.stdout + v.stderr);
  });
});

test("a fresh adoption passes validate, but says it certifies nothing (H15)", () => {
  // `adopt` writes a baseline scenario so day-one validation passes — that is
  // deliberate. What it must not do is stay silent afterwards: `lixi-platform`
  // sat on the untouched skeleton for months while CI reported a clean gate.
  withTmp((tmp) => {
    const dir = makeMavenProject(tmp);
    assert.equal(cli(["adopt", "--project-dir", dir, "--keep-matrix"]).status, 0);

    const v = cli(["validate", dir]);
    assert.equal(v.status, 0, "an un-retro-filled adoption still passes");
    assert.match(v.stdout, /Adoption never retro-filled/);

    const doc = JSON.parse(cli(["validate", dir, "--json"]).stdout);
    assert.equal(doc.validation.passed, true);
    assert.equal(doc.validation.adoptionRetrofilled, false);
    assert.ok(doc.status.some((d) => d.code === "adoption_not_retrofilled"));
  });
});

test("the warning goes away as soon as one real scenario exists (H15)", () => {
  withTmp((tmp) => {
    const dir = makeMavenProject(tmp);
    cli(["adopt", "--project-dir", dir, "--keep-matrix"]);
    fs.mkdirSync(path.join(dir, "features", "patient"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "features", "patient", "lookup.feature"),
      "Feature: Patient lookup\n  Scenario: found\n    Given a patient\n    When looked up\n    Then it is returned\n",
      "utf8"
    );
    const matrix = path.join(dir, "docs", "specs", "traceability.md");
    fs.appendFileSync(
      matrix,
      "| REQ-002 | SCN-002 | `features/patient/lookup.feature` | UC-002 | - | - | - | src | test | Draft |\n",
      "utf8"
    );

    const v = cli(["validate", dir]);
    assert.equal(v.status, 0, v.stdout + v.stderr);
    assert.doesNotMatch(v.stdout, /Adoption never retro-filled/);

    const doc = JSON.parse(cli(["validate", dir, "--json"]).stdout);
    assert.equal(doc.validation.adoptionRetrofilled, true);
  });
});

test("adopt seeds one proposed requirement per capability the layout implies", () => {
  // The seam that used to lose the whole point: onboard read eight capabilities
  // and adopt wrote a placeholder. Adoption died right there — measured on
  // lixi-platform, adopted months ago and still on REQ-001 alone.
  withTmp((tmp) => {
    const dir = path.join(tmp, "shop");
    for (const area of ["booking", "billing", "identity"]) {
      fs.mkdirSync(path.join(dir, "domain", area), { recursive: true });
      fs.writeFileSync(path.join(dir, "domain", area, "Entity.ts"), "//", "utf8");
      fs.writeFileSync(path.join(dir, "domain", area, "Repo.ts"), "//", "utf8");
    }
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "shop" }), "utf8");

    const r = cli(["adopt", "--project-dir", dir, "--keep-matrix"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Requirements seeded: 3 proposal/);

    const spec = fs.readFileSync(path.join(dir, "spec.md"), "utf8");
    for (const area of ["Booking", "Billing", "Identity"]) {
      assert.match(spec, new RegExp(`## REQ-\\d+ — ${area}`));
    }
    // Every seeded requirement says it is a guess and names its evidence.
    assert.match(spec, /\*\*Proposed, not specified\.\*\* Read off `domain\/booking`/);

    // A seeded requirement without a row would fail --strict-tdd (TDD-3).
    const matrix = fs.readFileSync(path.join(dir, "docs", "specs", "traceability.md"), "utf8");
    assert.match(matrix, /\| REQ-002 \|.*`domain\/\w+` \| TBD \| Draft \|/);

    assert.equal(cli(["validate", dir]).status, 0);
    const strict = cli(["validate", dir, "--strict-tdd"]);
    assert.equal(strict.status, 0, strict.stdout + strict.stderr);
  });
});

test("adopt --no-capabilities writes the skeleton and nothing more", () => {
  withTmp((tmp) => {
    const dir = path.join(tmp, "shop");
    fs.mkdirSync(path.join(dir, "domain", "booking"), { recursive: true });
    fs.writeFileSync(path.join(dir, "domain", "booking", "a.ts"), "//", "utf8");
    fs.mkdirSync(path.join(dir, "domain", "billing"), { recursive: true });
    fs.writeFileSync(path.join(dir, "domain", "billing", "b.ts"), "//", "utf8");
    fs.writeFileSync(path.join(dir, "package.json"), "{}", "utf8");

    const r = cli(["adopt", "--project-dir", dir, "--keep-matrix", "--no-capabilities"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout, /Requirements seeded/);
    const spec = fs.readFileSync(path.join(dir, "spec.md"), "utf8");
    assert.match(spec, /REQ-001/);
    assert.doesNotMatch(spec, /REQ-002/);
    assert.equal(cli(["validate", dir]).status, 0);
  });
});

test("adopt --monorepo adopts every declared module and writes the config", () => {
  withTmp((tmp) => {
    const dir = path.join(tmp, "platform");
    for (const mod of ["services/orders", "services/billing"]) {
      const pkg = path.join(dir, mod, "src", "main", "java", "com", "acme");
      fs.mkdirSync(pkg, { recursive: true });
      fs.writeFileSync(path.join(pkg, "App.java"), "//", "utf8");
      fs.writeFileSync(path.join(dir, mod, "build.gradle"), "apply plugin: 'java'", "utf8");
    }
    fs.writeFileSync(path.join(dir, "settings.gradle"), "include 'orders','billing'", "utf8");

    const r = cli(["adopt", "--project-dir", dir, "--keep-matrix", "--monorepo"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const cfg = fs.readFileSync(path.join(dir, "specops.config.yaml"), "utf8");
    assert.match(cfg, /- path: services\/billing/);
    assert.match(cfg, /- path: services\/orders/);
    for (const mod of ["services/orders", "services/billing"]) {
      assert.ok(fs.existsSync(path.join(dir, mod, "spec.md")), `${mod} adopted`);
    }
    // The root is not a project of its own: monorepo mode validates the children.
    assert.ok(!fs.existsSync(path.join(dir, "spec.md")));

    const v = cli(["validate", dir]);
    assert.equal(v.status, 0, v.stdout + v.stderr);
    assert.match(v.stdout, /2\/2 project\(s\) passed/);
  });
});

test("adopt --monorepo refuses a repository that declares no modules", () => {
  withTmp((tmp) => {
    const dir = makeMavenProject(tmp);
    const r = cli(["adopt", "--project-dir", dir, "--keep-matrix", "--monorepo"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /found 0 declared module/);
    assert.match(r.stderr, /specgate adopt/);
    assert.ok(!fs.existsSync(path.join(dir, "specops.config.yaml")));
  });
});

test("adopt --monorepo leaves an already adopted module alone", () => {
  withTmp((tmp) => {
    const dir = path.join(tmp, "platform");
    for (const mod of ["a", "b"]) {
      fs.mkdirSync(path.join(dir, mod, "src"), { recursive: true });
      fs.writeFileSync(path.join(dir, mod, "src", "x.ts"), "//", "utf8");
      fs.writeFileSync(path.join(dir, mod, "package.json"), JSON.stringify({ name: mod }), "utf8");
    }
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ workspaces: ["*"] }), "utf8");
    fs.writeFileSync(path.join(dir, "a", "spec.md"), "# Mine — do not touch\n", "utf8");

    const r = cli(["adopt", "--project-dir", dir, "--keep-matrix", "--monorepo"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /skip \(already adopted\): a/);
    assert.equal(
      fs.readFileSync(path.join(dir, "a", "spec.md"), "utf8"),
      "# Mine — do not touch\n"
    );
    // It still appears in the config: monorepo mode must validate it too.
    assert.match(fs.readFileSync(path.join(dir, "specops.config.yaml"), "utf8"), /- path: a/);
  });
});

// ── #69: the project's own name, not its parent's ────────────────────────────
test("#69: a Maven project is named by its own artifactId, not its parent's", () => {
  const { pomProjectName } = require("../../scripts/cli/commands/project/AdoptCommand");
  const pom =
    "<project><!-- <name>commented</name> -->\n" +
    "  <parent><groupId>org.springframework.boot</groupId>" +
    "<artifactId>spring-boot-starter-parent</artifactId><version>3.3.4</version></parent>\n" +
    "  <groupId>com.demo</groupId><artifactId>tienda</artifactId>\n" +
    "  <organization><name>ACME</name></organization>\n" +
    "  <dependencies><dependency><artifactId>spring-boot-starter-web</artifactId>" +
    "</dependency></dependencies>\n</project>\n";
  assert.equal(pomProjectName(pom), "tienda");
  assert.equal(
    pomProjectName(pom.replace("<groupId>com.demo", "<name>Tienda online</name><groupId>com.demo")),
    "Tienda online"
  );
  // A name that is only a property reference falls back to the artifactId.
  assert.equal(
    pomProjectName(
      pom.replace("<groupId>com.demo", "<name>${project.artifactId}</name><groupId>com.demo")
    ),
    "tienda"
  );
});

test("#69: a Gradle project is named by rootProject.name and its real build file", () => {
  const { detectStack } = require("../../scripts/cli/commands/project/AdoptCommand");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "csda-gradle-name-"));
  try {
    fs.writeFileSync(
      path.join(dir, "build.gradle.kts"),
      'plugins { id("org.springframework.boot") }\n'
    );
    fs.writeFileSync(path.join(dir, "settings.gradle.kts"), 'rootProject.name = "reservas"\n');
    const facts = detectStack(dir);
    assert.equal(facts.PROJECT_NAME, "reservas");
    assert.equal(facts.detected, "build.gradle.kts");
    assert.match(facts.STACK, /Spring Boot, Gradle/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
