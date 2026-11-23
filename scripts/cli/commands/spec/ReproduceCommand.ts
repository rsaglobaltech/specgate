import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import type { AgentIo } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import * as ui from "../../../lib/ui";
import { c } from "../../../lib/ui";
import { forShell } from "../../../lib/shell-command";
import { featureMap } from "../../../lib/feature-map";
import { keepRed, scenarioCommand } from "../../../lib/evidence";
import { readHarnessConfig } from "../../../../packages/core/src/infrastructure/HarnessConfigFile";

const NULL_SHAPE = { reproduce: null };
/** This checkout's CLI: `reproduce` opens its change as `propose --kind bug` does. */
const CLI = path.resolve(__dirname, "..", "..", "..", "..", "..", "bin", "specgate.js");

function usage(): void {
  process.stdout.write(
    `
  🐞 ${c.bold}specgate reproduce${c.reset} <change-id> --capability <c> --title "<what is broken>" [--ticket <KEY>]
     ${c.bold}specgate reproduce run${c.reset} <REQ>

  A bug is fixed only once it has been seen failing (trust curve, phase 2).
  reproduce opens a bug change whose requirement must be reproduced, and lowers
  the module's trust level. Write its scenario as the app should behave, then
  run it on today's code with reproduce run: red is kept as evidence, green is
  refused. apply delivers the fix only after that red.
`
  );
}

export class ReproduceCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(argv.length === 0 ? 2 : 0);
    }
    const io = agentIo(wantsJson(argv));
    let dirArg = ".";
    let capability = "";
    let title = "";
    let ticket = "";
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--capability") capability = argv[++i] || "";
      else if (a === "--title") title = argv[++i] || "";
      else if (a === "--ticket") ticket = argv[++i] || "";
      else if (a === "--json") continue;
      else if (!a.startsWith("-")) positional.push(a);
      else
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown argument for reproduce: ${a}`, {
            fix: "specgate reproduce --help",
          }),
        ]);
    }
    const dir = path.resolve(dirArg);
    if (positional[0] === "run") return this.run(dir, positional[1], io);
    return this.open(dir, positional[0], capability, title.trim(), ticket.trim(), io);
  }

  /** REQ-681: the bug change, its requirement to be reproduced. */
  private open(
    dir: string,
    changeId: string | undefined,
    capability: string,
    title: string,
    ticket: string,
    io: AgentIo
  ) {
    if (!changeId || !capability || !title) {
      io.usage(NULL_SHAPE, [
        error("reproduce_args", "reproduce needs a change id, --capability and --title.", {
          fix: 'specgate reproduce fix-precio --capability catalogo --title "The price shows without its discount"',
        }),
      ]);
      return;
    }
    const proposed = spawnSync(
      process.execPath,
      [CLI, "propose", changeId, "--kind", "bug", "--capability", capability, "--reserve", "1", "--project-dir", dir, "--json"],
      { cwd: dir, encoding: "utf8", env: process.env }
    );
    let doc: {
      change?: { id: string; path: string; reqRange: string[] } | null;
      trust?: { capability: string; from: number; to: number };
      status?: Array<{ severity: string; code: string; message: string; fix?: string }>;
    } = {};
    try {
      doc = JSON.parse(proposed.stdout);
    } catch {
      /* reported below */
    }
    if (proposed.status !== 0 || !doc.change) {
      const refused = (doc.status || [])
        .filter((s) => s.severity === "error")
        .map((s) => error(s.code, s.message, s.fix ? { fix: s.fix } : {}));
      io.fail(
        NULL_SHAPE,
        refused.length
          ? refused
          : [error("reproduce_propose_failed", `propose failed: ${proposed.stderr || proposed.stdout}`)]
      );
      return;
    }
    const req = doc.change.reqRange[0];
    const changeDir = path.join(dir, doc.change.path);
    const routes = featureMap(dir)
      .filter((e) => e.capability === capability && e.route)
      .map((e) => (e.url ? `${e.route} (${e.url})` : (e.route as string)));
    const uniqueRoutes = [...new Set(routes)];

    fs.writeFileSync(
      path.join(changeDir, "specs", capability, "spec.md"),
      [
        `# Delta — ${capability}`,
        "",
        "## ADDED Requirements",
        "",
        `### Requirement: ${req} — ${title}`,
        "",
        "<!-- specgate:trace repro=required kind=functional -->",
        "",
        `The system SHALL behave as specified where this was reported: "${title}" must no longer happen.`,
        "",
        `#### Scenario: SCN-${req.slice(4)}a — ${title}, no longer`,
        "",
        "- GIVEN <the state the bug was seen in>",
        "- WHEN <what the person did>",
        "- THEN <what the app should show, and did not>",
        "",
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(changeDir, "discover.md"),
      [
        `# Discover: ${changeId}`,
        "",
        "## Context",
        "",
        `A bug reported in ${capability}${ticket ? ` (${ticket})` : ""}: ${title}.`,
        "",
        uniqueRoutes.length
          ? `Where the app reaches ${capability}: ${uniqueRoutes.map((r) => `\`${r}\``).join(", ")}.`
          : `The map knows no route for ${capability} yet: \`specgate map --capability ${capability}\`.`,
        "",
        "## Use case",
        "",
        `1. The scenario of ${req} is written as the app should behave.`,
        `2. \`specgate reproduce run ${req}\` sees it fail on today's code.`,
        `3. The code is fixed, and \`specgate apply ${req}\` delivers it once the same scenario passes.`,
        "",
        "## Acceptance criteria",
        "",
        `- AC-1: ${req}'s scenario fails before the fix and passes after it.`,
        "",
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(changeDir, "design.md"),
      [
        `# Design: ${changeId}`,
        "",
        "## Mechanisms",
        "",
        `- AC-1 — the fix in ${capability}, written once ${req}'s scenario has been seen red.`,
        "",
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(changeDir, "tasks.md"),
      [
        "# Tasks",
        "",
        "## 1. Reproduce",
        "",
        `- [ ] 1.1 Write ${req}'s scenario and its test`,
        `- [ ] 1.2 \`specgate reproduce run ${req}\`: red`,
        "",
        "## 2. Fix",
        "",
        `- [ ] 2.1 ${req} — the code, until \`specgate apply ${req}\` passes`,
        "",
      ].join("\n"),
      "utf8"
    );
    if (ticket) fs.appendFileSync(path.join(changeDir, "change.yaml"), `ticket: ${ticket}\n`, "utf8");

    io.emit(
      {
        reproduce: {
          change: changeId,
          requirement: req,
          capability,
          ticket: ticket || null,
          routes: uniqueRoutes,
          trust: doc.trust || null,
        },
      },
      () => {
        process.stdout.write(
          ui.header("reproduce", changeId) +
            ui.ok(`${changeId} opened: ${req} — ${title}, to be reproduced first.`) +
            (doc.trust
              ? ui.warn(`${capability} went down to trust level ${doc.trust.to} (from ${doc.trust.from}).`)
              : "") +
            (uniqueRoutes.length ? `     ${ui.muted(`reached at ${uniqueRoutes.join(", ")}`)}\n` : "") +
            ui.next(
              `specgate reproduce run ${req}`,
              `after you write its scenario as the app should behave, and a test that names ${req}`
            )
        );
      }
    );
  }

  /** REQ-682: the scenario run on today's code — red kept, green refused. */
  private run(dir: string, req: string | undefined, io: AgentIo) {
    if (!req || !/^REQ-/.test(req)) {
      io.usage(NULL_SHAPE, [
        error("reproduce_req_required", "reproduce run expects a requirement.", {
          fix: "specgate reproduce run REQ-090",
        }),
      ]);
      return;
    }
    const bddCmd = String(readHarnessConfig(dir)?.bddCmd || "").trim();
    if (!bddCmd) {
      io.fail(NULL_SHAPE, [
        error("repro_no_runner", `No bdd_cmd runs ${req}'s scenarios, so nothing can show the bug.`, {
          target: req,
          fix: 'specgate config set bdd_cmd "<runs the feature files, with {tags}>"',
        }),
      ]);
      return;
    }
    const command = scenarioCommand(bddCmd, req);
    const startedAt = Date.now();
    const r = spawnSync(forShell(command), { cwd: dir, encoding: "utf8", shell: true });
    const run = {
      command,
      exitCode: r.status ?? 1,
      ms: Date.now() - startedAt,
      output: `${r.stdout || ""}${r.stderr || ""}`,
      startedAt,
    };
    if (run.exitCode === 0) {
      io.fail(NULL_SHAPE, [
        error(
          "repro_not_red",
          `${req}'s scenarios pass on today's code: they do not show the bug.`,
          {
            target: req,
            fix: `Write the scenario as the app should behave where it fails today, then specgate reproduce run ${req} again.`,
          }
        ),
      ]);
      return;
    }
    const file = keepRed(dir, req, run);
    io.emit({ reproduce: { requirement: req, red: true, command, exitCode: run.exitCode, evidence: file } }, () => {
      process.stdout.write(
        ui.header("reproduce run", req) +
          ui.ok(`${req} reproduced: its scenarios fail on today's code (exit ${run.exitCode}).`) +
          `     ${ui.muted(`kept in ${file}`)}\n` +
          ui.next(`specgate apply ${req}`, "once the fix makes the same scenarios pass")
      );
    });
  }
}
