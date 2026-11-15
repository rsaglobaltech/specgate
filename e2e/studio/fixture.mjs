// The project the studio's browser tests use (REQ-436): made fresh for every
// run from the files beside this one — an `orders` draft with two open
// questions, a brief, and an agent that works for a few seconds so Live has a
// run to follow.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const CLI = path.join(here, "..", "..", "bin", "specgate.js");

/** An agent that says what it does, takes its time and changes nothing. */
const STUB_AGENT = `// The browser tests' agent: a few steps in the events, then nothing written.
import fs from "node:fs";
const file = process.env.AGENT_EVENTS_FILE;
const step = (target) => {
  if (!file) return;
  const e = { type: "step", kind: "edit", target, t: Math.floor(Date.now() / 1000) };
  fs.appendFileSync(file, JSON.stringify(e) + "\\n");
};
step("src/orders.ts");
setTimeout(() => step("src/orders.test.ts"), 1500);
setTimeout(() => process.exit(0), Number(process.env.STUB_AGENT_MS || 20000));
`;

const git = (cwd, ...args) => execFileSync("git", args, { cwd, stdio: "pipe" });

export function makeProject() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "sg-studio-e2e-"));
  execFileSync(
    process.execPath,
    [CLI, "init", "--config", path.join(here, "fixture", "project.yaml"), "--out", parent],
    { stdio: "pipe", env: { ...process.env, NO_COLOR: "1" } }
  );
  const dir = path.join(parent, "my-spec-driven-app");
  fs.copyFileSync(path.join(here, "fixture", "brief.md"), path.join(dir, "docs", "brief.md"));
  fs.cpSync(
    path.join(here, "fixture", "draft-orders"),
    path.join(dir, "docs", "specs", "changes", "draft-orders"),
    {
      recursive: true,
    }
  );
  fs.writeFileSync(path.join(dir, "stub-agent.mjs"), STUB_AGENT);
  if (!fs.existsSync(path.join(dir, ".git"))) git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(
    dir,
    "-c",
    "user.email=e2e@example.com",
    "-c",
    "user.name=E2E",
    "commit",
    "-q",
    "-m",
    "the studio's test project"
  );
  return dir;
}
