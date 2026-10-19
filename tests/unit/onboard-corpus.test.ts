"use strict";

/**
 * Layout corpus — the guard against tuning `onboard` to whatever repository was
 * open at the time.
 *
 * Each fixture reproduces the *shape* of a well-known public project: the
 * directories, the build manifests, and enough source files to weigh. They were
 * built by reading the real trees (`git/trees?recursive=1`) of the projects they
 * name, and the expectations below are what those projects would themselves say
 * their parts are.
 *
 * Two rules this suite exists to hold:
 *
 *   1. **Never a confident wrong answer.** Proposing a packaging directory as a
 *      bounded context is worse than proposing nothing, because someone will
 *      believe it. `ripgrep` is here because it used to answer `pkg/brew`.
 *   2. **Silence is a valid answer.** A flat library has no capability
 *      structure, and inventing one would be a lie. `cobra` and `express` are
 *      here to keep that possible.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { proposeCapabilities } = require("../../scripts/onboard");

/** Materialise a layout: paths ending in `/` are directories, the rest files. */
function layout(paths: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "corpus-"));
  for (const p of paths) {
    const full = path.join(dir, p);
    if (p.endsWith("/")) fs.mkdirSync(full, { recursive: true });
    else {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, "");
    }
  }
  return dir;
}

/** `n` source files under `dir`, so a capability has something to weigh. */
function code(dir: string, ext: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${dir}/File${i}${ext}`);
}

function idsOf(dir: string): string[] {
  try {
    return proposeCapabilities(dir)
      .map((c: { id: string }) => c.id)
      .sort();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("Maven multi-module: the modules are the capabilities (apache/dubbo)", () => {
  const dir = layout([
    "pom.xml",
    "dubbo-common/pom.xml",
    ...code("dubbo-common/src/main/java/org/apache/dubbo/common", ".java", 12),
    "dubbo-rpc/pom.xml",
    ...code("dubbo-rpc/src/main/java/org/apache/dubbo/rpc", ".java", 9),
    "dubbo-registry/pom.xml",
    ...code("dubbo-registry/src/main/java/org/apache/dubbo/registry", ".java", 5),
  ]);
  assert.deepEqual(idsOf(dir), ["dubbo-common", "dubbo-registry", "dubbo-rpc"]);
});

test("Gradle multi-module with a build-logic module (ktorio/ktor)", () => {
  const dir = layout([
    "settings.gradle.kts",
    "build-logic/build.gradle.kts",
    ...code("build-logic/src/main/kotlin", ".kt", 8),
    "ktor-server/build.gradle.kts",
    ...code("ktor-server/common/src/io/ktor/server", ".kt", 20),
    "ktor-client/build.gradle.kts",
    ...code("ktor-client/common/src/io/ktor/client", ".kt", 15),
  ]);
  // build-logic builds the project; it is not part of what the project does.
  assert.deepEqual(idsOf(dir), ["ktor-client", "ktor-server"]);
});

test("npm workspace: packages are the capabilities, samples are not (nestjs/nest)", () => {
  const dir = layout([
    "package.json",
    "packages/core/package.json",
    ...code("packages/core/lib", ".ts", 20),
    "packages/common/package.json",
    ...code("packages/common/lib", ".ts", 18),
    "packages/websockets/package.json",
    ...code("packages/websockets/lib", ".ts", 6),
    "sample/01-cats-app/package.json",
    ...code("sample/01-cats-app/src", ".ts", 30),
    "sample/02-gateways/package.json",
    ...code("sample/02-gateways/src", ".ts", 25),
    "integration/hello-world/package.json",
    ...code("integration/hello-world/src", ".ts", 10),
  ]);
  assert.deepEqual(idsOf(dir), ["common", "core", "websockets"]);
});

test("Cargo workspace: crates, not the packaging folder (BurntSushi/ripgrep)", () => {
  const dir = layout([
    "Cargo.toml",
    "crates/core/Cargo.toml",
    ...code("crates/core/src", ".rs", 12),
    "crates/searcher/Cargo.toml",
    ...code("crates/searcher/src", ".rs", 9),
    "crates/printer/Cargo.toml",
    ...code("crates/printer/src", ".rs", 7),
    // The trap: `pkg` is a Go convention and pure packaging here.
    "pkg/brew/main.rb",
    "pkg/windows/rg.exe.manifest",
  ]);
  const ids = idsOf(dir);
  assert.deepEqual(ids, ["core", "printer", "searcher"]);
  assert.ok(!ids.includes("brew"), "a packaging directory is never a capability");
});

test("Ruby gems at the repository root (rails/rails)", () => {
  const dir = layout([
    "Gemfile",
    "activerecord/activerecord.gemspec",
    ...code("activerecord/lib/active_record", ".rb", 25),
    "actionpack/actionpack.gemspec",
    ...code("actionpack/lib/action_dispatch", ".rb", 18),
    "activesupport/activesupport.gemspec",
    ...code("activesupport/lib/active_support", ".rb", 22),
  ]);
  assert.deepEqual(idsOf(dir), ["actionpack", "activerecord", "activesupport"]);
});

test("a repository that also holds a side project keeps its own shape (grafana/loki)", () => {
  const dir = layout([
    "go.mod",
    ...code("pkg/storage", ".go", 30),
    ...code("pkg/querier", ".go", 22),
    ...code("pkg/ruler", ".go", 14),
    // Sub-modules that exist beside the product, not instead of it.
    "operator/go.mod",
    ...code("operator/internal", ".go", 12),
    "pkg/push/go.mod",
    ...code("pkg/push", ".go", 2),
  ]);
  const ids = idsOf(dir);
  assert.ok(ids.includes("storage") && ids.includes("querier"), `got ${ids.join(", ")}`);
  assert.ok(!ids.includes("operator"), "the operator must not stand in for the product");
});

test("a Python package is the level the lines are drawn at (django/django)", () => {
  const dir = layout([
    "setup.cfg",
    "pyproject.toml",
    "django/__init__.py",
    ...code("django/db", ".py", 20),
    ...code("django/forms", ".py", 12),
    ...code("django/template", ".py", 15),
    ...code("django/contrib", ".py", 25),
    "js_tests/tests.html",
    ...code("js_tests", ".js", 3),
  ]);
  const ids = idsOf(dir);
  assert.ok(ids.includes("db") && ids.includes("forms") && ids.includes("template"));
  assert.ok(!ids.includes("django"), "the package itself is a wrapper, not a capability");
});

test("src-layout with one shipped project and four test assemblies (serilog/serilog)", () => {
  const dir = layout([
    "Serilog.sln",
    "src/Serilog/Serilog.csproj",
    ...code("src/Serilog/Core", ".cs", 15),
    ...code("src/Serilog/Events", ".cs", 9),
    ...code("src/Serilog/Configuration", ".cs", 6),
    "test/Serilog.Tests/Serilog.Tests.csproj",
    ...code("test/Serilog.Tests", ".cs", 40),
    "test/Serilog.ApprovalTests/Serilog.ApprovalTests.csproj",
    ...code("test/Serilog.ApprovalTests", ".cs", 5),
  ]);
  const ids = idsOf(dir);
  assert.deepEqual(ids, ["configuration", "core", "events"]);
});

test("PHP src/<Vendor>/<Component> (laravel/framework)", () => {
  const dir = layout([
    "composer.json",
    ...code("src/Illuminate/Database", ".php", 30),
    ...code("src/Illuminate/Queue", ".php", 18),
    ...code("src/Illuminate/Routing", ".php", 14),
  ]);
  assert.deepEqual(idsOf(dir), ["database", "queue", "routing"]);
});

test("single Maven module: the Java packages are the capabilities (spring-petclinic)", () => {
  const dir = layout([
    "pom.xml",
    ...code("src/main/java/org/springframework/samples/petclinic/owner", ".java", 8),
    ...code("src/main/java/org/springframework/samples/petclinic/vet", ".java", 5),
    ...code("src/main/java/org/springframework/samples/petclinic/system", ".java", 3),
    ...code("src/test/java/org/springframework/samples/petclinic/owner", ".java", 6),
  ]);
  assert.deepEqual(idsOf(dir), ["owner", "system", "vet"]);
});

test("hexagonal layers are descended into, never proposed (lixi-platform/lixy-api)", () => {
  const dir = layout([
    "settings.gradle.kts",
    "domain/build.gradle.kts",
    ...code("domain/src/main/java/com/lixy/domain/booking", ".java", 12),
    ...code("domain/src/main/java/com/lixy/domain/wallet", ".java", 6),
    ...code("domain/src/main/java/com/lixy/domain/identity", ".java", 4),
    "application/build.gradle.kts",
    ...code("application/src/main/java/com/lixy/application/booking", ".java", 8),
    "infrastructure/build.gradle.kts",
    ...code("infrastructure/src/main/java/com/lixy/infrastructure/persistence", ".java", 10),
    "bootstrap/build.gradle.kts",
    ...code("bootstrap/src/main/java/com/lixy/api/controller", ".java", 9),
  ]);
  const ids = idsOf(dir);
  assert.deepEqual(ids, ["booking", "identity", "wallet"]);
  assert.ok(!ids.includes("infrastructure"), "a layer is not a capability");
});

test("deployables a monorepo declares are proposed as they are (lakebase-platform)", () => {
  const dir = layout([
    "settings.gradle",
    "services/platform/build.gradle",
    ...code("services/platform/src/main/java/com/lakebase/platform", ".java", 20),
    "services/catalog/build.gradle",
    ...code("services/catalog/src/main/java/com/lakebase/catalog", ".java", 12),
    "libs/common/build.gradle",
    ...code("libs/common/src/main/java/com/lakebase/common", ".java", 5),
    "cli/pyproject.toml",
    ...code("cli/lakebase_cli", ".py", 6),
  ]);
  const ids = idsOf(dir);
  assert.ok(ids.includes("platform") && ids.includes("catalog") && ids.includes("cli"));
});

test("a flat library proposes nothing at all (spf13/cobra, expressjs/express)", () => {
  // Silence is the honest answer. Both of these are a handful of files in one
  // package, and any structure read out of them would be invented.
  const cobra = layout(["go.mod", ...code(".", ".go", 14), "site/content/docs.md"]);
  assert.deepEqual(idsOf(cobra), []);

  const express = layout([
    "package.json",
    "index.js",
    ...code("lib", ".js", 6),
    ...code("test", ".js", 30),
  ]);
  assert.deepEqual(idsOf(express), []);
});

test("the proposal does not change after someone runs a build", () => {
  // The one property that matters most in CI: `./gradlew build` must not alter
  // what the repository is understood to be.
  const paths = [
    "settings.gradle",
    "services/orders/build.gradle",
    ...code("services/orders/src/main/java/com/acme/orders", ".java", 10),
    "services/billing/build.gradle",
    ...code("services/billing/src/main/java/com/acme/billing", ".java", 7),
  ];
  const clean = layout(paths);
  const built = layout([
    ...paths,
    ...code("services/orders/build/classes/java/main/com/acme/orders", ".java", 10),
    ...code("build/tmp", ".java", 40),
    "services/billing/build/libs/billing.jar",
  ]);
  assert.deepEqual(idsOf(built), idsOf(clean));
});
