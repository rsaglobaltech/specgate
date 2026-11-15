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
  repository: string;
  author: { name: string; url: string };
}

/** The skills folders inside the plugin, every one under `skills/`. */
export function pluginSkillPaths(): string[] {
  return STEPS.map((s) => `skills/${skillName(s)}`);
}

/** The Agent Plugins version the root manifest targets. */
export const AGENT_PLUGINS_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";

/** The keys the Agent Plugins 1.0.0 schema defines; it admits no other. */
export const AGENT_PLUGINS_KEYS = [
  "$schema",
  "name",
  "version",
  "description",
  "author",
  "homepage",
  "repository",
  "license",
  "keywords",
  "extensions",
];

/** The Tessl workspace the plugin is published under: `<workspace>/<plugin>`. */
export const TESSL_WORKSPACE = "rsaglobaltech";

/**
 * The manifests besides Claude Code's, each to its own format (REQ-550):
 *
 * - the open Agent Plugins `plugin.json` at the root, to the 1.0.0 schema —
 *   `$schema` and `name` required, no key the schema does not define, so no
 *   skill list: an Agent Plugins host finds the skills in `skills/`;
 * - Tessl's `.tessl-plugin/plugin.json` — `name` as `<workspace>/<plugin>`,
 *   `version` and `description` required, `skills` and `mcpServers` as paths.
 *
 * Generated from the same identity — and so from `package.json`'s version — so
 * they cannot drift.
 */
export function pluginManifests(id: PluginIdentity): SkillFile[] {
  const agentPlugins = {
    $schema: AGENT_PLUGINS_SCHEMA,
    name: id.name,
    version: id.version,
    description: id.description,
    author: id.author,
    homepage: id.homepage,
    repository: id.repository,
    license: id.license,
    keywords: id.keywords,
  };
  const tessl = {
    name: `${TESSL_WORKSPACE}/${id.name}`,
    version: id.version,
    description: id.description,
    author: id.author,
    homepage: id.homepage,
    repository: id.repository,
    license: id.license,
    skills: "./skills/",
    mcpServers: ".mcp.json",
  };
  return [
    { path: "plugin.json", contents: JSON.stringify(agentPlugins, null, 2) + "\n" },
    {
      path: path.join(".tessl-plugin", "plugin.json"),
      contents: JSON.stringify(tessl, null, 2) + "\n",
    },
  ];
}

/** The Agent Plugins 1.0.0 name: lower-case letters, digits, dots and hyphens. */
const AGENT_PLUGINS_NAME = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

/**
 * What an Agent Plugins 1.0.0 host would refuse in a root `plugin.json`: the
 * rules its schema publishes. Empty when the manifest is valid.
 */
export function agentPluginsFindings(m: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (m.$schema !== AGENT_PLUGINS_SCHEMA) out.push(`$schema must be ${AGENT_PLUGINS_SCHEMA}`);
  const name = typeof m.name === "string" ? m.name : "";
  if (!name || name.length > 64 || !AGENT_PLUGINS_NAME.test(name)) {
    out.push(`name "${String(m.name)}" is not an Agent Plugins name`);
  }
  for (const k of Object.keys(m)) {
    if (!AGENT_PLUGINS_KEYS.includes(k))
      out.push(`${k}: a key the Agent Plugins schema does not define`);
  }
  for (const k of ["version", "description", "homepage", "repository", "license"]) {
    if (k in m && typeof m[k] !== "string") out.push(`${k} must be a string`);
  }
  if (
    "keywords" in m &&
    !(Array.isArray(m.keywords) && m.keywords.every((x) => typeof x === "string"))
  ) {
    out.push("keywords must be an array of strings");
  }
  if ("author" in m) {
    const a = m.author as Record<string, unknown> | null;
    if (!a || typeof a !== "object" || Array.isArray(a)) out.push("author must be an object");
    else {
      for (const k of Object.keys(a)) {
        if (!["name", "email", "url"].includes(k) || typeof a[k] !== "string") {
          out.push(`author.${k}: not a string name, email or url`);
        }
      }
    }
  }
  return out;
}

/**
 * What Tessl would refuse in `.tessl-plugin/plugin.json`, checked against the
 * plugin folder its paths resolve in. Empty when the manifest is valid.
 */
export function tesslFindings(m: Record<string, unknown>, pluginDir: string): string[] {
  const out: string[] = [];
  if (typeof m.name !== "string" || !/^[a-z0-9][\w.-]*\/[a-z0-9][\w.-]*$/.test(m.name)) {
    out.push(`name "${String(m.name)}": a Tessl name is <workspace>/<plugin>`);
  }
  if (typeof m.version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(m.version)) {
    out.push(`version "${String(m.version)}" is not a semantic version`);
  }
  if (typeof m.description !== "string" || !m.description.trim())
    out.push("description is required");
  const paths = (v: unknown) => (Array.isArray(v) ? v : [v]).map(String);
  if ("skills" in m) {
    for (const p of paths(m.skills)) {
      const dir = path.join(pluginDir, p);
      const skills = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
      if (!skills.some((s) => fs.existsSync(path.join(dir, s, "SKILL.md")))) {
        out.push(`skills: ${p} holds no <skill>/SKILL.md`);
      }
    }
  }
  if ("mcpServers" in m) {
    if (m.mcpServers !== ".mcp.json" && m.mcpServers !== "./.mcp.json") {
      out.push(`mcpServers must point at .mcp.json, not hold the servers`);
    } else {
      const file = path.join(pluginDir, ".mcp.json");
      const servers = fs.existsSync(file)
        ? ((JSON.parse(fs.readFileSync(file, "utf8")).mcpServers || {}) as Record<
            string,
            { type?: string }
          >)
        : {};
      for (const [k, v] of Object.entries(servers)) {
        if (v.type !== "stdio" && v.type !== "http")
          out.push(`.mcp.json: ${k} states no type (stdio or http)`);
      }
    }
  }
  for (const k of ["displayName", "keywords"]) {
    if (k in m) out.push(`${k}: not a Tessl manifest field`);
  }
  return out;
}
