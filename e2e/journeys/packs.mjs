/**
 * Domain packs as versioned dependencies — offline. A local git repository
 * with tags stands in for the pack's remote, so every journey here runs
 * without the network, the same way `specops add` reads a real one.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { ROOT } from "../lib.mjs";

const VARS = ["--var", "PROJECT_NAME=Shop", "--var", "PROJECT_SLUG=shop", "--var", "DOMAIN=retail"];

/**
 * The multi-tenant pack as a git repo: v0.1.0 as shipped, v0.2.0 adding
 * REQ-005. Returns the repo path.
 */
function packRemote(dir, t) {
  const remote = path.join(dir, "remote");
  fs.cpSync(path.join(ROOT, "packs", "multi-tenant", "backend"), path.join(remote, "backend"), {
    recursive: true,
  });
  const id = [
    "-c",
    "user.email=e2e@example.com",
    "-c",
    "user.name=E2E",
    "-c",
    "commit.gpgsign=false",
  ];
  t.git(remote, "init", "-q", "-b", "main");
  t.git(remote, "add", "-A");
  t.git(remote, ...id, "commit", "-qm", "v0.1.0");
  t.git(remote, "tag", "v0.1.0");
  const yaml = path.join(remote, "backend", "pack.yaml");
  fs.writeFileSync(
    yaml,
    fs
      .readFileSync(yaml, "utf8")
      .replace('version: "0.1.0"', 'version: "0.2.0"')
      .replace(
        "    status: Draft\n\nbounded_contexts:",
        '    status: Draft\n  - id: REQ-005\n    title: "Audit every cross-tenant access attempt"\n    priority: Should\n    description: "Security needs the trail."\n    status: Draft\n\nbounded_contexts:'
      )
  );
  t.git(remote, ...id, "commit", "-qam", "v0.2.0");
  t.git(remote, "tag", "v0.2.0");
  return remote;
}

/** A scaffold with no starter requirement: the pack supplies them. */
function project(dir, t) {
  t.ok(t.sg(dir, "init", "--yes", "--no-git", "--no-sample-req", "--out", "."), "init --yes");
  return path.join(
    dir,
    fs.readdirSync(dir).find((d) => d !== "remote" && fs.statSync(path.join(dir, d)).isDirectory())
  );
}

export default [
  {
    name: "a pack pinned to a tag: add, diff, upgrade keeping a local edit, remove",
    covers: ["specops add", "specops diff", "specops sync", "specops remove"],
    run(dir, t) {
      const remote = packRemote(dir, t);
      const p = project(dir, t);
      t.ok(
        t.sg(
          p,
          "specops",
          "add",
          "--pack-repo",
          remote,
          "--pack-version",
          "v0.1.0",
          "--pack",
          "backend",
          ...VARS
        ),
        "specops add"
      );
      const lock = JSON.parse(t.read(p, ".specops.lock"));
      t.expect(
        lock.packs[0].version === "v0.1.0" && /^sha256:/.test(lock.packs[0].digest),
        "the lock pins tag and digest"
      );
      // Every requirement the pack declares is tracked — REQ-004 has no
      // scenario, and its absence used to fail the gate below on install.
      t.ok(
        t.sg(p, "validate", ".", "--against-lock"),
        "validate --against-lock right after install"
      );
      t.ok(t.sg(p, "validate", ".", "--strict"), "validate --strict right after install");

      const diff = t.sg(p, "specops", "diff", "--pack-version", "v0.2.0", "--json");
      t.ok(diff, "specops diff --json");
      t.expect(
        t.json(diff).diffs[0].targetVersion === "v0.2.0",
        "the diff is against the new tag",
        diff
      );
      const change = t.sg(p, "specops", "diff", "--pack-version", "v0.2.0", "--as-change");
      t.ok(change, "specops diff --as-change");
      t.expect(
        /REQ-005|upgrade-backend-v0\.2\.0/.test(t.out(change)),
        "the bump becomes a reviewable change",
        change
      );

      const feature = fs.readdirSync(path.join(p, "features", "multi-tenant"))[0];
      fs.appendFileSync(path.join(p, "features", "multi-tenant", feature), "# our team's note\n");
      t.ok(t.sg(p, "specops", "sync", "--pack-version", "v0.2.0"), "specops sync to v0.2.0");
      t.expect(
        JSON.parse(t.read(p, ".specops.lock")).packs[0].version === "v0.2.0",
        "the lock moves to v0.2.0"
      );
      t.expect(
        t.read(p, `features/multi-tenant/${feature}`).includes("# our team's note"),
        "the local edit survives"
      );
      t.expect(
        /\| REQ-005 \|/.test(t.read(p, "docs/specs/traceability.md")),
        "the new requirement arrives"
      );
      t.ok(t.sg(p, "validate", ".", "--against-lock"), "validate --against-lock after the upgrade");

      t.ok(t.sg(p, "specops", "remove", "backend"), "specops remove");
      t.expect(
        JSON.parse(t.read(p, ".specops.lock")).packs.length === 0,
        "the lock no longer lists it"
      );
    },
  },
  {
    name: "an air-gapped install from a git bundle",
    covers: ["pack bundle", "specops add"],
    run(dir, t) {
      const remote = packRemote(dir, t);
      const bundle = path.join(dir, "multi-tenant.bundle");
      t.ok(t.sg(dir, "pack", "bundle", "--repo", remote, "--out", bundle), "pack bundle");
      t.expect(fs.statSync(bundle).size > 0, "the bundle is written");
      const p = project(dir, t);
      t.ok(
        t.sg(
          p,
          "specops",
          "add",
          "--pack-repo",
          bundle,
          "--pack-version",
          "v0.2.0",
          "--pack",
          "backend",
          ...VARS
        ),
        "specops add from the bundle"
      );
      t.expect(
        /\| REQ-005 \|/.test(t.read(p, "docs/specs/traceability.md")),
        "the bundled v0.2.0 is what got installed"
      );
    },
  },
  {
    name: "authoring a pack: init, lint, and infer one from existing features",
    covers: ["pack init", "pack lint", "pack infer"],
    run(dir, t) {
      t.ok(
        t.sg(dir, "pack", "init", "--out", "packs", "--name", "Loyalty", "--type", "backend"),
        "pack init"
      );
      t.expect(t.exists(dir, "packs/loyalty/backend/pack.yaml"), "pack.yaml is scaffolded");
      t.ok(
        t.sg(dir, "pack", "lint", "--pack-root", "packs", "--pack", "loyalty/backend"),
        "lint of the skeleton"
      );
      // The skeleton's scenario is a template; --strict is for packs that ship.
      t.fails(
        t.sg(dir, "pack", "lint", "--pack-root", "packs", "--pack", "loyalty/backend", "--strict"),
        "lint --strict of the skeleton"
      );
      t.ok(
        t.sg(
          dir,
          "pack",
          "lint",
          "--pack-root",
          path.join(ROOT, "packs"),
          "--pack",
          "multi-tenant/backend",
          "--strict"
        ),
        "lint --strict of a shipped pack"
      );

      t.write(
        dir,
        "features/loyalty.feature",
        "Feature: Loyalty\n\n  @REQ-001 @SCN-001\n  Scenario: Points are earned on a paid order\n    Given a customer with 0 points\n    When an order of 10 EUR is paid\n    Then the customer has 10 points\n"
      );
      const inferred = t.sg(dir, "pack", "infer", "--from", "features/loyalty.feature");
      t.ok(inferred, "pack infer");
      t.expect(
        /requirements:/.test(inferred.stdout) && /REQ-001/.test(inferred.stdout),
        "a pack.yaml skeleton is proposed",
        inferred
      );
    },
  },
  {
    name: "expand a local pack into a project",
    covers: ["expand"],
    run(dir, t) {
      const p = project(dir, t);
      t.ok(
        t.sg(
          dir,
          "expand",
          "--pack-root",
          path.join(ROOT, "packs"),
          "--pack",
          "multi-tenant/backend",
          "--project-dir",
          p,
          ...VARS
        ),
        "expand"
      );
      t.expect(
        fs.readdirSync(path.join(p, "features", "multi-tenant")).length >= 3,
        "the pack's scenarios are written"
      );
      t.ok(t.sg(p, "validate", "."), "validate after expand");
    },
  },
];
