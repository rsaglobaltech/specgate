import * as fs from "node:fs";
import * as path from "node:path";
import { STORIES_DIR, renderStory } from "../../packages/core/src/domain/Workspace";
import {
  briefFrontMatter,
  briefStories,
  briefText,
  storyTemplate,
  workspaceBriefTemplate,
} from "../../packages/core/src/domain/WorkspaceStory";
import type { BriefStory } from "../../packages/core/src/domain/WorkspaceStory";
import { runConfinedAgent, withWritePermission } from "../draft/confined-agent";
import type { ConfinedRun } from "../draft/confined-agent";
import type { LoadedWorkspace } from "./workspace";

/**
 * The client's brief in a workspace repository, and the stories it holds
 * (REQ-339..340). A workspace brief names stories, as a project's names
 * modules: each story is split across the repositories it touches.
 */

export const WORKSPACE_BRIEF = path.join("docs", "brief.md");

export interface WorkspaceBriefState {
  /** The brief's file, relative to the workspace repository. */
  file: string;
  /** Written by this call: the root brief moved below a front matter. */
  created: boolean;
  stories: BriefStory[];
}

/**
 * `docs/brief.md` of the workspace, made from a root `brief.md` the first
 * time — the client's text kept as it is, below a front matter to fill.
 */
export function workspaceBrief(ws: LoadedWorkspace): WorkspaceBriefState {
  const file = path.join(ws.dir, WORKSPACE_BRIEF);
  let created = false;
  if (!fs.existsSync(file)) {
    const root = path.join(ws.dir, "brief.md");
    const body = fs.existsSync(root)
      ? fs.readFileSync(root, "utf8").replace(/\r\n/g, "\n")
      : "# Brief\n\nPaste the client's brief here as it is.\n";
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      workspaceBriefTemplate(
        ws.config.name,
        ws.config.repos.map((r) => r.name)
      ) + body,
      "utf8"
    );
    created = true;
  }
  const text = fs.readFileSync(file, "utf8");
  return {
    file: WORKSPACE_BRIEF.split(path.sep).join("/"),
    created,
    stories: briefStories(briefFrontMatter(text)),
  };
}

/** The stories the workspace brief names, without writing anything. */
export function readWorkspaceStories(ws: LoadedWorkspace): BriefStory[] {
  const file = path.join(ws.dir, WORKSPACE_BRIEF);
  if (!fs.existsSync(file)) return [];
  return briefStories(briefFrontMatter(fs.readFileSync(file, "utf8")));
}

/** The story folder, relative to the workspace repository. */
export const storyRel = (id: string) => `${STORIES_DIR}/${id}`;

/** The story's folder with its `story.yaml` (no parts yet) and a `story.md` to fill. */
export function scaffoldStory(ws: LoadedWorkspace, story: BriefStory): string[] {
  const dir = path.join(ws.dir, STORIES_DIR, story.id);
  fs.mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  const yaml = path.join(dir, "story.yaml");
  if (!fs.existsSync(yaml)) {
    fs.writeFileSync(
      yaml,
      renderStory({ id: story.id, title: story.title, subchanges: [] }),
      "utf8"
    );
    written.push(`${storyRel(story.id)}/story.yaml`);
  }
  const md = path.join(dir, "story.md");
  if (!fs.existsSync(md)) {
    fs.writeFileSync(md, storyTemplate(story.title, story.repos), "utf8");
    written.push(`${storyRel(story.id)}/story.md`);
  }
  return written;
}

/** What the agent drafting a story is told: the brief, the story, and the format. */
export function storyPrompt(ws: LoadedWorkspace, story: BriefStory): string {
  const brief = briefText(fs.readFileSync(path.join(ws.dir, WORKSPACE_BRIEF), "utf8"));
  const file = `${storyRel(story.id)}/story.md`;
  return [
    `# Draft the story ${story.id} of the workspace ${ws.config.name}`,
    "",
    `Write \`${file}\`: the business story "${story.title}", which the repositories ${story.repos
      .map((r) => `\`${r}\``)
      .join(", ")} will each build a part of. Write nothing else.`,
    "",
    "## The rules",
    "",
    "- **Intent:** who needs what, and why, in the client's words — quote the brief where it says it. No technology: each repository's design says how.",
    "- **Acceptance criteria:** one line each, `- AC-1: …`, `- AC-2: …`, each a thing a person can see or check. Only what the brief supports; a number the brief does not give is a question, not a guess.",
    "- Keep the file's headings: `## Intent`, `## Acceptance criteria`, `## Repositories`.",
    "",
    `## The file as it is now: ${file}`,
    "",
    "```markdown",
    fs.readFileSync(path.join(ws.dir, file), "utf8").trimEnd(),
    "```",
    "",
    "## The client's brief",
    "",
    brief.trimEnd(),
    "",
  ].join("\n");
}

/** An agent drafts the story, confined to its folder (REQ-340). */
export function draftStoryWithAgent(
  ws: LoadedWorkspace,
  story: BriefStory,
  command: string,
  showOutput: boolean
): ConfinedRun & { permissionAdded: boolean } {
  const { command: cmd, added } = withWritePermission(command);
  const prefix = `${storyRel(story.id)}/`;
  const run = runConfinedAgent({
    projectDir: ws.dir,
    changeId: story.id,
    allowed: (rel) => rel.split(path.sep).join("/").startsWith(prefix),
    command: cmd,
    prompt: storyPrompt(ws, story),
    showOutput,
  });
  return { ...run, permissionAdded: added };
}
