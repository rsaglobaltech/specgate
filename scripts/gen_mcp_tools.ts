import * as fs from "node:fs";
import * as path from "node:path";
import { SURFACE, mcpTools } from "./lib/surface";

/**
 * Resolve the repository root rather than walking up from `__dirname`.
 *
 * Compiled, this file runs from `dist/scripts/`, so `../packages/...` resolved
 * to `dist/packages/mcp-spec-driven/src/tools.ts` — build output. The generator
 * reported success on every run and never once wrote the file it is for, which
 * is why the committed registry drifted from the surface it is generated from.
 */
function repoRoot() {
  let dir = __dirname;
  for (;;) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("package.json not found above " + __dirname);
    dir = parent;
  }
}

const OUT_FILE = path.join(repoRoot(), "packages/mcp-spec-driven/src/tools.ts");
const toolsMap = mcpTools() as Record<string, string>;

// Convert toolsMap { toolName: "command name" } back into lookup by "command name"
const cmdToTool = Object.entries(toolsMap).reduce(
  (acc, [tool, cmd]) => {
    acc[cmd] = tool;
    return acc;
  },
  {} as Record<string, string>
);

let out = `// GENERATED FILE - DO NOT EDIT BY HAND
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
   * shell out and came back \`{ exitCode: 1, raw: "" }\` — a failure with no
   * reason in it, which is exactly the shape ADR-0017 exists to prevent.
   */
  public static ensureProjectDir(projectDir: unknown): string {
    if (!projectDir || typeof projectDir !== "string") {
      throw new Error("projectDir is required (absolute path to a spec-driven project)");
    }
    if (!fs.existsSync(projectDir)) {
      throw new Error(\`projectDir does not exist: \${projectDir}\`);
    }
    // A Specgate project has spec.md; an OpenSpec one has openspec/, and
    // \`specgate_verify\` exists for it (ADR-0030). Requiring spec.md refused
    // every OpenSpec project the tool was built for.
    if (
      !fs.existsSync(path.join(projectDir, "spec.md")) &&
      !fs.existsSync(path.join(projectDir, "openspec"))
    ) {
      throw new Error(\`Not a Specgate or OpenSpec project (no spec.md, no openspec/): \${projectDir}\`);
    }
    return projectDir;
  }
}

class CliInvoker {
  /**
   * Split a command line, honouring quotes.
   *
   * \`bin.split(" ")\` was the whole parser after #138, so any interpreter path
   * with a space in it — \`"/Users/me/My Tools/node" "…/cli.js"\` — was torn into
   * fragments and the spawn failed with no output.
   */
  private static parseCliCommand(cliPath: string | undefined): string[] {
    const raw = (cliPath || process.env.SPECGATE_CLI || "npx @rsaglobaltech/specgate").trim();
    const tokens: string[] = [];
    const re = /"([^"]*)"|'([^']*)'|(\\S+)/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      tokens.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
    }
    return tokens;
  }

  public static spawnCli(cliPath: string | undefined, args: string[]) {
    const cmd = CliInvoker.parseCliCommand(cliPath);
    const useShell = process.platform === "win32";
    const quote = (v: string) => (useShell && /\\s/.test(v) ? \`"\${v}"\` : v);
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
     * How this command takes the project directory. \`validate\` takes it as a
     * positional \`<dir>\` and rejects \`--project-dir\` outright, so the flag form
     * made \`validate_project\` — the most used tool of the seven — fail with
     * "Unknown flag(s)" and an empty payload over MCP. The surface already
     * records which is which in \`json.args\`; this reads it instead of assuming.
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
    const combined = (result.stdout || "") + "\\n" + (result.stderr || "");
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

`;

for (const command of SURFACE) {
  const processCmd = (cmdDef: any, subDef: any) => {
    const cmdString = subDef ? `${cmdDef.name} ${subDef.name}` : cmdDef.name;
    const toolName = cmdToTool[cmdString];
    if (!toolName) return; // skipped via mcp: false

    const summary =
      (subDef ? subDef.help?.summary : cmdDef.help?.summary) || `Run specgate ${cmdString}`;

    // `json.args: "<dir>"` is the surface saying this command takes the project
    // directory positionally rather than behind `--project-dir`.
    const jsonDef = subDef ? subDef.json : cmdDef.json;
    const dirStyle =
      jsonDef && (jsonDef.args === "<dir>" || jsonDef.args === "[dir]") ? "positional" : "flag";
    // The one positional a command takes besides the directory — `new`'s title,
    // `done`'s requirement — declared in the schema. It used to be passed when
    // an agent happened to send it and named nowhere, so no agent knew to.
    const positional = jsonDef && /^<(\w+)>$/.exec(jsonDef.args || "");
    const declared = subDef ? subDef.mcpArg : cmdDef.mcpArg;
    const argName = declared
      ? declared
      : positional && positional[1] !== "dir"
        ? positional[1] === "REQ"
          ? "requirement"
          : positional[1].toLowerCase()
        : null;
    const argProp = argName
      ? `,\n      ${argName}: { type: "string", description: ${JSON.stringify(`The <${argName}> argument of \`specgate ${cmdString}\`.`)} }`
      : "";
    const required = argName ? `["projectDir", "${argName}"]` : `["projectDir"]`;
    // `change *` is how a specification is edited on purpose; refusing it would
    // leave no way to open the change the guard asks for.
    const editsContract = Boolean(
      (subDef ? subDef.editsContract : cmdDef.editsContract) && cmdDef.name !== "change"
    );

    out += `TOOLS["${toolName}"] = new GenericCliTool(
  "${toolName}",
  ${JSON.stringify(summary)},
  "${cmdString}",
  {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      cliPath: { type: "string" }${argProp}
    },
    required: ${required}
  },
  "${dirStyle}",
  ${editsContract}
);\n`;
  };

  if (command.subcommands) {
    for (const sub of command.subcommands) {
      processCmd(command, sub);
    }
  } else {
    processCmd(command, null);
  }
}

// The three tools that are not a CLI command behind a shell, plus the published
// names of the four that are.
//
// #138 generated the whole registry from the command surface and, in doing so,
// deleted `read_spec`, `list_requirements` and `update_traceability` and renamed
// the other four to `csda_*` (now `specgate_*`). An MCP tool id lives in someone else's agent
// config: the seven published names have to keep resolving, so they are
// registered here as well as the generated ids. Both spellings reach the same
// handler, and the tools that read files come from `native-tools.ts` — which is
// not generated, so this file can be regenerated without losing them.
out += `
// ── The published seven ──────────────────────────────────────────────────────

TOOLS["read_spec"] = new ReadSpecTool();
TOOLS["list_requirements"] = new ListRequirementsTool();
TOOLS["update_traceability"] = new UpdateTraceabilityTool();

// Aliases: the documented name and the generated id are the same tool.
for (const [published, generated] of [
  ["lint_pack", "specgate_pack_lint"],
  ["validate_project", "specgate_validate"],
  ["plan", "specgate_plan"],
  ["mark_requirement_done", "specgate_done"],
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
`;

fs.writeFileSync(OUT_FILE, out);
console.log("Generated tools.ts");
