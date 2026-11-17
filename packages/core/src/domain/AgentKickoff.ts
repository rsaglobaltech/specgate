/**
 * REQ-598: what a person pastes into their agent — Codex, OpenCode, Claude Code
 * or another — to work on a specgate project, in English, written from the
 * project's state rather than from a page that goes stale. Pure: state in,
 * text out.
 */

export type PromptKind = "start" | "draft" | "build";

export interface PromptState {
  /** The next command `specgate status` names, or null when it names none. */
  next: string | null;
  /** The brief's modules not drafted yet. */
  undrafted: string[];
  /** The agents whose steps are installed in the project. */
  installed: { claude: boolean; opencode: boolean; codex: boolean };
}

const RULES = [
  "Rules you never break:",
  "- Write the test first, and name the requirement in it (REQ-NNN, and its scenario SCN-NNN when it has one): that mention is the link.",
  "- Run `specgate check` before you say anything is done; only what it passes is done.",
  "- Never edit spec.md, features/ or docs/specs/ to make a test pass.",
  "- Never archive a change, approve a layer or answer a question in questions.md yourself: a person does.",
  "- When a value is missing, ask (`specgate ask`) or record an assumption; never invent one.",
];

/** How each installed agent calls specgate's steps, for the agents the project has. */
function stepsLine(installed: PromptState["installed"]): string[] {
  const ways: string[] = [];
  if (installed.claude) ways.push("Claude Code: /specgate:draft, /specgate:apply, /specgate:check");
  if (installed.opencode) ways.push("OpenCode: /specgate-draft, /specgate-apply, /specgate-check");
  if (installed.codex)
    ways.push("Codex: $specgate-draft, $specgate-apply, $specgate-check (skills)");
  if (ways.length === 0) return [];
  return ["specgate's steps are installed for you:", ...ways.map((w) => `- ${w}`), ""];
}

/** The prompt for one situation. */
export function agentPrompt(kind: PromptKind, state: PromptState, module?: string): string {
  const intro = [
    "This project uses specgate for spec-driven development. specgate is installed: run it as `specgate`.",
    "Read AGENTS.md first: it is the contract you work under. Do not study specgate's own documentation;",
    "specgate tells you what to do next, and `specgate change instructions <artifact> --json` gives you the exact format of any file it asks for.",
    "",
  ];
  const body: string[] = [];
  if (kind === "draft") {
    const m = module || state.undrafted[0] || "<module>";
    body.push(
      `Draft the ${m} module of docs/brief.md:`,
      `1. Run \`specgate propose --from-brief ${m}\`. It opens the draft and writes DRAFTING.md in it.`,
      "2. Follow that DRAFTING.md: it is your prompt. Write what it asks, in the files it names.",
      `3. Run \`specgate propose --from-brief ${m}\` again until it says "Ready to review".`,
      "4. Stop there and say so: a person reviews the draft and answers its questions.",
      ""
    );
  } else if (kind === "build") {
    body.push(
      "Build the next requirement:",
      "1. Run `specgate status`. Take the next requirement it names.",
      "2. Write its test first, naming the requirement; see it fail.",
      "3. Write the code until `specgate check` passes.",
      "4. Run `specgate apply <REQ>`: it is refused unless the gate passes.",
      "5. Repeat from 1, one requirement at a time. Stop when status names a step for a person (a review, an answer, an archive).",
      ""
    );
  } else {
    body.push("Run `specgate status` and do the next step it names.");
    if (state.next) body.push(`Right now that is: \`${state.next}\`.`);
    if (state.undrafted.length > 0) {
      body.push(
        `docs/brief.md has modules not drafted yet: ${state.undrafted.join(", ")}.`,
        "Draft them one at a time: `specgate propose --from-brief <module>`, follow the DRAFTING.md it writes,",
        'and run it again until it says "Ready to review"; then stop for a person to review.'
      );
    }
    body.push("");
  }
  return [...intro, ...body, ...stepsLine(state.installed), ...RULES, ""].join("\n");
}
