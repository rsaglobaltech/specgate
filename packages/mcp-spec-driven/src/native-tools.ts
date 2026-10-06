/**
 * The three MCP tools that are not a CLI command behind a shell.
 *
 * Everything else in `tools.ts` is generated from `scripts/lib/surface.ts` — one
 * definition, one tool per command. These three are not: `read_spec` and
 * `list_requirements` read files the CLI has no read-only command for, and
 * `update_traceability` appends a matrix row. #138 replaced the hand-written
 * registry with the generated one and dropped them, which broke every agent
 * configured against the published seven-tool surface and left this package's
 * own tests red. An MCP tool id lives in someone else's agent config, so it is
 * removed on purpose or not at all.
 *
 * They live here rather than in `tools.ts` because that file is regenerated:
 * anything hand-written inside it is deleted the next time the generator runs.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface ITool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly csda?: string;
  handler(args: Record<string, unknown>): unknown;
}

/**
 * The change cycle is the reviewable way to edit a specification (C10-04).
 *
 * `docs/specs/changes/<id>/` is an open change; `archive/` is not one. Read
 * from disk on every call rather than cached, because the agent may have opened
 * the change through the CLI in another terminal.
 */
export function hasOpenChange(projectDir: string): boolean {
  const dir = path.join(projectDir, "docs", "specs", "changes");
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .some((e) => e.isDirectory() && e.name !== "archive");
  } catch {
    return false;
  }
}

/**
 * An escape hatch that has to be written down, never passed by the caller.
 *
 * If the agent could send `allowContractEdits: true` with the call, the guard
 * would protect nothing — it would be one more sentence for the agent to
 * ignore, which is what this guard exists to replace. A person puts this in
 * `.csda/config.json`, and it is visible in the repository afterwards.
 */
export function contractEditsAllowed(projectDir: string): boolean {
  try {
    const raw = fs.readFileSync(path.join(projectDir, ".csda", "config.json"), "utf8");
    return JSON.parse(raw).mcpAllowContractEdits === true;
  } catch {
    return false;
  }
}

/** Refuse a contract-editing call outside the change cycle. */
export function assertContractEditable(toolName: string, projectDir: string): void {
  if (hasOpenChange(projectDir) || contractEditsAllowed(projectDir)) return;
  throw new Error(
    toolName +
      " writes files the specification contract protects, and no change is open." +
      " Open one first: specgate change new <id>." +
      ' To allow it permanently, set "mcpAllowContractEdits": true in .csda/config.json.'
  );
}

class ProjectHelper {
  public static ensureProjectDir(projectDir: unknown): string {
    if (!projectDir || typeof projectDir !== "string") {
      throw new Error("projectDir is required (absolute path to a spec-driven project)");
    }
    if (!fs.existsSync(projectDir)) {
      throw new Error(`projectDir does not exist: ${projectDir}`);
    }
    const specFile = path.join(projectDir, "spec.md");
    if (!fs.existsSync(specFile)) {
      throw new Error(`Not a spec-driven project (no spec.md): ${projectDir}`);
    }
    return projectDir;
  }
}

export class ReadSpecTool implements ITool {
  public readonly name = "read_spec";
  public readonly description =
    "Read the spec.md file (and list other spec markdown) of a spec-driven project.";
  public readonly inputSchema = {
    type: "object",
    properties: {
      projectDir: {
        type: "string",
        description: "Absolute path to the spec-driven project root.",
      },
    },
    required: ["projectDir"],
  };

  public handler(args: Record<string, unknown>): { specMd: string; files: string[] } {
    const dir = ProjectHelper.ensureProjectDir(args.projectDir);
    const specMd = fs.readFileSync(path.join(dir, "spec.md"), "utf8");

    const docsSpecsDir = path.join(dir, "docs", "specs");
    const files: string[] = [];
    if (fs.existsSync(docsSpecsDir)) {
      for (const entry of fs.readdirSync(docsSpecsDir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          files.push(path.join("docs/specs", entry.name));
        }
      }
    }

    return { specMd, files: files.sort() };
  }
}

export class ListRequirementsTool implements ITool {
  public readonly name = "list_requirements";
  public readonly description =
    "List every REQ-NNN in the project with its title, source file, and line number.";
  public readonly inputSchema = {
    type: "object",
    properties: {
      projectDir: {
        type: "string",
        description: "Absolute path to the spec-driven project root.",
      },
    },
    required: ["projectDir"],
  };

  private static REQ_LINE = /\bREQ-(\d{3,})\b/g;
  private static REQ_HEADING = /^(##+)\s*(REQ-\d{3,})\b\s*[:\-—]?\s*(.*)$/m;

  public handler(args: Record<string, unknown>) {
    const dir = ProjectHelper.ensureProjectDir(args.projectDir);
    const sources = [
      { file: "spec.md", path: path.join(dir, "spec.md") },
      { file: "docs/specs/traceability.md", path: path.join(dir, "docs/specs/traceability.md") },
    ];

    const requirements = new Map<
      string,
      { id: string; title: string; file: string; line: number }
    >();
    for (const source of sources) {
      if (!fs.existsSync(source.path)) continue;
      const lines = fs.readFileSync(source.path, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        ListRequirementsTool.REQ_LINE.lastIndex = 0;
        let match;
        while ((match = ListRequirementsTool.REQ_LINE.exec(line)) !== null) {
          const id = `REQ-${match[1]}`;
          if (!requirements.has(id)) {
            let title = "";
            const headingMatch = line.match(ListRequirementsTool.REQ_HEADING);
            if (headingMatch && headingMatch[2] === id) {
              title = (headingMatch[3] || "").trim();
            } else {
              const idx = line.indexOf(id);
              title = line
                .slice(idx + id.length)
                .replace(/^[\s:\-—|]+/, "")
                .replace(/\|.*$/, "")
                .trim();
            }
            requirements.set(id, { id, title, file: source.file, line: i });
          }
        }
      }
    }

    return {
      requirements: Array.from(requirements.values()).sort((a, b) => a.id.localeCompare(b.id)),
    };
  }
}

export class UpdateTraceabilityTool implements ITool {
  public readonly name = "update_traceability";
  public readonly description = "Append a row to the traceability matrix. Idempotent.";
  public readonly inputSchema = {
    type: "object",
    properties: {
      projectDir: { type: "string" },
      requirement: { type: "string", description: "e.g. REQ-001" },
      scenario: { type: "string", description: "e.g. SCN-005 (optional)" },
      feature: {
        type: "string",
        description: "Path to the .feature file (relative to project root)",
      },
      status: { type: "string", enum: ["Draft", "Approved", "Implemented", "Verified"] },
    },
    required: ["projectDir", "requirement", "feature", "status"],
  };

  public handler(args: Record<string, unknown>) {
    const dir = ProjectHelper.ensureProjectDir(args.projectDir);
    // Deliberately *not* behind `assertContractEditable`, and the reason is the
    // same one `WriteScope` gives for exempting new files: this tool appends a
    // row and returns `{ updated: false }` when a matching one already exists.
    // It cannot loosen a term of the contract, only add one — and a requirement
    // in `NEEDS_FEATURE` is supposed to get its row. `req link`, which rewrites
    // an existing row, is guarded.
    const tracePath = path.join(dir, "docs/specs/traceability.md");
    if (!fs.existsSync(tracePath)) {
      throw new Error("docs/specs/traceability.md not found in this project");
    }

    const required = ["requirement", "feature", "status"];
    for (const k of required) {
      if (!args[k]) throw new Error(`Missing argument: ${k}`);
    }

    const content = fs.readFileSync(tracePath, "utf8");
    // A generated matrix is rebuilt from spec.md and the feature tags; a row
    // appended here would vanish on the next regeneration.
    if (content.includes("<!-- specgate:derived")) {
      throw new Error(
        "docs/specs/traceability.md is generated. Add the requirement with `specgate new`, " +
          "or tag its scenario @REQ-NNN @SCN-NNN, then run `specgate matrix`."
      );
    }
    const tag = `${args.requirement}.*${args.feature}`;
    if (new RegExp(tag).test(content)) {
      return { updated: false, rowsAdded: 0 };
    }

    const isRich = content.includes(
      "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |"
    );
    const row = isRich
      ? `| ${args.requirement} | ${args.scenario || "TBD"} | \`${args.feature}\` | TBD | TBD | TBD | TBD | TBD | TBD | ${args.status} |`
      : `| \`${args.feature}\` | ${args.requirement} | ${args.scenario || "TBD"} | ${args.status} |`;

    fs.appendFileSync(tracePath, `\n${row}\n`, "utf8");
    return { updated: true, rowsAdded: 1 };
  }
}
