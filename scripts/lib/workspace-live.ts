import * as fs from "node:fs";
import * as path from "node:path";
import { listDeltas } from "../../packages/core/src/infrastructure/ChangeWorkspace";
import { parseDelta } from "../../packages/core/src/domain/SpecParser";
import { splitQualified, STORIES_DIR } from "../../packages/core/src/domain/Workspace";
import { liveSignature, readLive } from "./live-model";
import type { LiveRequirement } from "./live-model";
import { DELIVERED } from "./in-flight";
import { memberStatuses, readStories, subChangeState } from "./workspace";
import type { LoadedWorkspace } from "./workspace";

/**
 * The workspace's live view (REQ-320..322): a fold of each member's own live
 * model (ADR-0037) and harness ledger, and of the workspace's stories
 * (ADR-0041). It reads; it never writes a member.
 */

export interface Cost {
  /** What the agents reported, or null when none reported a cost. */
  money: number | null;
  minutes: number;
}

export interface RepoLive {
  name: string;
  role: string;
  exists: boolean;
  queue: string[];
  /** The most recently updated requirement still running, or null when idle (REQ-320). */
  inFlight: {
    req: string;
    title: string;
    attempt: number;
    phase: string;
    elapsed: number;
    running: LiveRequirement["running"];
    /** The agent's last step: what it did, and to what. */
    agent: { kind: string; target: string } | null;
  } | null;
  requirements: { running: number; pass: number; fail: number };
  cost: Cost;
}

export type PartState = "open" | "building" | "archived" | "missing";

export interface StoryLive {
  id: string;
  title: string;
  done: boolean;
  subchanges: Array<{
    repo: string;
    change: string;
    state: PartState;
    requirements: string[];
    /** Each `repo:REQ-NNN` a requirement of the part waits on, not delivered there (REQ-321). */
    blockedBy: string[];
  }>;
  cost: Cost;
}

export interface WorkspaceLive {
  schemaVersion: 1;
  name: string;
  dir: string;
  repos: RepoLive[];
  stories: StoryLive[];
}

/** The requirements a sub-change's delta adds or modifies, with their dependencies and scenarios. */
export function partRequirements(
  memberDir: string,
  change: string
): Array<{ id: string; depends: string[]; scenarios: string[] }> {
  const out: Array<{ id: string; depends: string[]; scenarios: string[] }> = [];
  for (const d of listDeltas(memberDir, change)) {
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
        depends: raw.split(/[,;\s]+/).filter(Boolean),
        scenarios: r.scenarios.map((s) => s.id || "").filter(Boolean),
      });
    }
  }
  return out;
}

/** Minutes the member's ledger recorded, for the requirements `only` names (all when absent). */
function ledgerMinutes(memberDir: string, only?: Set<string>): number {
  const runs = path.join(memberDir, ".harness", "runs");
  let ms = 0;
  let files: string[] = [];
  try {
    files = fs.readdirSync(runs).filter((f) => f.endsWith(".json"));
  } catch {
    return 0;
  }
  for (const f of files) {
    try {
      const doc = JSON.parse(fs.readFileSync(path.join(runs, f), "utf8"));
      for (const r of doc.results || []) {
        if (only && !only.has(String(r.requirement))) continue;
        if (Number(r.durationMs) > 0) ms += Number(r.durationMs);
      }
    } catch {
      /* a ledger being written */
    }
  }
  return Math.round(ms / 60000);
}

function money(reqs: LiveRequirement[]): number | null {
  const costs = reqs
    .map((r) => (r.usage && r.usage.cost !== null ? r.usage.cost : null))
    .filter((c): c is number => c !== null);
  return costs.length ? Math.round(costs.reduce((a, b) => a + b, 0) * 100) / 100 : null;
}

function sumCost(costs: Cost[]): Cost {
  const paid = costs.map((c) => c.money).filter((m): m is number => m !== null);
  return {
    money: paid.length ? Math.round(paid.reduce((a, b) => a + b, 0) * 100) / 100 : null,
    minutes: costs.reduce((a, c) => a + c.minutes, 0),
  };
}

type MemberLive = ReturnType<typeof readLive>;

function repoLive(
  ws: LoadedWorkspace,
  name: string,
  role: string,
  live: MemberLive | null
): RepoLive {
  const dir = ws.dirs[name];
  const reqs = live ? live.requirements : [];
  const running = reqs.find((r) => r.state === "running") || null;
  const lastStep = running
    ? [...running.steps].reverse().find((e) => e.type === "step" && e.kind)
    : undefined;
  return {
    name,
    role,
    exists: live !== null,
    queue: live ? live.queue : [],
    inFlight: running
      ? {
          req: running.req,
          title: running.title,
          attempt: running.attempt,
          phase: running.phase,
          elapsed: running.elapsed,
          running: running.running,
          agent: lastStep
            ? { kind: String(lastStep.kind), target: String(lastStep.target || "") }
            : null,
        }
      : null,
    requirements: {
      running: reqs.filter((r) => r.state === "running").length,
      pass: reqs.filter((r) => r.state === "pass").length,
      fail: reqs.filter((r) => r.state === "fail").length,
    },
    cost: { money: money(reqs), minutes: live ? ledgerMinutes(dir) : 0 },
  };
}

/** The workspace's live model: every repository's harness, and every story's parts (REQ-320..322). */
export function readWorkspaceLive(ws: LoadedWorkspace): WorkspaceLive {
  const lives = new Map<string, MemberLive | null>();
  for (const r of ws.config.repos) {
    const dir = ws.dirs[r.name];
    lives.set(r.name, fs.existsSync(dir) ? readLive(dir) : null);
  }
  const statuses = new Map<string, Map<string, string>>();
  const statusOf = (repo: string, req: string): string => {
    if (!ws.dirs[repo] || !fs.existsSync(ws.dirs[repo])) return "";
    if (!statuses.has(repo)) statuses.set(repo, memberStatuses(ws.dirs[repo]));
    return statuses.get(repo)!.get(req) || "";
  };

  const stories: StoryLive[] = readStories(ws.dir).map((s) => {
    const costs: Cost[] = [];
    const subchanges = s.subchanges.map((sc) => {
      const dir = ws.dirs[sc.repo];
      const exists = !!dir && fs.existsSync(dir);
      const base = exists ? subChangeState(dir, sc.change) : "missing";
      const reqs = exists && base === "open" ? partRequirements(dir, sc.change) : [];
      const ids = new Set(reqs.map((r) => r.id));
      const live = lives.get(sc.repo);
      const seen = live ? live.requirements.filter((r) => ids.has(r.req)) : [];
      const blockedBy = [
        ...new Set(
          reqs.flatMap((r) =>
            r.depends.filter((d) => {
              const q = splitQualified(d);
              return !!q && !DELIVERED.includes(statusOf(q.repo, q.id));
            })
          )
        ),
      ];
      if (exists) costs.push({ money: money(seen), minutes: ledgerMinutes(dir, ids) });
      return {
        repo: sc.repo,
        change: sc.change,
        state: (base === "open" && seen.length > 0 ? "building" : base) as PartState,
        requirements: [...ids],
        blockedBy,
      };
    });
    return {
      id: s.id,
      title: s.title,
      done: subchanges.length > 0 && subchanges.every((p) => p.state === "archived"),
      subchanges,
      cost: sumCost(costs),
    };
  });

  return {
    schemaVersion: 1,
    name: ws.config.name,
    dir: ws.dir,
    repos: ws.config.repos.map((r) => repoLive(ws, r.name, r.role, lives.get(r.name) || null)),
    stories,
  };
}

/** Changes whenever a member's events or the workspace's stories change. */
export function workspaceLiveSignature(ws: LoadedWorkspace): string {
  const parts = ws.config.repos.map((r) =>
    fs.existsSync(ws.dirs[r.name]) ? liveSignature(ws.dirs[r.name]) : r.name
  );
  const stories = path.join(ws.dir, STORIES_DIR);
  try {
    for (const e of fs.readdirSync(stories)) {
      const st = fs.statSync(path.join(stories, e, "story.yaml"));
      parts.push(`${e}:${st.mtimeMs}`);
    }
  } catch {
    /* no stories yet */
  }
  return parts.join("|");
}
