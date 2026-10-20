/**
 * `specgate alm pr <change>` — push the ticket's branch and open, or update,
 * its one pull request (ADR-0039, REQ-149).
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import { findCliRoot, resolveProjectDir } from "../../../lib/project-root";
import * as ui from "../../../lib/ui";
import { readAlmConfig } from "../../../alm/core";
import { openOrUpdatePr, prConfig } from "../../../vcs/github-pr";

const CHANGES = "docs/specs/changes";
const NULL_SHAPE = { pr: null };

interface PrOptions {
  change: string;
  projectDir: string;
  push: boolean;
  check: boolean;
  json: boolean;
}

function parse(argv: string[]): PrOptions {
  const o: PrOptions = {
    change: "",
    projectDir: ".",
    push: true,
    check: true,
    json: wantsJson(argv),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project-dir") o.projectDir = argv[++i] ?? ".";
    else if (a === "--no-push") o.push = false;
    else if (a === "--no-check") o.check = false;
    else if (a === "--json") continue;
    else if (!a.startsWith("--") && !o.change) o.change = a;
  }
  return o;
}

function git(dir: string, args: string[]) {
  return spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
}

interface Requirement {
  id: string;
  name: string;
  status: string;
}

/** Every requirement of the change's deltas, with its status. */
function requirements(changeDir: string): Requirement[] {
  const specs = path.join(changeDir, "specs");
  if (!fs.existsSync(specs)) return [];
  const out: Requirement[] = [];
  for (const cap of fs.readdirSync(specs)) {
    const file = path.join(specs, cap, "spec.md");
    if (!fs.existsSync(file)) continue;
    const blocks = fs
      .readFileSync(file, "utf8")
      .split(/^### Requirement: /m)
      .slice(1);
    for (const block of blocks) {
      const head = /^(REQ-[\w.]+)\s*[—–-]\s*(.+)$/m.exec(block);
      if (!head) continue;
      const status = /specgate:trace[^>]*\bstatus="?([^"\s>]+(?: Clarification)?)"?/.exec(
        block
      )?.[1];
      out.push({ id: head[1], name: head[2].trim(), status: status ?? "Draft" });
    }
  }
  return out;
}

function gate(projectDir: string, run: boolean): { line: string; ok: boolean | null } {
  if (!run) return { line: "`specgate check` was not run for this update.", ok: null };
  const r = spawnSync(
    process.execPath,
    [path.join(findCliRoot(__dirname), "bin", "specgate.js"), "check", projectDir, "--json"],
    { encoding: "utf8" }
  );
  return r.status === 0
    ? { line: "✔ `specgate check` passes on this branch.", ok: true }
    : { line: "✖ `specgate check` does not pass on this branch: not ready to merge.", ok: false };
}

export async function main(argv: string[]): Promise<void> {
  const o = parse(argv);
  const io = agentIo(o.json);
  if (!o.change) {
    io.usage(NULL_SHAPE, [
      error("pr_no_change", "alm pr needs the change to open a pull request for.", {
        fix: "specgate alm pr kan-13-register-vehicle-entry",
      }),
    ]);
  }
  try {
    const projectDir = resolveProjectDir(o.projectDir);
    const cfg = prConfig(readAlmConfig(projectDir).pr);
    const changeDir = path.join(projectDir, CHANGES, o.change);
    if (!fs.existsSync(changeDir)) {
      throw new Error(`No change '${o.change}' under ${CHANGES}/.\nFix: specgate change list.`);
    }
    const yaml = fs.readFileSync(path.join(changeDir, "change.yaml"), "utf8");
    const key = /^ticket:\s*(\S+)\s*$/m.exec(yaml)?.[1];
    if (key && !/^[A-Z][A-Z0-9_]+-\d+$/.test(key)) {
      throw new Error(
        `ticket: ${key} in change.yaml is not a Jira issue key.\nFix: write the ticket's key, e.g. ticket: KAN-13.`
      );
    }
    if (!key) {
      throw new Error(
        `${o.change} was not opened from a ticket (no ticket: in change.yaml).\nFix: open it with specgate propose --from-ticket <KEY>.`
      );
    }
    const copy = fs.readFileSync(path.join(changeDir, "ticket.md"), "utf8");
    const summary = /^#\s+\S+\s+—\s+(.+)$/m.exec(copy)?.[1]?.trim() ?? o.change;
    const link = /\burl=(\S+)/.exec(copy)?.[1];

    const branch = git(projectDir, ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
    if (!new RegExp(`(^|/)${key}(-|$)`).test(branch)) {
      throw new Error(
        `The current branch '${branch}' is not ${key}'s.\nFix: check out its branch (feature/${key}-…) first.`
      );
    }
    // The pull request holds what is committed; the gate would judge the
    // working tree. Uncommitted work makes the two disagree.
    if (git(projectDir, ["status", "--porcelain"]).stdout.trim()) {
      throw new Error(
        "There are uncommitted changes: the pull request would not hold them.\nFix: commit them (starting with " +
          key +
          "), then run this again."
      );
    }
    if (o.push) {
      const pushed = git(projectDir, ["push", "-q", "-u", "origin", branch]);
      if (pushed.status !== 0) throw new Error(`git push failed: ${pushed.stderr.trim()}`);
    }

    const reqs = requirements(changeDir);
    const g = gate(projectDir, o.check);
    const body = [
      `<!-- specgate:pr change=${o.change} -->`,
      `**Ticket:** ${link ? `[${key}](${link})` : key} — ${summary}`,
      `**Change:** \`${CHANGES}/${o.change}/\``,
      "",
      "| Requirement | Status |",
      "|---|---|",
      ...reqs.map((r) => `| ${r.id} — ${r.name} | ${r.status} |`),
      "",
      `**Gate:** ${g.line}`,
      "",
      "_Opened by `specgate alm pr`. Specgate never merges._",
      "<!-- /specgate:pr -->",
    ].join("\n");
    const pr = await openOrUpdatePr(cfg, { head: branch, key, title: `${key} ${summary}`, body });
    io.emit({ pr: { ...pr, branch, ticket: key, requirements: reqs, gate: g.ok } }, () =>
      process.stdout.write(
        ui.header("alm pr", o.change) +
          ui.ok(`Pull request #${pr.number} ${pr.action} ${ui.muted(`→ ${cfg.base}`)}  ${pr.url}`) +
          (g.ok === false ? ui.warn(g.line) : "") +
          "\n"
      )
    );
  } catch (e) {
    io.fail(NULL_SHAPE, [error("pr_failed", (e as Error).message)]);
  }
}
