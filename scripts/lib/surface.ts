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
  { id: "core", title: "CORE COMMANDS" },
  { id: "pack", title: "PACK COMMANDS" },
  { id: "specops", title: "SPECOPS COMMANDS" },
  { id: "harness", title: "HARNESS COMMANDS" },
  { id: "dx", title: "DX COMMANDS" },
];

/** Sections of the narrowed help, in the order they print. */
export const CORE_GROUPS = [
  { id: "start", title: "START HERE" },
  { id: "daily", title: "EVERY DAY" },
];

interface HelpRow {
  group: string;
  icon: string;
  summary: string;
  /**
   * Position within the group. The daily surface reads as a sequence —
   * status → plan → req → change → validate → done — which is neither
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

interface Subcommand {
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

interface Command {
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
      icon: "🏗",
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
    name: "status",
    script: ["status.js"],
    help: {
      group: "core",
      icon: "🧭",
      summary: "Daily dashboard: what is done, what is orphaned, what to do next.",
    },
    coreHelp: {
      group: "daily",
      order: 1,
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
      group: "daily",
      order: 6,
      icon: "✅",
      summary: "The gate: specs, links, coverage — and your tests.",
    },
    json: { key: "check", gate: true, args: "[dir]" },
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
    // Not in the daily help: `status` lists the queue itself since phase 1 of
    // mejoras/plan-simplificacion-equipo.md. `plan` keeps the full detail.
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
      icon: "✔",
      summary: "Mark a requirement Implemented — after the gate passes for it.",
    },
    coreHelp: { group: "daily", order: 7, icon: "✔", summary: "Mark a requirement Implemented." },
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
    coreHelp: {
      group: "daily",
      order: 3,
      icon: "✨",
      summary: "Add a requirement: its prose, its scenario and its row.",
    },
    json: { key: "requirement", gate: false, args: "<title>" },
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
    // Out of the daily help: changing a requirement that already shipped is
    // not a daily act. The short help is the five-verb loop (phase 1 of
    // mejoras/plan-simplificacion-equipo.md); `--help --all` lists this.
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
      icon: "⚙",
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
      icon: "🗺",
      summary: "Inspect or fork the artefact graph a change follows.",
    },
  },
  {
    name: "completion",
    script: ["completion.js"],
    subcommands: [{ name: "bash" }, { name: "zsh" }, { name: "fish" }],
    help: {
      group: "dx",
      icon: "⌨",
      summary: "Print a shell completion script (bash · zsh).",
    },
  },
  {
    name: "studio",
    script: ["studio.js"],
    help: {
      group: "dx",
      icon: "🖼",
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

/** Every top-level command name, in declaration order. */
export function commandNames() {
  return SURFACE.map((c) => c.name);
}

/** `{ command: [sub, …] }` for every command that dispatches further. */
export function subcommandNames() {
  const out = {};
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
export function jsonContractRows() {
  const rows = [];
  const push = (invocation, json) => {
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
export function helpRows() {
  const byGroup = new Map(HELP_GROUPS.map((g) => [g.id, []]));
  const add = (label, help) => {
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
  return HELP_GROUPS.map((g) => ({ group: g.id, title: g.title, rows: byGroup.get(g.id) }));
}

/** The same, for the narrowed daily surface. */
export function coreHelpRows() {
  const byGroup = new Map(CORE_GROUPS.map((g) => [g.id, []]));
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
  return CORE_GROUPS.map((g) => ({ group: g.id, title: g.title, rows: byGroup.get(g.id) }));
}

/**
 * How many commands the full help lists but the narrowed one does not — the
 * number `usage()` quotes when it points at `--help --all`. It was prose, and
 * prose does not recount itself when a command is added.
 */
export function hiddenCommandCount() {
  return SURFACE.filter((c) => !c.coreHelp).length;
}

/**
 * `{ toolName: "command" | "command sub" }` for every row an MCP tool fronts.
 */
export function mcpTools() {
  const out = {};
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
