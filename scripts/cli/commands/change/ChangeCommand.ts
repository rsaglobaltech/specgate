#!/usr/bin/env node
/**
 * `specgate change <sub>` — the change lifecycle.
 *
 *   new · list · show · status · validate · archive
 *
 * Every subcommand accepts `--json` and, in that mode, prints exactly one JSON
 * document on stdout while prose goes to stderr. Failures print the command's
 * null-shape plus a `status` array of diagnostics and exit 1. That contract is
 * what lets an agent drive this without screen-scraping.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";

import { resolveProjectDir } from "../../../lib/project-root";
import * as os from "node:os";
import { spawnSync } from "node:child_process";
import {
  error,
  warning,
  hasErrors,
  printDiagnostics,
  errorMessage,
} from "../../../lib/diagnostics";
import type { Diagnostic } from "../../../lib/diagnostics";
import { archiveBaseMoved, recordBases } from "../../../lib/change-base";
import { buildInstructions } from "../../../change/instructions";
import type { Instructions } from "../../../change/instructions";
import { readHarnessConfig } from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import { changeScope, judgeScope } from "../../../../packages/core/src/domain/AuthoringScope";
import { agentIo } from "../../../lib/agent";
import type { AgentDocument } from "../../../lib/agent";
import { phrases } from "../../../../packages/core/src/infrastructure/DiskLanguageRepository";
import { ARTIFACTS, artifactState } from "../../../change/artifacts";
import { parseDelta, renderRequirement } from "../../../../packages/core/src/domain/SpecParser";
import { refreshDerivedMatrix } from "../spec/MatrixCommand";
import { changeRequirements, DELIVERED } from "../../../lib/in-flight";
import { ArchiveChangeUseCase } from "../../../../packages/core/src/application/ArchiveChangeUseCase";
import { DiskProjectRepository } from "../../../../packages/core/src/infrastructure/DiskProjectRepository";
import {
  CHANGE_ID_RE,
  CHANGE_CONFIG_FILE,
  DEFAULT_CONFIG,
  paths,
  listChangeIds,
  listArchivedIds,
  listDeltas,
  readConfig,
  renderConfig,
  reserveReqRange,
  taskProgress,
  changeStatusLabel,
} from "../../../../packages/core/src/infrastructure/ChangeWorkspace";
import {
  CHANGE_TEMPLATES,
  templateDelta,
  templateProposal,
  templateTasks,
  templateDesign,
  templateValueDriftDelta,
} from "../../../../packages/core/src/domain/ChangeTemplates";
import {
  LAYERED_SCHEMA,
  LEGACY_DISCOVER,
  layer,
  discoverRewritten,
  templateDiscover,
  templateLayeredDesign,
  templateLayeredTasks,
} from "../../../../packages/core/src/domain/ChangeLayers";
import { ValidateChangeUseCase } from "../../../../packages/core/src/application/ValidateChangeUseCase";
import { readCapabilityRequirements } from "../../../lib/capability-specs";
import { impactOf } from "../../../lib/change-impact";
import { approveChange, noteChange } from "../../../lib/change-review";
import type { LayerId } from "../../../../packages/core/src/domain/ChangeLayers";
import {
  declaredSpecValues,
  declaredCodeValues,
} from "../../../../packages/core/src/domain/ValueAnnotations";
import {
  declaredPaths,
  artifactFile,
} from "../../../../packages/core/src/domain/DeclaredArtifacts";
import { parseTraceability } from "../spec/PlanCommand";
import type { TraceRow } from "../spec/PlanCommand";
import { main as instructionsMain } from "../../../change/instructions";
import { briefOf, draftReport, draftModuleOf } from "../spec/DraftCommand";

/**
 * The scaffold set as the CLI hands it out: `(changeId, projectDir)`, with the
 * project's phrase table resolved here. `CHANGE_TEMPLATES` itself is pure and
 * takes the table directly.
 */
export const TEMPLATES = {
  ...CHANGE_TEMPLATES,
  specs: (_changeId: string, projectDir?: string) =>
    templateDelta("<capability>", "REQ-NNN", phrases(projectDir)),
};

import { c } from "../../../lib/ui";
import * as ui from "../../../lib/ui";

// The artefact graph. Dependencies are enablers, not gates: `requires` says
// what makes an artefact *possible*, never what the author must do next.
// F3 makes this configurable per schema; for now the built-in is the default.

/** The skeletons `change new` writes, shared with `change instructions`. */

/**
 * The verb this run was reached through: `propose` and `archive` are the daily
 * names of `change new` and `change archive` (ADR-0035). Only the wording
 * differs — the header, the help, the next step.
 */
let VERB: "propose" | "archive" | null = null;

/** The help of `propose` and `archive`, and the line that ties the old names to them. */
function verbUsage(sub: string) {
  // The old names keep their full help, under the line that names the new verb.
  if (!VERB && (sub === "new" || sub === "archive")) {
    process.stdout.write(
      sub === "new"
        ? "  Same as specgate propose: an idea becomes a change.\n"
        : "  Same as specgate archive: close a change once its requirements are delivered.\n"
    );
    usage();
    return true;
  }
  if (VERB === "propose") {
    process.stdout.write(
      `\n  ${c.bold}${c.cyan}💡 propose${c.reset}  ${c.dim}— open a change${c.reset}\n\n` +
        `  ${c.bold}USAGE${c.reset}\n` +
        `    ${c.cyan}specgate propose${c.reset} <change-id> [--capability <name>] [--from-value-drift <REQ:id>]\n` +
        `                     [--full] [--reserve <n>] [--project-dir <path>] [--json]\n` +
        `    ${c.cyan}specgate propose --from-brief${c.reset} [<module>]   ${c.dim}a module of docs/brief.md (see specgate draft --help)${c.reset}\n` +
        `    ${c.cyan}specgate propose --from-brief${c.reset} --check | --new-brief | --agent <cmd>\n` +
        `                     ${c.dim}check the brief · write one to fill in · have your agent propose its fields or cards${c.reset}\n` +
        `    ${c.cyan}specgate propose --from-ticket${c.reset} <KEY | issue.json> [--check] [--capability <name>]\n` +
        `                     [--agent <cmd>] [--no-branch] [--no-push]\n` +
        `                     ${c.dim}a Jira ticket as the source text: its Definition of Ready, then its change (docs/from-a-ticket.md)${c.reset}\n\n` +
        `  Opens docs/specs/changes/<change-id>/ — proposal, tasks, a reserved REQ range and a\n` +
        `  delta for the capability (named after the change unless --capability says).\n` +
        `  Then: write the delta, a test that names each requirement, the code; specgate apply.\n\n` +
        `  ${c.bold}A BRIEF, OR NOT${c.reset}\n` +
        `    One behaviour to fix or change     No brief: specgate propose <change-id>\n` +
        `    A feature with a few rules (2–6)   No brief: specgate propose <change-id>, rules in the delta\n` +
        `    A product, or a large area of one  A brief: docs/brief.md, then specgate propose --from-brief\n` +
        `    A story your analyst wrote in Jira  The ticket: specgate propose --from-ticket <KEY>\n` +
        `                                       ${c.dim}(how to write it: specgate propose --from-brief --new-brief)${c.reset}\n\n`
    );
    return true;
  }
  if (VERB === "archive") {
    process.stdout.write(
      `\n  ${c.bold}${c.cyan}📦 archive${c.reset}  ${c.dim}— close a change${c.reset}\n\n` +
        `  ${c.bold}USAGE${c.reset}\n` +
        `    ${c.cyan}specgate archive${c.reset} <change-id> [--dry-run] [--force] [--project-dir <path>] [--json]\n\n` +
        `  Merges the change into the capability specs, the matrix and features/ once every\n` +
        `  requirement it adds or modifies is Implemented (specgate apply). Nothing skips that.\n` +
        `  --force archives with unchecked tasks or a draft whose checklist fails, and overwrites\n` +
        `  existing feature files.\n\n`
    );
    return true;
  }
  return false;
}

function usage() {
  process.stdout.write(
    `\n  ${c.bold}${c.cyan}🔄 change${c.reset}  ${c.dim}— propose, review and archive a change${c.reset}\n\n` +
      `  ${c.bold}USAGE${c.reset}\n` +
      `    ${c.cyan}specgate change${c.reset} <new|list|show|status|instructions|author|validate|impact|approve|note|archive> [options]\n\n` +
      `  ${c.bold}SUBCOMMANDS${c.reset}\n` +
      `    ${c.green}new <id>${c.reset}       ${c.dim}Scaffold a change folder (proposal, tasks, delta skeleton).${c.reset}\n` +
      `    ${c.green}list${c.reset}           ${c.dim}Active changes with task progress.${c.reset}\n` +
      `    ${c.green}show <id>${c.reset}      ${c.dim}Proposal, deltas and what they touch.${c.reset}\n` +
      `    ${c.green}status [id]${c.reset}    ${c.dim}Which artefact to write next.${c.reset}\n` +
      `    ${c.green}author <id>${c.reset}    ${c.dim}Have an agent write one artefact, confined to the change.${c.reset}\n` +
      `    ${c.green}validate [id]${c.reset}  ${c.dim}Check the deltas against the capability specs.${c.reset}\n` +
      `    ${c.green}impact <REQ|id>${c.reset} ${c.dim}Spec, features, tests, files and requirements a change to it touches.${c.reset}\n` +
      `    ${c.green}approve <id>${c.reset}   ${c.dim}Approve the layers you own (--layer discover|design|tasks): Build waits for all.${c.reset}\n` +
      `    ${c.green}note <id> "<text>"${c.reset} ${c.dim}Ask the draft for a change in your words (--req REQ).${c.reset}\n` +
      `    ${c.green}archive <id>${c.reset}   ${c.dim}Once its requirements are Implemented: merge, sync traceability, archive.${c.reset}\n\n` +
      `  ${c.bold}OPTIONS${c.reset}\n` +
      `    ${c.green}--project-dir <path>${c.reset}  ${c.dim}Project root (default: auto-detected).${c.reset}\n` +
      `    ${c.green}--json${c.reset}                ${c.dim}One JSON document on stdout; prose on stderr.${c.reset}\n` +
      `    ${c.green}--capability <name>${c.reset}   ${c.dim}(new) Seed a delta for this capability.${c.reset}\n` +
      `    ${c.green}--modify <REQ>${c.reset}        ${c.dim}(new) Copy a delivered requirement into a MODIFIED delta, Draft. Repeatable.${c.reset}\n` +
      `    ${c.green}--from-value-drift <REQ:id>${c.reset} ${c.dim}(new) Propose a spec update for a diverging` +
      ` declared value (§8.6).${c.reset}\n` +
      `    ${c.green}--full${c.reset}                ${c.dim}(new) Full rigor — also scaffold design.md.${c.reset}\n` +
      `    ${c.green}--artifact <name>${c.reset}     ${c.dim}(author) Which artefact to write. Default: proposal.${c.reset}\n` +
      `    ${c.green}--agent <cmd>${c.reset}         ${c.dim}(author) Agent command; must contain {prompt_file}.${c.reset}\n` +
      `    ${c.green}--agent-profile <n>${c.reset}   ${c.dim}(author) A profile from .harness/profiles.yaml.${c.reset}\n` +
      `    ${c.green}--reserve <n>${c.reset}         ${c.dim}(new) Reserve n REQ ids for this change (default 3).${c.reset}\n` +
      `    ${c.green}--strict${c.reset}              ${c.dim}(validate) Treat advisory warnings as failures.${c.reset}\n` +
      `    ${c.green}--rebased${c.reset}             ${c.dim}(validate <id>) The delta was rewritten over requirements that moved; record them as they read now.${c.reset}\n` +
      `    ${c.green}--dry-run${c.reset}             ${c.dim}(archive) Print the plan, write nothing.${c.reset}\n` +
      `    ${c.green}--force${c.reset}               ${c.dim}(archive) Archive with unchecked tasks or a draft whose checklist fails; overwrite features.${c.reset}\n` +
      `                          ${c.dim}Never without its requirements delivered (ADR-0035).${c.reset}\n\n`
  );
}

/** Parsed command-line options for this command. */
export interface ChangeOptions {
  projectDir: string;
  json: boolean;
  strict: boolean;
  rebased: boolean;
  dryRun: boolean;
  force: boolean;
  full: boolean;
  capability: string | null;
  fromValueDrift: string | null;
  /** `--req REQ-NNN`: the requirement a review note is about (REQ-207). */
  req?: string;
  /** `--layer discover|design|tasks`: the layer `change approve` approves (REQ-311). */
  layer?: string;
  /** `--modify REQ-NNN`, repeatable: requirements copied into MODIFIED deltas (REQ-190). */
  modify: string[];
  schema?: string;
  reserve: number;
  yes?: boolean;
  artifact?: string;
  agent?: string;
  agentProfile?: string;
  positional: string[];
}

function parseArgs(argv: string[]): ChangeOptions {
  const opts: ChangeOptions = {
    projectDir: ".",
    json: false,
    strict: false,
    rebased: false,
    dryRun: false,
    force: false,
    full: false,
    capability: null,
    fromValueDrift: null,
    modify: [],
    reserve: 3,
    positional: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--capability" && argv[i + 1]) opts.capability = argv[++i];
    else if (a === "--from-value-drift" && argv[i + 1]) opts.fromValueDrift = argv[++i];
    else if (a === "--modify" && argv[i + 1]) opts.modify.push(argv[++i]);
    else if (a === "--req" && argv[i + 1]) opts.req = argv[++i];
    else if (a === "--layer" && argv[i + 1]) opts.layer = argv[++i];
    else if (a === "--schema" && argv[i + 1]) opts.schema = argv[++i];
    else if (a === "--reserve" && argv[i + 1]) opts.reserve = parseInt(argv[++i], 10) || 3;
    else if (a === "--artifact" && argv[i + 1]) opts.artifact = argv[++i];
    else if (a === "--agent" && argv[i + 1]) opts.agent = argv[++i];
    else if (a === "--agent-profile" && argv[i + 1]) opts.agentProfile = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "--strict") opts.strict = true;
    else if (a === "--rebased") opts.rebased = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--yes" || a === "-y") opts.yes = true;
    else if (a === "--full") opts.full = true;
    else if (a === "--lite") opts.full = false;
    else if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    } else if (a.startsWith("-")) {
      process.stderr.write(`Unknown flag: ${a}\n`);
      process.exit(2);
    } else opts.positional.push(a);
  }
  return opts;
}

// The contract itself lives in scripts/lib/agent.ts; these are thin adapters
// that keep the existing `opts`-first call sites unchanged.
function fail(opts: { json: boolean }, nullShape: AgentDocument, diags: Diagnostic[]): never {
  return agentIo(opts.json).fail(nullShape, diags);
}
function emit(opts: { json: boolean }, payload: AgentDocument, renderHuman?: () => void): void {
  return agentIo(opts.json).emit(payload, renderHuman);
}

/**
 * Route 2 of the three-way resolution for a declared-value divergence
 * (§8.6): `REQ-ID:value_id` becomes a `MODIFIED Requirements` delta
 * proposing the spec take the code's value. Routes 1 ("fix the code") and 3
 * ("retire the requirement") need no tooling of their own — `specgate report`
 * already points at the code file:line for route 1, and route 3 is
 * `change new` with a hand-written `REMOVED Requirements` section, same as
 * retiring any other requirement.
 */
function resolveValueDriftDelta(
  projectDir: string,
  spec: string
): { capability: string; content: string } | { diagnostics: Diagnostic[] } {
  const sep = spec.indexOf(":");
  const reqId = sep === -1 ? "" : spec.slice(0, sep);
  const valueId = sep === -1 ? "" : spec.slice(sep + 1);
  if (!reqId || !valueId) {
    return {
      diagnostics: [
        error("invalid_value_drift_spec", `"${spec}" is not REQ-ID:value_id.`, {
          fix: "e.g. --from-value-drift REQ-100:session_timeout",
        }),
      ],
    };
  }

  const found = readCapabilityRequirements(projectDir).find((c) => c.req.id === reqId);
  if (!found) {
    return {
      diagnostics: [
        error("value_drift_requirement_not_found", `No capability spec declares ${reqId}.`, {
          target: reqId,
          fix: "Check the id, or that docs/specs/capabilities/ exists.",
        }),
      ],
    };
  }
  const { req, capability } = found;

  const specValue = declaredSpecValues(req.trace).find((v) => v.id === valueId);
  if (!specValue) {
    return {
      diagnostics: [
        error(
          "value_drift_id_not_declared",
          `declares no value_${valueId} in its specgate:trace.`,
          {
            target: reqId,
            fix: `Add value_${valueId}=<literal> to its specgate:trace, or check the id.`,
          }
        ),
      ],
    };
  }

  let rows: TraceRow[] = [];
  const tracePath = path.join(projectDir, "docs/specs/traceability.md");
  if (fs.existsSync(tracePath)) {
    try {
      rows = parseTraceability(fs.readFileSync(tracePath, "utf8"));
    } catch {
      rows = [];
    }
  }
  const row = rows.find((r) => r.requirement === reqId);

  const codeFiles = new Set<string>();
  for (const cell of [row && row.technicalArtifact, row && row.testArtifact]) {
    for (const rel of declaredPaths(cell)) codeFiles.add(artifactFile(rel));
  }

  let codeValue: string | null = null;
  for (const rel of codeFiles) {
    const abs = path.join(projectDir, rel);
    if (!fs.existsSync(abs)) continue;
    const hit = declaredCodeValues(fs.readFileSync(abs, "utf8")).find((e) => e.id === valueId);
    if (hit) {
      codeValue = hit.value;
      break;
    }
  }

  if (codeValue === null) {
    return {
      diagnostics: [
        error(
          "value_drift_no_code_value",
          `No \`specgate:value ${valueId}=\` marker found in ${reqId}'s declared Technical/Test artifact.`,
          {
            target: reqId,
            fix: "Either the marker is missing, or the declared file doesn't exist yet — see `specgate report` / --strict-links.",
          }
        ),
      ],
    };
  }

  if (codeValue === specValue.value) {
    return {
      diagnostics: [
        error(
          "value_drift_already_matches",
          `value_${valueId} already matches the code (${codeValue}) — nothing to propose.`,
          { target: reqId }
        ),
      ],
    };
  }

  return {
    capability,
    content: templateValueDriftDelta(capability, req, valueId, specValue.value, codeValue),
  };
}

// ── new ───────────────────────────────────────────────────────────────────────

function cmdNew(opts: ChangeOptions) {
  const projectDir = resolveProjectDir(opts.projectDir);
  const p = paths(projectDir);
  const changeId = opts.positional[0];
  const nullShape = { change: null };

  if (!changeId) {
    return fail(opts, nullShape, [
      error("change_id_required", "`change new` expects a change id.", {
        fix: "e.g. `specgate change new add-dynamic-pricing`",
      }),
    ]);
  }
  if (!CHANGE_ID_RE.test(changeId)) {
    return fail(opts, nullShape, [
      error("invalid_change_id", `"${changeId}" is not a valid change id.`, {
        target: changeId,
        fix: "Use lowercase kebab-case, e.g. add-dynamic-pricing.",
      }),
    ]);
  }
  const dir = p.change(changeId);
  if (fs.existsSync(dir)) {
    return fail(opts, nullShape, [
      error("change_exists", `Change "${changeId}" already exists.`, {
        target: changeId,
        fix: `Edit ${path.relative(projectDir, dir)}, or pick another id.`,
      }),
    ]);
  }

  // `propose` always leaves a delta to write: named after the change unless
  // the person names the capability (ADR-0035).
  if (VERB === "propose" && !opts.capability && !opts.fromValueDrift) opts.capability = changeId;

  if (opts.capability && opts.fromValueDrift) {
    return fail(opts, nullShape, [
      error("conflicting_seed_flags", "--capability and --from-value-drift cannot both be given.", {
        fix: "Use one or the other — they seed the delta two different ways.",
      }),
    ]);
  }

  let valueDrift: { capability: string; content: string } | null = null;
  if (opts.fromValueDrift) {
    const resolved = resolveValueDriftDelta(projectDir, opts.fromValueDrift);
    if ("diagnostics" in resolved) {
      return fail(opts, nullShape, resolved.diagnostics);
    }
    valueDrift = resolved;
  }

  // REQ-190: each requirement as its capability spec has it, reopened as Draft.
  const modified = new Map<string, string[]>();
  for (const id of opts.modify) {
    const found = readCapabilityRequirements(projectDir).find((c) => c.req.id === id);
    if (!found) {
      return fail(opts, nullShape, [
        error("modify_requirement_not_found", `${id} is not in a capability spec.`, {
          target: id,
          fix: "A requirement still in an open change is edited there; check the id with specgate status.",
        }),
      ]);
    }
    const owner = changeModifying(projectDir, id);
    if (owner) {
      return fail(opts, nullShape, [
        error("modify_already_open", `${owner} already modifies ${id}.`, {
          target: id,
          fix: `Edit docs/specs/changes/${owner}, or archive it first.`,
        }),
      ]);
    }
    const text = found.req.text;
    const reopened = renderRequirement({
      ...found.req,
      text: Array.isArray(text) ? text.join("\n") : text,
      trace: { ...found.req.trace, status: "Draft" },
    });
    modified.set(found.capability, [...(modified.get(found.capability) || []), reopened.trim()]);
  }

  const reqRange = reserveReqRange(projectDir, opts.reserve);
  const config = {
    ...DEFAULT_CONFIG,
    // ADR-0042: a new change is layered unless the person names a schema.
    schema: opts.schema || LAYERED_SCHEMA,
    created: new Date().toISOString().slice(0, 10),
    rigor: opts.full ? "full" : "lite",
    req_range: reqRange,
  };

  const created: string[] = [];
  const write = (file: string, contents: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, "utf8");
    created.push(path.relative(projectDir, file).split(path.sep).join("/"));
  };

  write(path.join(dir, CHANGE_CONFIG_FILE), renderConfig(config));
  if (config.schema === LAYERED_SCHEMA) {
    // REQ-282: each layer with its owner.
    write(path.join(dir, "discover.md"), templateDiscover(changeId));
    write(path.join(dir, "design.md"), templateLayeredDesign(changeId));
    write(path.join(dir, "tasks.md"), templateLayeredTasks());
  } else {
    write(path.join(dir, "proposal.md"), templateProposal(changeId));
    write(path.join(dir, "tasks.md"), templateTasks());
    if (opts.full) write(path.join(dir, "design.md"), templateDesign(changeId));
  }
  if (opts.capability) {
    write(
      path.join(p.changeSpecs(changeId), opts.capability, "spec.md"),
      templateDelta(opts.capability, reqRange[0], phrases(projectDir))
    );
  }
  if (valueDrift) {
    write(path.join(p.changeSpecs(changeId), valueDrift.capability, "spec.md"), valueDrift.content);
  }
  for (const [capability, blocks] of modified) {
    write(
      path.join(p.changeSpecs(changeId), capability, "spec.md"),
      `# Delta — ${capability}\n\n## MODIFIED Requirements\n\n${blocks.join("\n\n")}\n`
    );
  }

  emit(
    opts,
    {
      change: {
        id: changeId,
        path: path.relative(projectDir, dir).split(path.sep).join("/"),
        schema: config.schema,
        rigor: config.rigor,
        reqRange,
        created,
      },
    },
    () => {
      process.stdout.write(
        ui.header(VERB === "propose" ? "propose" : "change new", changeId) +
          ui.ok(
            `Change ${c.bold}${changeId}${c.reset} created ` +
              ui.muted(`· ${config.rigor} · REQ ids ${reqRange[0]}…${reqRange[1]} reserved`)
          ) +
          "\n" +
          created.map((f) => ui.fileLine("added", f)).join("") +
          (VERB === "propose"
            ? ui.next(
                "specgate apply",
                "after you write the delta, a test that names each requirement, and the code"
              )
            : ui.next(
                `specgate change validate ${changeId}`,
                // ADR-0042: a layered change starts from its Discover.
                config.schema === LAYERED_SCHEMA
                  ? "after you write discover.md, the delta, then design.md and tasks.md"
                  : "after you write the proposal, then the delta"
              ))
      );
    }
  );
}

/** The open change whose delta already modifies a requirement, if one does (REQ-190). */
function changeModifying(projectDir: string, id: string): string | null {
  const heading = new RegExp(`^###\\s+Requirement:\\s+${id}\\b`, "m");
  for (const change of listChangeIds(projectDir)) {
    for (const d of listDeltas(projectDir, change)) {
      const text = fs.readFileSync(d.file, "utf8");
      const at = text.indexOf("## MODIFIED Requirements");
      if (at === -1) continue;
      const rest = text.slice(at + 3);
      const end = rest.search(/^## /m);
      if (heading.test(end === -1 ? rest : rest.slice(0, end))) return change;
    }
  }
  return null;
}

// ── list ──────────────────────────────────────────────────────────────────────

function cmdList(opts: ChangeOptions) {
  const projectDir = resolveProjectDir(opts.projectDir);
  const ids = listChangeIds(projectDir);
  const changes = ids.map((id) => {
    const progress = taskProgress(projectDir, id);
    const config = readConfig(projectDir, id);
    return {
      id,
      schema: config.schema,
      rigor: config.rigor,
      completedTasks: progress.complete,
      totalTasks: progress.total,
      deltaCount: listDeltas(projectDir, id).length,
      status: changeStatusLabel(progress),
    };
  });

  emit(opts, { changes, archived: listArchivedIds(projectDir).length }, () => {
    if (changes.length === 0) {
      process.stdout.write(ui.header("change list") + ui.info("No active changes.") + "\n");
      return;
    }
    process.stdout.write(ui.header("change list") + ui.section("Active changes"));
    process.stdout.write(
      ui.table(
        changes.map((ch) => [
          `${ui.state(ch.status === "complete" ? "ready" : ch.status === "in-progress" ? "doing" : "todo")} ${c.bold}${ch.id}${c.reset}`,
          ui.muted(`${ch.completedTasks}/${ch.totalTasks} tasks`),
          ui.muted(`${ch.deltaCount} delta(s)`),
          ui.muted(ch.rigor),
        ])
      ) + "\n"
    );
  });
}

// ── show ──────────────────────────────────────────────────────────────────────

/**
 * `change approve <id> [--layer discover|design|tasks]` — a person approves the
 * layers they own; Build waits until every layer is approved (REQ-206, REQ-311).
 */
function cmdApprove(opts: ChangeOptions) {
  const projectDir = resolveProjectDir(opts.projectDir);
  const id = opts.positional[0];
  const nullShape = { approve: null };
  const layer = opts.layer as LayerId | undefined;
  const r = id
    ? approveChange(projectDir, id, new Date().toISOString().slice(0, 10), layer)
    : { ok: false as const, code: "change_not_found", message: "approve needs a change id." };
  if (!r.ok) {
    return fail(opts, nullShape, [
      error(r.code, r.message, {
        target: id,
        fix:
          r.fix ||
          "Answer its questions and fix what specgate draft --check reports, then approve again.",
      }),
    ]);
  }
  emit(opts, { approve: r }, () => {
    const did = r.layers && r.layers.length ? ` — ${r.layers.join(", ")}` : "";
    process.stdout.write(
      ui.header("change approve", id) +
        (r.approved
          ? ui.ok(`${id} approved on ${r.approved}${did}.`)
          : ui.ok(`Recorded${did}. Still waiting: ${(r.pending || []).join(", ")}.`)) +
        "\n"
    );
  });
}

/** `change note <id> "<text>" [--req REQ]` — a change asked in the reviewer's words (REQ-207). */
function cmdNote(opts: ChangeOptions) {
  const projectDir = resolveProjectDir(opts.projectDir);
  const [id, ...words] = opts.positional;
  const nullShape = { note: null };
  const r = id
    ? noteChange(
        projectDir,
        id,
        words.join(" "),
        opts.req || "",
        new Date().toISOString().slice(0, 10)
      )
    : { ok: false as const, code: "change_not_found", message: "note needs a change id." };
  if (!r.ok) return fail(opts, nullShape, [error(r.code, r.message, { target: id })]);
  emit(opts, { note: r }, () =>
    process.stdout.write(
      ui.header("change note", id) + ui.ok(`Noted in ${id}/review.md (${r.notes} in all).`) + "\n"
    )
  );
}

/** `change impact <REQ|change>` — what a change to a requirement touches (REQ-191). */
function cmdImpact(opts: ChangeOptions) {
  const projectDir = resolveProjectDir(opts.projectDir);
  const target = opts.positional[0];
  const nullShape = { impact: null };
  const impact = target ? impactOf(projectDir, target) : null;
  if (!impact) {
    return fail(opts, nullShape, [
      error(
        "impact_target_not_found",
        target
          ? `"${target}" is neither a requirement id nor an open change.`
          : "impact needs a requirement or a change.",
        { target, fix: "specgate change impact REQ-017, or specgate change impact <change-id>" }
      ),
    ]);
  }
  emit(opts, { impact }, () => {
    process.stdout.write(ui.header("change impact", target));
    if (impact.length === 0) {
      process.stdout.write(ui.info(`${target} modifies or removes no requirement.`) + "\n");
      return;
    }
    for (const i of impact) {
      process.stdout.write(ui.section(i.requirement));
      const line = (label: string, items: string[]) =>
        process.stdout.write(
          `  ${ui.muted(label.padEnd(10))} ${items.length ? items.join(", ") : ui.muted("none")}\n`
        );
      line("spec", i.spec ? [`${i.spec.file}:${i.spec.line}`] : []);
      line("features", i.features);
      line("tests", i.tests);
      line("files", i.files);
      line("named by", i.namedBy);
    }
  });
}

function cmdShow(opts: ChangeOptions) {
  const projectDir = resolveProjectDir(opts.projectDir);
  const p = paths(projectDir);
  const changeId = opts.positional[0];
  const nullShape = { change: null };

  if (!changeId || !fs.existsSync(p.change(changeId))) {
    return fail(opts, nullShape, [
      error("change_not_found", `Change "${changeId || "(none)"}" does not exist.`, {
        target: changeId,
        fix: "Run `specgate change list`.",
      }),
    ]);
  }

  const deltas = listDeltas(projectDir, changeId).map((entry) => {
    const parsed = parseDelta(fs.readFileSync(entry.file, "utf8"));
    return {
      capability: entry.capability,
      file: entry.relative,
      added: parsed.added.map((r) => r.heading),
      modified: parsed.modified.map((r) => r.heading),
      removed: parsed.removed.map((r) => r.heading),
    };
  });

  // The Discover of a layered change, the proposal of a 0.27 one.
  const discoverFile = ["discover.md", LEGACY_DISCOVER]
    .map((f) => path.join(p.change(changeId), f))
    .find((f) => fs.existsSync(f));
  const proposal = discoverFile ? fs.readFileSync(discoverFile, "utf8") : "";
  const titleMatch = /^#\s+(.+)$/m.exec(proposal);
  const progress = taskProgress(projectDir, changeId);

  emit(
    opts,
    {
      change: {
        id: changeId,
        title: titleMatch ? titleMatch[1] : changeId,
        config: readConfig(projectDir, changeId),
        deltaCount: deltas.length,
        deltas,
        tasks: { total: progress.total, complete: progress.complete },
      },
    },
    () => {
      process.stdout.write(
        ui.header("change show", changeId) +
          `  ${c.bold}${titleMatch ? titleMatch[1] : changeId}${c.reset}\n\n`
      );
      if (deltas.length === 0) {
        process.stdout.write(`    ${ui.muted("No delta specs.")}\n\n`);
      }
      for (const d of deltas) {
        process.stdout.write(`  ${c.accent}${d.capability}${c.reset}  ${ui.muted(d.file)}\n`);
        for (const r of d.added) process.stdout.write(ui.fileLine("added", r));
        for (const r of d.modified) process.stdout.write(ui.fileLine("changed", r));
        for (const r of d.removed) process.stdout.write(ui.fileLine("removed", r));
        process.stdout.write("\n");
      }
      process.stdout.write(
        `  ${c.bold}Tasks${c.reset}  ${ui.progress(progress.complete, progress.total, "complete")}\n\n`
      );
    }
  );
}

// ── status ────────────────────────────────────────────────────────────────────

function cmdStatus(opts: ChangeOptions) {
  const projectDir = resolveProjectDir(opts.projectDir);
  const ids = listChangeIds(projectDir);
  const changeId = opts.positional[0] || (ids.length === 1 ? ids[0] : null);

  if (!changeId) {
    const payload = {
      changes: ids,
      message:
        ids.length === 0 ? "No active changes." : "Several active changes — name the one you mean.",
    };
    return emit(opts, payload, () => {
      process.stdout.write(ui.header("change status") + ui.info(payload.message) + "\n");
    });
  }

  const p = paths(projectDir);
  if (!fs.existsSync(p.change(changeId))) {
    return fail(opts, { changeName: null, artifacts: [] }, [
      error("change_not_found", `Change "${changeId}" does not exist.`, {
        target: changeId,
        fix: "Run `specgate change list`.",
      }),
    ]);
  }

  const config = readConfig(projectDir, changeId);
  const artifacts = artifactState(projectDir, changeId, config);
  const progress = taskProgress(projectDir, changeId);
  const isPlanningComplete = artifacts.every((a) => a.status === "done" || a.status === "skipped");
  const nextSteps = artifacts
    .filter((a) => a.status === "ready")
    .map((a) => `Write ${a.outputPath}${a.owner ? ` (${a.owner})` : ""}`);
  if (isPlanningComplete && progress.remaining > 0) {
    nextSteps.push(`Work through tasks.md (${progress.remaining} remaining)`);
  }
  if (isPlanningComplete && progress.remaining === 0) {
    nextSteps.push(
      `Apply each requirement (\`specgate apply REQ-NNN\`), then archive with \`specgate archive ${changeId}\``
    );
  }

  emit(
    opts,
    {
      changeName: changeId,
      schemaName: config.schema,
      artifacts,
      tasks: { total: progress.total, complete: progress.complete, remaining: progress.remaining },
      isPlanningComplete,
      nextSteps,
    },
    () => {
      process.stdout.write(ui.header("change status", `${changeId} · ${config.schema}`));
      const mark = {
        done: ui.state("done"),
        ready: ui.state("doing"),
        blocked: ui.state("todo"),
        skipped: ui.muted("—"),
      };
      process.stdout.write(
        ui.table(
          artifacts.map((a) => [
            `${mark[a.status]} ${a.id}`,
            ui.muted(a.outputPath) +
              (a.missingDeps ? ui.muted(`  (needs ${a.missingDeps.join(", ")})`) : ""),
          ])
        )
      );
      process.stdout.write(
        ui.steps(
          "Next",
          nextSteps.map((st) =>
            String(st).replace(/`(specgate [^`]+)`/, (_m, cmd) => `${ui.cmd(cmd)}`)
          )
        )
      );
    }
  );
}

// ── validate ──────────────────────────────────────────────────────────────────

/**
 * `specgate change author` — hand one change artefact to an agent, then hold it to
 * the same gate a human would face.
 *
 * This is the `spec-author` role of the multi-agent harness (E2-02), and it is
 * deliberately *not* part of `harness run`. That loop is built around a
 * requirement: a worktree per REQ, a branch named for it, and a gate of
 * `validate --strict-tdd` plus the project's tests. A change has no requirement
 * yet — writing one is the whole job — so it needs its own loop, its own scope
 * and its own gate: `specgate change validate`.
 *
 * The prompt is not invented here either. `change instructions` already knows
 * what each artefact is for, what rules it must satisfy, what it may unlock and
 * which REQ ids are reserved; this renders that same structure for an agent
 * rather than for a person.
 *
 * **The tree must be clean before it runs.** That is not ceremony: enforcing the
 * scope means reverting whatever the agent wrote outside the change directory,
 * and on a dirty tree "whatever the agent wrote" cannot be told apart from
 * whatever you were in the middle of. Clean first, and reverting can only ever
 * discard the agent's own work.
 */
function cmdAuthor(opts: ChangeOptions) {
  const projectDir = resolveProjectDir(opts.projectDir);
  const changeId = opts.positional[0];
  const artifact = opts.artifact || "proposal";
  const NULL_SHAPE = { change: null, artifact: null, wrote: [], reverted: [] };

  if (!changeId) {
    return fail(opts, NULL_SHAPE, [
      error("change_required", "change author needs a change id.", {
        fix: "specgate change author <id> [--artifact proposal|specs|design|tasks]",
      }),
    ]);
  }

  const p = paths(projectDir);
  if (!fs.existsSync(p.change(changeId))) {
    return fail(opts, NULL_SHAPE, [
      error("change_not_found", `Change "${changeId}" does not exist.`, {
        target: changeId,
        fix: `Create it first: specgate propose ${changeId}`,
      }),
    ]);
  }

  const agentCommand = resolveAuthorAgent(projectDir, opts);
  if (!agentCommand) {
    return fail(opts, NULL_SHAPE, [
      error("author_agent_unset", "No agent is configured for change author.", {
        fix: 'Pass --agent "<cmd with {prompt_file}>", or --agent-profile <name> from .harness/profiles.yaml.',
      }),
    ]);
  }

  const status = spawnSync("git", ["-C", projectDir, "status", "--porcelain"], {
    encoding: "utf8",
  });
  if (status.status !== 0) {
    return fail(opts, NULL_SHAPE, [
      error("author_needs_git", "change author needs a git repository.", {
        fix: "Run it inside the project's repository — the scope is enforced with git.",
      }),
    ]);
  }
  if (String(status.stdout).trim() !== "") {
    return fail(opts, NULL_SHAPE, [
      error("author_tree_dirty", "The working tree has uncommitted changes.", {
        fix: "Commit or stash first. The scope is enforced by reverting what the agent wrote outside the change, and on a dirty tree that would take your work with it.",
      }),
    ]);
  }

  const instructions = buildInstructions(projectDir, artifact, changeId, TEMPLATES);
  const prompt = authorPrompt(changeId, artifact, instructions);

  if (opts.dryRun) {
    return emit(opts, { change: changeId, artifact, wrote: [], reverted: [], prompt }, () =>
      process.stdout.write(`${prompt}\n`)
    );
  }

  const promptFile = path.join(
    os.tmpdir(),
    `specgate-author-${changeId}-${artifact}-${Date.now()}.md`
  );
  fs.writeFileSync(promptFile, prompt, "utf8");
  try {
    const command = agentCommand.split("{prompt_file}").join(promptFile);
    const agent = spawnSync(command, {
      shell: true,
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (agent.status !== 0) {
      return fail(opts, NULL_SHAPE, [
        error("author_agent_failed", `The agent exited ${agent.status}.`, {
          fix:
            `${agent.stdout || ""}${agent.stderr || ""}`.trim().slice(-500) ||
            "Re-run with --dry-run to see the prompt it was given.",
        }),
      ]);
    }
  } finally {
    fs.rmSync(promptFile, { force: true });
  }

  const touched = spawnSync("git", ["-C", projectDir, "status", "--porcelain"], {
    encoding: "utf8",
  });
  // Keep git's status code, not just the path. `??` means untracked — the agent
  // created it, so undoing means deleting. Anything else means the file existed
  // and was modified, so undoing means restoring it. Losing that distinction is
  // how a revert deletes a file the project already had.
  const entries = String(touched.stdout)
    .split("\n")
    .filter(Boolean)
    .map((line) => ({ code: line.slice(0, 2), file: line.slice(3).trim() }))
    .filter((e) => e.file);

  const { allowed, strayed } = judgeScope(
    entries.map((e) => e.file),
    changeId
  );
  const untracked = new Set(entries.filter((e) => e.code === "??").map((e) => e.file));

  // The boundary is enforced, not requested. An agent asked to *describe* a
  // change, and able to edit the capability spec it describes, can make the
  // change unnecessary instead of proposing it — quietly, and in a diff nobody
  // reads because it looks like the work.
  for (const stray of strayed) {
    if (untracked.has(stray)) {
      const full = path.join(projectDir, stray);
      if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
    } else {
      spawnSync("git", ["-C", projectDir, "checkout", "--", stray], { encoding: "utf8" });
    }
  }

  const validation = new ValidateChangeUseCase(new DiskProjectRepository(projectDir)).execute(
    changeId,
    { strict: opts.strict }
  );
  const diagnostics = [...validation.diagnostics];
  if (strayed.length > 0) {
    diagnostics.push(
      warning("author_out_of_scope", `The agent wrote outside ${changeScope(changeId)}.`, {
        target: strayed[0],
        fix: `Reverted: ${strayed.join(", ")}. Only the change's own directory is the author's to write; \`change archive\` is what moves a delta into a capability spec.`,
      })
    );
  }

  if (hasErrors(diagnostics)) {
    return fail(
      opts,
      { change: changeId, artifact, wrote: allowed, reverted: strayed },
      diagnostics
    );
  }

  return emit(
    opts,
    { change: changeId, artifact, wrote: allowed, reverted: strayed, status: diagnostics },
    () => {
      process.stdout.write(
        ui.rule() +
          "\n" +
          ui.ok(`${c.bold}${changeId}${c.reset} — ${artifact} written by the agent`) +
          "\n"
      );
      for (const f of allowed) process.stdout.write(ui.fileLine("added", f));
      for (const f of strayed)
        process.stdout.write(ui.fileLine("changed", f, "out of scope, reverted"));
      if (diagnostics.length > 0) printDiagnostics(diagnostics);
      process.stdout.write(ui.next(`specgate change validate ${changeId}`, "read it first"));
    }
  );
}

/** The agent command for authoring: explicit flag, then profile, then harness config. */
function resolveAuthorAgent(projectDir: string, opts: ChangeOptions): string | null {
  if (opts.agent) return opts.agent;
  const config = readHarnessConfig(projectDir) || {};
  if (opts.agentProfile) {
    return config.profileAgents?.[opts.agentProfile] || null;
  }
  return config.agent || null;
}

/**
 * The instructions `change instructions` already produces, rendered for an
 * agent rather than for a person.
 */
function authorPrompt(changeId: string, artifact: string, instructions: Instructions): string {
  const parts = [
    `# Write the ${artifact} for change \`${changeId}\``,
    "",
    `You are a specification author. Write **only** inside \`${changeScope(changeId)}\`.`,
    "Anything you write elsewhere will be reverted before it is read — the capability",
    "specs and the traceability matrix are moved by `specgate change archive`, after a",
    "human has reviewed this proposal. Describe the change; do not make it.",
    "",
  ];

  if (instructions.outputPath) parts.push(`## Write to\n\n\`${instructions.outputPath}\`\n`);
  if (instructions.rules?.length) {
    parts.push("## Rules\n", ...instructions.rules.map((r: string) => `- ${r}`), "");
  }
  const ctx = instructions.context || {};
  if (ctx.reservedReqRange) {
    parts.push(
      `## Reserved requirement ids\n\n\`${ctx.reservedReqRange[0]}\`…\`${ctx.reservedReqRange[1]}\` — use these and no others.\n`
    );
  }
  if (ctx.proposal) {
    parts.push(
      "## The proposal this must stay faithful to\n",
      "```markdown",
      ctx.proposal.trim(),
      "```",
      ""
    );
  }
  if (instructions.template) {
    parts.push("## Template\n", "```markdown", String(instructions.template).trim(), "```", "");
  }
  parts.push(`When finished, the change must pass \`specgate change validate ${changeId}\`.`);
  return parts.join("\n");
}

/**
 * REQ-287: a layered change's Discover as it was agreed — in the commit that
 * recorded the approval, or else the first one that held it — against the
 * working copy. Outside git, or before the first commit, there is nothing to
 * compare with.
 */
function storyRewritten(projectDir: string, changeId: string) {
  if (readConfig(projectDir, changeId).schema !== LAYERED_SCHEMA) return null;
  const dir = paths(projectDir).change(changeId);
  const file = path.join(dir, "discover.md");
  if (!fs.existsSync(file)) return null;
  const git = (...args: string[]) =>
    spawnSync("git", ["-C", projectDir, ...args], { encoding: "utf8" });
  const top = git("rev-parse", "--show-toplevel");
  if (top.status !== 0) return null;
  const rel = (f: string) =>
    path
      .relative(fs.realpathSync.native(top.stdout.trim()), fs.realpathSync.native(f))
      .split(path.sep)
      .join("/");
  const earliest = (args: string[]) => {
    const r = git("log", "--format=%h", ...args);
    const shas = r.status === 0 ? r.stdout.trim().split(/\r?\n/).filter(Boolean) : [];
    return shas[shas.length - 1] || "";
  };
  const config = path.join(dir, CHANGE_CONFIG_FILE);
  const approved = readConfig(projectDir, changeId).approved
    ? earliest(["-S", "approved:", "--", rel(config)])
    : "";
  const sha = approved || earliest(["--diff-filter=A", "--", rel(file)]);
  if (!sha) return null;
  const baseline = git("show", `${sha}:${rel(file)}`);
  if (baseline.status !== 0) return null;
  if (!discoverRewritten(baseline.stdout, fs.readFileSync(file, "utf8"))) return null;
  return warning(
    "layer_discover_rewritten",
    `discover.md differs from the story agreed at ${sha}${approved ? " (approved)" : ""}.`,
    {
      target: changeId,
      file: `docs/specs/changes/${changeId}/discover.md`,
      fix: `The business story stays put while the design changes: restore it (\`git checkout ${sha} -- ${rel(file)}\`), or have ${layer("discover").owner} agree the new story.`,
    }
  );
}

function cmdValidate(opts: ChangeOptions) {
  const projectDir = resolveProjectDir(opts.projectDir);
  const requested = opts.positional[0];
  const ids = requested ? [requested] : listChangeIds(projectDir);
  const p = paths(projectDir);

  if (requested && !fs.existsSync(p.change(requested))) {
    return fail(opts, { items: [] }, [
      error("change_not_found", `Change "${requested}" does not exist.`, {
        target: requested,
        fix: "Run `specgate change list`.",
      }),
    ]);
  }

  if (opts.rebased && !requested) {
    return fail(opts, { items: [] }, [
      error("change_name_required", "`--rebased` records one change: name it.", {
        fix: "specgate change validate <change-id> --rebased",
      }),
    ]);
  }

  const items = ids.map((id) => {
    const result = new ValidateChangeUseCase(new DiskProjectRepository(projectDir)).execute(
      id,
      opts
    );
    const rewritten = storyRewritten(projectDir, id);
    if (rewritten) result.diagnostics.push(rewritten);
    const failed = opts.strict ? result.diagnostics.length > 0 : hasErrors(result.diagnostics);
    // What each delta rewrites, as it reads now: on first sight, or on
    // --rebased once the delta was rewritten over a requirement that moved (REQ-168).
    if (!failed) recordBases(projectDir, { changeId: id, rebased: opts.rebased });
    return {
      id,
      type: "change",
      valid: !failed,
      deltaCount: result.deltaCount,
      issues: result.diagnostics,
    };
  });

  const failedCount = items.filter((i) => !i.valid).length;
  const payload = {
    items,
    summary: { total: items.length, passed: items.length - failedCount, failed: failedCount },
    version: "1.0",
  };

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ ...payload, status: [] }, null, 2)}\n`);
  } else if (items.length === 0) {
    process.stdout.write(
      ui.header("change validate") + ui.info("No active changes to validate.") + "\n"
    );
  } else {
    process.stdout.write(ui.header("change validate"));
    for (const item of items) {
      const line = `${c.bold}${item.id}${c.reset} ${ui.muted(`(${item.deltaCount} delta(s))`)}`;
      process.stdout.write(item.valid ? ui.ok(line) : ui.fail(line));
      if (item.issues.length > 0) {
        printDiagnostics(item.issues, process.stdout);
      }
    }
    process.stdout.write("\n");
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

// ── archive ───────────────────────────────────────────────────────────────────

function cmdArchive(opts: ChangeOptions) {
  const projectDir = resolveProjectDir(opts.projectDir);
  const changeId = opts.positional[0];
  const nullShape = { archive: null };

  if (!changeId) {
    return fail(opts, nullShape, [
      error("archive_change_name_required", "`change archive` expects a change id.", {
        fix: "e.g. `specgate change archive add-dynamic-pricing`",
      }),
    ]);
  }

  // A draft (a change opened from a brief) is archived only once its
  // checklist passes: reservas_app archived one with two findings open and
  // nothing said so (#57). `--force` archives anyway, as it does for tasks.
  const isDraft = Boolean(briefOf(projectDir, changeId));
  // A ticket's change goes on to its pull request, archive included (REQ-159).
  const ticketKey = /^ticket:\s*(\S+)\s*$/m.exec(
    (() => {
      try {
        return fs.readFileSync(
          path.join(projectDir, "docs", "specs", "changes", changeId, "change.yaml"),
          "utf8"
        );
      } catch {
        return "";
      }
    })()
  )?.[1];
  if (!opts.force && isDraft) {
    const checked = draftReport(projectDir, changeId);
    if ("report" in checked && checked.report.status.length > 0) {
      const codes = [...new Set(checked.report.status.map((d) => d.code))].join(", ");
      return fail(opts, nullShape, [
        error(
          "archive_draft_not_ready",
          `Draft '${changeId}' has ${checked.report.status.length} open finding(s) in its checklist (${codes}).`,
          {
            target: changeId,
            fix: `Run \`specgate propose ${ticketKey ? `--from-ticket ${ticketKey}` : `--from-brief ${draftModuleOf(changeId)}`}\`, fix what it reports, then archive — or pass --force to archive it as it is.`,
          }
        ),
      ]);
    }
  }

  // Never over a requirement that moved under the delta (REQ-168): archiving
  // would drop the other change's rewrite without a conflict. Not --force-able.
  const moved = archiveBaseMoved(projectDir, changeId);
  if (moved.length > 0) return fail(opts, nullShape, moved);

  // A change is archived when its code is done (ADR-0035): every requirement
  // it adds or modifies went through the gate. `--force` does not skip this —
  // it is the one rule archive exists to keep.
  const owned = changeRequirements(projectDir, changeId);
  const owed = owned.filter((r) => !DELIVERED.includes(r.status));
  if (owed.length > 0) {
    return fail(opts, nullShape, [
      error(
        "archive_requirements_pending",
        `Change '${changeId}' has ${owed.length} requirement(s) not delivered yet: ${owed.map((r) => r.id).join(", ")}.`,
        { target: changeId, fix: `specgate apply ${owed[0].id}` }
      ),
    ]);
  }

  const repo = new DiskProjectRepository(projectDir);
  const useCase = new ArchiveChangeUseCase(repo);
  const plan = useCase.execute(changeId, {
    force: opts.force,
    draft: isDraft,
    // The gate is the evidence for a change with requirements; its task boxes
    // are then a reminder, not a second gate.
    gated: owned.length > 0,
  });

  if (!plan.ok) {
    return fail(opts, nullShape, plan.diagnostics);
  }

  const archivedAs = plan.move ? path.basename(plan.move.to) : `${changeId}-archived`;
  const rel = (f: string) => path.relative(projectDir, f).split(path.sep).join("/");
  const summary = {
    change: changeId,
    archivedAs: archivedAs,
    specsUpdated: plan.totals.specsWritten > 0 || plan.totals.specsRetired > 0,
    totals: plan.totals,
    writes: plan.writes.map((w) => ({ file: rel(w.file), kind: w.kind })),
    deletes: plan.deletes.map((d) => ({ file: rel(d.file), reason: d.reason })),
    warnings: plan.warnings,
  };

  if (opts.dryRun) {
    return emit(opts, { archive: { ...summary, dryRun: true } }, () => {
      process.stdout.write(
        ui.header(
          VERB === "archive" ? "archive" : "change archive",
          `${changeId} · dry run, nothing written`
        ) + ui.section("Archive plan")
      );
      for (const w of summary.writes) process.stdout.write(ui.fileLine("changed", w.file, w.kind));
      for (const d of summary.deletes)
        process.stdout.write(ui.fileLine("removed", d.file, d.reason));
      if (plan.move) {
        process.stdout.write(
          `    ${c.accent}${ui.sym.arrow}${c.reset} ${rel(plan.move.from)} ${ui.muted("moves to")} ${rel(plan.move.to)}\n`
        );
      }
      if (plan.warnings.length > 0) {
        process.stdout.write("\n");
        printDiagnostics(plan.warnings, process.stdout);
      }
      process.stdout.write("\n");
    });
  }

  try {
    repo.executePlan(plan);
  } catch (err) {
    return fail(opts, nullShape, [
      error(
        "archive_spec_update_failed",
        `Archive failed and was rolled back: ${errorMessage(err)}`,
        {
          target: changeId,
          fix: "Fix the underlying filesystem error and re-run; the project is unchanged.",
        }
      ),
    ]);
  }
  // A generated matrix is rebuilt from the capability specs just written, so
  // the rows archive wrote and the rows derivation produces cannot disagree.
  refreshDerivedMatrix(projectDir);

  emit(opts, { archive: summary }, () => {
    const t = plan.totals;
    // Set on every plan that gets this far: only a failed plan returns early.
    const trace = t.traceability!;
    process.stdout.write(
      ui.header(VERB === "archive" ? "archive" : "change archive", changeId) +
        ui.ok(`Archived as ${c.bold}${archivedAs}${c.reset}`) +
        "\n" +
        ui
          .kv("Specs", `${t.added} added · ${t.modified} modified · ${t.removed} removed`, 14)
          .replace(/^ {2}/, "    ") +
        ui
          .kv(
            "Traceability",
            `${trace.added} row(s) added · ${trace.updated} updated · ${trace.removed} removed`,
            14
          )
          .replace(/^ {2}/, "    ") +
        ui
          .kv(
            "Features",
            `${plan.writes.filter((w) => w.kind === "feature").length} materialised`,
            14
          )
          .replace(/^ {2}/, "    ") +
        // The archived requirements are Draft: they owe nothing yet, so the
        // gate passes. Saying it "will fail until the tests exist" was wrong
        // (#92); what comes next is the queue, or the next module.
        ui.next(
          ticketKey
            ? `specgate alm pr ${changeId}`
            : isDraft
              ? "specgate propose --from-brief"
              : "specgate status",
          ticketKey
            ? `${ticketKey}'s pull request, with this archive in it`
            : isDraft
              ? "the next module of the brief, or what to build first"
              : "what each requirement still needs"
        )
    );
    if (plan.warnings.length > 0) printDiagnostics(plan.warnings, process.stdout);
  });
}

// ── entry ─────────────────────────────────────────────────────────────────────

export class CliCommand extends BaseCommand {
  constructor(args: string[] = [], verb: "propose" | "archive" | null = null) {
    super(args);
    VERB = verb;
  }

  public execute() {
    const argv = this.args;
    const sub = argv[0];
    if ((argv.includes("--help") || argv.includes("-h")) && verbUsage(sub)) process.exit(0);
    if (!sub || sub === "--help" || sub === "-h") {
      usage();
      process.exit(sub ? 0 : 2);
    }

    // `instructions` parses its own arguments: its first positional is an
    // artefact name, not a change id, so the shared parser does not fit.
    if (sub === "instructions") {
      instructionsMain(argv.slice(1), TEMPLATES);
      return;
    }

    const opts = parseArgs(argv.slice(1));

    const table: Record<string, (opts: ChangeOptions) => void> = {
      new: cmdNew,
      list: cmdList,
      show: cmdShow,
      status: cmdStatus,
      validate: cmdValidate,
      archive: cmdArchive,
      author: cmdAuthor,
      impact: cmdImpact,
      approve: cmdApprove,
      note: cmdNote,
    };

    const handler = table[sub];
    if (!handler) {
      process.stderr.write(
        `Unknown change sub-command: ${sub}. Expected: ${Object.keys(table).join(", ")}\n`
      );
      process.exit(2);
    }

    try {
      handler(opts);
    } catch (err) {
      fail(opts, {}, [
        error("change_error", errorMessage(err), {
          fix: "Re-run with --json for the machine-readable form of this failure.",
        }),
      ]);
    }
  }
}

export { artifactState, ARTIFACTS };
