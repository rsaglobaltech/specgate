/**
 * The shape of the documentation site, decided once.
 *
 * Ordered by the question a reader is asking, not alphabetically and not by
 * the order the files happened to be written. Someone who has just run
 * `npx @rsaglobaltech/specgate` needs a different page from someone deciding whether
 * to adopt the tool at all, and the sidebar should make that obvious without
 * being read end to end.
 *
 * A document missing from this list is still rendered — it simply does not
 * appear in the sidebar. `tests/unit/docs-site.test.ts` fails when a shipped
 * document is orphaned that way, because a page nobody can navigate to is a
 * page nobody reads.
 */

export interface NavEntry {
  /** Path relative to `docs/`, without the extension. */
  readonly slug: string;
  /** What the sidebar calls it — often shorter than the document's own title. */
  readonly label: string;
  /** One line under the label on section index pages. */
  readonly blurb: string;
  /** Optional key into `icons.ts`. Decoration: an unknown name renders nothing. */
  readonly icon?: string;
}

export interface NavSection {
  readonly title: string;
  /** Shown at the top of the section on the docs home page. */
  readonly summary: string;
  /** Optional key into `icons.ts`, drawn beside the group heading. */
  readonly icon?: string;
  readonly entries: readonly NavEntry[];
}

export const NAV: readonly NavSection[] = [
  {
    title: "Start here",
    icon: "rocket",
    summary: "Fifteen minutes from nothing to a project whose specs are checked by CI.",
    entries: [
      {
        slug: "getting-started",
        label: "Getting started",
        blurb: "Install, scaffold a project, and run the gate for the first time.",
      },
      {
        slug: "quickstart",
        label: "You cloned a repo",
        blurb: "Someone handed you a spec-driven repository. Start here instead.",
      },
      {
        slug: "walkthrough",
        label: "Walkthrough",
        blurb: "The whole loop end to end, in one sitting.",
      },
      {
        slug: "tutorial",
        label: "Tutorial: Smart Parking",
        blurb: "A complete worked example, from a blank folder to a delivered requirement.",
      },
    ],
  },
  {
    title: "Working with specs",
    icon: "file",
    summary: "What a specification is here, and what the tool does with it.",
    entries: [
      {
        slug: "writing-specs",
        label: "Writing specs",
        blurb: "Requirements, scenarios and the traceability matrix.",
      },
      {
        slug: "validating",
        label: "Validating",
        blurb: "The gate: structure, traceability, Gherkin and TDD.",
      },
      {
        slug: "reviewing-changes",
        label: "Reviewing changes",
        blurb: "Propose, review and archive a change to specs that already shipped.",
      },
      {
        slug: "domain-packs",
        label: "Domain packs",
        blurb: "Install a curated domain model instead of writing one from scratch.",
      },
    ],
  },
  {
    title: "Agents and the harness",
    icon: "robot",
    summary:
      "The part that spends money. Read the harness page before pointing an agent at anything.",
    entries: [
      {
        slug: "agents",
        label: "Agent tools",
        blurb: "Wire Claude Code, Cursor, Copilot and five others into the same loop.",
      },
      {
        slug: "agent-setup",
        label: "Choosing your agent",
        blurb: "Claude, Aider, Cursor or a three-line wrapper — and the two things that bite.",
      },
      {
        slug: "harness",
        label: "The harness",
        blurb: "Unattended delivery: plan → agent → gate → done, one worktree per requirement.",
      },
      {
        slug: "bootstrap-prompt",
        label: "Bootstrap prompt",
        blurb: "The prompt that turns an idea into a first specification.",
      },
    ],
  },
  {
    title: "Running it for real",
    icon: "server",
    summary: "CI, boards, and the things an enterprise asks before it says yes.",
    entries: [
      {
        slug: "automation",
        label: "Automation",
        blurb: "Generate the gate for GitHub, GitLab, Azure or Jenkins.",
      },
      {
        slug: "alm",
        label: "Jira and Azure Boards",
        blurb: "Mirror requirements onto a board without letting the board define them.",
      },
      {
        slug: "deployment",
        label: "Deployment",
        blurb: "How specgate's own docs site, npm package and container image are published.",
      },
      {
        slug: "supply-chain",
        label: "Supply chain",
        blurb: "SBOM, licences, provenance and what ships in the tarball.",
      },
    ],
  },
  {
    title: "Reference",
    icon: "book",
    summary: "Look things up.",
    entries: [
      {
        slug: "commands",
        label: "Command reference",
        blurb: "Every command, its flags and its JSON shape.",
      },
      {
        slug: "how-to",
        label: "How-to guides",
        blurb: "Short answers to specific questions.",
      },
      {
        slug: "troubleshooting",
        label: "Troubleshooting",
        blurb: "When the gate says no and you disagree.",
      },
      {
        slug: "comparisons",
        label: "Comparisons",
        blurb: "How this differs from OpenSpec, Spec Kit and writing it yourself.",
      },
      {
        slug: "release-process",
        label: "Release process",
        blurb: "How a version is cut, and what support it gets.",
      },
    ],
  },
  {
    // These two were published and linked from nowhere. They are the two
    // documents that explain *why* the tool is shaped this way, which makes
    // them the wrong ones to leave unreachable.
    title: "Background",
    icon: "compass",
    summary: "Why it works this way.",
    entries: [
      {
        slug: "articles/specs-that-cannot-lie",
        label: "Specs that cannot lie",
        blurb: "The argument the tool is built on, and the defects that shaped it.",
      },
      {
        slug: "case-studies/case-1",
        label: "Worked example: brownfield adoption",
        blurb:
          "An illustration — invented company, constructed numbers — of the workflow end to end.",
      },
    ],
  },
];

/** Every slug the sidebar links to, in reading order. */
export function navSlugs(): string[] {
  return NAV.flatMap((section) => section.entries.map((entry) => entry.slug));
}

/** The entry for a slug, or `null` when the document is not in the sidebar. */
export function navEntry(slug: string): NavEntry | null {
  for (const section of NAV) {
    const found = section.entries.find((entry) => entry.slug === slug);
    if (found) return found;
  }
  return null;
}

/** What comes before and after this page, for the footer links. */
export function neighbours(slug: string): { prev: NavEntry | null; next: NavEntry | null } {
  const all = NAV.flatMap((section) => section.entries);
  const at = all.findIndex((entry) => entry.slug === slug);
  if (at === -1) return { prev: null, next: null };
  return { prev: all[at - 1] ?? null, next: all[at + 1] ?? null };
}
