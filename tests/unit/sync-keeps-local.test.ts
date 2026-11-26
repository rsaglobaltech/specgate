/**
 * sync-keeps-local REQ-774: upgrading a pack keeps what the team wrote in
 * spec.md — a delivered requirement stays delivered — and brings what the new
 * version adds. Offline: the pack is a local git repository with two tags,
 * the cache a folder of the test's own.
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const FIXTURE = path.join(ROOT_DIR, "tests", "fixtures", "pack-upgrade");

const made: string[] = [];
test.after(() => {
  for (const d of made)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
const GIT_ENV = {
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t.invalid",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t.invalid",
};
const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...GIT_ENV } });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
};
const cli = (cwd: string, args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...GIT_ENV, NO_COLOR: "1", SPECGATE_SKIP_DOCTOR: "1" },
  });

/** A pack repository with `backend` at v0.1.0 and v0.2.0. */
function packRepo(root: string): string {
  const repo = path.join(root, "pack");
  fs.mkdirSync(repo);
  git(repo, "init", "-q");
  for (const v of ["v0.1.0", "v0.2.0"]) {
    fs.rmSync(path.join(repo, "backend"), { recursive: true, force: true });
    fs.cpSync(path.join(FIXTURE, v), path.join(repo, "backend"), { recursive: true });
    git(repo, "add", "-A");
    git(repo, "commit", "-qm", v);
    git(repo, "tag", v);
  }
  return repo;
}

const VARS = [
  "--var",
  "PROJECT_NAME=Smart Parking",
  "--var",
  "PROJECT_SLUG=smart-parking",
  "--var",
  "DOMAIN=parking operations",
];

test("REQ-774 SCN-774a: a delivered requirement stays delivered across a pack upgrade", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-sync-keeps-")));
  made.push(root);
  const repo = packRepo(root);
  const cache = path.join(root, "cache");
  fs.writeFileSync(
    path.join(root, "cfg.yaml"),
    "PROJECT_NAME: Smart Parking\nPROJECT_SLUG: smart-parking\nPROJECT_TYPE: backend\nDOMAIN: parking operations\nSTACK: Node 20\nAPI_STYLE: REST\nTESTING: node:test\nLANG: en\n"
  );
  assert.equal(cli(root, ["init", "--config", "./cfg.yaml", "--out", "."]).status, 0);
  const project = path.join(root, "smart-parking");
  git(project, "init", "-q");
  git(project, "add", "-A");
  git(project, "commit", "-qm", "init");
  const add = cli(project, [
    "specops",
    "add",
    "--pack-repo",
    repo,
    "--pack-version",
    "v0.1.0",
    "--pack",
    "backend",
    "--cache-dir",
    cache,
    ...VARS,
  ]);
  assert.equal(add.status, 0, add.stdout + add.stderr);

  // The team delivered REQ-001: `apply` wrote its status on the trace comment.
  const specFile = path.join(project, "spec.md");
  const before = fs.readFileSync(specFile, "utf8");
  const block = before.slice(before.indexOf("REQ-001"));
  assert.match(block, /<!-- specgate:trace /);
  fs.writeFileSync(
    specFile,
    before.replace(/(REQ-001[^\n]*\n\n<!-- specgate:trace )/, "$1status=Implemented ")
  );
  assert.match(fs.readFileSync(specFile, "utf8"), /status=Implemented/);
  git(project, "add", "-A");
  git(project, "commit", "-qm", "delivered REQ-001");

  const sync = cli(project, [
    "specops",
    "sync",
    "--pack-version",
    "v0.2.0",
    "--cache-dir",
    cache,
    "--var",
    "STACK=Node 20",
    "--var",
    "API_STYLE=REST",
    "--var",
    "TESTING=node:test",
    "--var",
    "LANG=en",
  ]);
  assert.equal(sync.status, 0, sync.stdout + sync.stderr);
  const after = fs.readFileSync(specFile, "utf8");
  const req001 = after.slice(after.indexOf("## REQ-001"), after.indexOf("## REQ-002"));
  assert.match(req001, /status=Implemented/, "REQ-001 is still delivered");
  assert.match(after, /## REQ-006/, "what v0.2.0 adds arrives");
});
