"use strict";

/**
 * Issue #121: the Docker image build went from 3 minutes to a 28-minute
 * cancel between 0.6.0 and 0.7.0.
 *
 * Measured, not assumed: tsconfig.json's include list covers the whole
 * tests directory, the whole features directory, and every package's own
 * test directory, because the same config also drives "npm run test:unit"
 * outside Docker — but none of that ships in the npm tarball (see
 * package.json's "files" list), so compiling and packing it inside
 * Dockerfile.cli's build stage was pure waste. The 0.6.0 to 0.7.0 cycle
 * added roughly 290 files and 35k lines, almost entirely tests, and that
 * waste is what the arm64 leg paid for twice over — once at native cost,
 * and again multiplied by QEMU's emulation penalty on the amd64 CI runner.
 *
 * These tests pin the fix's two halves so neither can silently regress:
 * Dockerfile.cli no longer copies the top-level test directories in, and
 * .dockerignore excludes them — including each package's own test
 * directory, which the Dockerfile still bulk-copies as part of "packages".
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const dockerfile = fs.readFileSync(path.join(ROOT, "Dockerfile.cli"), "utf8");
const dockerignore = fs.readFileSync(path.join(ROOT, ".dockerignore"), "utf8");

test("Dockerfile.cli's build stage does not COPY tests or features", () => {
  assert.doesNotMatch(dockerfile, /^COPY tests /m);
  assert.doesNotMatch(dockerfile, /^COPY features /m);
});

test("Dockerfile.cli's build stage copies every source npm run build reads, the studio's included", () => {
  // 0.29.0's image failed to build: the studio's source (studio/, bundled by
  // scripts/build-studio.cjs) was not copied, and tsc -p studio/tsconfig.json
  // found nothing. The build script names every tree it compiles.
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const build: string = pkg.scripts.build;
  for (const tree of ["studio"]) {
    assert.match(build, new RegExp(`\\b${tree}/`), `the build reads ${tree}/`);
    assert.match(
      dockerfile,
      new RegExp(`^COPY ${tree} \\./${tree}$`, "m"),
      `Dockerfile.cli copies ${tree}/`
    );
  }
});

test("Dockerfile.cli copies every source folder the npm tarball ships, types/ included", () => {
  // 0.32.0's image failed to build: types/api.d.ts, which scripts/api compiles
  // against and the tarball ships, was not copied in.
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const folders = (pkg.files as string[])
    .filter((f) => f.endsWith("/") && !f.startsWith("dist/"))
    .map((f) => f.slice(0, -1))
    .filter((f) => fs.existsSync(path.join(ROOT, f)));
  assert.ok(folders.includes("types"), "the tarball ships types/");
  for (const tree of folders) {
    assert.match(
      dockerfile,
      new RegExp(`^COPY ${tree} \\./${tree}$`, "m"),
      `Dockerfile.cli copies ${tree}/`
    );
  }
});

test(".dockerignore excludes everything that never reaches the npm tarball", () => {
  for (const pattern of ["tests", "features", "packages/*/test", "node_modules", ".git"]) {
    assert.match(
      dockerignore,
      new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"),
      `.dockerignore should list ${pattern}`
    );
  }
});

test("nothing under packages/*/src still imports from packages/*/test", () => {
  // If this were ever true, excluding test/ from the build context would
  // break the build — confirms the exclusion is safe, not just fast.
  const packagesDir = path.join(ROOT, "packages");
  for (const pkg of fs.readdirSync(packagesDir)) {
    const srcDir = path.join(packagesDir, pkg, "src");
    if (!fs.existsSync(srcDir)) continue;
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.name.endsWith(".ts")) out.push(full);
      }
      return out;
    };
    for (const file of walk(srcDir)) {
      const content = fs.readFileSync(file, "utf8");
      assert.doesNotMatch(
        content,
        /from ["'].*\/test\//,
        `${path.relative(ROOT, file)} imports from a test/ directory`
      );
    }
  }
});
