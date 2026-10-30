import * as fs from "node:fs";
import * as path from "node:path";
import { STORY_LINK, loadWorkspace, readStories, storyContext } from "./workspace";
import type { StoryLink } from "./workspace";

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

/** A prompt with the story's context after it, when its change is part of a story. */
export function withStoryContext(prompt: string, projectDir: string, changeId: string): string {
  const story = storyPartContext(projectDir, changeId);
  return story ? `${prompt.replace(/\n*$/, "\n")}\n${story}` : prompt;
}
