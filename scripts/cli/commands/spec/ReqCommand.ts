import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProjectDir } from "../../../lib/project-root";
import { parseTraceability } from "./PlanCommand";
import { agentIo, wantsJson } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import { DiskTraceabilityRepository } from "../../../../packages/core/src/infrastructure/DiskTraceabilityRepository";
import { AddRequirementUseCase } from "../../../../packages/core/src/application/AddRequirementUseCase";
import { LinkRequirementUseCase } from "../../../../packages/core/src/application/LinkRequirementUseCase";
import { DoneCommand } from "./DoneCommand";
import { isDerivedProject, writeRequirementFields } from "../../../lib/derived-writes";
import { refreshDerivedMatrix } from "./MatrixCommand";
import { TraceabilityMatrix } from "../../../../packages/core/src/domain/TraceabilityMatrix";
import { appendRequirementSection } from "../../../../packages/core/src/domain/SpecSections";
import {
  planRemoval,
  removeMatrixRows,
  removeSpecProse,
  isDelivered,
} from "../../../../packages/core/src/domain/RequirementRemoval";

const COLOR_ENABLED =
  process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";
const c = {
  reset: COLOR_ENABLED ? "\x1b[0m" : "",
  bold: COLOR_ENABLED ? "\x1b[1m" : "",
  dim: COLOR_ENABLED ? "\x1b[2m" : "",
  red: COLOR_ENABLED ? "\x1b[31m" : "",
  green: COLOR_ENABLED ? "\x1b[32m" : "",
  yellow: COLOR_ENABLED ? "\x1b[33m" : "",
  cyan: COLOR_ENABLED ? "\x1b[36m" : "",
};

export const COL: Record<string, number> = {
  requirement: 1,
  scenarioId: 2,
  featureFile: 3,
  useCase: 4,
  command: 5,
  aggregate: 6,
  event: 7,
  technicalArtifact: 8,
  testArtifact: 9,
  status: 10,
};

export const LINK_FIELDS: Record<string, string> = {
  "--feature": "featureFile",
  "--uc": "useCase",
  "--cmd": "command",
  "--agg": "aggregate",
  "--evt": "event",
  "--code": "technicalArtifact",
  "--test": "testArtifact",
  "--scenario": "scenarioId",
};

export function pad3(n: number) {
  return String(n).padStart(3, "0");
}

export function nextReqId(rows: any[]) {
  return TraceabilityMatrix.nextReqId(rows);
}

export function nextScenarioId(rows: any[]) {
  return TraceabilityMatrix.nextScenarioId(rows);
}

export function buildRow(fields: any) {
  return TraceabilityMatrix.buildRow(fields);
}

export function isMatrixDataLine(line: string) {
  if (!line.startsWith("|")) return false;
  if (line.includes("---")) return false;
  if (line.includes("| Requirement | Scenario ID |")) return false;
  if (line.includes("| Feature | Scenario |")) return false;
  return true;
}

export function appendRequirement(content: string, fields: any) {
  const rows = parseTraceability(content);
  return TraceabilityMatrix.appendRequirement(content, fields, rows);
}

export function updateRequirementFields(content: string, reqId: string, fields: any) {
  return TraceabilityMatrix.updateRequirementFields(content, reqId, fields, COL);
}

function readMatrix(tracePath: string): string {
  if (!fs.existsSync(tracePath)) {
    process.stderr.write(
      `${c.red}✖${c.reset}  docs/specs/traceability.md not found.\n` +
        `   ${c.dim}Run \`specgate init\` first, or pass --project-dir to an existing project.${c.reset}\n`
    );
    process.exit(2);
  }
  return fs.readFileSync(tracePath, "utf8");
}

function meaningfulCell(value: any) {
  if (!value || value === "-" || String(value).toUpperCase() === "TBD") return null;
  return value;
}

function statusColor(status: string) {
  if (["Implemented", "Verified", "Released"].includes(status)) return c.green;
  if (status === "Draft" || !status) return c.yellow;
  return c.reset;
}

function collectFieldFlags(argv: string[]) {
  const fields: Record<string, string> = {};
  let status: string | null = null;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a in LINK_FIELDS && argv[i + 1] != null) {
      fields[LINK_FIELDS[a]] = argv[++i];
    } else if (a === "--status" && argv[i + 1] != null) {
      status = argv[++i];
    } else {
      rest.push(a);
    }
  }
  return { fields, status, rest };
}

/**
 * `req --help`, or a subcommand nobody wrote, used to hand execution to
 * nothing: `execute()` matched `list` / `add` / `link` and fell off the end of
 * the function otherwise, exiting 0 with no output. `req done <REQ>` was the
 * worse case — `cmdList`'s own "Next:" hint recommends it, and following that
 * hint did nothing at all. Found 2026-08-26 timing a newcomer's first path
 * through the tool.
 */
function usage(): void {
  process.stdout.write(
    `
  📝 ${c.bold}specgate req${c.reset} — add, link and close requirements without hand-editing the matrix

` +
      `  ${c.dim}specgate req${c.reset}                          list requirements and their status
` +
      `  ${c.dim}specgate req add${c.reset} "<title>"             add one, Draft
` +
      `  ${c.dim}specgate req link${c.reset} REQ-007 --test <path>  set a field (--feature/--test/--code/--uc/--cmd)
` +
      `  ${c.dim}specgate req done${c.reset} REQ-007               mark Implemented (same as specgate done REQ-007)
` +
      `  ${c.dim}specgate req rm${c.reset} REQ-007                 remove its row and its prose (--dry-run, --force)

` +
      `  Run ${c.cyan}specgate req <subcommand> --help${c.reset} for a subcommand's own flags.

`
  );
}

const FIELD_FLAGS =
  `    --feature <path>   feature file          --test <path>   test artifact\n` +
  `    --code <path>      implementation        --scenario <id> scenario id\n` +
  `    --uc <text>        use case              --cmd <text>    command/query\n` +
  `    --agg <name>       aggregate             --evt <name>    event\n`;
const STATUS_FLAG = `    --status <status>  Draft · Approved · Implemented · Verified · Released · Deprecated\n`;

/**
 * `usage()` promised "a subcommand's own flags" and then printed itself again
 * for every subcommand, so `req link --help` never named a single field flag.
 * Found 2026-10-06 walking the daily loop on a fresh repo.
 */
const SUB_USAGE: Record<string, string> = {
  add:
    `\n  📝 ${c.bold}specgate req add${c.reset} "<title>" [field flags]\n\n` +
    `  Reserves the next REQ-NNN, adds its row to docs/specs/traceability.md\n` +
    `  and a draft \`## REQ-NNN\` section to spec.md. Status defaults to Draft.\n\n` +
    `  FIELD FLAGS (optional)\n${FIELD_FLAGS}${STATUS_FLAG}\n`,
  link:
    `\n  📝 ${c.bold}specgate req link${c.reset} REQ-NNN <field flag>...\n\n` +
    `  Sets fields on every row of REQ-NNN. At least one flag is required.\n\n` +
    `  FIELD FLAGS\n${FIELD_FLAGS}\n` +
    `  The status changes through \`specgate done REQ-NNN [--status <status>] [--check]\`,\n` +
    `  which can verify the requirement before it claims anything.\n\n` +
    `  EXAMPLE\n    specgate req link REQ-007 --feature features/orders.feature --test test/orders.test.js\n\n`,
  rm:
    `\n  📝 ${c.bold}specgate req rm${c.reset} REQ-NNN [--dry-run] [--force]\n\n` +
    `  Removes the requirement's rows and its spec.md section.\n\n` +
    `    --dry-run   show what would be removed, write nothing\n` +
    `    --force     required once the requirement has left Draft —\n` +
    `                \`specgate done REQ-NNN --status Deprecated\` is usually what you want\n\n`,
};
SUB_USAGE.remove = SUB_USAGE.rm;

function cmdList(tracePath: string, io?: any) {
  const rows = parseTraceability(readMatrix(tracePath));
  const reqs = rows.filter((r) => /^REQ-\d+/.test(r.requirement || ""));

  if (io && io.json) {
    io.emit({
      requirements: reqs.map((r) => ({
        id: r.requirement,
        scenarioId: r.scenarioId || null,
        title: meaningfulCell(r.useCase),
        status: r.status || "Draft",
        featureFile: meaningfulCell(r.featureFile),
        testArtifact: meaningfulCell(r.testArtifact),
        technicalArtifact: meaningfulCell(r.technicalArtifact),
      })),
    });
    return 0;
  }

  if (reqs.length === 0) {
    process.stdout.write(
      `\n  ${c.dim}No requirements yet. Add one: specgate req add "…"${c.reset}\n\n`
    );
    return 0;
  }
  process.stdout.write(
    `\n  ${c.bold}📝 Requirements${c.reset} ${c.dim}(${reqs.length})${c.reset}\n\n`
  );
  for (const r of reqs) {
    const meaningful = (v: any) => meaningfulCell(v) !== null;
    process.stdout.write(
      `    ${c.cyan}${(r.requirement || "").padEnd(9)}${c.reset} ${c.dim}${r.scenarioId || ""}${c.reset}  ${statusColor(r.status)}${r.status || "Draft"}${c.reset}\n`
    );
    if (meaningful(r.featureFile))
      process.stdout.write(`      ${c.dim}feature: ${r.featureFile}${c.reset}\n`);
    if (meaningful(r.testArtifact))
      process.stdout.write(`      ${c.dim}test:    ${r.testArtifact}${c.reset}\n`);
    if (meaningful(r.technicalArtifact))
      process.stdout.write(`      ${c.dim}code:    ${r.technicalArtifact}${c.reset}\n`);
  }
  process.stdout.write(
    `\n  ${c.dim}Next: specgate req link <REQ> --test … · specgate req done <REQ>${c.reset}\n\n`
  );
  return 0;
}

export class ReqCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    let projectDir = ".";
    const stripped: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--project-dir" && argv[i + 1]) {
        projectDir = argv[++i];
      } else {
        stripped.push(argv[i]);
      }
    }

    let resolvedDir: string;
    try {
      resolvedDir = resolveProjectDir(projectDir);
    } catch {
      resolvedDir = projectDir;
    }

    const tracePath = path.join(resolvedDir, "docs", "specs", "traceability.md");
    const sub = stripped[0];

    // Anywhere, not just first: `req add --help` used to answer "A title is
    // required", which is the tool refusing to explain itself to someone
    // trying to learn it — while two help texts tell you to use --help.
    if (stripped.includes("--help") || stripped.includes("-h")) {
      if (sub === "done") {
        new DoneCommand(["--help"]).execute();
        return;
      }
      if (sub && SUB_USAGE[sub]) process.stdout.write(SUB_USAGE[sub]);
      else usage();
      process.exit(0);
    }

    if (!sub || sub === "list") {
      const io = agentIo(wantsJson(stripped));
      const code = cmdList(tracePath, io);
      process.exit(code);
    }

    if (sub === "add") {
      const { fields, status, rest } = collectFieldFlags(stripped.slice(1));
      const title = rest
        .filter((a) => !a.startsWith("-"))
        .join(" ")
        .trim();
      if (!title && !fields.useCase) {
        process.stderr.write(
          `${c.red}✖${c.reset}  A title is required: specgate req add "<what the requirement does>"\n`
        );
        process.exit(2);
      }
      if (title && !fields.useCase) fields.useCase = title;

      // The matrix row carries the title; `spec.md` carries the requirement.
      // Writing only the row left the requirement with no text anywhere, which
      // is why `harness prompt` emitted "Implement REQ-002" with nothing in it
      // to implement.
      if (title && !fields.useCase) fields.useCase = title;

      const repo = new DiskTraceabilityRepository();
      const useCase = new AddRequirementUseCase(repo);
      const result = useCase.execute(resolvedDir, { ...fields, status });

      const specPath = path.join(resolvedDir, "spec.md");
      let wroteSection = false;
      if (fs.existsSync(specPath) && result.reqId) {
        const written = appendRequirementSection(
          fs.readFileSync(specPath, "utf8"),
          result.reqId,
          title || fields.useCase || result.reqId
        );
        if (written.added) {
          fs.writeFileSync(specPath, written.content, "utf8");
          wroteSection = true;
        }
      }
      if (isDerivedProject(resolvedDir) && result.reqId) {
        // The row is regenerated from spec.md, so whatever the flags set has
        // to be written there or it disappears. The title is the heading.
        const explicit: Record<string, string> = { ...fields };
        delete explicit.useCase;
        if (status) explicit.status = status;
        // The scenario id it reserved: without it the next `new` reserves the
        // same SCN number again, since nothing else records this one.
        if (result.scenarioId && !explicit.scenarioId) explicit.scenarioId = result.scenarioId;
        writeRequirementFields(resolvedDir, result.reqId, explicit);
      }

      process.stdout.write(
        `${c.green}✔${c.reset}  Added ${c.bold}${result.reqId}${c.reset} ${c.dim}(${result.scenarioId}, status ${status || "Draft"})${c.reset}\n` +
          (wroteSection
            ? `   ${c.dim}spec.md: added a draft \`## ${result.reqId}\` section — rewrite the obligation${c.reset}\n`
            : "") +
          `   ${c.dim}Next: specgate req link ${result.reqId} --feature <path> --test <path>${c.reset}\n`
      );
      process.exit(0);
    }

    if (sub === "rm" || sub === "remove") {
      const args = stripped.slice(1);
      const reqId = args.find((a) => /^REQ-\d+$/.test(a));
      const dryRun = args.includes("--dry-run");
      const force = args.includes("--force");

      if (!reqId) {
        process.stderr.write(`${c.red}✖${c.reset}  Expected a REQ-id: specgate req rm REQ-007\n`);
        process.exit(2);
      }

      const traceContent = readMatrix(tracePath);
      const specPath = path.join(resolvedDir, "spec.md");
      const specContent = fs.existsSync(specPath) ? fs.readFileSync(specPath, "utf8") : "";
      const plan = planRemoval(traceContent, reqId, specContent);

      if (plan.rows.length === 0 && !plan.hasProse) {
        process.stderr.write(
          `${c.red}✖${c.reset}  ${reqId} is not in docs/specs/traceability.md or spec.md.\n`
        );
        process.exit(1);
      }

      // Removing a delivered requirement deletes the record that something
      // shipped. That is a decision, not a typo fix, so it has to be said out
      // loud once.
      const delivered = plan.statuses.filter(isDelivered);
      if (delivered.length > 0 && !force) {
        process.stderr.write(
          `${c.red}✖${c.reset}  ${reqId} is ${delivered.join(", ")}, not Draft.\n` +
            `   ${c.dim}Removing it deletes the record that this was delivered. Re-run with --force ` +
            `if that is what you mean, or set it to Deprecated instead:${c.reset}\n` +
            `   ${c.dim}specgate done ${reqId} --status Deprecated${c.reset}\n`
        );
        process.exit(1);
      }

      const nextTrace = removeMatrixRows(traceContent, reqId);
      const nextSpec = removeSpecProse(specContent, reqId);

      if (!dryRun) {
        if (nextTrace !== traceContent) fs.writeFileSync(tracePath, nextTrace, "utf8");
        if (nextSpec !== specContent && fs.existsSync(specPath)) {
          fs.writeFileSync(specPath, nextSpec, "utf8");
        }
        refreshDerivedMatrix(resolvedDir);
      }

      const prefix = dryRun ? `${c.dim}[dry-run]${c.reset} ` : "";
      process.stdout.write(
        `${prefix}${c.green}✔${c.reset}  Removed ${c.bold}${reqId}${c.reset} ` +
          `${c.dim}(${plan.rows.length} matrix row(s)${plan.hasProse ? ", and its prose in spec.md" : ""})${c.reset}\n`
      );

      // Say what was left behind. A feature file nothing references fails
      // `validate` with feature_not_in_matrix, and finding that out from a red
      // build instead of from here would be the tool wasting somebody's time.
      for (const feature of plan.orphanedFeatures) {
        process.stdout.write(
          `   ${c.yellow}⚠${c.reset}  ${feature} is no longer referenced by any row.\n` +
            `   ${c.dim}Delete it, or point another requirement at it — \`validate\` fails on ` +
            `a feature file that is not in the matrix.${c.reset}\n`
        );
      }
      process.stdout.write(
        `   ${c.dim}Nothing else was touched: tests, implementation and git history keep ` +
          `whatever they said about ${reqId}.${c.reset}\n`
      );
      process.exit(0);
    }

    if (sub === "link") {
      const { fields, status, rest } = collectFieldFlags(stripped.slice(1));
      // `--status` was parsed and dropped: `req link REQ-002 --status
      // Implemented` printed a tick and left the row Draft. One way to change
      // a status — `done`, which can check first — instead of two that differ.
      if (status !== null) {
        process.stderr.write(
          `${c.red}✖${c.reset}  req link does not change the status.\n` +
            `   ${c.dim}Use: specgate done ${rest.find((a) => /^REQ-\d+$/.test(a)) || "REQ-NNN"} --status ${status} --check${c.reset}\n`
        );
        process.exit(2);
      }
      const reqId = rest.find((a) => /^REQ-\d+$/.test(a));
      if (!reqId) {
        process.stderr.write(
          `${c.red}✖${c.reset}  Expected a REQ-id: specgate req link REQ-007 --test …\n`
        );
        process.exit(2);
      }
      if (Object.keys(fields).length === 0) {
        process.stderr.write(
          `${c.red}✖${c.reset}  Nothing to link. Pass at least one field flag (--feature/--test/--code/--uc/…).\n`
        );
        process.exit(2);
      }

      // Derived project: the link goes into the requirement's csda:trace in
      // spec.md, or the next regeneration would drop it.
      const derivedRows = isDerivedProject(resolvedDir)
        ? writeRequirementFields(resolvedDir, reqId, fields)
        : undefined;
      const result =
        derivedRows === undefined
          ? new LinkRequirementUseCase(new DiskTraceabilityRepository(), COL).execute(
              resolvedDir,
              reqId,
              fields
            )
          : { ok: derivedRows !== null };

      if (!result.ok) {
        process.stderr.write(
          `${c.red}✖${c.reset}  ${reqId} not found in traceability.md.\n` +
            `   ${c.dim}List existing: specgate req list${c.reset}\n`
        );
        process.exit(1);
      }

      const set = Object.keys(fields)
        .map((k) => `${k}=${fields[k]}`)
        .join(", ");
      process.stdout.write(
        `${c.green}✔${c.reset}  ${c.bold}${reqId}${c.reset} ${c.dim}updated: ${set}${c.reset}\n`
      );
      process.exit(0);
    }

    if (sub === "done") {
      // Delegates rather than reimplements — `specgate req done` is the same
      // operation as the top-level `specgate done`, and DoneCommand.execute()
      // already calls process.exit itself, so this never falls through.
      new DoneCommand(["--project-dir", resolvedDir, ...stripped.slice(1)]).execute();
      return;
    }

    usage();
    process.exit(2);
  }
}
