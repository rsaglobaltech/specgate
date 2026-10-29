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
import {
  CRITERIA,
  INTENT,
  criteriaLines,
  section,
} from "../../packages/core/src/domain/WorkspaceStory";
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

/** Where `workspace harness run` keeps each repository's log and context (REQ-349). */
export const RUNS_DIR = ".specgate/workspace-runs";

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
  /** What does not fail the check: a sub-change whose criteria drift (REQ-343). */
  warnings: Diagnostic[];
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
  return { ok, repos, problems, warnings: divergedParts(ws) };
}

/** The `discover.md` of a member's open change, or null. */
function discoverOf(memberDir: string, change: string): string | null {
  const file = path.join(memberDir, "docs", "specs", "changes", change, "discover.md");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

/**
 * REQ-343: the story's criteria are the business's, the same in every
 * repository; an open sub-change whose `AC-n` lines are not the story's has
 * drifted from it.
 */
export function divergedParts(ws: LoadedWorkspace): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const s of readStories(ws.dir)) {
    const md = path.join(s.dir, "story.md");
    if (!fs.existsSync(md)) continue;
    const theirs = criteriaLines(fs.readFileSync(md, "utf8"));
    if (theirs.length === 0) continue;
    for (const sc of s.subchanges) {
      const dir = ws.dirs[sc.repo];
      if (!dir || !fs.existsSync(dir)) continue;
      const text = discoverOf(dir, sc.change);
      if (text === null) continue;
      const mine = criteriaLines(text);
      const missing = theirs.filter((c) => !mine.includes(c));
      const extra = mine.filter((c) => !theirs.includes(c));
      if (missing.length === 0 && extra.length === 0) continue;
      out.push(
        warning(
          "workspace_story_diverged",
          `${sc.repo}'s change ${sc.change} states its criteria otherwise than the story ${s.id}` +
            (missing.length
              ? `: the story's "${missing[0]}" is not there`
              : `: "${extra[0]}" is not the story's`) +
            ".",
          {
            target: sc.repo,
            file: `${sc.repo}/docs/specs/changes/${sc.change}/discover.md`,
            fix: `Write the story's criteria as ${STORIES_DIR}/${s.id}/story.md states them, or change the story there, on purpose.`,
          }
        )
      );
    }
  }
  return out;
}

/**
 * REQ-345: the order a story's repositories are built in. A repository whose
 * part depends on a requirement another part adds, not yet delivered, comes a
 * level after that part's repository.
 */
export function storyLevels(ws: LoadedWorkspace, story: Story): Record<string, number> {
  const owner = new Map<string, string>();
  const needs = new Map<string, Set<string>>();
  const parts = story.subchanges.filter(
    (sc) => ws.dirs[sc.repo] && fs.existsSync(ws.dirs[sc.repo])
  );
  const reqsOf = new Map<string, Array<{ id: string; depends: string[] }>>();
  for (const sc of parts) {
    const reqs = changeRequirements(ws.dirs[sc.repo], sc.change);
    reqsOf.set(sc.repo, reqs);
    for (const r of reqs) owner.set(`${sc.repo}:${r.id}`, sc.repo);
  }
  for (const sc of parts) {
    const set = new Set<string>();
    const statuses = memberStatusesCache(ws);
    for (const r of reqsOf.get(sc.repo) || []) {
      for (const d of r.depends) {
        const q = splitQualified(d);
        if (!q || q.repo === sc.repo) continue;
        const theirs = owner.get(`${q.repo}:${q.id}`);
        if (theirs && !DELIVERED.includes(statuses(q.repo).get(q.id) || "")) set.add(theirs);
      }
    }
    needs.set(sc.repo, set);
  }
  const level: Record<string, number> = {};
  const visit = (repo: string, seen: Set<string>): number => {
    if (level[repo]) return level[repo];
    if (seen.has(repo)) return 1; // a cycle: build them together
    seen.add(repo);
    const deps = [...(needs.get(repo) || [])];
    const l = deps.length ? Math.max(...deps.map((d) => visit(d, seen))) + 1 : 1;
    level[repo] = l;
    return l;
  };
  for (const sc of parts) visit(sc.repo, new Set());
  return level;
}

function memberStatusesCache(ws: LoadedWorkspace): (repo: string) => Map<string, string> {
  const cache = new Map<string, Map<string, string>>();
  return (repo) => {
    if (!cache.has(repo))
      cache.set(repo, ws.dirs[repo] ? memberStatuses(ws.dirs[repo]) : new Map());
    return cache.get(repo)!;
  };
}

/** The requirements a change adds or modifies, open or archived, with their `depends=`. */
export function changeRequirements(
  memberDir: string,
  change: string
): Array<{ id: string; title: string; depends: string[]; scenarios: string[] }> {
  const archived = listArchivedIds(memberDir).find((a) => a === change || a.endsWith(`-${change}`));
  const id = listChangeIds(memberDir).includes(change)
    ? change
    : archived
      ? path.join("archive", archived)
      : null;
  if (!id) return [];
  const out: Array<{ id: string; title: string; depends: string[]; scenarios: string[] }> = [];
  for (const d of listDeltas(memberDir, id)) {
    let parsed: ReturnType<typeof parseDelta>;
    try {
      parsed = parseDelta(fs.readFileSync(d.file, "utf8"));
    } catch {
      continue;
    }
    for (const r of [...(parsed.added || []), ...(parsed.modified || [])]) {
      if (!r.id) continue;
      const raw = String((r.trace || {}).depends || "");
      out.push({
        id: r.id.toUpperCase(),
        title: String(r.name || ""),
        depends: raw.split(/[,;\s]+/).filter(Boolean),
        scenarios: r.scenarios.map((s) => s.id || "").filter(Boolean),
      });
    }
  }
  return out;
}

/**
 * REQ-344: what a repository's harness is told of the story's other parts —
 * each repository, its role, and the requirements its part adds with their
 * status — so a requirement can name what it waits for.
 */
export function storyContext(ws: LoadedWorkspace, story: Story, repo: string): string {
  const roleOf = (n: string) => (ws.config.repos.find((r) => r.name === n) || { role: "" }).role;
  const statuses = memberStatusesCache(ws);
  const lines = [
    `## The workspace story ${ws.config.name}:${story.id} — ${story.title}`,
    "",
    `This requirement is ${repo}'s part of a story built across repositories. The other parts:`,
    "",
  ];
  for (const sc of story.subchanges) {
    if (sc.repo === repo || !ws.dirs[sc.repo]) continue;
    lines.push(`- \`${sc.repo}\` (${roleOf(sc.repo)}):`);
    const reqs = fs.existsSync(ws.dirs[sc.repo])
      ? changeRequirements(ws.dirs[sc.repo], sc.change)
      : [];
    if (reqs.length === 0) lines.push("  - nothing specified yet");
    for (const r of reqs)
      lines.push(`  - ${sc.repo}:${r.id} — ${r.title} (${statuses(sc.repo).get(r.id) || "Draft"})`);
  }
  const contracts = ws.config.repos.filter((r) => r.role === "contracts").map((r) => r.name);
  lines.push(
    "",
    "Call another part's requirement by its qualified id: a requirement that needs it carries `depends=<repo>:REQ-NNN` in its trace" +
      (contracts.length
        ? `, and an API between repositories is an operation of \`${contracts[0]}\`, cited as \`api=<file>#<operationId>\`.`
        : "."),
    "Do not build another repository's part here: call it through its API, or a stand-in in the tests.",
    ""
  );
  return lines.join("\n");
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
  title: string,
  carried: { storyText: string; repos: string[] } = { storyText: "", repos: [] }
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
  // A 1.0 change's Discover (ADR-0042), or a 0.27 change's proposal.
  const changeDir = path.join(dir, "docs", "specs", "changes", story);
  const proposal = ["discover.md", "proposal.md"]
    .map((f) => path.join(changeDir, f))
    .find((f) => fs.existsSync(f));
  if (proposal) {
    let text = fs.readFileSync(proposal, "utf8");
    // REQ-342: the story itself, not a path this repository cannot open.
    const link =
      `\n> Part of the workspace story \`${ws.config.name}:${story}\` — ${title}. ` +
      "Its intent and criteria are copied below as the story states them; change them in the story, " +
      "not here.\n";
    text = text.replace(/^(# .*\n)/, `$1${link}`);
    const intent = section(carried.storyText, INTENT);
    const criteria = criteriaLines(carried.storyText);
    if (intent) text = replaceSection(text, /context/i, intent);
    if (criteria.length)
      text = replaceSection(text, CRITERIA, criteria.map((c) => `- ${c}`).join("\n"));
    text = text.trimEnd() + "\n\n" + otherRepositories(ws, repo, carried.repos) + "\n";
    fs.writeFileSync(proposal, text, "utf8");
  }
  return null;
}

/** The body of a `##` section replaced, its heading kept. */
function replaceSection(md: string, heading: RegExp, body: string): string {
  const lines = md.split("\n");
  const at = lines.findIndex((l) => /^##\s/.test(l) && heading.test(l));
  if (at < 0) return md;
  let end = lines.findIndex((l, i) => i > at && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  return [...lines.slice(0, at + 1), "", body, "", ...lines.slice(end)].join("\n");
}

/** REQ-344: the story's other repositories, and how to name what this part needs from them. */
function otherRepositories(ws: LoadedWorkspace, repo: string, repos: string[]): string {
  const others = repos.filter((r) => r !== repo);
  const contracts = ws.config.repos.filter((r) => r.role === "contracts").map((r) => r.name);
  const roleOf = (n: string) => (ws.config.repos.find((r) => r.name === n) || { role: "" }).role;
  const example = others[0] || "fleet";
  return [
    "## The story's other repositories",
    "",
    ...others.map((r) => `- \`${r}\` (${roleOf(r)})`),
    ...contracts
      .filter((c) => !others.includes(c) && c !== repo)
      .map((c) => `- \`${c}\` (contracts)`),
    "",
    `A requirement here that needs one of their requirements names it in its trace: \`depends=${example}:REQ-NNN\`.` +
      (contracts.length
        ? ` An API between repositories is an operation of \`${contracts[0]}\`, cited as \`api=<file>#<operationId>\`.`
        : ""),
  ].join("\n");
}

export function noteNoMembers(): Diagnostic {
  return warning("workspace_no_members", "No sibling folder holds a Specgate project.", {
    fix: "specgate workspace init --repo fleet=../fleet --repo web=../web:web",
  });
}
