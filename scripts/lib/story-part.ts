import * as fs from "node:fs";
import * as path from "node:path";
import { STORY_LINK, loadWorkspace, readStories, storyContext } from "./workspace";
import type { StoryLink } from "./workspace";
import { storyCriteria } from "../../packages/core/src/domain/WorkspaceStory";
import { parseDelta } from "../../packages/core/src/domain/SpecParser";
import { listDeltas } from "../../packages/core/src/infrastructure/ChangeWorkspace";
import { warning, type Diagnostic } from "./diagnostics";

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
      const cites =
        String(trace.api || "").trim() !== "" ||
        shared.some((c) => new RegExp(`(^|,)\\s*${c}:REQ-\\d+`).test(depends));
      if (cites) continue;
      out.push(
        warning(
          "layer_no_contract_cited",
          `${r.id} shares a criterion of the story ${story.id} with ${shared.join(", ")}, and cites none of its requirements or operations.`,
          {
            target: r.id,
            fix: `Add depends=${shared[0]}:REQ-NNN (the requirement of ${shared[0]} it uses) or api=<file>#<operationId> to ${r.id}'s specgate:trace.`,
          }
        )
      );
    }
  }
  return out;
}

/** A prompt with the story's context after it, when its change is part of a story. */
export function withStoryContext(prompt: string, projectDir: string, changeId: string): string {
  const story = storyPartContext(projectDir, changeId);
  return story ? `${prompt.replace(/\n*$/, "\n")}\n${story}` : prompt;
}
