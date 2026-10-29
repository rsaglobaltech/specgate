/**
 * A workspace: the repositories of one product, named in one file (ADR-0041).
 *
 * Specgate's gate is a repository's. A product made of services, a web app and
 * a contracts repository needs a place that knows them all: which repositories
 * there are, which requirement of one another depends on, and which business
 * story is split into a change in each. That place is a workspace repository
 * holding `specgate.workspace.yaml`. Inside a member, `REQ-012` stays the id;
 * across the workspace it is `fleet:REQ-012`.
 *
 * Pure domain: parsing and the id grammar. Reading the members is
 * `scripts/lib/workspace.ts`.
 */

import { parseYamlLite } from "./YamlLite";

export const WORKSPACE_FILE = "specgate.workspace.yaml";

/** Where a workspace keeps its business stories. */
export const STORIES_DIR = "docs/stories";

/** What a member is to the product. `contracts` holds the APIs others depend on. */
export const WORKSPACE_ROLES = ["service", "web", "library", "contracts"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export interface WorkspaceRepo {
  /** The name ids are qualified with: `fleet` in `fleet:REQ-012`. */
  name: string;
  /** The member's folder, relative to the workspace repository. */
  path: string;
  url?: string;
  role: WorkspaceRole;
  capabilities: string[];
}

export interface WorkspaceConfig {
  name: string;
  repos: WorkspaceRepo[];
}

/** A member name: what a qualified id can carry before its colon. */
export const REPO_NAME = /^[a-z][a-z0-9-]*$/;

/** `fleet:REQ-012` anywhere in a text. */
const QUALIFIED_ID = /(?<![\w./-])([a-z][a-z0-9-]*):(REQ-\d+)\b/g;

export interface QualifiedRef {
  repo: string;
  id: string;
  line: number;
}

/** Every qualified id a text mentions, with its line (1-based). */
export function qualifiedRefs(text: string): QualifiedRef[] {
  const out: QualifiedRef[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const m of line.matchAll(QUALIFIED_ID)) out.push({ repo: m[1], id: m[2], line: i + 1 });
  });
  return out;
}

/**
 * `contracts:REQ-003` as a `depends=` entry reads it, upper-cased by
 * `splitDependencies`: the repository and the id, or null for a plain id.
 */
export function splitQualified(dep: string): { repo: string; id: string } | null {
  const m = /^([A-Za-z][A-Za-z0-9-]*):(REQ-\d+)$/i.exec(dep.trim());
  return m ? { repo: m[1].toLowerCase(), id: m[2].toUpperCase() } : null;
}

export interface WorkspaceRead {
  config: WorkspaceConfig | null;
  problems: string[];
}

/** The workspace file, checked: every member named once, with a path and a known role. */
export function readWorkspace(text: string): WorkspaceRead {
  const problems: string[] = [];
  let doc: Record<string, unknown>;
  try {
    doc = parseYamlLite(text) || {};
  } catch (e) {
    return {
      config: null,
      problems: [`${WORKSPACE_FILE} does not parse: ${(e as Error).message}`],
    };
  }
  const version = doc.workspace_version;
  if (version !== 1 && version !== "1") {
    problems.push(`${WORKSPACE_FILE} needs workspace_version: 1.`);
  }
  const name = String(doc.name || "").trim();
  if (!name) problems.push(`${WORKSPACE_FILE} needs a name.`);
  const rawRepos = Array.isArray(doc.repos) ? doc.repos : [];
  if (rawRepos.length === 0) problems.push(`${WORKSPACE_FILE} lists no repos.`);
  const repos: WorkspaceRepo[] = [];
  const seen = new Set<string>();
  for (const raw of rawRepos as Array<Record<string, unknown>>) {
    const repoName = String((raw && raw.name) || "").trim();
    if (!REPO_NAME.test(repoName)) {
      problems.push(
        `A repo is named "${repoName}": a name is lower-case letters, digits and dashes, as in fleet.`
      );
      continue;
    }
    if (seen.has(repoName)) {
      problems.push(`The repo ${repoName} is listed twice.`);
      continue;
    }
    seen.add(repoName);
    const repoPath = String(raw.path || "").trim();
    if (!repoPath) problems.push(`The repo ${repoName} has no path.`);
    const role = String(raw.role || "service").trim() as WorkspaceRole;
    if (!WORKSPACE_ROLES.includes(role)) {
      problems.push(
        `The repo ${repoName} has the role ${role}: a role is ${WORKSPACE_ROLES.join(", ")}.`
      );
    }
    const caps = raw.capabilities;
    repos.push({
      name: repoName,
      path: repoPath,
      ...(raw.url ? { url: String(raw.url) } : {}),
      role,
      capabilities: Array.isArray(caps) ? caps.map(String) : caps ? [String(caps)] : [],
    });
  }
  return { config: problems.length ? null : { name, repos }, problems };
}

/** The workspace file as `workspace init` writes it. */
export function renderWorkspace(config: WorkspaceConfig): string {
  const lines = [
    "# The repositories of one product (ADR-0041). Across them a requirement is",
    "# <repo>:REQ-NNN; inside a repository REQ-NNN stays its id.",
    "workspace_version: 1",
    `name: ${config.name}`,
    "repos:",
  ];
  for (const r of config.repos) {
    lines.push(`  - name: ${r.name}`, `    path: ${r.path}`);
    if (r.url) lines.push(`    url: ${r.url}`);
    lines.push(`    role: ${r.role}`);
    lines.push(`    capabilities: [${r.capabilities.join(", ")}]`);
  }
  return lines.join("\n") + "\n";
}

/** A story's sub-change in one member, and where it stands. */
export interface SubChange {
  repo: string;
  change: string;
}

export interface Story {
  id: string;
  title: string;
  subchanges: SubChange[];
}

/** `story.yaml` of a workspace story. */
export function readStory(text: string): Story | null {
  let doc: Record<string, unknown>;
  try {
    doc = parseYamlLite(text) || {};
  } catch {
    return null;
  }
  const id = String(doc.story || "").trim();
  if (!id) return null;
  const subs = Array.isArray(doc.subchanges) ? doc.subchanges : [];
  return {
    id,
    title: String(doc.title || id),
    subchanges: (subs as Array<Record<string, unknown>>)
      .map((s) => ({ repo: String(s.repo || ""), change: String(s.change || id) }))
      .filter((s) => s.repo),
  };
}

export function renderStory(story: Story): string {
  const lines = ["story_version: 1", `story: ${story.id}`, `title: ${story.title}`, "subchanges:"];
  for (const s of story.subchanges) lines.push(`  - repo: ${s.repo}`, `    change: ${s.change}`);
  return lines.join("\n") + "\n";
}
