import * as fs from "node:fs";
import * as path from "node:path";
import { STORY_LINK, loadWorkspace, readStories, storyContext } from "./workspace";
import { changeRequirements } from "./in-flight";
import type { StoryLink } from "./workspace";
import { storyCriteria } from "../../packages/core/src/domain/WorkspaceStory";
import { parseDelta } from "../../packages/core/src/domain/SpecParser";
import { listDeltas } from "../../packages/core/src/infrastructure/ChangeWorkspace";
import { error, warning, type Diagnostic } from "./diagnostics";
import { citedOperation, memberCitations, projectContracts } from "./contracts";

/**
 * REQ-366: the story a member's change is a part of, told to whoever writes
 * that part. `workspace propose` leaves `story.json` in the sub-change, naming
 * the workspace (relative to the member), the story and this repository; the
 * context is the one `workspace harness run` hands the harness (REQ-344),
 * read afresh, so a part written later hears of the requirements the others
 * have specified since.
 */
export function storyPartContext(projectDir: string, changeId: string): string {
  const file = path.join(projectDir, "docs", "specs", "changes", changeId, STORY_LINK);
  if (!fs.existsSync(file)) return "";
  let link: StoryLink;
  try {
    link = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return "";
  }
  const { ws } = loadWorkspace(path.resolve(projectDir, link.workspace || "."));
  if (!ws) return "";
  const story = readStories(ws.dir).find((s) => s.id === link.story);
  if (!story) return "";
  return storyContext(ws, story, link.repo);
}

/**
 * REQ-386: in a story with a contracts repository, a requirement of another
 * repository that shares a criterion with it cites it — `depends=<contracts>:REQ-NNN`
 * or an `api=` of its contract. The story's context asked for it and the agents
 * of tracking and web still cited nothing, so every repository ran at the same
 * level (truck-flote, MS4-1). A warning: a requirement may need no contract.
 */
export function contractCitationWarnings(projectDir: string, changeId: string): Diagnostic[] {
  const file = path.join(projectDir, "docs", "specs", "changes", changeId, STORY_LINK);
  if (!fs.existsSync(file)) return [];
  let link: StoryLink;
  try {
    link = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
  const { ws } = loadWorkspace(path.resolve(projectDir, link.workspace || "."));
  if (!ws) return [];
  const story = readStories(ws.dir).find((s) => s.id === link.story);
  if (!story) return [];
  const roleOf = (n: string) => (ws.config.repos.find((r) => r.name === n) || { role: "" }).role;
  if (roleOf(link.repo) === "contracts") return [];
  const contracts = story.subchanges
    .map((sc) => sc.repo)
    .filter((r) => r !== link.repo && roleOf(r) === "contracts");
  if (contracts.length === 0) return [];
  // Which criteria each repository answers; a story that maps none shares them all.
  const md = path.join(story.dir, "story.md");
  const map = fs.existsSync(md) ? storyCriteria(fs.readFileSync(md, "utf8")) : {};
  const mine = map[link.repo] || [];
  const shared = Object.keys(map).length
    ? contracts.filter((c) => (map[c] || []).some((ac) => mine.includes(ac)))
    : contracts;
  if (shared.length === 0) return [];
  const out: Diagnostic[] = [];
  for (const d of listDeltas(projectDir, changeId)) {
    const delta = parseDelta(fs.readFileSync(d.file, "utf8"));
    for (const r of [...delta.added, ...delta.modified]) {
      if (!r.id) continue;
      const trace = (r.trace || {}) as Record<string, string>;
      const depends = String(trace.depends || "");
      const api = String(trace.api || "").trim();
      const used = shared.flatMap((c) =>
        [...depends.matchAll(new RegExp(`(?:^|,)\\s*${c}:(REQ-\\d+)`, "g"))].map((m) => ({
          repo: c,
          id: m[1],
        }))
      );
      // REQ-415: an api= of a contracts repository resolves to one of its
      // operations. In run 8 web cited contracts/tracking.yaml, a file that does
      // not exist, and was approved and built (truck-flote, MS8-2).
      const unresolved = api
        .split(",")
        .map((s) => s.trim())
        .filter((ref) => {
          const q = /^([A-Za-z][A-Za-z0-9-]*):/.exec(ref);
          const repo = q ? q[1].toLowerCase() : "";
          if (!shared.includes(repo) || !ws.dirs[repo] || !fs.existsSync(ws.dirs[repo]))
            return false;
          return !citedOperation(ref, (n) => ws.dirs[n], projectDir);
        });
      for (const ref of unresolved) {
        const repo = ref.split(":")[0].toLowerCase();
        const ops = operationsOf(ws.dirs[repo]);
        // While the contracts repository has no contract yet, nothing can resolve.
        const known = Object.keys(ops).length > 0;
        out.push(
          (known ? error : warning)(
            "layer_api_unresolved",
            `${r.id} cites api=${ref}, which is not an operation of ${repo}'s contracts.` +
              (known ? ` Its operations: ${listOperations(repo, ops)}.` : ""),
            {
              target: r.id,
              fix: `Copy the api= of the operation ${r.id} serves or calls exactly as the story lists it: api=${repo}:<file>#<operationId>, with the file ${repo} has.`,
            }
          )
        );
      }
      if (api === "" && used.length > 0) {
        // REQ-406: a requirement of the contracts is not its operation. In run 7
        // tracking and web cited contracts:REQ-NNN and served paths of their own.
        const ops = [
          ...new Set(
            used.flatMap((u) =>
              ws.dirs[u.repo] && fs.existsSync(ws.dirs[u.repo])
                ? memberCitations(ws.dirs[u.repo])
                    .filter((c) => c.requirement === u.id)
                    .map((c) => `api=${u.repo}:${c.ref}`)
                : []
            )
          ),
        ];
        // REQ-415: once the contracts' requirement cites its operation, the
        // part cites it too: approval refuses it, the warning was not enough
        // (truck-flote, MS8-2: tracking cited none and served paths of its own).
        out.push(
          (ops.length ? error : warning)(
            "layer_no_operation_cited",
            `${r.id} depends on ${used.map((u) => `${u.repo}:${u.id}`).join(", ")} and cites none of its operations: ` +
              `the service serves, and the web calls, exactly the operation the contract says.` +
              (ops.length ? ` It could cite ${ops.join(", ")}.` : ""),
            {
              target: r.id,
              fix: `Add ${ops[0] || `api=${used[0].repo}:contracts/<file>#<operationId>`} to ${r.id}'s specgate:trace.`,
            }
          )
        );
        continue;
      }
      const cites = api !== "" || used.length > 0;
      if (cites) continue;
      out.push(
        warning(
          "layer_no_contract_cited",
          `${r.id} shares a criterion of the story ${story.id} with ${shared.join(", ")}, and cites none of its requirements or operations.`,
          {
            target: r.id,
            fix: `Add depends=${shared[0]}:REQ-NNN (the requirement of ${shared[0]} it uses) and api=${shared[0]}:contracts/<file>#<operationId> to ${r.id}'s specgate:trace.`,
          }
        )
      );
    }
  }
  return out;
}

/** The operations of a repository's contracts, by file. */
function operationsOf(dir: string): Record<string, Array<{ operationId?: string; label: string }>> {
  try {
    return projectContracts(dir, []);
  } catch {
    return {};
  }
}

/** `api=` lines for every operation, to say what a reference could have been. */
function listOperations(
  repo: string,
  ops: Record<string, Array<{ operationId?: string; label: string }>>
): string {
  return Object.entries(ops)
    .flatMap(([file, list]) =>
      list.filter((o) => o.operationId).map((o) => `api=${repo}:${file}#${o.operationId}`)
    )
    .slice(0, 8)
    .join(", ");
}

/**
 * REQ-395: the contracts repositories a part shares a criterion with whose own
 * part has no requirement yet. The parts of a story were written at the same
 * time, and tracking, finding nothing in contracts, designed its own API
 * (truck-flote, MS6-1): a part is written after the contracts it uses.
 */
export function contractsNotYetSpecified(projectDir: string, changeId: string): string[] {
  const file = path.join(projectDir, "docs", "specs", "changes", changeId, STORY_LINK);
  if (!fs.existsSync(file)) return [];
  let link: StoryLink;
  try {
    link = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
  const { ws } = loadWorkspace(path.resolve(projectDir, link.workspace || "."));
  if (!ws) return [];
  const story = readStories(ws.dir).find((s) => s.id === link.story);
  if (!story) return [];
  const roleOf = (n: string) => (ws.config.repos.find((r) => r.name === n) || { role: "" }).role;
  if (roleOf(link.repo) === "contracts") return [];
  const md = path.join(story.dir, "story.md");
  const map = fs.existsSync(md) ? storyCriteria(fs.readFileSync(md, "utf8")) : {};
  const mine = map[link.repo] || [];
  return story.subchanges
    .filter((sc) => sc.repo !== link.repo && roleOf(sc.repo) === "contracts")
    .filter(
      (sc) => !Object.keys(map).length || (map[sc.repo] || []).some((ac) => mine.includes(ac))
    )
    .filter((sc) => {
      const dir = ws.dirs[sc.repo];
      return dir && fs.existsSync(dir) && changeRequirements(dir, sc.change).length === 0;
    })
    .map((sc) => sc.repo);
}

/**
 * REQ-407: the folder of each repository of the workspace this project is a
 * member of, read from the `story.json` its open changes keep; nothing when no
 * open change is a story's part.
 */
export function workspaceMemberDirs(projectDir: string): (repo: string) => string | undefined {
  // `workspace harness run` names it: the harness may read a copy of the project.
  if (process.env.SPECGATE_WORKSPACE) {
    const { ws } = loadWorkspace(process.env.SPECGATE_WORKSPACE);
    if (ws) return (repo) => ws.dirs[repo];
  }
  const changes = path.join(projectDir, "docs", "specs", "changes");
  let ids: string[] = [];
  try {
    ids = fs.readdirSync(changes);
  } catch {
    return () => undefined;
  }
  for (const id of ids) {
    const file = path.join(changes, id, STORY_LINK);
    if (!fs.existsSync(file)) continue;
    try {
      const link: StoryLink = JSON.parse(fs.readFileSync(file, "utf8"));
      const { ws } = loadWorkspace(path.resolve(projectDir, link.workspace || "."));
      if (ws) return (repo) => ws.dirs[repo];
    } catch {
      continue;
    }
  }
  return () => undefined;
}

/** A prompt with the story's context after it, when its change is part of a story. */
export function withStoryContext(prompt: string, projectDir: string, changeId: string): string {
  const story = storyPartContext(projectDir, changeId);
  return story ? `${prompt.replace(/\n*$/, "\n")}\n${story}` : prompt;
}
