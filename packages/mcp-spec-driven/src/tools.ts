// GENERATED FILE - DO NOT EDIT BY HAND
// Derived from scripts/lib/surface.ts

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import {
  ReadSpecTool,
  ListRequirementsTool,
  UpdateTraceabilityTool,
  assertContractEditable,
} from "./native-tools";

export interface ITool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly csda?: string;
  handler(args: Record<string, unknown>): unknown;
}

class ProjectHelper {
  /**
   * A tool that is handed a directory which is not a spec-driven project has to
   * say so. #138 reduced this to a type check, so every such call went on to
   * shell out and came back `{ exitCode: 1, raw: "" }` — a failure with no
   * reason in it, which is exactly the shape ADR-0017 exists to prevent.
   */
  public static ensureProjectDir(projectDir: unknown): string {
    if (!projectDir || typeof projectDir !== "string") {
      throw new Error("projectDir is required (absolute path to a spec-driven project)");
    }
    if (!fs.existsSync(projectDir)) {
      throw new Error(`projectDir does not exist: ${projectDir}`);
    }
    if (!fs.existsSync(path.join(projectDir, "spec.md"))) {
      throw new Error(`Not a spec-driven project (no spec.md): ${projectDir}`);
    }
    return projectDir;
  }
}

class CliInvoker {
  /**
   * Split a command line, honouring quotes.
   *
   * `bin.split(" ")` was the whole parser after #138, so any interpreter path
   * with a space in it — `"/Users/me/My Tools/node" "…/cli.js"` — was torn into
   * fragments and the spawn failed with no output.
   */
  private static parseCliCommand(cliPath: string | undefined): string[] {
    const raw = (cliPath || "npx @rsaglobaltech/specgate").trim();
    const tokens: string[] = [];
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      tokens.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
    }
    return tokens;
  }

  public static spawnCli(cliPath: string | undefined, args: string[]) {
    const cmd = CliInvoker.parseCliCommand(cliPath);
    const useShell = process.platform === "win32";
    const quote = (v: string) => (useShell && /\s/.test(v) ? `"${v}"` : v);
    return spawnSync(quote(cmd[0]), [...cmd.slice(1), ...args].map(quote), {
      encoding: "utf8",
      shell: useShell,
      timeout: 60000,
    });
  }
}

export class GenericCliTool implements ITool {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly csda: string,
    public readonly inputSchema: Record<string, unknown>,
    /**
     * How this command takes the project directory. `validate` takes it as a
     * positional `<dir>` and rejects `--project-dir` outright, so the flag form
     * made `validate_project` — the most used tool of the seven — fail with
     * "Unknown flag(s)" and an empty payload over MCP. The surface already
     * records which is which in `json.args`; this reads it instead of assuming.
     */
    public readonly dirStyle: "flag" | "positional" = "flag",
    /**
     * True when this command may write a path the write-scope rules protect.
     * Computed at generation time from scripts/lib/surface.ts and
     * WriteScope.DEFAULT_PROTECTED_PATHS, so the rule has one definition.
     */
    public readonly editsContract = false
  ) {}

  public handler(args: Record<string, unknown>) {
    const dir = ProjectHelper.ensureProjectDir(args.projectDir);

    // C10-04. The prompt has always told the agent not to rewrite the
    // specification it is being measured against; nothing enforced it over MCP.
    // An agent that cannot make a scenario pass can otherwise relax the
    // scenario, and the gate approves — the exact failure this product exists
    // to prevent. The change cycle is the way to edit a spec on purpose, and it
    // leaves a reviewable trail.
    if (this.editsContract) assertContractEditable(this.name, dir);

    const argv = this.csda.split(" ");

    if (this.dirStyle === "positional") argv.push(dir);
    else argv.push("--project-dir", dir);

    // Pass args safely
    for (const [k, v] of Object.entries(args)) {
      if (k === "projectDir" || k === "cliPath") continue;
      if (typeof v === "string") {
        argv.push(v); // Quick hack, we need proper arg mapping
      }
    }

    if (!argv.includes("--json")) {
      argv.push("--json");
    }

    const result = CliInvoker.spawnCli(args.cliPath as string, argv);
    const combined = (result.stdout || "") + "\n" + (result.stderr || "");
    try {
      if (result.stdout && result.stdout.trim().startsWith("{")) {
        return JSON.parse(result.stdout.trim());
      }
    } catch {
      // Not JSON: fall through to the raw envelope below.
    }

    return {
      exitCode: typeof result.status === "number" ? result.status : 1,
      raw: combined.trim(),
    };
  }
}

export const TOOLS: Record<string, ITool> = {};

TOOLS["csda_init"] = new GenericCliTool(
  "csda_init",
  "Scaffold a new project; --from-pack <repo>@<tag> also installs a pack.",
  "init",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["csda_adopt"] = new GenericCliTool(
  "csda_adopt",
  "Install SDD on an EXISTING repository (brownfield, non-invasive).",
  "adopt",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["csda_onboard"] = new GenericCliTool(
  "csda_onboard",
  "Read an existing repo and propose the capabilities its code implies.",
  "onboard",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_doctor"] = new GenericCliTool(
  "csda_doctor",
  "Diagnose the project and environment; every finding ships a fix.",
  "doctor",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_status"] = new GenericCliTool(
  "csda_status",
  "Daily dashboard: what is done, what is orphaned, what to do next.",
  "status",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_ci_init"] = new GenericCliTool(
  "csda_ci_init",
  "Generate the spec gate for GitHub, GitLab, Azure, or Jenkins.",
  "ci init",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_alm_sync"] = new GenericCliTool(
  "csda_alm_sync",
  "Sync REQs with Jira / Azure Boards (create, close, drift).",
  "alm sync",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_alm_link"] = new GenericCliTool(
  "csda_alm_link",
  "Run specgate alm link",
  "alm link",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_alm_status"] = new GenericCliTool(
  "csda_alm_status",
  "Run specgate alm status",
  "alm status",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_alm_pull"] = new GenericCliTool(
  "csda_alm_pull",
  "Run specgate alm pull",
  "alm pull",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["validate_project"] = new GenericCliTool(
  "validate_project",
  "Check structure, traceability, Gherkin. --strict is the gate: TDD, links, scenarios, requirements and coverage.",
  "validate",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "positional",
  false
);
TOOLS["csda_expand"] = new GenericCliTool(
  "csda_expand",
  "Apply a domain pack (local path or remote git tag).",
  "expand",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["plan"] = new GenericCliTool(
  "plan",
  "List requirements that still need a test or implementation.",
  "plan",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_report"] = new GenericCliTool(
  "csda_report",
  "Spec-coverage dashboard as self-contained HTML (CI/Pages artifact).",
  "report",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["mark_requirement_done"] = new GenericCliTool(
  "mark_requirement_done",
  "Mark a requirement as Implemented in traceability.md.",
  "done",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["csda_req_add"] = new GenericCliTool(
  "csda_req_add",
  "Run specgate req add",
  "req add",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["csda_req_link"] = new GenericCliTool(
  "csda_req_link",
  "Run specgate req link",
  "req link",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["csda_req_done"] = new GenericCliTool(
  "csda_req_done",
  "Run specgate req done",
  "req done",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["csda_req_rm"] = new GenericCliTool(
  "csda_req_rm",
  "Run specgate req rm",
  "req rm",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["csda_req_list"] = new GenericCliTool(
  "csda_req_list",
  "Run specgate req list",
  "req list",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_fix"] = new GenericCliTool(
  "csda_fix",
  "Apply the fixes validate suggests (--dry-run to preview).",
  "fix",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["csda_change_new"] = new GenericCliTool(
  "csda_change_new",
  "Run specgate change new",
  "change new",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_change_list"] = new GenericCliTool(
  "csda_change_list",
  "Run specgate change list",
  "change list",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_change_show"] = new GenericCliTool(
  "csda_change_show",
  "Run specgate change show",
  "change show",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_change_status"] = new GenericCliTool(
  "csda_change_status",
  "Run specgate change status",
  "change status",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_change_validate"] = new GenericCliTool(
  "csda_change_validate",
  "Run specgate change validate",
  "change validate",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_change_archive"] = new GenericCliTool(
  "csda_change_archive",
  "Run specgate change archive",
  "change archive",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_change_instructions"] = new GenericCliTool(
  "csda_change_instructions",
  "Run specgate change instructions",
  "change instructions",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_change_author"] = new GenericCliTool(
  "csda_change_author",
  "Run specgate change author",
  "change author",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_pack_init"] = new GenericCliTool(
  "csda_pack_init",
  "Scaffold a new pack skeleton (backend · frontend · contracts).",
  "pack init",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["lint_pack"] = new GenericCliTool(
  "lint_pack",
  "Lint a pack: schema, cross-refs, and scenario quality (--strict).",
  "pack lint",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_pack_infer"] = new GenericCliTool(
  "csda_pack_infer",
  "Propose a pack.yaml skeleton from a .feature file.",
  "pack infer",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_pack_bundle"] = new GenericCliTool(
  "csda_pack_bundle",
  "Export a pack repo as a git bundle for air-gapped use.",
  "pack bundle",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_specops_add"] = new GenericCliTool(
  "csda_specops_add",
  "Add a pack (npm-install-style); writes .specops.lock.",
  "specops add",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["csda_specops_remove"] = new GenericCliTool(
  "csda_specops_remove",
  "Drop a pack entry from .specops.lock.",
  "specops remove",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["csda_specops_sync"] = new GenericCliTool(
  "csda_specops_sync",
  "Re-expand packs and three-way merge them, preserving local edits.",
  "specops sync",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["csda_specops_diff"] = new GenericCliTool(
  "csda_specops_diff",
  "Preview a version bump; --as-change derives a reviewable change.",
  "specops diff",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_specops_contribute"] = new GenericCliTool(
  "csda_specops_contribute",
  "Send a local change back upstream to the pack (never pushes).",
  "specops contribute",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_harness_run"] = new GenericCliTool(
  "csda_harness_run",
  "Run the plan → agent → verify → done loop for every pending requirement.",
  "harness run",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["csda_harness_prompt"] = new GenericCliTool(
  "csda_harness_prompt",
  "Print the prompt the harness would hand an agent for one REQ.",
  "harness prompt",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_harness_init"] = new GenericCliTool(
  "csda_harness_init",
  "Scaffold harness.config.yaml and the prompt prefix.",
  "harness init",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["csda_harness_report"] = new GenericCliTool(
  "csda_harness_report",
  "What the harness has cost: first-attempt rate, time per delivered requirement.",
  "harness report",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_config_init"] = new GenericCliTool(
  "csda_config_init",
  "Run specgate config init",
  "config init",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_config_set"] = new GenericCliTool(
  "csda_config_set",
  "Run specgate config set",
  "config set",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_config_get"] = new GenericCliTool(
  "csda_config_get",
  "Run specgate config get",
  "config get",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_config_list"] = new GenericCliTool(
  "csda_config_list",
  "Run specgate config list",
  "config list",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_agents_init"] = new GenericCliTool(
  "csda_agents_init",
  "Wire the loop into Claude, Cursor, Copilot, Aider and more.",
  "agents init",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_update"] = new GenericCliTool(
  "csda_update",
  "Refresh generated agent files after a CLI upgrade, keeping your edits.",
  "update",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  true
);
TOOLS["csda_schema_which"] = new GenericCliTool(
  "csda_schema_which",
  "Run specgate schema which",
  "schema which",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_schema_init"] = new GenericCliTool(
  "csda_schema_init",
  "Run specgate schema init",
  "schema init",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_schema_fork"] = new GenericCliTool(
  "csda_schema_fork",
  "Run specgate schema fork",
  "schema fork",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_schema_validate"] = new GenericCliTool(
  "csda_schema_validate",
  "Run specgate schema validate",
  "schema validate",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_completion_bash"] = new GenericCliTool(
  "csda_completion_bash",
  "Run specgate completion bash",
  "completion bash",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_completion_zsh"] = new GenericCliTool(
  "csda_completion_zsh",
  "Run specgate completion zsh",
  "completion zsh",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_completion_fish"] = new GenericCliTool(
  "csda_completion_fish",
  "Run specgate completion fish",
  "completion fish",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);
TOOLS["csda_studio"] = new GenericCliTool(
  "csda_studio",
  "Serve a local, read-only HTML view of the spec tree (--json for agents).",
  "studio",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" },
    },
    required: ["projectDir"],
  },
  "flag",
  false
);

// ── The published seven ──────────────────────────────────────────────────────

TOOLS["read_spec"] = new ReadSpecTool();
TOOLS["list_requirements"] = new ListRequirementsTool();
TOOLS["update_traceability"] = new UpdateTraceabilityTool();

// Aliases: the documented name and the generated id are the same tool.
for (const [published, generated] of [
  ["lint_pack", "csda_pack_lint"],
  ["validate_project", "csda_validate"],
  ["plan", "csda_plan"],
  ["mark_requirement_done", "csda_done"],
] as const) {
  if (TOOLS[generated]) TOOLS[published] = TOOLS[generated];
}

export const readSpec = (args: any) => TOOLS["read_spec"].handler(args);
export const listRequirements = (args: any) => TOOLS["list_requirements"].handler(args);
export const updateTraceability = (args: any) => TOOLS["update_traceability"].handler(args);
export const lintPack = (args: any) => TOOLS["lint_pack"].handler(args);
export const validateProject = (args: any) => TOOLS["validate_project"].handler(args);
export const plan = (args: any) => TOOLS["plan"].handler(args);
export const markRequirementDone = (args: any) => TOOLS["mark_requirement_done"].handler(args);
