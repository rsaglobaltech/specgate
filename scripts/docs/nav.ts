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
  /**
   * A subsection inside the section: the sidebar draws it as a small heading,
   * and Previous/Next stay inside it — the last phase of one journey does not
   * lead into the first phase of the other.
   */
  readonly group?: string;
  /** Its number in a journey; pages that have one get the step indicator. */
  readonly step?: number;
  /** How long the step takes, shown in the step indicator. */
  readonly time?: string;
}

export interface NavSection {
  readonly title: string;
  /** Shown at the top of the section on the docs home page. */
  readonly summary: string;
  /** Optional key into `icons.ts`, drawn beside the group heading. */
  readonly icon?: string;
  readonly entries: readonly NavEntry[];
}

/**
 * The places a reader goes, in the order they need them: start, where the
 * work comes from, every day, the gate, existing code, reference, extensions;
 * then forja, a companion tool, and everything else under "Advanced". Every
 * shipped document is still in exactly one section.
 */
export const NAV: readonly NavSection[] = [
  {
    title: "Start",
    icon: "rocket",
    summary:
      "Install it, learn the ideas behind it, and follow one of two journeys of five short steps — a new project, or code you already have.",
    entries: [
      {
        slug: "getting-started",
        group: "Begin",
        label: "Getting started",
        blurb:
          "Install it, choose where you start and where the work comes from, then the four verbs.",
      },
      {
        slug: "concepts",
        group: "Begin",
        label: "Concepts",
        blurb:
          "The six ideas behind every command, and the vocabulary: change, delta, draft, gate, matrix.",
      },
      {
        slug: "start/scratch-1-install",
        group: "From scratch",
        step: 1,
        time: "5 min",
        label: "Install and set up",
        blurb: "Create the project with your own tools, set Specgate up, run the gate once.",
      },
      {
        slug: "start/scratch-2-specify",
        group: "From scratch",
        step: 2,
        time: "20–60 min a module",
        label: "Specify",
        blurb:
          "The brief becomes a draft change per module, checked against the brief, then reviewed by a person.",
      },
      {
        slug: "start/scratch-3-build",
        group: "From scratch",
        step: 3,
        time: "as long as the code",
        label: "Build",
        blurb: "The first requirement, test first — by hand or handed to the harness.",
      },
      {
        slug: "start/scratch-4-prove",
        group: "From scratch",
        step: 4,
        time: "2 min",
        label: "Prove",
        blurb:
          "`apply` marks a requirement Implemented only through the gate; `check` and `report` show where it stands.",
      },
      {
        slug: "start/scratch-5-every-day",
        group: "From scratch",
        step: 5,
        time: "10 min, once",
        label: "Every day",
        blurb: "The gate in CI, and the four verbs every day.",
      },
      {
        slug: "start/existing-1-adopt",
        group: "Existing project",
        step: 1,
        time: "5 min",
        label: "Adopt",
        blurb: "`onboard` and `init` on a working codebase, touching no code.",
      },
      {
        slug: "start/existing-2-specify",
        group: "Existing project",
        step: 2,
        time: "10 min",
        label: "Specify",
        blurb: "One behaviour you rely on, written as a requirement with a real example.",
      },
      {
        slug: "start/existing-3-first-requirement",
        group: "Existing project",
        step: 3,
        time: "5 min",
        label: "First requirement",
        blurb: "The test you already have names it; `apply` marks it Implemented.",
      },
      {
        slug: "start/existing-4-ci",
        group: "Existing project",
        step: 4,
        time: "10 min",
        label: "CI",
        blurb: "The gate on every pull request, without fixing the past first.",
      },
      {
        slug: "start/existing-5-every-day",
        group: "Existing project",
        step: 5,
        label: "Every day",
        blurb: "One behaviour per bug fix, one module at a time.",
      },
      {
        slug: "quickstart",
        group: "Someone else set it up",
        label: "Joining a project",
        blurb:
          "The repository already uses Specgate: see where it stands and deliver your first requirement.",
      },
    ],
  },
  {
    title: "Where work comes from",
    icon: "compass",
    summary:
      "Three entries into the same lifecycle: a change you describe, a client brief, or a Jira ticket.",
    entries: [
      {
        slug: "start/write-the-brief",
        label: "Write the brief",
        blurb:
          "Your plan as docs/brief.md, the four fields on top — or let your agent propose them.",
      },
      {
        slug: "from-a-brief",
        label: "From a client brief",
        blurb: "A brief to a reviewed draft: assumptions, open questions and the draft checklist.",
      },
      {
        slug: "from-a-ticket",
        label: "From a Jira ticket",
        blurb:
          "A story with acceptance criteria to a change checked against it, a branch and a pull request.",
      },
      {
        slug: "existing-project-with-jira",
        label: "An existing codebase, with Jira",
        blurb:
          "Adopt a years-old codebase whose work arrives as Jira tickets: the spec grows ticket by ticket.",
      },
    ],
  },
  {
    title: "Every day",
    icon: "file",
    summary: "The loop a team runs on every pull request.",
    entries: [
      {
        slug: "first-pr",
        label: "Your team's first PR",
        blurb: "What the author writes, what the reviewer reads, and what to do when check fails.",
      },
      {
        slug: "reviewing-changes",
        label: "Change a shipped requirement",
        blurb: "Propose, review and archive a change to specs that already shipped.",
      },
      {
        slug: "writing-specs",
        label: "Writing specs",
        blurb: "Requirements, scenarios and the traceability matrix.",
      },
      {
        slug: "new-project",
        label: "A new product, step by step",
        blurb: "The twelve steps six pilots took, from a client's brief to a running product.",
      },
    ],
  },
  {
    title: "The gate in CI",
    icon: "server",
    summary: "What fails a pull request, and how to wire it in.",
    entries: [
      {
        slug: "validating",
        label: "Validating",
        blurb: "Every check the gate runs, what each status owes, and the flags behind check.",
      },
      {
        slug: "quality",
        label: "Quality and security checks",
        blurb: "Coverage and mutation of what a change adds, SAST, secrets, SonarQube — all in Docker.",
      },
      {
        slug: "automation",
        label: "Automation",
        blurb: "Generate the gate for GitHub, GitLab, Azure or Jenkins.",
      },
    ],
  },
  {
    title: "Existing code",
    icon: "compass",
    summary: "Adopting Specgate on a repository that already ships.",
    entries: [
      {
        slug: "case-studies/case-1",
        label: "Worked example: brownfield adoption",
        blurb:
          "One existing service adopted end to end — invented company, every command and output real.",
      },
      {
        slug: "vs-openspec",
        label: "Specgate or OpenSpec",
        blurb: "Where they differ, where OpenSpec is ahead, and how to use both.",
      },
      {
        slug: "openspec",
        label: "Already on OpenSpec",
        blurb: "Keep your OpenSpec specs; verify proves that what they call done is done.",
      },
      {
        slug: "comparisons",
        label: "Comparisons",
        blurb: "How this differs from OpenSpec, Spec Kit and writing it yourself.",
      },
    ],
  },
  {
    title: "Proven on real products",
    icon: "check",
    summary:
      "Six products built from real client briefs — what worked, and what Specgate got wrong.",
    entries: [
      {
        slug: "projects/index",
        label: "All six, compared",
        blurb: "Brief, stack, requirements and tests for each pilot, side by side.",
      },
      {
        slug: "projects/rebar-crew",
        label: "Rebar Crew — field app",
        blurb: "Expo + Next.js: 47 of 47, after a first round that was done and unusable.",
      },
      {
        slug: "projects/bookings",
        label: "Bookings — appointments",
        blurb: "Next.js from a detailed brief: 38 of 38 in five cycles.",
      },
      {
        slug: "projects/credit-shop",
        label: "Credit shop — e-commerce",
        blurb: "A five-line brief became 24 requirements, nearly every value an assumption.",
      },
      {
        slug: "projects/fincore",
        label: "FinCore — core banking",
        blurb: "Spring Boot: 59 of 60, one legal question left to the client.",
      },
      {
        slug: "projects/eventtech",
        label: "EventTech — event operations",
        blurb: "Quarkus with event sourcing and real time: 38 of 38.",
      },
      {
        slug: "projects/healthtech",
        label: "HealthTech — clinical cases",
        blurb: "Quarkus in a regulated domain: 23 of 24, no clinical rule invented.",
      },
    ],
  },
  {
    title: "Reference",
    icon: "book",
    summary: "Every command, a router to the right guide, and what to do when something fails.",
    entries: [
      {
        slug: "commands",
        label: "Command reference",
        blurb: "Every command, its flags and its JSON shape.",
      },
      {
        slug: "how-to",
        label: "How-to guides",
        blurb: "I want to… — the guide for each task.",
      },
      {
        slug: "faq",
        label: "FAQ",
        blurb: "The questions a team asks in its first week, answered in two lines each.",
      },
      {
        slug: "troubleshooting",
        label: "Troubleshooting",
        blurb: "When the gate says no and you disagree.",
      },
    ],
  },
  {
    title: "Extensions",
    icon: "robot",
    summary: "Agents, MCP, the harness, domain packs and your issue tracker.",
    entries: [
      {
        slug: "agents",
        label: "Agent tools",
        blurb: "Wire Claude Code, Cursor, Copilot and six others into the same loop.",
      },
      {
        slug: "mcp",
        label: "The MCP server",
        blurb:
          "The daily loop as tools for Claude Desktop, Cursor and other MCP clients, and the guard on the spec.",
      },
      {
        slug: "harness",
        label: "The harness",
        blurb: "Unattended delivery: plan → agent → gate → apply, one worktree per requirement.",
      },
      {
        slug: "studio",
        label: "The studio",
        blurb: "Specgate as an app: from an empty folder to the report, without the commands.",
      },
      {
        slug: "harness-report",
        label: "What the harness has cost",
        blurb: "First-attempt rate and cost per delivered requirement, from the run ledger.",
      },
      {
        slug: "domain-packs",
        label: "Domain packs",
        blurb: "Install requirements a pilot already proved, or package your own.",
      },
      {
        slug: "packs-end-to-end",
        label: "Domain packs, end to end",
        blurb: "Install a pack, upgrade it to a new version, and take it off again.",
      },
      {
        slug: "alm",
        label: "Jira, Azure Boards, GitHub",
        blurb: "Mirror requirements onto a board without letting the board define them.",
      },
    ],
  },
  {
    // ADR-0033: forja's documentation lives here, one site for both tools.
    title: "New project (forja)",
    icon: "package",
    summary:
      "forja, a companion tool, generates a whole application with the architecture in place, sign-in working and Specgate adopted.",
    entries: [
      {
        slug: "forja/getting-started",
        group: "Generate",
        label: "Getting started",
        blurb: "Generate a Next.js + Expo monorepo in TypeScript, with the hexagon in place.",
      },
      {
        slug: "forja/java",
        group: "Generate",
        label: "Java backends",
        blurb: "A Spring Boot or Quarkus API, a Next.js web app and Keycloak sign-in.",
      },
      {
        slug: "forja/daily-use",
        group: "Grow it",
        label: "Daily use",
        blurb:
          "Add use cases, entities and ports where the architecture expects them; check the setup.",
      },
      {
        slug: "forja/specgate",
        group: "Grow it",
        label: "With Specgate",
        blurb: "How a generated project adopts Specgate, and how a use case names its requirement.",
      },
      {
        slug: "forja/e2e",
        group: "Grow it",
        label: "End-to-end tests",
        blurb: "Playwright drives the sign-in flow in a real browser.",
      },
      {
        slug: "forja/cli",
        group: "Reference",
        label: "forja command line",
        blurb: "init, add, doctor: every flag and the values it accepts.",
      },
      {
        slug: "forja/config",
        group: "Reference",
        label: "forja.config.json",
        blurb: "Every field, its values and its defaults.",
      },
      {
        slug: "forja/generated-project",
        group: "Reference",
        label: "What it generates",
        blurb: "Recipe by recipe: the folders, the files, the versions.",
      },
      {
        slug: "forja/architecture",
        group: "Reference",
        label: "The generated architecture",
        blurb: "The hexagon forja generates and the rules that keep it.",
      },
      {
        slug: "forja/contributing",
        group: "Reference",
        label: "Contributing to forja",
        blurb: "Develop forja, write a recipe, verify what it generates.",
      },
    ],
  },
  {
    title: "Advanced",
    icon: "book",
    summary: "Longer reads, setups and the reasons behind the design.",
    entries: [
      {
        slug: "tutorial",
        label: "Tutorial: Smart Parking",
        blurb:
          "A complete worked example on a domain pack, from a blank folder to a delivered requirement.",
      },
      {
        slug: "agent-setup",
        label: "Choosing your agent",
        blurb: "Claude, Aider, Cursor or a three-line wrapper — and the two things that bite.",
      },
      {
        slug: "supply-chain",
        label: "Supply chain",
        blurb: "SBOM, licences, provenance and what ships in the tarball.",
      },
      {
        slug: "release-process",
        label: "Releases & deployment",
        blurb: "How a version is cut and published to npm, Docker and the docs site.",
      },
      {
        slug: "articles/specs-that-cannot-lie",
        label: "Specs that cannot lie",
        blurb: "The argument the tool is built on, and the defects that shaped it.",
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

/**
 * What comes before and after this page, for the footer links. A page in a
 * group stays inside it: Next on a journey's last phase is nothing, not the
 * other journey's first.
 */
export function neighbours(slug: string): { prev: NavEntry | null; next: NavEntry | null } {
  const all = NAV.flatMap((section) => section.entries);
  const entry = all.find((e) => e.slug === slug);
  if (!entry) return { prev: null, next: null };
  const scope = entry.group ? all.filter((e) => e.group === entry.group) : all;
  const at = scope.indexOf(entry);
  return { prev: scope[at - 1] ?? null, next: scope[at + 1] ?? null };
}

/** The numbered steps of the journey this page belongs to, or [] when it is in none. */
export function journeyOf(slug: string): NavEntry[] {
  const entry = navEntry(slug);
  if (!entry || !entry.group || !entry.step) return [];
  return NAV.flatMap((s) => s.entries).filter((e) => e.group === entry.group && e.step);
}
