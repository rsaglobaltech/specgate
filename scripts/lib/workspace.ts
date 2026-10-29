import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import {
  STORIES_DIR,
  WORKSPACE_FILE,
  qualifiedRefs,
  readStory,
  readWorkspace,
  splitQualified,
} from "../../packages/core/src/domain/Workspace";
import type {
  Story,
  WorkspaceConfig,
  WorkspaceRepo,
} from "../../packages/core/src/domain/Workspace";
import {
  listArchivedIds,
  listChangeIds,
  listDeltas,
} from "../../packages/core/src/infrastructure/ChangeWorkspace";
import { parseDelta } from "../../packages/core/src/domain/SpecParser";
import { readDeclaredDependencies } from "./requirement-graph";
import { DELIVERED, inFlightRequirements } from "./in-flight";
import { findCliRoot } from "./project-root";
import { error, warning } from "./diagnostics";
import type { Diagnostic } from "./diagnostics";

/**
 * The repositories of a workspace, read from disk (ADR-0041). Every member is
 * asked through the CLI itself — `status --json`, `check --json` — so the
 * workspace sees exactly what each repository's own gate sees.
 */

/** Where `workspace check` writes its last result, for `workspace status`. */
export const LAST_CHECK_FILE = ".specgate/workspace-check.json";

export interface LoadedWorkspace {
  dir: string;
  config: WorkspaceConfig;
  /** Each member's absolute folder, by name. */
  dirs: Record<string, string>;
}

export function workspaceFile(dir: string): string {
  return path.join(dir, WORKSPACE_FILE);
}

/** The workspace at `dir`, or the problems that keep it from being read. */
export function loadWorkspace(dir: string): { ws: LoadedWorkspace | null; problems: Diagnostic[] } {
  const file = workspaceFile(dir);
  if (!fs.existsSync(file)) {
    return {
      ws: null,
      problems: [
        error("workspace_missing", `${dir} has no ${WORKSPACE_FILE}.`, {
          fix: "specgate workspace init --repo fleet=../fleet --repo web=../web:web",
        }),
      ],
    };
  }
  const read = readWorkspace(fs.readFileSync(file, "utf8"));
  if (!read.config) {
    return {
      ws: null,
      problems: read.problems.map((p) =>
        error("workspace_invalid", p, { file: WORKSPACE_FILE, fix: "Correct the line it names." })
      ),
    };
  }
  const dirs: Record<string, string> = {};
  for (const r of read.config.repos) dirs[r.name] = path.resolve(dir, r.path);
  return { ws: { dir, config: read.config, dirs }, problems: [] };
}

const CLI = () => path.join(findCliRoot(__dirname), "bin", "specgate.js");

function cli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [CLI(), ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function json(text: string): Record<string, any> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function branchOf(dir: string): string | null {
  const r = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dir, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** A member's requirements: every id `status` knows, and how many are done. */
export interface MemberRequirements {
  total: number;
  done: number;
  pending: number;
  ids: string[];
}

export function memberRequirements(dir: string): MemberRequirements | null {
  const r = cli(["status", "--json", "--project-dir", dir]);
  const doc = json(r.stdout);
  if (!doc || !Array.isArray(doc.requirements)) return null;
  const ids = doc.requirements.map((q: { id: string }) => String(q.id).toUpperCase());
  const total = Number(doc.total ?? ids.length);
  const pending = Number(doc.pending ?? 0);
  return { total, pending, done: Math.max(0, total - pending), ids };
}

/**
 * The status each requirement of a member carries: the matrix's Status column,
 * then the open changes' deltas on top (what the gate judges in flight).
 */
export function memberStatuses(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const matrix = path.join(dir, "docs", "specs", "traceability.md");
  if (fs.existsSync(matrix)) {
    for (const line of fs.readFileSync(matrix, "utf8").split(/\r?\n/)) {
      const cells = line.split("|").map((c) => c.trim());
      if (!/^REQ-\d+$/.test(cells[1] || "")) continue;
      const status = cells[cells.length - 2] || "";
      out.set(cells[1], status.replace(/`/g, ""));
    }
  }
  for (const r of inFlightRequirements(dir)) out.set(r.id.toUpperCase(), r.status);
  return out;
}

/** `depends=` of a member, archived and in flight, by requirement. */
export function memberDependencies(dir: string): Record<string, string[]> {
  const declared: Record<string, string[]> = { ...readDeclaredDependencies(dir) };
  for (const change of listChangeIds(dir)) {
    for (const d of listDeltas(dir, change)) {
      let parsed: ReturnType<typeof parseDelta>;
      try {
        parsed = parseDelta(fs.readFileSync(d.file, "utf8"));
      } catch {
        continue;
      }
      for (const req of [...(parsed.added || []), ...(parsed.modified || [])]) {
        const raw = req.id && (req.trace || {}).depends;
        if (raw && req.id)
          declared[req.id.toUpperCase()] = String(raw)
            .split(/[,;\s]+/)
            .filter(Boolean);
      }
    }
  }
  return declared;
}

/** The files a member writes its requirements in: where a qualified id may appear. */
function specFiles(dir: string): string[] {
  const out: string[] = [];
  const add = (f: string) => fs.existsSync(f) && out.push(f);
  add(path.join(dir, "spec.md"));
  const caps = path.join(dir, "docs", "specs", "capabilities");
  if (fs.existsSync(caps)) {
    for (const e of fs.readdirSync(caps, { withFileTypes: true })) {
      if (e.isDirectory()) add(path.join(caps, e.name, "spec.md"));
    }
  }
  for (const change of listChangeIds(dir)) for (const d of listDeltas(dir, change)) add(d.file);
  return out;
}

/** The workspace's own stories, read from `docs/stories/<id>/story.yaml`. */
export function readStories(dir: string): Array<Story & { dir: string }> {
  const root = path.join(dir, STORIES_DIR);
  if (!fs.existsSync(root)) return [];
  const out: Array<Story & { dir: string }> = [];
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const file = path.join(root, e.name, "story.yaml");
    if (!fs.existsSync(file)) continue;
    const story = readStory(fs.readFileSync(file, "utf8"));
    if (story) out.push({ ...story, dir: path.join(root, e.name) });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export type SubChangeState = "open" | "archived" | "missing";

/** Where a story's sub-change stands in its member: open, archived, or not there. */
export function subChangeState(memberDir: string, change: string): SubChangeState {
  if (listChangeIds(memberDir).includes(change)) return "open";
  if (listArchivedIds(memberDir).some((a) => a === change || a.endsWith(`-${change}`)))
    return "archived";
  return "missing";
}

// ── The JSON model (ADR-0041) ────────────────────────────────────────────────

export interface RepoState {
  name: string;
  role: string;
  path: string;
  url: string | null;
  exists: boolean;
  branch: string | null;
  requirements: { total: number; done: number; pending: number } | null;
  gate: { state: "passed" | "failed" | "not run"; at: string | null };
}

export interface StoryState {
  id: string;
  title: string;
  done: boolean;
  subchanges: Array<{ repo: string; change: string; state: SubChangeState }>;
}

export interface WorkspaceModel {
  schemaVersion: 1;
  name: string;
  dir: string;
  repos: RepoState[];
  stories: StoryState[];
}

interface LastCheck {
  at: string;
  repos: Record<string, boolean>;
}

function lastCheck(dir: string): LastCheck | null {
  const file = path.join(dir, LAST_CHECK_FILE);
  if (!fs.existsSync(file)) return null;
  return json(fs.readFileSync(file, "utf8")) as LastCheck | null;
}

export function storyStates(ws: LoadedWorkspace): StoryState[] {
  return readStories(ws.dir).map((s) => {
    const subchanges = s.subchanges.map((sc) => ({
      repo: sc.repo,
      change: sc.change,
      state: (ws.dirs[sc.repo] && fs.existsSync(ws.dirs[sc.repo])
        ? subChangeState(ws.dirs[sc.repo], sc.change)
        : "missing") as SubChangeState,
    }));
    return {
      id: s.id,
      title: s.title,
      // REQ-297: done only when every repository archived its part.
      done: subchanges.length > 0 && subchanges.every((sc) => sc.state === "archived"),
      subchanges,
    };
  });
}

/** `workspace status`: each repository and each story, as one document. */
export function workspaceModel(ws: LoadedWorkspace): WorkspaceModel {
  const last = lastCheck(ws.dir);
  const repos = ws.config.repos.map((r: WorkspaceRepo): RepoState => {
    const dir = ws.dirs[r.name];
    const exists = fs.existsSync(dir);
    const req = exists ? memberRequirements(dir) : null;
    const ran = last && r.name in last.repos;
    return {
      name: r.name,
      role: r.role,
      path: r.path,
      url: r.url || null,
      exists,
      branch: exists ? branchOf(dir) : null,
      requirements: req ? { total: req.total, done: req.done, pending: req.pending } : null,
      gate: {
        state: ran ? (last!.repos[r.name] ? "passed" : "failed") : "not run",
        at: ran ? last!.at : null,
      },
    };
  });
  return {
    schemaVersion: 1,
    name: ws.config.name,
    dir: ws.dir,
    repos,
    stories: storyStates(ws),
  };
}

// ── workspace check ─────────────────────────────────────────────────────────

export interface CheckResult {
  ok: boolean;
  repos: Array<{ name: string; ok: boolean; problems: Diagnostic[] }>;
  problems: Diagnostic[];
}

/**
 * `workspace check`: each member's own gate, then what only the workspace can
 * judge — qualified ids that must exist (REQ-293) and cross-repository
 * dependencies that must be delivered (REQ-295).
 */
export function checkWorkspace(ws: LoadedWorkspace): CheckResult {
  const repos: CheckResult["repos"] = [];
  const problems: Diagnostic[] = [];
  const known = new Map<string, Set<string>>();
  const statuses = new Map<string, Map<string, string>>();

  for (const r of ws.config.repos) {
    const dir = ws.dirs[r.name];
    if (!fs.existsSync(dir)) {
      const p = error("workspace_repo_missing", `The repo ${r.name} is not at ${r.path}.`, {
        target: r.name,
        fix: r.url ? `git clone ${r.url} ${r.path}` : `Correct its path in ${WORKSPACE_FILE}.`,
      });
      repos.push({ name: r.name, ok: false, problems: [p] });
      continue;
    }
    const run = cli(["check", dir, "--json"]);
    const doc = json(run.stdout);
    const own: Diagnostic[] = Array.isArray(doc?.status)
      ? doc!.status.filter((d: Diagnostic) => d.severity === "error")
      : [];
    repos.push({ name: r.name, ok: run.status === 0, problems: own });
    known.set(r.name, new Set((memberRequirements(dir) || { ids: [] }).ids));
    statuses.set(r.name, memberStatuses(dir));
  }

  // REQ-293: a qualified id names a repo of the workspace and a requirement it has.
  const sources: Array<{ file: string; rel: string }> = [];
  for (const s of readStories(ws.dir)) {
    for (const f of fs.readdirSync(s.dir)) {
      if (f.endsWith(".md")) sources.push({ file: path.join(s.dir, f), rel: "" });
    }
  }
  for (const r of ws.config.repos) {
    if (!known.has(r.name)) continue;
    for (const f of specFiles(ws.dirs[r.name])) sources.push({ file: f, rel: r.name });
  }
  for (const { file, rel } of sources) {
    const shown = rel
      ? `${rel}/${path.relative(ws.dirs[rel], file).split(path.sep).join("/")}`
      : path.relative(ws.dir, file).split(path.sep).join("/");
    for (const ref of qualifiedRefs(fs.readFileSync(file, "utf8"))) {
      const ids = known.get(ref.repo);
      if (!ws.dirs[ref.repo]) {
        problems.push(
          error(
            "workspace_unknown_repo",
            `${shown}:${ref.line} names ${ref.repo}:${ref.id}, and ${ref.repo} is not a repo of this workspace.`,
            {
              file: shown,
              line: ref.line,
              fix: `Add ${ref.repo} to ${WORKSPACE_FILE}, or correct the repo name.`,
            }
          )
        );
      } else if (ids && !ids.has(ref.id)) {
        problems.push(
          error(
            "workspace_unknown_requirement",
            `${shown}:${ref.line} names ${ref.repo}:${ref.id}, which ${ref.repo} does not have.`,
            {
              file: shown,
              line: ref.line,
              fix: `Correct the id, or write ${ref.id} in ${ref.repo}.`,
            }
          )
        );
      }
    }
  }

  // REQ-295: a requirement that depends on another repo's waits for it.
  for (const r of ws.config.repos) {
    if (!known.has(r.name)) continue;
    for (const [req, deps] of Object.entries(memberDependencies(ws.dirs[r.name]))) {
      for (const dep of deps) {
        const q = splitQualified(dep);
        if (!q) continue;
        const theirs = statuses.get(q.repo);
        if (!theirs) {
          if (!ws.dirs[q.repo]) {
            problems.push(
              error(
                "workspace_unknown_repo",
                `${r.name}:${req} depends on ${q.repo}:${q.id}, and ${q.repo} is not a repo of this workspace.`,
                {
                  target: `${r.name}:${req}`,
                  fix: `Add ${q.repo} to ${WORKSPACE_FILE}, or correct depends= in ${req}.`,
                }
              )
            );
          }
          continue;
        }
        const status = theirs.get(q.id);
        if (status === undefined) {
          problems.push(
            error(
              "workspace_unknown_requirement",
              `${r.name}:${req} depends on ${q.repo}:${q.id}, which ${q.repo} does not have.`,
              {
                target: `${r.name}:${req}`,
                fix: `Correct depends= in ${req}, or write ${q.id} in ${q.repo}.`,
              }
            )
          );
        } else if (!DELIVERED.includes(status)) {
          problems.push(
            error(
              "workspace_dependency_pending",
              `${r.name}:${req} depends on ${q.repo}:${q.id}, which is ${status}, not delivered.`,
              {
                target: `${r.name}:${req}`,
                fix: `Deliver ${q.id} in ${q.repo} first (specgate harness run --req ${q.id} there).`,
              }
            )
          );
        }
      }
    }
  }

  const ok = repos.every((r) => r.ok) && problems.length === 0;
  return { ok, repos, problems };
}

export function recordCheck(dir: string, result: CheckResult): void {
  const file = path.join(dir, LAST_CHECK_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const repos: Record<string, boolean> = {};
  for (const r of result.repos) repos[r.name] = r.ok;
  fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), repos }, null, 2) + "\n");
}

// ── workspace propose ───────────────────────────────────────────────────────

/** Open the story's change in one member, linked back to the story. */
export function openSubChange(
  ws: LoadedWorkspace,
  repo: string,
  story: string,
  title: string
): Diagnostic | null {
  const dir = ws.dirs[repo];
  const r = cli(["change", "new", story, "--project-dir", dir]);
  if (r.status !== 0) {
    return error(
      "workspace_propose_failed",
      `change new ${story} failed in ${repo}: ${(r.stderr || r.stdout).trim().split("\n").pop()}`,
      {
        target: repo,
        fix: `Run specgate change new ${story} in ${repo} to see why.`,
      }
    );
  }
  const proposal = path.join(dir, "docs", "specs", "changes", story, "proposal.md");
  if (fs.existsSync(proposal)) {
    const text = fs.readFileSync(proposal, "utf8");
    const link =
      `\n> Part of the workspace story \`${ws.config.name}:${story}\` — ${title}. ` +
      `The story and its other repositories: \`${STORIES_DIR}/${story}/story.md\` in the workspace repository.\n`;
    fs.writeFileSync(proposal, text.replace(/^(# .*\n)/, `$1${link}`), "utf8");
  }
  return null;
}

export function noteNoMembers(): Diagnostic {
  return warning("workspace_no_members", "No sibling folder holds a Specgate project.", {
    fix: "specgate workspace init --repo fleet=../fleet --repo web=../web:web",
  });
}
