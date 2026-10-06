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
import { error, warning, hasErrors, printDiagnostics } from "../../../lib/diagnostics";
import { buildInstructions } from "../../../change/instructions";
import { readHarnessConfig } from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import { changeScope, judgeScope } from "../../../../packages/core/src/domain/AuthoringScope";
import { agentIo } from "../../../lib/agent";
import { phrases } from "../../../../packages/core/src/infrastructure/DiskLanguageRepository";
import { ARTIFACTS, artifactState } from "../../../change/artifacts";
import { parseDelta } from "../../../../packages/core/src/domain/SpecParser";
import { refreshDerivedMatrix } from "../spec/MatrixCommand";
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
import { ValidateChangeUseCase } from "../../../../packages/core/src/application/ValidateChangeUseCase";
import { readCapabilityRequirements } from "../../../lib/capability-specs";
import {
  declaredSpecValues,
  declaredCodeValues,
} from "../../../../packages/core/src/domain/ValueAnnotations";
import {
  declaredPaths,
  artifactFile,
} from "../../../../packages/core/src/domain/DeclaredArtifacts";
import { parseTraceability } from "../spec/PlanCommand";
import { main as instructionsMain } from "../../../change/instructions";

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

const COLOR_ENABLED =
  process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";
const c = {
  reset: COLOR_ENABLED ? "\x1b[0m" : "",
  bold: COLOR_ENABLED ? "\x1b[1m" : "",
  dim: COLOR_ENABLED ? "\x1b[2m" : "",
  green: COLOR_ENABLED ? "\x1b[32m" : "",
  yellow: COLOR_ENABLED ? "\x1b[33m" : "",
  cyan: COLOR_ENABLED ? "\x1b[36m" : "",
  red: COLOR_ENABLED ? "\x1b[31m" : "",
};

// The artefact graph. Dependencies are enablers, not gates: `requires` says
// what makes an artefact *possible*, never what the author must do next.
// F3 makes this configurable per schema; for now the built-in is the default.

/** The skeletons `change new` writes, shared with `change instructions`. */

function usage() {
  process.stdout.write(
    `\n  ${c.bold}${c.cyan}🔄 change${c.reset}  ${c.dim}— propose, review and archive a change${c.reset}\n\n` +
      `  ${c.bold}USAGE${c.reset}\n` +
      `    ${c.cyan}specgate change${c.reset} <new|list|show|status|instructions|author|validate|archive> [options]\n\n` +
      `  ${c.bold}SUBCOMMANDS${c.reset}\n` +
      `    ${c.green}new <id>${c.reset}       ${c.dim}Scaffold a change folder (proposal, tasks, delta skeleton).${c.reset}\n` +
      `    ${c.green}list${c.reset}           ${c.dim}Active changes with task progress.${c.reset}\n` +
      `    ${c.green}show <id>${c.reset}      ${c.dim}Proposal, deltas and what they touch.${c.reset}\n` +
      `    ${c.green}status [id]${c.reset}    ${c.dim}Which artefact to write next.${c.reset}\n` +
      `    ${c.green}author <id>${c.reset}    ${c.dim}Have an agent write one artefact, confined to the change.${c.reset}\n` +
      `    ${c.green}validate [id]${c.reset}  ${c.dim}Check the deltas against the capability specs.${c.reset}\n` +
      `    ${c.green}archive <id>${c.reset}   ${c.dim}Merge deltas into the specs, sync traceability, archive.${c.reset}\n\n` +
      `  ${c.bold}OPTIONS${c.reset}\n` +
      `    ${c.green}--project-dir <path>${c.reset}  ${c.dim}Project root (default: auto-detected).${c.reset}\n` +
      `    ${c.green}--json${c.reset}                ${c.dim}One JSON document on stdout; prose on stderr.${c.reset}\n` +
      `    ${c.green}--capability <name>${c.reset}   ${c.dim}(new) Seed a delta for this capability.${c.reset}\n` +
      `    ${c.green}--from-value-drift <REQ:id>${c.reset} ${c.dim}(new) Propose a spec update for a diverging` +
      ` declared value (§8.6).${c.reset}\n` +
      `    ${c.green}--full${c.reset}                ${c.dim}(new) Full rigor — also scaffold design.md.${c.reset}\n` +
      `    ${c.green}--artifact <name>${c.reset}     ${c.dim}(author) Which artefact to write. Default: proposal.${c.reset}\n` +
      `    ${c.green}--agent <cmd>${c.reset}         ${c.dim}(author) Agent command; must contain {prompt_file}.${c.reset}\n` +
      `    ${c.green}--agent-profile <n>${c.reset}   ${c.dim}(author) A profile from .harness/profiles.yaml.${c.reset}\n` +
      `    ${c.green}--reserve <n>${c.reset}         ${c.dim}(new) Reserve n REQ ids for this change (default 3).${c.reset}\n` +
      `    ${c.green}--strict${c.reset}              ${c.dim}(validate) Treat advisory warnings as failures.${c.reset}\n` +
      `    ${c.green}--dry-run${c.reset}             ${c.dim}(archive) Print the plan, write nothing.${c.reset}\n` +
      `    ${c.green}--force${c.reset}               ${c.dim}(archive) Archive with unchecked tasks; overwrite features.${c.reset}\n\n`
  );
}

/** Parsed command-line options for this command. */
export interface ChangeOptions {
  projectDir: string;
  json: boolean;
  strict: boolean;
  dryRun: boolean;
  force: boolean;
  full: boolean;
  capability: string | null;
  fromValueDrift: string | null;
  schema?: string;
  reserve: number;
  yes?: boolean;
  artifact?: string;
  agent?: string;
  agentProfile?: string;
  positional: string[];
}

function parseArgs(argv) {
  const opts: ChangeOptions = {
    projectDir: ".",
    json: false,
    strict: false,
    dryRun: false,
    force: false,
    full: false,
    capability: null,
    fromValueDrift: null,
    reserve: 3,
    positional: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--capability" && argv[i + 1]) opts.capability = argv[++i];
    else if (a === "--from-value-drift" && argv[i + 1]) opts.fromValueDrift = argv[++i];
    else if (a === "--schema" && argv[i + 1]) opts.schema = argv[++i];
    else if (a === "--reserve" && argv[i + 1]) opts.reserve = parseInt(argv[++i], 10) || 3;
    else if (a === "--artifact" && argv[i + 1]) opts.artifact = argv[++i];
    else if (a === "--agent" && argv[i + 1]) opts.agent = argv[++i];
    else if (a === "--agent-profile" && argv[i + 1]) opts.agentProfile = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "--strict") opts.strict = true;
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
const fail = (opts, nullShape, diags) => agentIo(opts.json).fail(nullShape, diags);
const emit = (opts, payload, renderHuman) => agentIo(opts.json).emit(payload, renderHuman);

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
): { capability: string; content: string } | { diagnostics: any[] } {
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
        error("value_drift_id_not_declared", `declares no value_${valueId} in its csda:trace.`, {
          target: reqId,
          fix: `Add value_${valueId}=<literal> to its csda:trace, or check the id.`,
        }),
      ],
    };
  }

  let rows: any[] = [];
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
          `No \`csda:value ${valueId}=\` marker found in ${reqId}'s declared Technical/Test artifact.`,
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

function cmdNew(opts) {
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

  const reqRange = reserveReqRange(projectDir, opts.reserve);
  const config = {
    ...DEFAULT_CONFIG,
    schema: opts.schema || DEFAULT_CONFIG.schema,
    created: new Date().toISOString().slice(0, 10),
    rigor: opts.full ? "full" : "lite",
    req_range: reqRange,
  };

  const created = [];
  const write = (file, contents) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, "utf8");
    created.push(path.relative(projectDir, file).split(path.sep).join("/"));
  };

  write(path.join(dir, CHANGE_CONFIG_FILE), renderConfig(config));
  write(path.join(dir, "proposal.md"), templateProposal(changeId));
  write(path.join(dir, "tasks.md"), templateTasks());
  if (opts.full) write(path.join(dir, "design.md"), templateDesign(changeId));
  if (opts.capability) {
    write(
      path.join(p.changeSpecs(changeId), opts.capability, "spec.md"),
      templateDelta(opts.capability, reqRange[0], phrases(projectDir))
    );
  }
  if (valueDrift) {
    write(path.join(p.changeSpecs(changeId), valueDrift.capability, "spec.md"), valueDrift.content);
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
        `\n  ${c.green}✔${c.reset} Change ${c.bold}${changeId}${c.reset} created ` +
          `${c.dim}(${config.rigor} · REQ ids ${reqRange[0]}…${reqRange[1]} reserved)${c.reset}\n\n` +
          created.map((f) => `    ${c.dim}+${c.reset} ${f}\n`).join("") +
          `\n  ${c.dim}Next:${c.reset} write the proposal, then the delta, then ` +
          `${c.cyan}specgate change validate ${changeId}${c.reset}\n\n`
      );
    }
  );
}

// ── list ──────────────────────────────────────────────────────────────────────

function cmdList(opts) {
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
      process.stdout.write(`\n  ${c.dim}No active changes.${c.reset}\n\n`);
      return;
    }
    process.stdout.write(`\n  ${c.bold}Active changes${c.reset}\n\n`);
    for (const ch of changes) {
      const mark =
        ch.status === "complete"
          ? `${c.green}●${c.reset}`
          : ch.status === "in-progress"
            ? `${c.yellow}◐${c.reset}`
            : `${c.dim}○${c.reset}`;
      process.stdout.write(
        `    ${mark} ${c.bold}${ch.id}${c.reset}  ` +
          `${c.dim}${ch.completedTasks}/${ch.totalTasks} tasks · ${ch.deltaCount} delta(s) · ${ch.rigor}${c.reset}\n`
      );
    }
    process.stdout.write("\n");
  });
}

// ── show ──────────────────────────────────────────────────────────────────────

function cmdShow(opts) {
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

  const proposalFile = path.join(p.change(changeId), "proposal.md");
  const proposal = fs.existsSync(proposalFile) ? fs.readFileSync(proposalFile, "utf8") : "";
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
      process.stdout.write(`\n  ${c.bold}${titleMatch ? titleMatch[1] : changeId}${c.reset}\n\n`);
      if (deltas.length === 0) {
        process.stdout.write(`    ${c.dim}No delta specs.${c.reset}\n\n`);
      }
      for (const d of deltas) {
        process.stdout.write(
          `    ${c.cyan}${d.capability}${c.reset} ${c.dim}(${d.file})${c.reset}\n`
        );
        for (const r of d.added) process.stdout.write(`      ${c.green}+${c.reset} ${r}\n`);
        for (const r of d.modified) process.stdout.write(`      ${c.yellow}~${c.reset} ${r}\n`);
        for (const r of d.removed) process.stdout.write(`      ${c.red}-${c.reset} ${r}\n`);
      }
      process.stdout.write(
        `\n    ${c.dim}${progress.complete}/${progress.total} tasks complete${c.reset}\n\n`
      );
    }
  );
}

// ── status ────────────────────────────────────────────────────────────────────

function cmdStatus(opts) {
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
      process.stdout.write(`\n  ${c.dim}${payload.message}${c.reset}\n\n`);
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
    .map((a) => `Write ${a.outputPath}`);
  if (isPlanningComplete && progress.remaining > 0) {
    nextSteps.push(`Work through tasks.md (${progress.remaining} remaining)`);
  }
  if (isPlanningComplete && progress.remaining === 0) {
    nextSteps.push(`Archive with \`specgate change archive ${changeId}\``);
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
      process.stdout.write(
        `\n  ${c.bold}${changeId}${c.reset} ${c.dim}(${config.schema})${c.reset}\n\n`
      );
      const mark = {
        done: `${c.green}✔${c.reset}`,
        ready: `${c.yellow}▶${c.reset}`,
        blocked: `${c.dim}·${c.reset}`,
        skipped: `${c.dim}—${c.reset}`,
      };
      for (const a of artifacts) {
        const deps = a.missingDeps ? ` ${c.dim}(needs ${a.missingDeps.join(", ")})${c.reset}` : "";
        process.stdout.write(
          `    ${mark[a.status]} ${a.id.padEnd(10)} ${c.dim}${a.outputPath}${c.reset}${deps}\n`
        );
      }
      process.stdout.write(`\n  ${c.bold}Next${c.reset}\n`);
      for (const step of nextSteps) process.stdout.write(`    ${c.cyan}→${c.reset} ${step}\n`);
      process.stdout.write("\n");
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
function cmdAuthor(opts) {
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
        fix: `Create it first: specgate change new ${changeId}`,
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

  const promptFile = path.join(os.tmpdir(), `csda-author-${changeId}-${artifact}-${Date.now()}.md`);
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
        `\n  ${c.bold}${changeId}${c.reset} — ${artifact} written by the agent\n\n`
      );
      for (const f of allowed) process.stdout.write(`    ${c.green}+${c.reset} ${f}\n`);
      for (const f of strayed)
        process.stdout.write(
          `    ${c.yellow}~${c.reset} ${f} ${c.dim}(out of scope, reverted)${c.reset}\n`
        );
      if (diagnostics.length > 0) printDiagnostics(diagnostics);
      process.stdout.write(
        `\n  Next: read it, then ${c.cyan}specgate change validate ${changeId}${c.reset}\n\n`
      );
    }
  );
}

/** The agent command for authoring: explicit flag, then profile, then harness config. */
function resolveAuthorAgent(projectDir: string, opts): string | null {
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
function authorPrompt(changeId: string, artifact: string, instructions: any): string {
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

function cmdValidate(opts) {
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

  const items = ids.map((id) => {
    const result = new ValidateChangeUseCase(new DiskProjectRepository(projectDir)).execute(
      id,
      opts
    );
    const failed = opts.strict ? result.diagnostics.length > 0 : hasErrors(result.diagnostics);
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
    process.stdout.write(`\n  ${c.dim}No active changes to validate.${c.reset}\n\n`);
  } else {
    process.stdout.write("\n");
    for (const item of items) {
      const mark = item.valid ? `${c.green}✔${c.reset}` : `${c.red}✖${c.reset}`;
      process.stdout.write(
        `  ${mark} ${c.bold}${item.id}${c.reset} ${c.dim}(${item.deltaCount} delta(s))${c.reset}\n`
      );
      if (item.issues.length > 0) {
        printDiagnostics(item.issues, process.stdout);
      }
    }
    process.stdout.write("\n");
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

// ── archive ───────────────────────────────────────────────────────────────────

function cmdArchive(opts) {
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

  const repo = new DiskProjectRepository(projectDir);
  const useCase = new ArchiveChangeUseCase(repo);
  const plan = useCase.execute(changeId, { force: opts.force });

  if (!plan.ok) {
    return fail(opts, nullShape, plan.diagnostics);
  }

  const archivedAs = plan.move ? path.basename(plan.move.to) : `${changeId}-archived`;
  const rel = (f) => path.relative(projectDir, f).split(path.sep).join("/");
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
        `\n  ${c.bold}Archive plan${c.reset} ${c.dim}(dry run — nothing written)${c.reset}\n\n`
      );
      for (const w of summary.writes) {
        process.stdout.write(`    ${c.green}~${c.reset} ${w.file} ${c.dim}(${w.kind})${c.reset}\n`);
      }
      for (const d of summary.deletes) {
        process.stdout.write(`    ${c.red}-${c.reset} ${d.file} ${c.dim}(${d.reason})${c.reset}\n`);
      }
      if (plan.move) {
        process.stdout.write(
          `    ${c.cyan}→${c.reset} ${rel(plan.move.from)} ${c.dim}moves to${c.reset} ${rel(plan.move.to)}\n`
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
  } catch (err: any) {
    return fail(opts, nullShape, [
      error("archive_spec_update_failed", `Archive failed and was rolled back: ${err.message}`, {
        target: changeId,
        fix: "Fix the underlying filesystem error and re-run; the project is unchanged.",
      }),
    ]);
  }
  // A generated matrix is rebuilt from the capability specs just written, so
  // the rows archive wrote and the rows derivation produces cannot disagree.
  refreshDerivedMatrix(projectDir);

  emit(opts, { archive: summary }, () => {
    const t = plan.totals;
    process.stdout.write(
      `\n  ${c.green}✔${c.reset} Archived as ${c.bold}${archivedAs}${c.reset}\n\n` +
        `    ${c.dim}specs:${c.reset}        ${t.added} added · ${t.modified} modified · ${t.removed} removed\n` +
        `    ${c.dim}traceability:${c.reset} ${t.traceability.added} row(s) added · ${t.traceability.updated} updated · ${t.traceability.removed} removed\n` +
        `    ${c.dim}features:${c.reset}     ${plan.writes.filter((w) => w.kind === "feature").length} materialised\n\n` +
        `  ${c.dim}Now run${c.reset} ${c.cyan}specgate validate . --strict${c.reset} ${c.dim}— it will fail until the tests exist.${c.reset}\n\n`
    );
    if (plan.warnings.length > 0) printDiagnostics(plan.warnings, process.stdout);
  });
}

// ── entry ─────────────────────────────────────────────────────────────────────

export class CliCommand extends BaseCommand {
  public execute() {
    const argv = this.args;
    const sub = argv[0];
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

    const table = {
      new: cmdNew,
      list: cmdList,
      show: cmdShow,
      status: cmdStatus,
      validate: cmdValidate,
      archive: cmdArchive,
      author: cmdAuthor,
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
        error("change_error", err.message, {
          fix: "Re-run with --json for the machine-readable form of this failure.",
        }),
      ]);
    }
  }
}

export { artifactState, ARTIFACTS };
