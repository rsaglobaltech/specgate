import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import * as ui from "../../../lib/ui";
import { c } from "../../../lib/ui";
import { GATE_POLICY_FILE } from "../../../lib/gate-policy";
import {
  LEVEL_NAMES,
  MAX_LEVEL,
  promotionChangeId,
  promotionDiscover,
  readTrust,
  trustReport,
} from "../../../lib/trust";

const NULL_SHAPE = { trust: null };

function usage(): void {
  process.stdout.write(
    `
  🪜 ${c.bold}specgate trust${c.reset} [--json] [--project-dir <dir>]
     ${c.bold}specgate trust promote${c.reset} <capability> [--json]

  How far an agent may go in each module, and what it has earned (ADR-0046).
  The levels live in ${GATE_POLICY_FILE} under trust: — 1 observed, 2 confined,
  3 verified, 4 unattended, 5 triage. A level rises only through a change a
  person approves (trust promote opens it); a bug proposed for a module lowers
  it at once (propose --kind bug --capability <c>).
`
  );
}

export class TrustCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(0);
    }
    const json = wantsJson(argv);
    const io = agentIo(json);
    let dirArg = ".";
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--json") continue;
      else if (!a.startsWith("-")) positional.push(a);
      else
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown argument for trust: ${a}`, { fix: "specgate trust --help" }),
        ]);
    }
    const dir = path.resolve(dirArg);
    if (positional[0] === "promote") return this.promote(dir, positional[1], io);
    if (positional.length) {
      io.usage(NULL_SHAPE, [
        error("trust_unknown_action", `trust knows one action: promote (got ${positional[0]}).`, {
          fix: "specgate trust promote <capability>",
        }),
      ]);
    }

    // REQ-674: each module's level and the evidence behind it.
    const report = trustReport(dir);
    io.emit({ trust: report }, () => {
      const out = (s: string) => process.stdout.write(s);
      out(ui.header("trust", report.declared ? "" : "no levels declared"));
      if (!report.declared) {
        out(
          `  ${ui.muted(`No trust: in ${GATE_POLICY_FILE} — the harness runs as it always has.`)}\n` +
            `  ${ui.muted("Declare one per module, e.g. trust: { catalogo: 3 }.")}\n\n`
        );
      }
      for (const r of report.capabilities) {
        out(
          `  ${c.bold}${r.capability.padEnd(22)}${c.reset}` +
            `${r.level} ${r.name.padEnd(11)}` +
            ui.muted(
              `${r.applied} applied · streak ${r.streak} · ${r.leaks} leak${r.leaks === 1 ? "" : "s"}`
            ) +
            (r.ready ? `  ${c.green}ready${c.reset}` : "") +
            "\n"
        );
      }
      const ready = report.capabilities.filter((r) => r.next);
      out(ready.length ? ui.next(ready[0].next as string, "a person approves the rise") : "\n");
    });
  }

  /** REQ-672: the change that carries a promotion, its evidence in the Discover. */
  private promote(dir: string, capability: string | undefined, io: ReturnType<typeof agentIo>) {
    if (!capability) {
      io.usage(NULL_SHAPE, [
        error("trust_capability_required", "trust promote expects a capability.", {
          fix: "specgate trust promote <capability> — specgate trust lists them",
        }),
      ]);
      return;
    }
    const trust = readTrust(dir);
    if (!trust) {
      io.fail(NULL_SHAPE, [
        error("trust_not_declared", `This project declares no trust levels.`, {
          file: GATE_POLICY_FILE,
          fix: `Write trust: { ${capability}: 1 } in ${GATE_POLICY_FILE}: the first level is the team's starting point.`,
        }),
      ]);
      return;
    }
    const report = trustReport(dir);
    const row = report.capabilities.find((r) => r.capability === capability);
    if (!row) {
      io.fail(NULL_SHAPE, [
        error("capability_unknown", `This project has no capability ${capability}.`, {
          target: capability,
          fix: `Use one of: ${report.capabilities.map((r) => r.capability).join(", ")}.`,
        }),
      ]);
      return;
    }
    if (row.level >= MAX_LEVEL) {
      io.fail(NULL_SHAPE, [
        error("trust_at_top", `${capability} is at level ${row.level}, the highest a module can have yet.`, {
          target: capability,
          fix: "Level 6, merging alone, comes in a later change.",
        }),
      ]);
      return;
    }
    const to = row.level + 1;
    const id = promotionChangeId(capability, to);
    const changeDir = path.join(dir, "docs", "specs", "changes", id);
    if (fs.existsSync(changeDir)) {
      io.fail(NULL_SHAPE, [
        error("change_exists", `The promotion ${id} is already open.`, {
          target: id,
          fix: `specgate change approve ${id}`,
        }),
      ]);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const files: Record<string, string> = {
      "change.yaml": [
        "specgate_change_version: 1",
        "schema: layered",
        `created: ${today}`,
        "rigor: lite",
        "skip_specs: true",
        "retire_capabilities: false",
        `trust_promotion: ${capability} ${row.level} ${to}`,
        "",
      ].join("\n"),
      "discover.md": promotionDiscover(row, to, trust.promoteAfter),
      "design.md": [
        `# Design: ${id}`,
        "",
        "## Mechanisms",
        "",
        `- AC-1 — approving the three layers writes \`${capability}: ${to}\` under trust: in ${GATE_POLICY_FILE} and appends a \`promotion\` line naming ${id} to .specgate/trust-ledger.jsonl.`,
        "",
      ].join("\n"),
      "tasks.md": [
        "# Tasks",
        "",
        "## 1. Review",
        "",
        `- [ ] 1.1 Read the evidence in discover.md, then \`specgate change approve ${id}\``,
        "",
      ].join("\n"),
    };
    fs.mkdirSync(changeDir, { recursive: true });
    for (const [f, text] of Object.entries(files)) fs.writeFileSync(path.join(changeDir, f), text, "utf8");
    const rel = path.relative(dir, changeDir).split(path.sep).join("/");
    io.emit(
      { trust: { promote: { capability, from: row.level, to, change: id, path: rel, evidence: row } } },
      () => {
        process.stdout.write(
          ui.header("trust promote", capability) +
            ui.ok(
              `${id} opened: ${capability} from ${row.level} (${row.name}) to ${to} (${LEVEL_NAMES[to]}), once a person approves it.`
            ) +
            "\n" +
            Object.keys(files)
              .map((f) => ui.fileLine("added", `${rel}/${f}`))
              .join("") +
            ui.next(`specgate change approve ${id}`, "after reading the evidence in discover.md")
        );
      }
    );
  }
}
