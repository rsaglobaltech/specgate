/**
 * The command surface of this CLI, declared once.
 *
 * Before this module the surface was described in five places that nothing
 * kept in step: the dispatch table and `usage()` in
 * `bin/specgate.ts`, the completion lists in
 * `scripts/completion.ts`, the JSON contract table in
 * `scripts/gen_agent_contract.ts`, the tool schemas in the MCP package, and
 * the literal command strings in `scripts/agents/commands.ts`. The drift was
 * not hypothetical: `harness init`, `change instructions`, `alm link` and
 * `alm status` all shipped without ever reaching the shell completion, and
 * the guard that was supposed to catch it only compared top-level names by
 * scraping the dispatcher with a regex.
 *
 * A command is one row here. Every consumer reads this module, so a command
 * that exists is completable, documented and contract-checked by
 * construction — or it is none of those, deliberately.
 *
 * Field guide:
 *
 *   name         The token the user types.
 *   script       Path segments under `dist/scripts/`, for the dispatcher.
 *   subcommands  Present when the command dispatches further.
 *   help         Present when the row earns its own line in `--help --all`.
 *   coreHelp     Present when the row is part of the narrowed daily surface.
 *   json         Present when the row speaks the ADR-0017 JSON contract.
 *
 * `json.key` is the document key the payload carries on success and that a
 * failure sets to null — the contract's rule 3. `json.flag` exists because
 * `harness run` spells the flag `--format json`, which predates the contract
 * and keeps working (rule 5).
 */

/**
 * Sections of `--help --all`, in the order they print. Declared here because
 * the order and the wording are editorial, not derivable.
 */
export const HELP_GROUPS = [
  { id: "core", title: "Core" },
  { id: "pack", title: "Packs" },
  { id: "specops", title: "SpecOps" },
  { id: "harness", title: "Harness" },
  { id: "dx", title: "Developer experience" },
];

/** Sections of the narrowed help, in the order they print. */
export const CORE_GROUPS = [
  { id: "start", title: "Start here" },
  { id: "daily", title: "Every day" },
  { id: "ci", title: "CI" },
];

interface HelpRow {
  group: string;
  icon: string;
  summary: string;
  /**
   * Position within the group. The daily surface reads as a sequence —
   * propose → apply → status → archive (ADR-0035) — which is neither
   * alphabetical nor the order the commands are declared in.
   */
  order?: number;
}

interface JsonContract {
  /** The document key the payload carries, and that a failure sets to null. */
  key: string;
  /** True when the command reports findings by exiting 1 (validate, doctor…). */
  gate: boolean;
  /** Positional signature, as the contract table spells it. */
  args?: string;
  /** Override for commands that predate `--json`. */
  flag?: string;
}

export interface Subcommand {
  name: string;
  script?: string[];
  /**
   * Index into argv where this row's own arguments begin. 2 by default — the
   * dispatcher eats the sub-command token. `pack lint` and `config set` parse
   * that token themselves, so theirs starts at 1.
   */
  argsFrom?: number;
  help?: HelpRow;
  json?: JsonContract;
  /**
   * Name of the MCP tool that fronts this command, when one does. The MCP
   * package builds and publishes on its own, so it cannot read this module at
   * runtime — the link is a declaration both sides make and a test compares.
   */
  mcp?: string | boolean;
  /**
   * The positional argument the MCP tool must declare, for a command with no
   * JSON contract to carry it (`json.args` does otherwise): `change new`'s id,
   * `req link`'s requirement. Without it the tool's schema named only
   * `projectDir`, and an agent had no way to know the id was required.
   */
  mcpArg?: string;
  /**
   * True when this command may write a path `WriteScope.DEFAULT_PROTECTED_PATHS`
   * protects — `spec.md`, `AI_RULES.md`, `features/**\/*.feature`,
   * `docs/specs/**`, `.specops.lock` or `harness.config.yaml`.
   *
   * These are the terms of the contract an agent is working *against*, so an
   * agent that can edit them can relax the scenario it cannot satisfy. The
   * harness has verified this since 0.7.0; the MCP server refuses the tool
   * outright, which is C10-04. `tests/unit/surface-registry.test.ts` fails when
   * a command writes one of those paths without saying so here.
   */
  editsContract?: boolean;
}

export interface Command {
  name: string;
  script?: string[];
  subcommands?: Subcommand[];
  help?: HelpRow;
  coreHelp?: HelpRow;
  json?: JsonContract;
  /**
   * Name of the MCP tool that fronts this command, when one does. The MCP
   * package builds and publishes on its own, so it cannot read this module at
   * runtime — the link is a declaration both sides make and a test compares.
   */
  mcp?: string | boolean;
  /**
   * The positional argument the MCP tool must declare, for a command with no
   * JSON contract to carry it (`json.args` does otherwise): `change new`'s id,
   * `req link`'s requirement. Without it the tool's schema named only
   * `projectDir`, and an agent had no way to know the id was required.
   */
  mcpArg?: string;
  /**
   * True when this command may write a path `WriteScope.DEFAULT_PROTECTED_PATHS`
   * protects — `spec.md`, `AI_RULES.md`, `features/**\/*.feature`,
   * `docs/specs/**`, `.specops.lock` or `harness.config.yaml`.
   *
   * These are the terms of the contract an agent is working *against*, so an
   * agent that can edit them can relax the scenario it cannot satisfy. The
   * harness has verified this since 0.7.0; the MCP server refuses the tool
   * outright, which is C10-04. `tests/unit/surface-registry.test.ts` fails when
   * a command writes one of those paths without saying so here.
   */
  editsContract?: boolean;
}

export const SURFACE: Command[] = [
  {
    name: "init",
    editsContract: true,
    script: ["init_project.js"],
    help: {
      group: "core",
      icon: "⚡",
      summary: "Adopt this repo if it has code, else scaffold one; --new forces a scaffold.",
    },
    coreHelp: {
      group: "start",
      order: 1,
      icon: "⚡",
      summary: "Start here: adopts a repo that has code, scaffolds one that does not.",
    },
  },
  {
    name: "adopt",
    editsContract: true,
    script: ["adopt_project.js"],
    help: {
      group: "core",
      icon: "🧱",
      summary: "Install SDD on an EXISTING repository (brownfield, non-invasive).",
    },
    // `init` does this in a repo that has code (phase 1); kept for scripts.
  },
  {
    name: "onboard",
    script: ["onboard.js"],
    help: {
      group: "core",
      icon: "🧭",
      summary: "Read an existing repo and propose the capabilities its code implies.",
    },
    // `adopt` seeds the same proposals; kept for a read-only preview.
  },
  {
    name: "doctor",
    script: ["doctor.js"],
    help: {
      group: "core",
      icon: "🩺",
      summary: "Diagnose the project and environment; every finding ships a fix.",
    },
    json: { key: "doctor", gate: true },
  },
  {
    // Plumbing. Git calls this, not a person: `harness init` registers it as
    // the merge driver for docs/specs/traceability.md. It is on the surface so
    // the driver can be registered by name — the alternative was writing an
    // absolute path into .git/config, which is meaningless on any other clone.
    name: "merge-traceability",
    script: ["merge-traceability.js"],
    mcp: false,
    // No `help` block on purpose: git calls this, a person does not, so it is
    // a hidden command rather than a line in a menu nobody can act on.
  },
  {
    // Plumbing too: the merge driver for docs/specs/capabilities/*/spec.md.
    name: "merge-capability-spec",
    script: ["merge-capability-spec.js"],
    mcp: false,
  },
  {
    name: "status",
    script: ["status.js"],
    help: {
      group: "core",
      icon: "🧭",
      summary: "Daily dashboard: what is done, what is orphaned, what to do next.",
    },
    coreHelp: {
      group: "daily",
      order: 3,
      icon: "🧭",
      summary: "What is left, requirement by requirement, and the one command to run next.",
    },
    json: { key: "status", gate: false },
  },
  {
    name: "ci",
    subcommands: [
      {
        name: "init",
        script: ["ci_init.js"],
        help: {
          group: "core",
          icon: "🚦",
          summary: "Generate the spec gate for GitHub, GitLab, Azure, or Jenkins.",
        },
      },
    ],
  },
  {
    name: "alm",
    script: ["alm", "cli.js"],
    subcommands: [
      {
        name: "sync",
        help: {
          group: "core",
          icon: "🎫",
          summary: "Sync REQs with Jira / Azure Boards (create, close, drift).",
        },
      },
      { name: "link" },
      { name: "status" },
      { name: "pull", editsContract: true, json: { key: "pulled", gate: false } },
      // REQ-309: an agent reads where a change stands, and moves its ticket there.
      { name: "phase", json: { key: "phase", gate: false, args: "<change>" } },
      {
        name: "move",
        mcpArg: "change",
        json: { key: "move", gate: false, args: "<change> [<phase>]" },
      },
      // Pushes a branch and opens a pull request: a person's step, not an MCP tool.
      { name: "pr", mcp: false },
    ],
  },
  {
    name: "check",
    script: ["check.js"],
    help: {
      group: "core",
      icon: "✅",
      summary: "The gate: validate --strict, then your tests — before you open a PR.",
    },
    coreHelp: {
      group: "ci",
      order: 1,
      icon: "✅",
      summary: "The gate in CI and before a pull request: specs, links, coverage, tests.",
    },
    json: { key: "check", gate: true, args: "[dir]" },
  },
  {
    name: "migrate",
    // REQ-325: a one-time move to 1.0 a person runs and reviews; not an MCP tool.
    mcp: false,
    script: ["migrate.js"],
    help: {
      group: "core",
      icon: "🧭",
      summary:
        "Move a 0.27 project to 1.0: open changes into three layers, a report of what is left.",
    },
    json: { key: "migrate", gate: false, args: "1.0 [--dry-run]" },
  },
  {
    name: "workspace",
    // ADR-0041: runs every member's own gate; a person's view, not an MCP tool yet.
    mcp: false,
    script: ["workspace.js"],
    help: {
      group: "core",
      icon: "🧩",
      summary: "The repositories of one product: status, check, a story across them (ADR-0041).",
    },
    json: { key: "workspace", gate: true, args: "<init|status|check|propose>" },
  },
  {
    name: "quality",
    mcp: false,
    script: ["quality.js"],
    help: {
      group: "core",
      icon: "🔍",
      summary: "The quality and security checks of the gate: list, doctor, run (ADR-0040).",
    },
    json: { key: "quality", gate: false, args: "<list|doctor|run>" },
  },
  {
    name: "draft",
    script: ["draft.js"],
    help: {
      group: "core",
      icon: "📝",
      summary:
        "From your plan or brief to requirements, one module at a time — each draft checked against it.",
    },
    // Out of the short help: `propose --from-brief` is the same command (ADR-0035).
    json: { key: "draft", gate: true },
    mcp: false,
  },
  {
    name: "verify",
    script: ["verify.js"],
    help: {
      group: "core",
      icon: "🔎",
      summary: "Gate what OpenSpec calls done on tests that name each criterion (ADR-0030).",
    },
    json: { key: "verify", gate: true },
  },
  {
    name: "pet",
    script: ["pet.js"],
    help: {
      group: "dx",
      icon: "🐈",
      summary: "Gato, the cat that keeps the gate: the project's health as a pet.",
    },
    json: { key: "pet", gate: false },
    mcp: false,
  },
  {
    name: "matrix",
    editsContract: true,
    script: ["matrix.js"],
    help: {
      group: "core",
      icon: "🧮",
      summary: "Generate the matrix from spec.md, tags and tests; --check, --migrate.",
    },
    json: { key: "matrix", gate: true },
    mcp: false,
  },
  {
    name: "validate",
    script: ["validate_specs.js"],
    help: {
      group: "core",
      icon: "🔎",
      summary:
        "Check structure, traceability, Gherkin. --strict is the gate: TDD, links, scenarios, requirements and coverage.",
    },
    json: { key: "validation", gate: true, args: "<dir>" },
    mcp: "validate_project",
  },
  {
    name: "expand",
    editsContract: true,
    script: ["expand_domain_pack.js"],
    help: {
      group: "core",
      icon: "🧩",
      summary: "Apply a domain pack (local path or remote git tag).",
    },
  },
  {
    name: "plan",
    script: ["plan.js"],
    help: {
      group: "core",
      icon: "📋",
      summary: "List requirements that still need a test or implementation.",
    },
    // Not in the daily help: `status` lists the queue itself, and the short help
    // keeps to the four verbs (docs/specs/adr/0035-four-verbs-one-lifecycle.md).
    // `plan` keeps the full detail.
    json: { key: "plan", gate: false },
    mcp: "plan",
  },
  {
    name: "report",
    script: ["report.js"],
    help: {
      group: "core",
      icon: "📊",
      summary: "Spec-coverage dashboard as self-contained HTML (CI/Pages artifact).",
    },
    json: { key: "report", gate: false },
  },
  {
    name: "done",
    editsContract: true,
    script: ["done.js"],
    help: {
      group: "core",
      icon: "🏁",
      summary: "Mark a requirement Implemented — after the gate passes for it.",
    },
    // Out of the short help: `apply` is the same command (ADR-0035).
    json: { key: "requirement", gate: false, args: "<REQ>" },
    mcp: "mark_requirement_done",
  },
  {
    name: "new",
    editsContract: true,
    script: ["new.js"],
    help: {
      group: "core",
      icon: "✨",
      summary: "One requirement in one step: spec.md section, tagged scenario, matrix row.",
    },
    // Out of the short help: a requirement arrives through a change (ADR-0035).
    json: { key: "requirement", gate: false, args: "<title>" },
  },
  {
    // ADR-0033: the generator behind the one front door. `forja add usecase`
    // runs `specgate new`, so the contract can change through it.
    name: "add",
    editsContract: true,
    // forja comes through npx and has prompts of its own: not an MCP tool yet.
    mcp: false,
    script: ["add.js"],
    help: {
      group: "core",
      icon: "🧩",
      summary: "In a forja project: a use case, entity or port, with its test and wiring.",
    },
    // Out of the short help since ADR-0035; `status` names it in forja projects.
  },
  {
    name: "req",
    script: ["req.js"],
    subcommands: [
      { name: "add", editsContract: true, mcpArg: "title" },
      { name: "link", editsContract: true, mcpArg: "requirement" },
      { name: "done", editsContract: true, mcpArg: "requirement" },
      { name: "rm", editsContract: true, mcpArg: "requirement" },
      { name: "list" },
    ],
    help: {
      group: "core",
      icon: "📝",
      summary: "Add, link, remove and close requirements without hand-editing the matrix.",
    },
    // Out of the daily help since the matrix is generated (phase 3C): a test
    // that names its requirement is the link, and `new`/`done` cover the rest.
  },
  {
    name: "fix",
    editsContract: true,
    script: ["fix.js"],
    help: {
      group: "core",
      icon: "🔧",
      summary: "Apply the fixes validate suggests (--dry-run to preview).",
    },
  },
  {
    name: "change",
    script: ["change", "cli.js"],
    subcommands: [
      { name: "new", editsContract: true, mcpArg: "id" },
      { name: "list", json: { key: "changes", gate: false } },
      { name: "show", json: { key: "change", gate: false, args: "<id>" } },
      { name: "status", json: { key: "artifacts", gate: false } },
      { name: "validate", json: { key: "change", gate: true, args: "<id>" } },
      { name: "archive", editsContract: true, json: { key: "archive", gate: true, args: "<id>" } },
      { name: "instructions", json: { key: "instructions", gate: false, args: "<artifact>" } },
      { name: "author", editsContract: true, json: { key: "change", gate: true, args: "<id>" } },
    ],
    help: {
      group: "core",
      icon: "🔄",
      summary:
        "Propose, review and archive a change (new · list · show · status · validate · archive).",
    },
    // Out of the short help: `propose` and `archive` are its daily verbs
    // (ADR-0035); `--help --all` lists the rest.
  },
  {
    // ADR-0035: the daily verbs. `propose` is `change new`, or `draft` with
    // --from-brief; `apply` is `done`; `archive` is `change archive`.
    name: "propose",
    editsContract: true,
    mcp: false,
    script: ["propose.js"],
    help: {
      group: "core",
      icon: "💡",
      summary: "Open a change for an idea, or from docs/brief.md with --from-brief.",
    },
    coreHelp: {
      group: "daily",
      order: 1,
      icon: "💡",
      summary: "Open a change: an idea, or the next module of docs/brief.md.",
    },
    json: { key: "change", gate: false, args: "<id>" },
  },
  {
    name: "brief",
    subcommands: [
      {
        name: "add",
        script: ["brief_add.js"],
        editsContract: true,
        mcp: false,
        help: {
          group: "core",
          icon: "➕",
          summary: "A new requirement for a module the brief covers, archived or not (REQ-192).",
        },
        json: { key: "brief", gate: false, args: "<module> <text>" },
      },
    ],
  },
  {
    name: "questions",
    mcp: false,
    script: ["questions.js"],
    help: {
      group: "core",
      icon: "❓",
      summary: "Everything waiting for an answer: open questions and what they block (REQ-187).",
    },
    json: { key: "questions", gate: false },
  },
  {
    name: "answer",
    editsContract: true,
    mcp: false,
    script: ["answer.js"],
    help: {
      group: "core",
      icon: "💬",
      summary: "Answer a question: its row, an assumption to review, the requirements to revise.",
    },
    json: { key: "answer", gate: false, args: "<Q> <answer>" },
  },
  {
    name: "ask",
    editsContract: true,
    mcp: false,
    script: ["ask.js"],
    help: {
      group: "core",
      icon: "🙋",
      summary: "Ask instead of guessing: the requirement waits for the answer (REQ-189).",
    },
    json: { key: "ask", gate: false, args: "<REQ> <question>" },
  },
  {
    // ADR-0037: thinking with the agent before a change exists; writes nothing.
    name: "explore",
    mcp: false,
    script: ["explore.js"],
    help: {
      group: "core",
      icon: "🔭",
      summary:
        "Think with your agent before a change exists: the project's state, nothing written.",
    },
    json: { key: "explore", gate: false, args: "[question]" },
  },
  {
    name: "apply",
    editsContract: true,
    mcp: false,
    script: ["apply.js"],
    help: {
      group: "core",
      icon: "🏁",
      summary: "Deliver one requirement: its test first, then the gate marks it Implemented.",
    },
    coreHelp: {
      group: "daily",
      order: 2,
      icon: "🏁",
      summary: "Deliver the next requirement: test first, the gate, Implemented.",
    },
    json: { key: "requirement", gate: false, args: "[REQ]" },
  },
  {
    name: "archive",
    editsContract: true,
    mcp: false,
    script: ["archive.js"],
    help: {
      group: "core",
      icon: "📦",
      summary: "Merge a change into the specs once every requirement in it is Implemented.",
    },
    coreHelp: {
      group: "daily",
      order: 4,
      icon: "📦",
      summary: "Close a change once all its requirements are delivered.",
    },
    json: { key: "archive", gate: true, args: "<id>" },
  },

  {
    name: "pack",
    subcommands: [
      {
        name: "init",
        script: ["init_pack.js"],
        argsFrom: 1,
        help: {
          group: "pack",
          icon: "📦",
          summary: "Scaffold a new pack skeleton (backend · frontend · contracts).",
        },
      },
      {
        name: "lint",
        script: ["lint_pack.js"],
        argsFrom: 1,
        mcp: "lint_pack",
        help: {
          group: "pack",
          icon: "🔍",
          summary: "Lint a pack: schema, cross-refs, and scenario quality (--strict).",
        },
      },
      {
        name: "infer",
        script: ["infer_pack.js"],
        argsFrom: 1,
        help: {
          group: "pack",
          icon: "🔮",
          summary: "Propose a pack.yaml skeleton from a .feature file.",
        },
      },
      {
        name: "bundle",
        script: ["bundle_pack.js"],
        help: {
          group: "pack",
          icon: "📴",
          summary: "Export a pack repo as a git bundle for air-gapped use.",
        },
      },
    ],
  },

  {
    name: "specops",
    subcommands: [
      {
        name: "add",
        editsContract: true,
        script: ["specops", "add.js"],
        help: {
          group: "specops",
          icon: "➕",
          summary: "Add a pack (npm-install-style); writes .specops.lock.",
        },
      },
      {
        name: "remove",
        editsContract: true,
        script: ["specops", "remove.js"],
        help: {
          group: "specops",
          icon: "➖",
          summary: "Drop a pack entry from .specops.lock.",
        },
      },
      {
        name: "sync",
        editsContract: true,
        script: ["specops", "sync.js"],
        help: {
          group: "specops",
          icon: "🔁",
          summary: "Re-expand packs and three-way merge them, preserving local edits.",
        },
      },
      {
        name: "diff",
        script: ["specops", "diff.js"],
        help: {
          group: "specops",
          icon: "📊",
          summary: "Preview a version bump; --as-change derives a reviewable change.",
        },
        json: { key: "changes", gate: false },
      },
      {
        name: "contribute",
        script: ["specops", "contribute.js"],
        help: {
          group: "specops",
          icon: "📤",
          summary: "Send a local change back upstream to the pack (never pushes).",
        },
      },
    ],
  },

  {
    name: "harness",
    subcommands: [
      {
        name: "run",
        editsContract: true,
        script: ["harness", "run.js"],
        help: {
          group: "harness",
          icon: "🤖",
          summary: "Run the plan → agent → verify → done loop for every pending requirement.",
        },
        json: { key: "results", gate: false, flag: "--format json" },
      },
      {
        name: "prompt",
        script: ["harness", "run.js"],
        help: {
          group: "harness",
          icon: "📝",
          summary: "Print the prompt the harness would hand an agent for one REQ.",
        },
      },
      {
        name: "init",
        editsContract: true,
        script: ["harness", "init.js"],
        help: {
          group: "harness",
          icon: "🧰",
          summary: "Scaffold harness.config.yaml and the prompt prefix.",
        },
      },
      {
        // ADR-0037: an agent's own stream as harness events, at the end of its pipe.
        name: "events",
        mcp: false,
        script: ["harness", "events.js"],
        help: {
          group: "harness",
          icon: "📡",
          summary: "Turn an agent's stream into harness events for the live view (--from claude).",
        },
      },
      {
        name: "report",
        script: ["harness", "report.js"],
        help: {
          group: "harness",
          icon: "📈",
          summary: "What the harness has cost: first-attempt rate, time per delivered requirement.",
        },
        json: { key: "report", gate: false },
      },
    ],
  },

  {
    name: "config",
    subcommands: [
      { name: "init", script: ["config_init.js"] },
      { name: "set", script: ["config_set.js"], argsFrom: 1 },
      { name: "get", script: ["config_set.js"], argsFrom: 1 },
      { name: "list", script: ["config_set.js"], argsFrom: 1 },
    ],
    help: {
      group: "dx",
      icon: "🔩",
      summary: "Project preferences: `config init`, `config set profile full`.",
    },
  },
  {
    name: "agents",
    subcommands: [
      {
        name: "init",
        script: ["agents", "init.js"],
        help: {
          group: "dx",
          icon: "🤖",
          summary: "Wire the loop into Claude, Cursor, Copilot, Aider and more.",
        },
      },
    ],
  },
  {
    name: "update",
    editsContract: true,
    script: ["update.js"],
    help: {
      group: "dx",
      icon: "🔄",
      summary: "Refresh generated agent files after a CLI upgrade, keeping your edits.",
    },
  },
  {
    name: "schema",
    script: ["schema", "cli.js"],
    subcommands: [{ name: "which" }, { name: "init" }, { name: "fork" }, { name: "validate" }],
    help: {
      group: "dx",
      icon: "📐",
      summary: "Inspect or fork the artefact graph a change follows.",
    },
  },
  {
    name: "completion",
    script: ["completion.js"],
    subcommands: [{ name: "bash" }, { name: "zsh" }, { name: "fish" }],
    help: {
      group: "dx",
      icon: "💻",
      summary: "Print a shell completion script (bash · zsh · fish).",
    },
  },
  {
    name: "studio",
    script: ["studio.js"],
    help: {
      group: "dx",
      icon: "🎨",
      summary: "Serve a local, read-only HTML view of the spec tree (--json for agents).",
    },
  },
  {
    name: "mcp",
    script: ["cli", "commands", "mcp", "index.js"],
    subcommands: [
      {
        name: "serve",
        mcp: false,
        help: {
          group: "core",
          icon: "🔌",
          summary: "Run the MCP server over stdio — what the generated MCP configs start.",
        },
      },
      {
        name: "install",
        mcp: false,
        help: {
          group: "core",
          icon: "🔌",
          summary: "Install MCP server configuration for AI clients.",
        },
      },
    ],
  },
];

// ── Derived views ─────────────────────────────────────────────────────────────

/** One row of the published agent-contract table. */
export interface JsonContractRow {
  command: string;
  nullShapeKey: string;
  gate: boolean;
}

/** One line of `--help`, under its group. */
export interface HelpListing {
  label: string;
  icon: string;
  summary: string;
  order?: number;
}

/** A help group with the lines it lists. */
export interface HelpSection {
  group: string;
  title: string;
  rows: HelpListing[];
}

/** Every top-level command name, in declaration order. */
export function commandNames(): string[] {
  return SURFACE.map((c) => c.name);
}

/** `{ command: [sub, …] }` for every command that dispatches further. */
export function subcommandNames(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const command of SURFACE) {
    if (command.subcommands) out[command.name] = command.subcommands.map((s) => s.name);
  }
  return out;
}

/**
 * Every row that speaks the JSON contract, flattened to the exact invocation
 * an agent types. `gen_agent_contract.ts` renders these straight into the
 * published table, so the string is the contract's own spelling.
 */
export function jsonContractRows(): JsonContractRow[] {
  const rows: JsonContractRow[] = [];
  const push = (invocation: string, json: JsonContract) => {
    const args = json.args ? ` ${json.args}` : "";
    const flag = json.flag || "--json";
    rows.push({
      command: `${invocation}${args} ${flag}`,
      nullShapeKey: json.key,
      gate: Boolean(json.gate),
    });
  };
  for (const command of SURFACE) {
    if (command.json) push(command.name, command.json);
    for (const sub of command.subcommands || []) {
      if (sub.json) push(`${command.name} ${sub.name}`, sub.json);
    }
  }
  return rows;
}

/**
 * Rows that print their own line in `--help --all`, grouped and ordered as
 * the help does. A row's label is `command` or `command sub`, which is why
 * the help can list `ci init` and `plan` side by side.
 */
export function helpRows(): HelpSection[] {
  const byGroup = new Map(HELP_GROUPS.map((g) => [g.id, [] as HelpListing[]]));
  const add = (label: string, help: HelpRow) => {
    const bucket = byGroup.get(help.group);
    if (!bucket) throw new Error(`surface: unknown help group '${help.group}' on '${label}'`);
    bucket.push({ label, icon: help.icon, summary: help.summary });
  };
  for (const command of SURFACE) {
    if (command.help) add(command.name, command.help);
    for (const sub of command.subcommands || []) {
      if (sub.help) add(`${command.name} ${sub.name}`, sub.help);
    }
  }
  // Every group has its bucket: the map was built from this same list.
  return HELP_GROUPS.map((g) => ({ group: g.id, title: g.title, rows: byGroup.get(g.id)! }));
}

/** The same, for the narrowed daily surface. */
export function coreHelpRows(): HelpSection[] {
  const byGroup = new Map(CORE_GROUPS.map((g) => [g.id, [] as HelpListing[]]));
  for (const command of SURFACE) {
    if (!command.coreHelp) continue;
    const bucket = byGroup.get(command.coreHelp.group);
    if (!bucket) {
      throw new Error(`surface: unknown core help group on '${command.name}'`);
    }
    bucket.push({
      label: command.name,
      icon: command.coreHelp.icon,
      summary: command.coreHelp.summary,
      order: command.coreHelp.order,
    });
  }
  for (const rows of byGroup.values()) {
    rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return CORE_GROUPS.map((g) => ({ group: g.id, title: g.title, rows: byGroup.get(g.id)! }));
}

/**
 * How many commands the full help lists but the narrowed one does not — the
 * number `usage()` quotes when it points at `--help --all`. It was prose, and
 * prose does not recount itself when a command is added.
 */
export function hiddenCommandCount(): number {
  return SURFACE.filter((c) => !c.coreHelp).length;
}

/**
 * `{ toolName: "command" | "command sub" }` for every row an MCP tool fronts.
 */
export function mcpTools(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const command of SURFACE) {
    if (command.subcommands) {
      for (const sub of command.subcommands) {
        if (command.mcp === false || sub.mcp === false) continue;
        const toolName =
          (typeof sub.mcp === "string" ? sub.mcp : false) ||
          `specgate_${command.name}_${sub.name}`.replace(/-/g, "_");
        out[toolName] = `${command.name} ${sub.name}`;
      }
    } else {
      if (command.mcp === false) continue;
      const toolName =
        (typeof command.mcp === "string" ? command.mcp : false) ||
        `specgate_${command.name}`.replace(/-/g, "_");
      out[toolName] = command.name;
    }
  }
  return out;
}
