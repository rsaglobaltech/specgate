import * as fs from "node:fs";
import * as path from "node:path";
import { STORIES_DIR, renderStory } from "../../packages/core/src/domain/Workspace";
import {
  briefFrontMatter,
  briefStories,
  briefText,
  storyQuestionsTemplate,
  storyTemplate,
  withoutFilledHints,
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
  // REQ-363: the client's questions, kept apart from the story.
  const questions = path.join(dir, "questions.md");
  if (!fs.existsSync(questions)) {
    fs.writeFileSync(questions, storyQuestionsTemplate(story.id), "utf8");
    written.push(`${storyRel(story.id)}/questions.md`);
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
    `- **Repositories:** each repository with the criteria it answers, one line each as \`- fleet: AC-1, AC-2\` — from what each repository is (${story.repos
      .map((r) => `\`${r}\` ${roleOf(ws, r)}`)
      .join(", ")}); a criterion two repositories build, both name it (REQ-361).`,
    `- **Questions:** what only the client can decide goes in \`${storyRel(story.id)}/questions.md\`, one table row each (\`| Q1 | <question> | AC-n | |\`), not in story.md. The story is not split while one is open (REQ-363).`,
    "- Replace the `<!-- … -->` hints with your text; keep the file's headings: `## Intent`, `## Acceptance criteria`, `## Repositories`.",
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
  // REQ-364: the form's hints go once the agent has written below them.
  const md = path.join(ws.dir, STORIES_DIR, story.id, "story.md");
  if (run.ok && fs.existsSync(md)) {
    const text = fs.readFileSync(md, "utf8");
    const clean = withoutFilledHints(text);
    if (clean !== text.replace(/\r\n/g, "\n")) fs.writeFileSync(md, clean, "utf8");
  }
  return { ...run, permissionAdded: added };
}

function roleOf(ws: LoadedWorkspace, repo: string): string {
  const r = ws.config.repos.find((x) => x.name === repo);
  return r ? `(${r.role})` : "";
}

/** What the agent proposing the brief's stories is told (REQ-360). */
export function storiesPrompt(ws: LoadedWorkspace): string {
  const text = fs.readFileSync(path.join(ws.dir, WORKSPACE_BRIEF), "utf8");
  return [
    `# Propose the stories of the workspace ${ws.config.name}'s brief`,
    "",
    `Fill \`stories:\` in the front matter at the top of \`${WORKSPACE_BRIEF.split(path.sep).join("/")}\`. Change nothing below the front matter: it is the client's text, and it is put back if it changes. Write no other file.`,
    "",
    "## The rules",
    "",
    "- One line per business story the brief asks for: `  - { id: follow-shipment, title: <the story in the client's words>, repos: [fleet, web] }`.",
    `- \`repos\` names the repositories that build a part of it, from these: ${ws.config.repos
      .map((r) => `\`${r.name}\` (${r.role})`)
      .join(", ")}.`,
    "- In the brief's order; only what the brief asks for. When unsure of a story or of its repositories, still propose it, with a `# check: …` comment on the line above saying what is uncertain.",
    "",
    "## The brief as it is now",
    "",
    "```markdown",
    text.trimEnd(),
    "```",
    "",
  ].join("\n");
}

/**
 * REQ-360: an agent fills the brief's `stories:`, allowed to write only the
 * brief; the client's text below the front matter is put back if it moved.
 */
export function proposeStoriesWithAgent(
  ws: LoadedWorkspace,
  command: string,
  showOutput: boolean
): ConfinedRun & { permissionAdded: boolean; textRestored: boolean } {
  const { command: cmd, added } = withWritePermission(command);
  const file = path.join(ws.dir, WORKSPACE_BRIEF);
  const before = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const rel = WORKSPACE_BRIEF.split(path.sep).join("/");
  const run = runConfinedAgent({
    projectDir: ws.dir,
    changeId: "stories",
    allowed: (r) => r.split(path.sep).join("/") === rel,
    command: cmd,
    prompt: storiesPrompt(ws),
    showOutput,
  });
  let textRestored = false;
  if (fs.existsSync(file)) {
    const after = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    if (briefText(after) !== briefText(before)) {
      const front = /^---\n[\s\S]*?\n---[ \t]*\n/.exec(after);
      const fm = front ? front[0] : (/^---\n[\s\S]*?\n---[ \t]*\n/.exec(before) || [""])[0];
      const body = before.slice((/^---\n[\s\S]*?\n---[ \t]*\n/.exec(before) || [""])[0].length);
      fs.writeFileSync(file, fm + body, "utf8");
      textRestored = true;
    }
  }
  return { ...run, permissionAdded: added, textRestored };
}
