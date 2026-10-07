#!/usr/bin/env node
// csda:allow-placeholders — the templates it hands out contain {{VAR}} tokens.

/**
 * `change instructions <artifact>` — everything needed to write one artefact.
 *
 * The single context engine. Before this existed, `harness run` assembled its
 * own prompt, the MCP server had its own idea of what an agent needs to know,
 * and a slash command had nothing at all. Three answers to one question is two
 * too many: when the delta grammar changes, only one of them gets updated.
 *
 * Everything that drives an agent — slash commands, the harness, MCP, the VS
 * Code extension — consumes this. It is deliberately data, not prose: the
 * caller decides how to render it.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { resolveProjectDir } from "../lib/project-root";
import { error } from "../lib/diagnostics";
import { agentIo, wantsJson, EXIT } from "../lib/agent";
import {
  paths,
  listChangeIds,
  listDeltas,
  readConfig,
  CAPABILITIES_DIR,
} from "../../packages/core/src/infrastructure/ChangeWorkspace";
import { artifactState, artifactsFor, ARTIFACTS } from "./artifacts";
import { BUILT_IN } from "../schema/registry";

/**
 * The rules an agent gets wrong when it is not told them. Each one exists
 * because the validator rejects the alternative — these are not style
 * preferences, they are the grammar.
 */
export const DELTA_RULES = [
  "Write only what changes. A delta is not a copy of the spec.",
  "Use exactly these section headings: `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`.",
  "`MODIFIED` replaces the whole requirement block — it does not merge scenario by scenario.",
  "Every requirement body must state an obligation with SHALL, MUST, SHOULD or MAY, or validation reports `no_rfc2119_keyword`.",
  "Scenario steps are plain `- GIVEN` / `- WHEN` / `- THEN` bullets. `- **GIVEN**` fails with `scenario_not_gherkin`: the keyword has to start the line.",
  "Every requirement needs at least one scenario.",
  "The optional `<!-- csda:trace uc=… cmd=… agg=… evt=… feature=… -->` comment is the bridge to the DDD matrix. Without it the requirement still archives, with `-` in those columns.",
];

const PROPOSAL_RULES = [
  "State the problem, not the solution. The approach belongs in one paragraph; technical detail belongs in design.md.",
  "Say what is out of scope. A proposal that excludes nothing has not been thought about.",
];

const TASKS_RULES = [
  "Tasks are checkboxes. `change archive` refuses to run while any are unchecked, unless --force.",
  "One task per reviewable unit of work, not one per file touched.",
];

const DESIGN_RULES = [
  "Only for `--full` rigor. At `--lite` this artefact is skipped, not missing.",
  "Record the decision and the alternatives rejected. If it is a decision the project will be asked about later, it wants an ADR instead.",
];

const ARTIFACT_RULES = {
  proposal: PROPOSAL_RULES,
  specs: DELTA_RULES,
  design: DESIGN_RULES,
  tasks: TASKS_RULES,
};

/** Pseudo-artefacts: not files to write, but stages to carry out. */
export const STAGES = {
  apply: {
    summary: "Implement the change: write the tests first, then the code.",
    rules: [
      "Work one requirement at a time. `specgate status` is the queue.",
      "The scenario in the delta is the acceptance criterion — implement to it, not around it.",
      "Write the test first and mention the requirement's REQ-NNN in it — that mention is the link.",
      "Close each requirement with `specgate done REQ-NNN`: it runs the gate first and writes nothing while it fails.",
      "Do not edit `docs/specs/traceability.md` by hand — it is generated (`specgate matrix`, and `specgate check` refreshes it).",
    ],
    nextCommand: "specgate check",
  },
  archive: {
    summary: "Merge the change into the spec tree and file it away.",
    rules: [
      "Every task must be checked first, or archive refuses.",
      "Preview with `--dry-run`: it lists the specs and matrix rows that will move.",
      "Archiving inserts the traceability rows and materialises the proposed feature files. It is not a file move.",
      "After archiving, the requirement is real work: `specgate plan` lists it as pending.",
    ],
    nextCommand: "specgate change archive <id> --dry-run",
  },
};

/** What writing this artefact unblocks, derived from the graph rather than restated. */
export function unlockedBy(artifactId, artifacts?) {
  return (artifacts || ARTIFACTS)
    .filter((a) => (a.requires || []).includes(artifactId))
    .map((a) => a.id);
}

function readIfExists(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/**
 * The facts an artefact's instructions are rendered against — the project's
 * stack, what already exists, and where the change currently stands.
 */
export interface InstructionContext {
  [key: string]: string | string[] | number | undefined;
}

/** The project's declared stack, so an agent does not invent one. */
function projectContext(projectDir) {
  const rules = readIfExists(path.join(projectDir, "AI_RULES.md"));
  const context: InstructionContext = {};
  if (rules) {
    const stack = /^-?\s*\**Stack:?\**:?\s*(.+)$/m.exec(rules);
    if (stack) context.stack = stack[1].trim();
    const testing = /^-?\s*\**Testing:?\**:?\s*(.+)$/m.exec(rules);
    if (testing) context.testing = testing[1].trim();
    context.rulesFile = "AI_RULES.md";
  }
  const capabilities = path.join(projectDir, CAPABILITIES_DIR);
  if (fs.existsSync(capabilities)) {
    context.existingCapabilities = fs
      .readdirSync(capabilities, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  }
  return context;
}

export function buildInstructions(projectDir, artifact, changeId, templates) {
  const p = paths(projectDir);
  const stage = STAGES[artifact];
  const config = readConfig(projectDir, changeId);
  const artifacts = artifactsFor(projectDir, config);
  const states = artifactState(projectDir, changeId, config);
  const state = states.find((s) => s.id === artifact);

  const context: InstructionContext = { ...projectContext(projectDir) };
  const proposal = readIfExists(path.join(p.change(changeId), "proposal.md"));
  // The proposal is the intent every later artefact has to stay faithful to.
  if (proposal && artifact !== "proposal") context.proposal = proposal;
  if (Array.isArray(config.req_range) && config.req_range.length === 2) {
    context.reservedReqRange = config.req_range;
  }
  context.rigor = config.rigor;
  context.schema = config.schema || "spec-driven";
  context.deltasWritten = listDeltas(projectDir, changeId).length;

  if (stage) {
    return {
      change: changeId,
      artifact,
      kind: "stage",
      summary: stage.summary,
      rules: stage.rules,
      context,
      nextCommand: stage.nextCommand.replace("<id>", changeId),
    };
  }

  return {
    change: changeId,
    artifact,
    kind: "artifact",
    outputPath: state ? state.outputPath : null,
    state: state ? state.status : "unknown",
    requires: state ? state.requires : [],
    unlocks: unlockedBy(artifact, artifacts),
    template: templates[artifact] ? templates[artifact](changeId, projectDir) : null,
    rules: ARTIFACT_RULES[artifact] || [],
    context,
    nextCommand: `specgate change validate ${changeId}`,
  };
}

/** The default vocabulary. A project schema may add to it — see knownFor(). */
export const KNOWN = [...ARTIFACTS.map((a) => a.id), ...Object.keys(STAGES)];

/** Every artefact id any built-in schema declares, for the pre-check. */
const ANY_KNOWN = [
  ...new Set(Object.values(BUILT_IN).flatMap((s) => s.artifacts.map((a) => a.id))),
  ...Object.keys(STAGES),
];

/** What this project actually recognises, once its schema is resolved. */
export function knownFor(projectDir, config) {
  return [...artifactsFor(projectDir, config).map((a) => a.id), ...Object.keys(STAGES)];
}

function usage() {
  process.stdout.write(
    "Usage:\n" +
      `  specgate change instructions <${KNOWN.join("|")}> [<change-id>] [--json]\n\n` +
      "Everything needed to write one artefact of a change: the template, the\n" +
      "rules the validator enforces, the project's declared stack, and what\n" +
      "writing it unblocks. The single context engine behind the slash commands,\n" +
      "the harness and the MCP server.\n"
  );
}

export function main(argv, templates) {
  const args = argv.filter((a) => a !== "--json");
  const io = agentIo(wantsJson(argv));
  const NULL_SHAPE = { instructions: null };

  if (args.includes("--help") || args.includes("-h")) {
    usage();
    process.exit(EXIT.OK);
  }

  const artifact = args[0];
  if (!artifact) {
    if (!io.json) usage();
    io.usage(NULL_SHAPE, [
      error("artifact_required", "Name the artefact you want instructions for.", {
        fix: `Use one of: ${KNOWN.join(", ")}.`,
      }),
    ]);
  }

  // A cheap typo check against every artefact any built-in schema declares.
  // The precise, schema-specific check happens once the change is resolved —
  // but running only that one turns `instructions nonsense` in a project with
  // no changes into "no active change", which hides the real mistake.
  if (!ANY_KNOWN.includes(artifact)) {
    io.usage(NULL_SHAPE, [
      error("artifact_unknown", `Unknown artefact: ${artifact}.`, {
        target: artifact,
        fix: `Use one of: ${ANY_KNOWN.join(", ")}.`,
      }),
    ]);
  }
  // Split flags from positionals in one pass — `--project-dir <path>` takes a
  // value, so a naive filter on "starts with -" leaves the path behind as a
  // positional and it gets read as a change id.
  const positional = [];
  let projectDirArg = ".";
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--project-dir" && args[i + 1]) {
      projectDirArg = args[++i];
    } else if (!args[i].startsWith("-")) {
      positional.push(args[i]);
    }
  }

  let projectDir;
  try {
    projectDir = resolveProjectDir(projectDirArg);
  } catch (err) {
    io.usage(NULL_SHAPE, [
      error("project_not_found", err.message, {
        fix: "Run from inside a spec-driven project, or pass --project-dir.",
      }),
    ]);
  }

  const ids = listChangeIds(projectDir);
  const changeId = positional[0] || (ids.length === 1 ? ids[0] : null);

  if (!changeId) {
    io.fail(NULL_SHAPE, [
      error(
        ids.length === 0 ? "no_active_change" : "change_ambiguous",
        ids.length === 0
          ? "No active changes."
          : `Several active changes — name the one you mean: ${ids.join(", ")}.`,
        {
          fix:
            ids.length === 0
              ? "Open one first: specgate change new <id>"
              : `specgate change instructions ${artifact} <change-id>`,
        }
      ),
    ]);
  }
  if (!ids.includes(changeId)) {
    io.fail(NULL_SHAPE, [
      error("change_not_found", `Change "${changeId}" does not exist.`, {
        target: changeId,
        fix: ids.length
          ? `Active changes: ${ids.join(", ")}.`
          : "Open one: specgate change new <id>",
      }),
    ]);
  }

  // Which artefact names are valid depends on the change's schema — `bdd-first`
  // recognises `feature`, `spec-driven` does not. So this check waits until the
  // change is resolved rather than using the default vocabulary.
  const known = knownFor(projectDir, readConfig(projectDir, changeId));
  if (!known.includes(artifact)) {
    io.usage(NULL_SHAPE, [
      error("artifact_unknown", `Unknown artefact: ${artifact}.`, {
        target: artifact,
        fix: `This change follows the "${readConfig(projectDir, changeId).schema || "spec-driven"}" schema. Use one of: ${known.join(", ")}.`,
      }),
    ]);
  }

  const instructions = buildInstructions(projectDir, artifact, changeId, templates);
  io.emit({ instructions }, () => renderHuman(instructions));
  process.exit(EXIT.OK);
}

function renderHuman(ins) {
  const out = [];
  out.push(`\n  ${ins.artifact} — ${ins.change}\n`);
  if (ins.summary) out.push(`  ${ins.summary}\n`);
  if (ins.outputPath) out.push(`  write to: ${ins.outputPath}  (${ins.state})`);
  if (ins.unlocks && ins.unlocks.length) out.push(`  unlocks:  ${ins.unlocks.join(", ")}`);
  if (ins.context.stack) out.push(`  stack:    ${ins.context.stack}`);
  if (ins.context.reservedReqRange) {
    out.push(`  REQ ids:  ${ins.context.reservedReqRange.join("…")}`);
  }
  if (ins.rules.length) {
    out.push("\n  Rules");
    for (const r of ins.rules) out.push(`    · ${r}`);
  }
  if (ins.template) {
    out.push("\n  Template\n");
    out.push(
      ins.template
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n")
    );
  }
  out.push(`\n  Next: ${ins.nextCommand}\n`);
  process.stdout.write(`${out.join("\n")}\n`);
}
