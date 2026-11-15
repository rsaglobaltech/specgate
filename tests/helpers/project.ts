/**
 * A small specgate project for the tests that read what `--json` says about
 * one: `specgate init` from the studio's fixture, derived matrix, no git.
 */
import * as assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ROOT_DIR, runCli } from "./cli";

export const FIXTURE = path.join(ROOT_DIR, "e2e", "studio", "fixture");

/** A new project; remove it with `removeProject`. */
export function newProject(prefix = "sg-project-"): string {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const init = runCli([
    "init",
    "--config",
    path.join(FIXTURE, "project.yaml"),
    "--out",
    parent,
    "--no-git",
    "--no-agents",
    "--no-ci",
  ]);
  assert.equal(init.status, 0, init.stdout + init.stderr);
  return path.join(parent, "my-spec-driven-app");
}

export function removeProject(dir: string): void {
  fs.rmSync(path.dirname(dir), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

/** Write a file of the project, its folders made. */
export function write(dir: string, rel: string, text: string): void {
  const file = path.join(dir, ...rel.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

/** Append a requirement section to spec.md. */
export function specRequirement(dir: string, id: string, title: string, trace = ""): void {
  fs.appendFileSync(
    path.join(dir, "spec.md"),
    `\n## ${id} — ${title}\n\nThe system SHALL ${title.toLowerCase()}.\n\n` +
      `<!-- specgate:trace actor=Customer kind=functional${trace ? ` ${trace}` : ""} -->\n`
  );
}

/** A feature file whose scenarios carry `@REQ @SCN` tags. */
export function feature(dir: string, rel: string, req: string, scenarios: string[]): void {
  write(
    dir,
    rel,
    `Feature: ${req}\n\n` +
      scenarios
        .map(
          (scn) =>
            `  @${req} @${scn}\n  Scenario: ${scn}\n    Given a customer\n    When they act\n    Then it happens\n`
        )
        .join("\n")
  );
}

/** What `specgate <args> --json --project-dir <dir>` prints, parsed, with its exit status. */
export function cliJson(dir: string, ...args: string[]): { status: number | null; doc: any } {
  const r = runCli([...args, "--json", "--project-dir", dir]);
  const at = r.stdout.indexOf("{");
  assert.ok(at >= 0, `no JSON from specgate ${args.join(" ")}:\n${r.stdout}\n${r.stderr}`);
  return { status: r.status, doc: JSON.parse(r.stdout.slice(at)) };
}

/** git in `dir` with an identity of its own: CI has none. */
export function git(dir: string, ...args: string[]) {
  return spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], {
    cwd: dir,
    encoding: "utf8",
  });
}
