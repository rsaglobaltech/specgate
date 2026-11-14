/**
 * The loop as Agent Skills (REQ-549, REQ-550).
 *
 * `agents init` writes a slash command per tool, in each tool's own format, so
 * every new tool used to need code here. The open Agent Skills format — a
 * folder holding a `SKILL.md` whose front matter names it and says when to use
 * it — is one format several tools scan: `.agents/skills/` is read by Codex and
 * OpenCode, and Claude Code, Cursor and Gemini CLI each have a skills folder of
 * their own. One renderer, the same `STEPS` as every other target.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { STEPS, type AgentStep } from "./commands";
import { warning, type Diagnostic } from "../lib/diagnostics";

/** Where every tool that reads the shared folder finds the skills. */
export const SHARED_SKILLS_DIR = path.join(".agents", "skills");

/** A tool's own skills folder, for the tools that have one. */
export const TOOL_SKILL_DIRS: Readonly<Record<string, string>> = Object.freeze({
  claude: path.join(".claude", "skills"),
  cursor: path.join(".cursor", "skills"),
  gemini: path.join(".gemini", "skills"),
});

/** `specgate-apply`: the namespace and the step, as a folder name a skill may have. */
export function skillName(step: AgentStep): string {
  return `specgate-${step.name}`;
}

/** A front-matter value on one line, quoted so a colon in it cannot end it. */
const yamlLine = (v: string) => JSON.stringify(v.replace(/\s+/g, " ").trim());

/**
 * One step as a `SKILL.md`: the front matter is what an agent reads to decide
 * whether to load the skill, so the description says when, not only what.
 */
export function skillBody(step: AgentStep): string {
  return [
    "---",
    `name: ${skillName(step)}`,
    `description: ${yamlLine(`${step.summary} Use when: ${step.when}`)}`,
    "---",
    "",
    `# ${skillName(step)}`,
    "",
    step.summary,
    "",
    `**Use when:** ${step.when}`,
    "",
    "## Run",
    "",
    "```bash",
    ...step.run,
    "```",
    "",
    "## Guidance",
    "",
    ...step.guidance.map((g) => `- ${g}`),
    "",
    "> The authoritative rules come from `specgate change instructions <artifact> --json`.",
    "> If this file and the engine disagree, the engine is right — say so and continue.",
    "",
  ].join("\n");
}

export interface SkillFile {
  path: string;
  contents: string;
}

/** Every step's `SKILL.md` under one skills folder. */
export function skillFiles(dir: string): SkillFile[] {
  return STEPS.map((s) => ({
    path: path.join(dir, skillName(s), "SKILL.md"),
    contents: skillBody(s),
  }));
}

/**
 * The skills folders to write: the shared one always, plus each named tool's
 * own — or, with no tool named, each tool whose folder (`.claude/`, …) the
 * project already has.
 */
export function skillDirsFor(projectDir: string, named: string[] | null): string[] {
  const tools = named
    ? named.filter((t) => TOOL_SKILL_DIRS[t])
    : Object.keys(TOOL_SKILL_DIRS).filter((t) =>
        fs.existsSync(path.join(projectDir, TOOL_SKILL_DIRS[t].split(path.sep)[0]))
      );
  return [SHARED_SKILLS_DIR, ...tools.map((t) => TOOL_SKILL_DIRS[t])];
}

/**
 * Write the skills. A `SKILL.md` that differs from what this version renders
 * was changed by hand (or by another version): its folder is kept as it is and
 * said, as `skill_kept`, unless `force`. Rewriting a person's skill silently is
 * the one thing a generator must not do.
 */
export function writeSkills(
  projectDir: string,
  dirs: string[],
  opts: { force?: boolean; dryRun?: boolean } = {}
): { written: string[]; unchanged: string[]; kept: string[]; diagnostics: Diagnostic[] } {
  const written: string[] = [];
  const unchanged: string[] = [];
  const kept: string[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const dir of dirs) {
    for (const file of skillFiles(dir)) {
      const rel = file.path.split(path.sep).join("/");
      const target = path.join(projectDir, file.path);
      const now = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
      if (now === file.contents) {
        unchanged.push(rel);
        continue;
      }
      if (now !== null && !opts.force) {
        kept.push(rel);
        diagnostics.push(
          warning("skill_kept", `${rel} was changed by hand — its folder is left as it is.`, {
            file: rel,
            fix: "Pass --force to replace it, or merge the generated skill by hand.",
          })
        );
        continue;
      }
      if (!opts.dryRun) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.contents, "utf8");
      }
      written.push(rel);
    }
  }
  return { written, unchanged, kept, diagnostics };
}

// ── REQ-550: the plugin's manifests ─────────────────────────────────────────

/** What every manifest says about the plugin. */
export interface PluginIdentity {
  name: string;
  displayName: string;
  description: string;
  version: string;
  license: string;
  keywords: string[];
  homepage: string;
}

/** The skills folders inside the plugin, as the manifests list them. */
export function pluginSkillPaths(): string[] {
  return STEPS.map((s) => `skills/${skillName(s)}`);
}

/**
 * The manifests besides Claude Code's: the open Agent Plugins `plugin.json` at
 * the root, and Tessl's `.tessl-plugin/plugin.json`. Generated from the same
 * identity — and so from `package.json`'s version — so they cannot drift.
 */
export function pluginManifests(id: PluginIdentity): SkillFile[] {
  const skills = pluginSkillPaths();
  const common = {
    name: id.name,
    version: id.version,
    description: id.description,
    license: id.license,
    homepage: id.homepage,
    keywords: id.keywords,
    skills,
  };
  return [
    { path: "plugin.json", contents: JSON.stringify(common, null, 2) + "\n" },
    {
      path: path.join(".tessl-plugin", "plugin.json"),
      contents: JSON.stringify({ ...common, displayName: id.displayName }, null, 2) + "\n",
    },
  ];
}
