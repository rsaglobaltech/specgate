<!-- specgate:allow-placeholders — release notes quote the {{VAR}} template syntax. -->

# Changelog

Notable changes, newest first. Follows [Keep a Changelog](https://keepachangelog.com/)
and [Semantic Versioning](https://semver.org/).

The release process is in [`docs/release-process.md`](docs/release-process.md).

## [Unreleased]

### Fixed

- **Quality presets for each app of a monorepo** (REQ-235): `quality init` read only the root's build files, so forja's Spring Boot API in `apps/api` got no Java check at all. It now reads each app folder — one level down, or in `apps/`, `packages/` and `services/` — when the root has no build file of that stack, and runs its checks there (`cd apps/api && mvn …`) with their reports named from the root. One Semgrep scan carries every stack's rules, a renamed check writes its own SARIF, and `{changed_classes@<folder>}` and `{changed_src@<folder>}` keep one folder's files.
- **forja is found, or you are told how to get it** (REQ-236): `init --forja` and `add` use `SPECGATE_FORJA_CMD`, then a `forja` on the PATH, then npx; when npm does not have the package, `init --forja` stops with how to install it instead of npm's 404. forja gets Specgate's version in `SPECGATE_VERSION`, so the project it generates depends on the Specgate that generated it.
- **Maven dependencies are scanned from the build's own bill of materials** (REQ-237): an `sbom` check writes CycloneDX with Maven, in its image and cache, and `dependencies` runs osv-scanner (now 2.2.4) on it. osv-scanner could not resolve a Spring Boot 4 parent by itself (deps.dev did not have it, Maven Central answered 429), so it scanned 2 of 96 packages, or failed.
- **Tests that start containers run in the gate** (REQ-238): `docker: true` gives a check the host's Docker and what Testcontainers needs to reach it; the Maven and Gradle presets set it on coverage and mutation when the build declares Testcontainers. forja's Spring Boot tests failed with "Could not find a valid Docker environment" before.
- **The baseline runs what a check needs first** (REQ-240): `needs: <check>` names an earlier check whose output a check reads; `quality baseline` ran only the SARIF checks, so Maven's `dependencies` found no bill of materials and its debt was not recorded.
- **`quality run --json` says why a check failed** (REQ-239): each outcome carries the last 30 lines the check printed.

## [0.27.1] — 2026-10-28

0.27.0 reached ghcr.io only: its npm and GitHub Packages publish stopped on a quality check that failed on CI runners. This is that release, with the fix and the studio's new-project step working in an empty folder.

### Fixed

- **A quality check run as the person has a home it can write**: in Docker on Linux, a check runs with your uid, and Semgrep failed when that uid was not the image's own user (uid 1001 on a CI runner) because it could not create its cache in `/`. It now runs with `HOME=/tmp`.
- **The studio stays up in an empty folder** (REQ-213): any request it does not serve, such as the browser's own `/favicon.ico`, made it read the matrix and exit when there was none, so the new-project step died on its first load. It answers 404 until the project exists. The step also says it asks five questions, not four.

### Changed

- **The documentation shows the quality checks and the studio**: a band for each on the landing page, the studio under Start with a screenshot of every step, and the gate's section named after the tools it runs.

## [0.27.0] — 2026-10-28

Quality, not only tests: your team's checks in the gate — coverage and mutation of the lines a change adds, SpotBugs, PMD, Semgrep, secrets, dependencies, SonarQube and Conventional Commits — each in Docker, without an account, and only what a change adds fails.

### Added

- **Quality and security checks in the gate** (REQ-218, REQ-219, ADR-0040): `checks:` in `harness.config.yaml` names your team's tools — each with `when` (attempt, end, ci), whether it gates, and how it runs (Docker by default, local or auto). `check` runs them after the tests, `check --ci` adds the CI-only ones and fails a check that cannot run, and the harness runs them per attempt and before a requirement is kept.
- **Only what a change adds fails** (REQ-222, REQ-223): SARIF findings are compared with `.specgate/quality-baseline.json`; `specgate quality baseline --accept` records today's debt. Diff coverage (JaCoCo, LCOV, Cobertura) and mutation score (PIT, Stryker) are measured on the lines the change touched, against `diff_coverage` and `mutation_score`.
- **Presets for Maven, Gradle and Node** (REQ-225, REQ-230): `specgate quality init [--level basic|strict]` writes the checks for the stack it detects — JaCoCo, PIT, SpotBugs, PMD, Semgrep, gitleaks, osv-scanner, Vitest/Stryker — all in pinned Docker images, with dependency caches in named volumes. `quality list`, `quality doctor [--pull]` and `quality run` show and run them.
- **Conventional Commits** (REQ-234): `builtin:commits` checks each commit of the change against Conventional Commits 1.0.0, with `commit_types` to set the types.
- **SonarQube without an account** (REQ-226): `builtin:sonar` starts SonarQube Community in Docker on 127.0.0.1, analyses the change and judges its issues like any SARIF; the token stays in `.specgate/sonar.local`, ignored by git.
- **An agent that reviews** (REQ-227): `builtin:review` and `builtin:adversary` run a profile as reviewer of the diff; its verdict gates or advises.
- **Architecture as findings** (REQ-231): with `arch_sarif:`, only an architecture violation the change adds fails.
- **The quality of what was delivered** (REQ-220, REQ-221, REQ-228, REQ-229): each run record keeps its checks; `harness report` and the studio's report show diff coverage, mutation score and findings per requirement; the studio's Project page lists the checks and its new-project step asks for the level.

### Changed

- **Commit messages follow Conventional Commits** (REQ-234): a failed attempt is committed as `chore(REQ-NNN): attempt FAILED the gate` (resume still reads the old `wip` form), a green one as `feat(REQ-NNN): …`, and the agent's prompt asks for the same.

- **The studio commits the specification before a build** (REQ-233): the brief, approvals, answers and drafts the studio wrote are committed with the person's own git identity, so the harness finds the clean tree it needs. Any other uncommitted file stops the build, named, and is never committed.

## [0.26.0] — 2026-10-27

The studio becomes an app: from an empty folder to the report of what was built, step by step, without the commands. And a clean slate: everything a brief-to-app run left on the list, the test suite green on Windows.

### Added

- **The studio is an app you use without the commands** (REQ-204): `specgate studio` opens on a route of seven steps — Project, Brief, Drafts, Questions, Review, Build, Report — each done, current or locked as the project's files say, with one next action (REQ-212). A simple mode hides the commands and an advanced one shows each action's; Spanish and English. Every write is a POST with the page's token; the overview it replaced is at `/overview`.
- **A project from an empty folder** (REQ-213): four questions — name, web/API/mobile, stack, agent — and the studio runs `specgate init`, writes the harness configuration and the agent's profiles, a brief to fill and a first commit. A folder with files is left alone, with the command that adopts it.
- **The brief as a form** (REQ-214): product, who uses it, and per module its rules, examples and open questions, saved into `docs/brief.md` keeping every other line; markdown in advanced mode; the brief rules come back with each save. A client's text can be pasted for the agent to structure (REQ-215).
- **Drafting each module from the studio** (REQ-216): in the background, one at a time, with its progress and the checklist in plain words, and a way to stop it.
- **Review and approve a draft** (REQ-206, REQ-207): `specgate change approve <id>` records that a person approved it, refused while the checklist has errors or a question is open; `specgate change note <id> "<text>" --req REQ-x` asks for a change in your words. Review in the studio does both.
- **Build from the studio** (REQ-208, REQ-209): what is ready, an estimate, the harness started in the background, its steps in plain words, and a stop that takes effect after the requirement in progress. Answering a question releases the requirements it held (REQ-210).
- **The agent chosen per run** (REQ-211): `harness run --profile <name>` and `propose --from-brief --profile <name>` run that profile of `.harness/profiles.yaml`; the studio lists the profiles with their cost hint and whether they stream usage.
- **The report** (REQ-217): what was built of the total, each requirement with the scenario that proves it, what is missing and why, the decisions taken, cost and time; downloadable as one HTML page.
- **Answer a question from the live view** (REQ-201): under each question the agent asked, Needs attention has a form to answer it and then mark it reviewed. The write, `POST /live/answer`, goes through the same code as `specgate answer` and needs the token its own page carries, a JSON body and a loopback origin; any other method than GET or HEAD gets 405.
- **Every open question in the live view** (REQ-203): an Open questions section lists what `specgate questions` lists, each with the same form, so drafts' questions are answered from studio too; a question the agent asked shows as waiting for an answer, not as a failure.
- **A requirement used on a screen needs an end-to-end test** (REQ-199): with `e2e_dir` in `harness.config.yaml`, a requirement whose actor uses web, mobile, tablet or desktop passes the gate only once a file there names it, and its prompt says so.
- **A requirement an open change modifies is reworked** (REQ-198): the harness gives it `NEEDS_REWORK` instead of `NEEDS_STATUS_UPDATE`, and its prompt says the tests and code are for the old text.

### Changed

- **The harness template shows the streaming agent** (REQ-200): the Claude Code command that feeds studio's live view, and `e2e_dir`.
- **Opening a module says which drafts stop growing** (REQ-197).
- **Status names the module** of the next use case (REQ-193), and **DRAFTING.md gives the draft's real limit** with how to grow it (REQ-194).

### Fixed

- **The dry run names the agent only when one is set**, so `harness prompt` prints no `Agent none`.
- **The Cucumber gate on Windows** (REQ-196): the message stream went to a path Cucumber did not write, so a filter matching nothing passed. The four tests that failed only on Windows pass, tests remove their temp folders, and `docs:terminal` / `docs:journey` say they need a POSIX shell.
- **Ids reserved from a mention** (REQ-202): "GIVEN REQ-999 is defined nowhere" in a scenario made the next change start at REQ-1000; only headings, matrix rows and `req_range` count now.
- **No inline code split across changelog lines** (REQ-195), checked by a test.

## [0.25.0] — 2026-10-27

Questions you answer with a command, and a specification that evolves without copying by hand: what taking a brief to a delivered app asked for.

### Added

- **Everything waiting for an answer, in one list** (REQ-187):
  `specgate questions` lists the open questions of every open change and of
  `docs/specs/questions.md`, with what each blocks, and the requirements in
  Needs Clarification that no question names.
- **Answering writes the answer and what it decides** (REQ-188):
  `specgate answer Q6 "…"` fills the question's row, adds an assumption to
  review and names the requirements to revise. The draft checklist (D13)
  waits until `specgate answer Q6 --reviewed` says the spec reflects it; an
  answer that decides nothing, such as "TBD", is refused.
- **The agent can ask instead of guessing** (REQ-189):
  `specgate ask REQ-049 "…"` records the question where the requirement is
  defined and sets it Needs Clarification. Inside the harness the attempt
  ends as a question, no retry is spent, the harness commits the question,
  and the live view shows it under Needs attention with the command that
  answers it. The harness prompt tells the agent so.
- **Modifying a delivered requirement starts from its text** (REQ-190):
  `specgate change new <id> --modify REQ-017` copies the requirement into a
  MODIFIED delta, reopened as Draft.
- **What a change to a requirement touches** (REQ-191):
  `specgate change impact <REQ|change>` lists its spec file and line,
  features, tests, the files its commits changed and the requirements that
  name it.
- **A new requirement for a module the brief covers** (REQ-192):
  `specgate brief add <module> "…"` appends the line to the brief and adds a
  requirement quoting it to the module's open change, or creates
  `<module>-additions`, even when the module is archived.

### Fixed

- **The live matrix reads a quoted status whole**: `status="Needs Clarification"`
  was read as `Needs`.

## [0.24.0] — 2026-10-26

A live view you can work from, and a harness that survives a night: what a twenty-requirement chain in a Next.js app ran into.

### Added

- **A requirement opens into everything the project holds about it**
  (REQ-180): clicking a requirement in `/live` shows its statement, its
  scenarios with their steps, the spec file and line that define it, its
  assumptions, the tests that name it, its feature, every attempt with the
  stage it failed at, and the files the last attempt changed, each linked to
  the editor.
- **The agent's session in the live view** (REQ-182):
  `harness events --from claude` now records the model, the context of each message against the
  model's window, and the session's tokens, cost and turns; `harness run`
  keeps the run's queue and each attempt's prompt beside the events. The
  sidebar is the run's work queue (now, needs attention, up next with an
  estimate, finished recently), the summary adds tokens and cost, and an
  Agent tab shows the selected attempt's session and the prompt it was given.

### Changed

- **The live view groups by module and keeps its header in view** (REQ-181):
  the header and summary stay put while the page scrolls; the centre is a
  matrix by module, one segment per requirement, queued ones included; and a
  Traceability view shows the matrix as it stands, filtered as you type.

### Fixed

- **The harness no longer fills the disk** (REQ-184): the in-flight view
  copied each worktree whole, `.next/cache` included, until a chain stopped
  with ENOSPC. It now copies only what git keeps, and a requirement does not
  start with less than 2 GB free (`SPECGATE_HARNESS_MIN_FREE_GB`).
- **Re-running delivered requirements works in the order asked** (REQ-185):
  `--req` order is kept, and a branch whose own work is already merged is
  recreated without `--force`.
- **One harness run per working copy** (REQ-186): a lock beside the events
  refuses a second run; `check` warns while a run holds it; a post-merge
  failure says it ran in the working copy.
- **`check` fills the test command's placeholders** (REQ-183): a test command
  with `{req}` ran with the literal text. `check` runs it for the whole
  project, with the placeholders empty; `apply` and `done` fill `{req}` with
  the requirement they deliver.
- **The live view takes the last attempt that started**, not the highest
  attempt number, so a new run's attempt 1 is not hidden by an earlier run's
  attempt 3.

## [0.23.0] — 2026-10-25

The live view, read like a CI run: watch the harness work through a run requirement by requirement, step by step.

### Changed

- **The live view reads like a CI run** (REQ-179): `/live` listed every
  requirement the same way, by id alone. It now has a sidebar of the run's
  requirements by module, a summary of the run, its requirements as a graph of
  jobs, and the selected one's steps (Agent, each gate stage, the stages still
  to come) with the agent's stream as the log of the step in progress. Each
  requirement shows its title from the specification. Light and dark.

## [0.22.3] — 2026-10-25

What a first project from a brief tripped over, from statuses to the harness's first attempt: rehearsed on a Spanish brief with eight modules and a Next.js monorepo.

### Fixed

- **Approved owes a test, as the strict gate says** (REQ-173): `apply --status Approved` wrote Approved on a requirement no test named, and the
  next `validate --strict` failed TDD-1 for the whole project, so every
  `harness run` went red whatever requirement it worked on. `apply` and `done`
  now refuse it with the TDD-1 reason and the fix, as they already did for
  Implemented; `--no-check` writes it and warns. An unknown `--status`, such
  as `Aproved`, is refused instead of written.
- **A base the gate already fails is said before any agent runs** (REQ-175):
  the harness gate judges the whole project, so a red base failed every
  attempt for a reason outside its requirement, three paid attempts at a time.
  `harness run` now validates the base first and stops when a requirement
  outside the run is past Draft with no test (TDD-1, TDD-2), which no attempt
  may fix; no branch is created, and `--skip-baseline` runs anyway.
- **A question that blocks nothing says so** (REQ-176): D7 refused every open
  question without a requirement to block, so a question for later had to be
  dropped. `none` (or `—`, `ninguno`) in its Blocks column makes it a warning;
  an empty cell is still refused. `docs/from-a-brief.md` now shows how to
  answer a question, step by step.
- **An open draft can reserve more ids** (REQ-177): a draft's ten ids could
  not grow, and agents folded new behaviour into existing requirements to fit.
  `propose --from-brief <module> --reserve <n>` on an open draft now grows its
  ranges and rewrites DRAFTING.md, as long as its range is the last reserved.
- **Three papercuts on a first project** (REQ-178): B9 no longer warns about
  the one actor of a brief written in the first person; `harness init` keeps
  a `.harness/prompt-prefix.md` you edited instead of refusing, so it can be
  re-run to register the merge drivers; and `validate` without a directory
  names `specgate validate .` instead of printing the whole help.

## [0.22.2] — 2026-10-21

Parallel tickets that never overwrite each other, rehearsed end to end on a brownfield Maven project with Jira tickets and OpenCode.

### Fixed

- **A merge driver that is gone falls back to git's merge** (REQ-169): in a
  project without `node_modules`, the drivers run this machine's copy of
  specgate. With that copy gone, git stopped the merge with only your side in
  the file, no markers, and `git add` dropped the other side's text. The
  driver now says it is missing and merges by lines; `specgate doctor` warns.
  Re-run `specgate harness init` in clones registered before this release.
- **`id_taken_on_base` only for ids the branch introduced** (REQ-120): a
  requirement the base changed after the branch started was reported as an id
  taken, with the advice to renumber it.
- **A local `develop` nobody updated is not the base** (REQ-148): `pr.base`
  resolves to `origin/develop` unless the local branch already contains it,
  and a ticket's branch no longer tracks its base. Behind origin, every
  colleague's commit merged from `origin/develop` was reported as missing the
  ticket key.
- **`check` compares ids with `pr.base`** (REQ-120): ticket keys were
  measured from `develop` and ids from the remote's default, `main`, so an id
  taken on `develop` and not yet released went unseen.
- **`harness init` keeps a generated matrix on `merge=union`**: it appended
  the row driver after the union line, and git takes the last matching line,
  so the matrix could stop a merge again (ADR-0036).
- **A ticket's branch starts from `develop` with gitflow** (REQ-148): from
  `pr.base`, else the branch you are on, else the remote's default. A clone
  whose default is `main` cut the branch from `origin/main`, without the
  team's work on `develop`; `ticket_key_missing` measures from the same base.
- **Readable ids from German summaries** (REQ-161): `ß` → `ss`, `ä` → `ae`…;
  "Groß-/Kleinschreibung" made `gro-kleinschreibung`.

### Added

- **`change_base_moved`** (REQ-168): a change records, in `based_on` in its
  `change.yaml`, the text of each requirement it modifies or removes; `check`
  warns and `archive` refuses when that requirement changed since, and `check`
  warns before the branch has even brought the base in.
  `change validate <change> --rebased` records the new text once the delta is
  rewritten. When two tickets rewrote one requirement, the second used to
  archive over the first with a green gate and no conflict.
- **Capability specs merge requirement by requirement** (REQ-166):
  `harness init` registers a second git merge driver, `specgate-spec`, for
  `docs/specs/capabilities/*/spec.md`, and `doctor` checks it. Two tickets
  archiving into the same capability used to conflict on the whole file; only
  a requirement both rewrote differently conflicts now.
- **OpenCode in `agents init`** (REQ-162): `/specgate-*` commands in
  `.opencode/commands/`, detected from `.opencode/` or `opencode.json`.
- **Opening a ticket's change commits and pushes it** (REQ-165), so the ids it
  reserved are visible to every other clone at once; the branch used to be
  pushed empty, with the reservation left uncommitted on one disk.
- **`change_id_clash`** (REQ-164), and `propose --from-ticket` fetches
  `origin` before reserving ids (REQ-163): two developers who opened tickets a
  minute apart on two clones both reserved REQ-010.
- **`change_overlap`** (REQ-160): `check`, and the report on a change opened
  from a ticket, warn when a requirement your open change modifies or removes
  is also rewritten by another open change, on this branch or on any local or
  remote-tracking branch not merged yet. Two tickets rewriting REQ-012 on two
  branches used to surface as a git conflict at the second merge, or not at
  all.

## [0.22.1] — 2026-10-20

Documentation a newcomer can follow, and the CLI's words brought in line with it.

### Changed

- **The documentation, rewritten** after an audit of every page against the
  CLI and the first real end-to-end run on Jira Cloud and GitHub. Three
  sources of work (a change, a brief, a Jira ticket) into one lifecycle of
  four verbs; the recorded journeys run `propose`, `apply` and `archive`;
  archive comes before the pull request everywhere. New pages: _From a Jira
  ticket_ for a team lead setting it up, and _An existing codebase, with work
  in Jira_ (Maven profiles, a parent POM, Bitbucket and Jenkins).
- **The `/specgate:draft` agent command runs `propose --from-brief`**, and the
  MCP write guard names `specgate propose <id>`.

### Fixed

- `propose --help` lists `--no-push`; `alm --help` no longer says a ticket has
  no acceptance criterion.
- `alm pr` asks for the least token it needs: Pull requests, read and write.
- `alm pr` is covered by an E2E journey and is not exposed as an MCP tool.

## [0.22.0] — 2026-10-20

A brief shaped like what it becomes, checked before any agent drafts from it
(ADR-0038); and a Jira ticket as source text, as a brief is (ADR-0039). Tried
end to end on a real Jira Cloud board and GitHub: two stories went from the
ticket to Done, the board moved by its own automation.

### Fixed

- **New ids are free on every branch** (REQ-152). Two changes opened on two
  branches both reserved REQ-002: reserving ids now reads every local and
  remote-tracking branch. A change also reserves its scenario ids,
  `scn_range` in `change.yaml` (REQ-157).
- **A monorepo's stack is read from its apps** (REQ-153). With npm workspaces,
  `AGENTS.md` said "Stack: Node.js" for a Spring API in `apps/api`.
- **`specgate update` updates the `AGENTS.md` contract** (REQ-155), keeping its
  facts and project rules, also when the project has no other agent files.
- **The harness's commits name the ticket** (REQ-156): `KAN-14 REQ-002: …`.
- **`--agent` on an open change hands the agent its findings.** A second run
  read a finished draft and changed nothing.
- **Credentials never travel over plain http**: `base_url` and `pr.base_url`
  must be https (localhost excepted).

- **`specgate alm pull` works against Jira Cloud again.** Atlassian removed
  `/rest/api/3/search` (HTTP 410); search now pages `/rest/api/3/search/jql`
  by `nextPageToken`, up to 1000 issues.
- **Tokens created with scopes.** `cloud_id: auto` sends every Jira request
  through `api.atlassian.com/ex/jira/<cloud id>`, the only door such a token
  opens. Sent to the site, such a token is answered as anonymous — HTTP 200 and
  no issues — which used to read as "No open issues"; it is now a 401 whose fix
  names `cloud_id: auto`.

### Changed

- **A draft is not opened over a broken brief.** `propose --from-brief <module>` refuses with `brief_not_ready` while the brief has an error: an
  empty body, an empty module section, a module without its section once the
  brief uses sections, or rules without examples. A brief with no module
  sections — a pasted email — drafts as before.
- **`--new-brief` writes cards.** Why, a glossary, a `## Module:` section with
  Rules, Examples and Questions, and notes, in place of the six sections.

### Added

- **From a Jira ticket** ([ADR-0039](docs/specs/adr/0039-the-ticket-as-source-text.md),
  change `ticket-source`, [the page](docs/from-a-ticket.md)).
  - `specgate propose --from-ticket <KEY | issue.json> --check`: the ticket's
    intent, source, acceptance criteria and open questions (English, German or
    Spanish headings, ADF or plain text, or `acceptance_field`), and a
    Definition of Ready, T1–T9, each with a fix an analyst applies in Jira.
  - `specgate propose --from-ticket <KEY>`: the change `<key>-<slug>` with
    `ticket.md` as its source — the D-checklist runs against the ticket, and an
    edited copy is `ticket_copy_edited` — the capability from `epics:`, and the
    branch `feature/<KEY>-<slug>` (`bugfix/` for a bug). `--agent` drafts it,
    confined, never writing the copy.
  - `ticket_changed` when the ticket moved since the change was opened;
    `ticket_key_missing` from `check` for a commit on the ticket's branch that
    does not name it.
  - `specgate alm pr <change>`: one pull request per ticket on GitHub, titled
    with the key, its body the requirements and the gate, the archived change
    included (REQ-159). Never merges; keeps what reviewers wrote.
  - The ticket's branch is pushed as soon as it is created (REQ-148), so a
    Jira automation moves the ticket when work starts.
  - `AGENTS.md` names the ticket path (REQ-154); in a project connected to
    Jira, `status` suggests `propose --from-ticket` (REQ-158).
- **Brief cards** ([ADR-0038](docs/specs/adr/0038-brief-cards.md), change `brief-cards`).
  - `specgate propose --from-brief --check`: rules B1–B11 on the brief, each
    with its fix. Errors (B1–B4) stop a draft; warnings (B5–B11) name vague
    words, promises without a number, technology in a rule, modules too big,
    actors never mentioned, non-goals in a rule, and conditions placed last
    (EARS).
  - `non_goals: [...]` in the front matter.
  - `DRAFTING.md` quotes the module's section and lists its values and
    questions: a rule becomes a requirement, an example a scenario, a question
    a `questions.md` row.
  - `propose --from-brief --agent` proposes the module sections from pasted
    notes, once the fields are complete; a lost line puts the brief back
    (`draft_brief_text_lost`).
  - `propose --help` says when no brief is needed.
- **"Write the brief" in eight steps**, with a glossary, the EARS patterns and
  the whole Lingo example, its outputs recorded.

### Fixed

- **Front matter shapes are reported as shapes.** `actors: [Admin]` was "There
  is no `actors:` list" and `surfaces: web` passed silently; both are now
  `brief_wrong_shape` with the line to write.
- **D6 no longer reads HTML comments as the brief.** A template's hint such as
  "e.g. 48 hours" made 48 look stated.
- **`explore` prints a project snapshot**, no longer called a brief.
- **The guides use `propose --from-brief`** where they still said `draft`, and
  forja's guide follows propose → apply → archive.

## [0.21.0] — 2026-10-20

The daily loop becomes four verbs over the same gate (ADR-0035), the gate stops
failing on text that is not a defect (ADR-0036), and the harness can be watched
while it works (ADR-0037).

### Breaking

- **`archive` (and `change archive`) waits for the code.** A change is merged
  into the specs only once every requirement it adds or modifies is
  Implemented; before, it was archived first and delivered after. `--force`
  does not skip this. Drafts from a brief follow the same path: review, apply,
  then archive. Scripts that archived a change before implementing it now get
  `archive_requirements_pending` with the `specgate apply` to run.
- **`specgate studio` binds to 127.0.0.1** and refuses requests addressed to
  another host name; pass `--host` to serve it elsewhere (a devcontainer).

### Added

- **See the harness work** ([ADR-0037](docs/specs/adr/0037-see-the-harness-work.md), change `live-view`).
  - `harness run` writes `.harness/events/<REQ>.jsonl` — attempts, gate stages,
    chain merges — and hands the agent `AGENT_EVENTS_FILE`, `AGENT_EVENTS_REQ`,
    `AGENT_EVENTS_ATTEMPT`.
  - `specgate harness events --from claude` turns Claude Code's stream into
    events; no file contents, tool output or secrets, commands masked.
  - `specgate studio` serves `/live`, `/live.json` and `/live/stream`
    (server-sent events), bound to 127.0.0.1 and refusing foreign Host headers;
    `--host` binds elsewhere on purpose.
  - `specgate explore` — a brief of the project's state for thinking with an
    agent before a change exists; writes nothing.
  - `specgate onboard --tour` — the whole loop on a temporary copy, narrated.

- **A gate a team can trust** ([ADR-0036](docs/specs/adr/0036-a-gate-a-team-can-trust.md), change `trust-gate`).
  - `check` compares requirement ids with the base branch (`--base`,
    `SPECGATE_BASE`, or origin's default) and fails on the same id with another
    title (`id_taken_on_base`), naming the next id free on both sides.
  - `harness run --chain`: one requirement at a time, each cut from the
    previous merge, merged with a merge commit when green, the gate run again
    on the merge, a red result undone, the chain stopped at the first failure.
  - `harness run --setup-cmd <cmd|none>`; without it, the install the lockfile
    implies runs in each new worktree. The agent gets `SPECGATE_REQ` and
    `SPECGATE_ATTEMPT`.
  - A corpus fixture of real specification shapes passes `validate --strict`
    with no finding; `SPECGATE_CORPUS` runs the same test over private projects.

- **Four verbs, one lifecycle** ([ADR-0035](docs/specs/adr/0035-four-verbs-one-lifecycle.md), change `compact-use`).
  The short help is `init`; `propose`, `apply`, `status`, `archive`; `check`.
  - `specgate propose <id>` opens a change with a delta to write (`change new`);
    `propose --from-brief` drafts the next module of `docs/brief.md` (`draft`).
  - `specgate apply [REQ]` delivers one requirement — the next one when none is
    named: refused while no test names it (`apply_no_test`, with the fix), gated,
    then Implemented. `done` is its old name, with the same result.
  - `specgate archive <id>` merges a change once every requirement it adds or
    modifies is Implemented (`archive_requirements_pending`); `--force` does not
    skip that.
- **An open change's requirements count while it is in flight.** `status`,
  `apply`, `check` and `harness run` judge the project as it will be after
  archive — a temporary copy with every open change archived into it — and
  `apply` writes the status in the change's delta.

### Changed

- The placeholder rule ignores code spans, and the vague-step rule code spans
  and quoted text: `` `tool verify <module>` `` is a command, not a template.
- TDD-3 asks a matrix row for a requirement a spec _declares_ (a heading or a
  requirement table row outside fenced code), not for every id it mentions.
- A generated matrix is declared `merge=union` in `.gitattributes`: parallel
  branches no longer conflict on it, and `check` regenerates it.
- `new` and `req add` allocate above the ids open changes reserved.

- **A change is archived when its code is done**, not before. Drafts from a
  brief follow the same path: reviewed, applied, then archived. `draft` names
  `specgate apply` once a draft is ready, and the next module to draft skips
  one that is ready.
- Unchecked tasks are a warning, not a refusal, for a change whose requirements
  all passed the gate; a change with none still needs its tasks ticked.
- `status` names `specgate apply REQ-…` where it named `specgate done REQ-…`.
- A delta's scenario findings name their requirement:
  `Scenario "…" of REQ-007 has no steps.`

- The codebase compiles under full `strict` TypeScript (`noImplicitAny`,
  `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`), typed throughout
  instead of `any`; the documentation site, README and CONTRIBUTING teach the
  four-verb loop.
- Dev dependencies: @cucumber/cucumber 13.3.0, typescript-eslint 8.71.2,
  prettier 3.9.10, js-yaml 5.5.0, marked 18.1.1, @types/node 26.6.5; Pages
  actions `upload-pages-artifact` v5 and `deploy-pages` v5.

### Fixed

- `specops diff --as-change` printed `── undefined @ undefined ──` in its human
  output: it read snake_case fields from camelCase results.
- **The CLI no longer contradicts ADR-0035–0037** (four verbs, trusted gate, live view).
  - `agents init` (and the bundled Claude Code plugin) teaches propose → test →
    apply → archive: `/specgate:propose` opens a change, `/specgate:apply`
    delivers a requirement, `/specgate:archive` runs only once all are applied;
    `/specgate:draft` no longer says to archive before building, and
    `/specgate:done` stays as an alias of apply. `AGENTS.md` says the same.
  - `docs:terminal:check` and `docs:journey:check` no longer crash: the
    storyboards leave the draft open, apply its requirements, and show archive
    waiting for the rest. Recordings and `docs/start/` regenerated.
  - `specgate explore` outside a Specgate project refuses with
    `project_not_found` and a fix line (exit 2) instead of an ENOENT stack.
  - Next-step advice names the new verbs: `propose --from-brief` says
    `specgate propose --from-brief …`, the no-test-command warning and
    `done_needs_clarification` say `apply`, and fixes that named `change new`,
    `change archive` or `done` say `propose`, `archive` or `apply`. The old
    names keep working.
  - `status` with an open draft shows its `questions.md` at the change's real
    path (not under `changes/archive/`), and counts a ready draft as drafted.
  - Right after `specgate propose`, `check` passes: a change whose delta is
    still the untouched skeleton is not judged yet, and `status`/`check` say so
    (`change_delta_unwritten`, info). A delta with real but invalid content
    still fails.

## [0.20.0] — 2026-10-12

### Added

- **One front door for a new application** ([ADR-0033](docs/specs/adr/0033-one-front-door-two-engines.md)).
  `specgate init --forja [<name> <flags…>]` generates a whole application with
  [forja](https://github.com/rsaglobaltech/forja) — a Next.js + Expo monorepo in
  TypeScript, or a Spring Boot / Quarkus API with a web app — which adopts
  Specgate as it installs. In a terminal, plain `init` in an empty folder asks
  first. forja is fetched with `npx` only when chosen, so Specgate keeps zero
  runtime dependencies; `SPECGATE_FORJA_CMD` points at another forja.
- **`specgate add usecase|entity|port`** in a forja project: the class where the
  architecture expects it, its test and its wiring, through `forja add`; `add usecase` also creates the requirement and names it in the test. Outside a forja
  project it says to use `new`. In a forja project, `status` suggests it as the
  next step for a requirement with no code.
- **`arch_cmd`: your architecture check in the gate** ([ADR-0028](docs/specs/adr/0028-architecture-conformance-is-part-of-the-gate.md), points 1–2).
  `specgate config set arch_cmd "<cmd>"` — ArchUnit, dependency-cruiser,
  import-linter… — and `check`, `done` and the harness gate run it between
  validation and the tests; in the harness a failure goes back to the agent.
  Without it the gate passes as before and says the architecture was not checked.
- **The documentation site carries forja's documentation**, as the "New project
  (forja)" section, and the landing page shows where Specgate and forja sit in
  the DevOps loop.

### Fixed

- **Copy did nothing on the documentation site.** The button looked for the code
  inside its own header, found nothing, and gave up silently — on every block of
  every page and the landing page. It copies now; on a terminal block it copies
  the commands without their output; and where the Clipboard API is refused it
  falls back to the browser's copy command.

### Changed

- **The Start section of the documentation reads as two journeys, not a list.**
  The sidebar has real subsections (Begin · From scratch · Existing project)
  with numbered steps; every journey page opens with a step indicator — where
  you are, what is behind you, how long this step takes — and an "In this
  phase" card; Previous/Next stay inside the journey. Recorded CLI output is
  drawn as a terminal in the CLI's own colours. Getting started is three
  things in order: install, pick your path, learn the daily loop. The landing
  page starts with three commands that work in an empty folder, and its
  journey snippets show 0.19's output.

## [0.19.1] — 2026-10-12

### Fixed

- **On Windows, output to a log or a pipe printed ASCII symbols** (`v` for `✔`),
  as if it were an old console window. Only a console window gets ASCII now;
  a CI log is Unicode text like everywhere else. 0.19.0 was not published to
  npm because its Windows E2E caught this.

## [0.19.0] — 2026-10-12

### Changed — breaking

- **One name everywhere: `csda` is gone** ([ADR-0032](docs/specs/adr/0032-one-name-everywhere.md)).
  The on-disk format, kept under the tool's first name by ADR-0024, is now
  `specgate` too: `<!-- specgate:trace … -->`, `specgate:value`,
  `specgate:allow-placeholders`, `.specgate/`, `SPECGATE_*` environment
  variables, `specgate_change_version` in `change.yaml`, the `specgate-matrix`
  merge driver, and the Maven/Gradle coordinates `com.rsaglobaltech.specgate`.
  The `csda` binary alias and the `csda_*` MCP tool names are removed. There is
  no compatibility layer: a project on the old format fails `validate` with
  `old_format` and the one-line migration to run.

### Fixed

- **`specgate draft --agent "claude -p"` could never write** (#103): in print
  mode Claude Code has no permission to edit, so it asked "Want to grant
  permission…?", exited, and `draft` reported `draft_no_front_matter`. `draft`
  now adds `--permission-mode acceptEdits` when the command brings no
  permission flag of its own, and says so. An agent that runs and writes
  nothing is told apart from a draft with findings, with the likely cause.
- **After `draft <module> --agent`, the next step was lost** (#105) at the end of
  the agent's long output. A rule now marks where Specgate takes over, the
  brief's modules show where each stands, and the next steps are numbered —
  review, questions, archive, then the next module or `status`.

- **A second `draft <module> --agent` pass redrafted blind** (#107): the agent
  may only edit, so it cannot run the checker, and its prompt carried the guide
  but not the findings. It now gets the open findings, with their fixes. On a
  real run with `claude -p`: 13 findings after the first pass, 0 after the
  second.
- **Under `--agent`, the agent asked for permission to run `specgate draft`**
  (#106), which Specgate runs itself when the agent finishes. The prompt says so.

### Changed

- **A new look for the CLI, one design system for every command.** Each
  command opens with `◆ specgate · <command>` and ends with one `Next` block, its
  command alone on a line so it copies clean. `status` and `draft` show progress
  bars; findings read `✖ message` with `fix:` under them; `check` and `done`
  draw one line per stage and print what `validate` and the tests said only
  when they fail. The harness draws one aligned line per attempt and
  requirement, a report with a progress bar, and the branch to review as its
  next step; `harness report` and `harness init` follow the same shapes. One palette (`scripts/lib/ui.ts`) replaces twenty copies:
  truecolor where the terminal has it, 256 or 16 colours where not, none under
  `NO_COLOR` or off a terminal, `FORCE_COLOR` honoured. Symbols are one column
  wide; `SPECGATE_ASCII=1` swaps them for ASCII. Help icons are emoji that
  always take two columns, so the names line up.
- **`validate` and the pack commands lost `❌ [ERROR]`, `💡 [FIX]`, `ℹ️ [INFO]`,
  `⚠️ [WARN]`** for `✖`, an indented fix, `ℹ` and `▲`. The VS Code extension and
  the pack registry, which read those lines, read both forms.

### Added

- **Gato, the cat that keeps the gate** (`specgate pet`). A terminal pet whose
  state is the project's: it grows from an egg to a crowned legend as
  requirements close, falls sick on a red `check`, worries over unanswered
  questions, sleeps when the gate has not run for a week, and keeps a streak of
  green days. Whatever it says ends with the command `status` gives. A small
  version sits at the foot of `status` on a terminal — never in a pipe, a log
  or CI — and `specgate config set pet off` hides it.

- **A bare `specgate` inside a project shows where it stands** — `status`, with
  its one next command — instead of the list of every command. Outside a
  project it is still the help.

## [0.18.0] — 2026-10-11

### Added

- **`specgate draft` — from a plan to requirements, one command at a time.**
  Save your plan or a client's brief as `docs/brief.md` and run
  `specgate draft`: with no brief it says what a brief is and what a good one
  says, and `--new-brief` writes one to fill in; with no front matter it
  explains each field (`product`, `surfaces`, `actors`, `modules`) with an
  example and the block to paste; with mistakes it says each one and its fix;
  with a valid one it lists the modules, their state and the next one.
- **`specgate draft <module>`** opens the module as a change linked to the
  brief, writes `DRAFTING.md` — everything your agent needs — and prints a
  one-line prompt to paste into any agent. Run it again to check the draft
  against the brief; it says what to fix, or that it is ready to archive.
- **`--agent "claude -p"`** hands the work to your agent on standard input (or
  in a file, with `{prompt_file}`), undoes anything it writes outside the
  draft, and checks the result. Without a module, the agent proposes the
  brief's front matter and leaves the text below it untouched.
- **`/specgate:draft`**, installed by `agents init`, does the same from Claude
  Code and the other agent tools.
- **[Write the brief](docs/start/write-the-brief.md)**, a new step-by-step
  guide; the quickstart is now two journeys of five phases, every output
  recorded from the CLI; and [Specgate or OpenSpec](docs/vs-openspec.md).
- **Seven proven domain packs, derived from the six pilots.** `ledger`,
  `transfers`, `event-registration`, `clinical-record`, `appointment-booking`,
  `shop-orders` and `time-attendance`: 65 requirements and 85 scenarios, each
  implemented and tested by the product it came from (Spring Boot, Quarkus and
  TypeScript stacks). Questions a pilot could not answer ship as _Needs
  Clarification_ — drug interaction alerts, shipping costs — instead of an
  invented answer. Separate id ranges, so a project can install all seven.
  Install them with `specops add` into a project made by `specgate init`;
  `init --from-pack` does not handle a requirement with two scenarios yet.
- **`metadata.tier` and `metadata.provenance` in `pack.yaml` (schema 1.5.0).**
  `proven` or `starter`; `pack lint` refuses a `proven` pack without a
  provenance. The pack registry shows the tier on every card and lists proven
  packs first.

### Changed

- `init`, `status` and `--help` point to `specgate draft` when there is a
  brief. A draft opened from a brief needs no `tasks.md` ticked before
  archiving: its checklist is its gate.
- **The eleven existing packs are described as what they are: starter
  examples.** They were called "curated domain packs"; each is four or five
  generic Draft requirements and no product was built from one. The docs, the
  README and the registry now say so (and `supply-chain.md`, which said ten).

### Fixed

- `change archive` said the gate would fail until the tests existed; archived
  requirements are Draft and the gate passes. It now names the next step (#92).
- `change author --artifact specs` never told the agent about the brief, the
  assumptions or the open questions (#93); brief to draft took four commands
  and a hand edit (#94); nothing said what a brief's front matter is (#95).

## [0.17.10] — 2026-10-11

### Added

- **`done REQ-a REQ-b …` closes several requirements with one run of the
  tests (#77).** Each requirement is still validated on its own and reported
  on its own line; one that fails is left as it was and the others close. In
  FinCore, eight `done` were eight runs of a suite that starts Postgres.
- **A startup test for Spring and Quarkus projects (#78).** `adopt`/`init`
  suggest one, and the harness prompt requires it for Spring: a test that boots
  the real context with no test doubles. FinCore did not start for a whole
  module while every test, and CI, were green.
- **[From a client brief to a running product](docs/new-project.md)**: the
  step-by-step guide distilled from six pilots.
- **`validate` warns about a `csda:trace` line no requirement section owns
  (#79)** — above the first requirement or under another heading — since
  nothing reads it.

### Changed

- **`change archive` refuses a draft whose checklist fails (#57).** A change
  with `brief:` in `change.yaml` is checked with `draft --check` first;
  `archive_draft_not_ready` names the findings, and `--force` archives anyway.
  This also closes #58: a draft can no longer pass by being archived.

### Fixed

- **D12 reads nested lists (#80).** The organizer lists
  `GET /api/eventos/{id}/sesiones` and moves `POST /api/sesiones/{id}/sala`: the
  same resource, and D12 asked for an assumption row in three EventTech drafts.
  A list whose last segment names the collection now counts, and the caller of
  each call is the actor the step names before it.
- **A MODIFIED requirement reads the assumptions of the change that first
  wrote it (#81)**, in D6 and D12: EventTech's REQ-008 needed its row copied
  into the new draft.
- **A deferred answer is not an answer (#82).** "Se decidirá con el cliente",
  "TBD" or "pending" in a question's `Answer` keeps it open: D7 asks for
  `Needs Clarification` and `status` lists it as waiting.
- **D6 accepts values the requirement's own obligation states under a
  `Source:` line (#75)**: "24" and "97" of ISO 13616 in FinCore.

## [0.17.9] — 2026-10-10

### Added

- **`draft --check` asks how an actor gets the ids they act on (D12, #76).**
  In FinCore the operator could settle a SEPA transfer by its id and no
  scenario let the operator see which transfers were pending; reservas_app and
  credito-tienda had the same gap, and each time only running the product
  found it. A scenario where an actor calls `…/{id}/…` (or a concrete id such
  as an IBAN) now needs a scenario of the same actor that lists the collection
  (`GET`) or creates in it (`POST`), in the draft or the project's
  specification — or a row of `assumptions.md` naming the requirement and the
  collection path that says where the id comes from. On the FinCore drafts it
  flags the settlement (fixed in `pagos-2`) and the teller's account actions;
  D11 stays reserved for a rule still being designed.

## [0.17.8] — 2026-10-10

### Fixed

- **`done` refuses a requirement waiting for an answer (#72).** In the FinCore pilot, `done REQ-055` marked Implemented a requirement
  in `Needs Clarification` with no test and no code: validation judged the row
  by the status it had, which owes nothing, and the suite was green. `done`
  now fails with `done_needs_clarification` before running anything, and
  `validate --delivering` judges the requirement as delivered whatever its row
  says — Draft, Approved or `Needs Clarification` — so TDD-1 applies, and
  `delivering_needs_clarification` names the wait.
- **`status` lists requirements waiting for an answer apart (#73).** A
  `Needs Clarification` requirement was under "To do" as "a test and code". It
  now has its own group, "Waiting for an answer", with the open question that
  blocks it from the change's `questions.md` (`question` in `--json`).
- **D6 reads id ranges in `assumptions.md` (#74).** A row used by
  `REQ-004..REQ-010` (also `…`, `–`, `to`, `a`) covered none of them, and the
  draft reported 25 values as unlisted until the ids were spelled out.

## [0.17.7] — 2026-10-10

### Fixed

- **The CI job runs the project's tests (#70).** `ci init` wrote a job with
  Node and `validate . --strict`, so a Spring Boot project with a class deleted
  stayed green in CI. The job now sets up the detected toolchain — Temurin at
  the Java version the `pom.xml` or Gradle build declares, with the Maven or
  Gradle cache; `npm ci` for a Node lockfile; Go and Python setup — and runs
  `specgate check`: the configured `test_cmd`, or the detected one passed as
  `--test-cmd`. GitLab and Jenkins run in a JDK image and fetch Node from
  nodejs.org, checked against its `SHASUMS256.txt`. With no test command the
  job keeps `validate . --strict`, and `ci init` says it runs no tests.
- **A Maven project is named by its own `artifactId` (#69).** The first
  `<artifactId>` in a Spring Boot `pom.xml` is the parent's, so the project was
  called `spring-boot-starter-parent` in `spec.md` and the harness prompt.
  `<parent>`, dependencies, build and the other nested blocks are skipped; a
  Gradle project is named by `rootProject.name`, and `init` names the build file
  it read (`build.gradle.kts`).
- **`harness init` merges a config `config set` wrote (#71).** It refused the
  two-line `harness.config.yaml` as "already present" and asked for `--force`,
  which would have replaced the chosen `test_cmd`. A file made only of harness
  keys is now kept as written and the missing keys are appended; `--force`
  still replaces it, and a file with other keys is still refused.

## [0.17.6] — 2026-10-10

### Fixed

- **`done` refuses a requirement whose obligation is still the template (#67).**
  `specgate new` writes "The system MUST satisfy: <title>." with a note to
  replace it; the sentence states MUST, so it passed every rule and `done`
  closed the requirement on it. A delivered requirement (or the one `done` is
  closing) whose section still carries either line now fails
  `validate --strict` with `requirement_template_obligation`, naming the file.
  Draft and Needs Clarification still owe nothing.
- **The test command is configured without the harness (#68).**
  `specgate config set test_cmd "npm test"` (and `config get test_cmd`) writes
  `test_cmd:` to `harness.config.yaml`, keeping every other line, or creates it.
  `check`'s warning now names this command instead of `harness init`, whose
  output talks about agents to teams that do not use one.

### Documentation

- **A real tutorial video, from an empty directory** (`scripts/demo/tutorial/`):
  `npm init`, the published package, a requirement written by hand (the
  obligation in `vim`, the scenario, the test, the code), `done` refusing a red
  suite, `check`, `ci init` and the commit — in 16:9 and 9:16, in Spanish. It
  replaces the 55-second social clip, which copied its files in off camera.
- **The README comparison row** now states what a team learns before its first
  pull request — five commands, the other 26 opt-in — instead of a warning.

### Security

- **Two CodeQL findings fixed.** The parser of archived harness prompt names used
  a regular expression that ran polynomially on names repeating `-attempt-`
  (js/polynomial-redos); it now reads the name by hand, with the same result
  (checked against the old expression on 20 000 generated names). A no-op
  replacement in the agent contract's checks is gone (js/identity-replacement).

### Documentation

- **Two new guides.** _From a client brief_ — the brief, a draft per module,
  assumptions and open questions, the D1–D10 checklist, writing in Spanish, and
  what the checklist cannot see. _Already on OpenSpec_ — `verify`, scenario ids,
  V1–V7, adopting with `--since`, the GitHub Action.
- **The harness** documents when it does not retry, the per-attempt time limit,
  and the build in the gate; **the README** covers drafting from a brief,
  `verify` for OpenSpec teams and how releases are tested on real products.

## [0.17.5] — 2026-10-09

### Fixed

- **The harness accepts the `done` it asks for, whatever order `done` writes.**
  0.17.3 allowed a status-only change to a spec trace, comparing the text; but
  `done` also reorders the attributes, so the change still looked like an edit
  and two requirements lost an attempt each. Attributes are now compared as a
  set.
- **An agent that runs out of time is stopped, not orphaned.** On timeout the
  harness killed the shell it had started and moved on, leaving an agent that
  ignores SIGTERM still running in the worktree — in credito-tienda one hung
  for 53 minutes under a 20-minute limit until a person killed it. The agent
  now runs in its own process group, and the whole group is killed at the
  deadline.

## [0.17.4] — 2026-10-09

### Fixed

- **`init --no-capabilities`.** The guide offered it for adoption and `init`
  refused it ("Unknown argument"); on a freshly generated scaffold every
  pilot deleted three folder-named proposals by hand. `init` now passes it to
  the adoption it runs.
- **D3 asks for the actor's own screen.** A requirement the owner drives had
  its only screen scenario written from the client's side ("un cliente abre la
  página"), and D3 counted it; the owner then got no screen to enter the data.
  A scenario now counts for the actor it names, or for any actor when it names
  none.
- **A modified requirement no longer blocks the gate of another.** Archiving a
  change that modified two delivered requirements put both back to `Draft`
  with new scenarios, and each one's harness gate failed on the other's
  untested scenarios. Scenario coverage is now owed by delivered rows and by
  the one being delivered, like `--strict-tdd`. The specification of a modified
  requirement merges on its own; the branch flow is no longer needed.
- **The harness retries an untested scenario.** "Nothing proves" names the
  feature file but is fixed by a test, and the harness had stopped after one
  attempt as if the specification were wrong.

### Changed

- **`harness init` gates on the build when there is one.** A requirement in
  reservas_app passed typecheck and tests and broke `next build`, and nothing
  in the gate built. For an npm project with a `build` script the detected
  gate is now `npm test && npm run build`; an explicit `--test-cmd` is taken as
  written.

## [0.17.3] — 2026-10-09

### Fixed

- **`draft --check` catches an id the project already uses (D10).** A second
  draft numbered its scenarios from SCN-212, which a delivered requirement
  already owned; nothing said so until `validate` reported "Duplicate Scenario
  ID" after archiving. A modified requirement keeps its own ids.
- **The harness no longer rejects the `specgate done` it asks for.** Its prompt
  tells the agent to close the requirement with `done`, which records the
  status in the capability spec; write-scope then refused the attempt as an
  edit to `docs/specs/**`, and the agent had to start again. A change that only
  sets `status=` on a trace is now allowed; any other edit to the
  specification is still refused.
- **A requirement waiting on a question does not turn the gate red.**
  `validate --strict` demanded a test of every `Needs Clarification` row —
  the status a draft gives a requirement its open question blocks, and which
  the harness refuses to build. A draft that asked instead of guessing failed
  the gate. It is now exempt, like `Draft`.

## [0.17.2] — 2026-10-09

### Fixed

From a second and third cycle on the same product (reservas_app), on 0.17.1.

- **A requirement modified by a change gets the scenarios it gained.**
  Archiving left its feature file as it was, so the new scenarios never reached
  the gate — silently. The file is now rewritten from the delta when everything
  in it belongs to the requirement (`archive_feature_regenerated`); otherwise
  archiving names the scenarios it lacks (`archive_feature_stale`).
- **`plan` and `status` agree with `validate` about untested scenarios.** A
  requirement with two scenarios no test named was "Ready to close — its test
  is in place", and `NEEDS_STATUS_UPDATE` to the harness, while `validate --strict` said "Nothing proves" them. It is now `NEEDS_TEST`.
- **`draft --check`:** a requirement can say it lives on one surface
  (`surfaces=web` in its trace), so a menu is not asked for an API scenario
  (D3); a value already in the project's specification — reviewed in an
  earlier change — is not "unlisted" (D6).

### Documentation

- `reviewing-changes.md`: changing a requirement that already shipped — why the
  specification cannot merge before its code, and the branch flow that works.

## [0.17.1] — 2026-10-09

### Changed

- **The documentation reads in the order a team needs it**: Start (a
  10-minute quickstart), Every day, The gate in CI, Existing code, Reference,
  Extensions — and everything else under Advanced. Every page is still
  published.

### Fixed

Found building a second real product from a client brief (reservas_app,
written in Spanish).

- **A draft archives into feature files, in its own language.** `change archive` wrote no `.feature` for a requirement whose trace named none — a
  draft that passed `draft --check` archived with "0 materialised". Each
  requirement with scenarios now gets `features/<capability>/<REQ>.feature`.
  Scenarios written with `DADO / CUANDO / ENTONCES` become Spanish Gherkin
  (`# language: es`); they used to be written as English `Feature:` files whose
  steps Cucumber read as prose, and `validate --strict` called every one empty.
- **`draft --check` runs the rules the harness gate will apply (D9).** A
  scenario title, a missing When or Then, a placeholder step: the gate checks
  them once a requirement leaves Draft, so a draft could pass the checklist and
  fail the harness on a scenario the agent may not edit.
- **Two words name a behaviour.** "Franja cerrada" and "Identificador
  repetido" were refused as generic titles; a title is now generic when it is a
  single word or a placeholder ("Scenario 1", "Escenario 2", "Test").
- **The harness stops when another attempt cannot help.** An agent out of
  quota ("You've hit your session limit") was retried three times in 22
  seconds; a gate failing only on files the agent may not edit was retried
  three times too. Both now end the requirement after one attempt, saying who
  has to act.
- **`check` names the test command adoption found.** `init` printed "Test
  command: npm test" and the next `check` said "No test command configured"
  without saying which, or how. The warning now names the detected command and
  the one line that turns it on (`specgate harness init`). The first gate after
  adoption still checks the specification only, as documented.
- **`draft --check`:** an answered question (an `Answer` column, or `Answer (Q1): …` below the table) no longer keeps its requirement waiting; a value
  repeated in a scenario is one finding, not one per mention; "responsive" is
  not read as a promised response time, and `px` is a unit.
- **`status` shows the title of a requirement archived from a change** instead
  of a blank.

## [0.17.0] — 2026-10-09

### Fixed

- **`specops sync` that changes nothing leaves `.specops.lock` alone.** It
  rewrote each pack's `expanded_at` on every run, so a no-op sync left a diff
  to commit or revert. The timestamp now moves only when the pack's repo,
  version, commit or variables do.

## [0.16.0] — 2026-10-09

### Changed

- **`AGENTS.md` is the agent contract; `AI_RULES.md` folds into it**
  (ADR-0031). `init` and `adopt` write one short `AGENTS.md` — the file
  Codex, Cursor, Copilot and most agents read — with the commands, the loop,
  what never to do and the stack's rules, instead of an `AI_RULES.md`, an
  "Agent Manifest" and `agents init`'s instructions that overlapped. Specgate
  keeps its part in a marked block; a team's own `AGENTS.md` text is never
  rewritten. `specgate update` moves an existing `AI_RULES.md` below the block,
  verbatim. Until then both are read, so no rule drops out of the agent's
  prompt; `validate` and `doctor` accept either.

- **`specgate init` installs the `/specgate:*` commands for the agents your
  project already uses** — Claude Code (`.claude/`, `CLAUDE.md`), Cursor,
  Copilot, Gemini, Windsurf, Cline, Aider, Codex, Antigravity — and only for
  those, never overwriting a file. With none found it says how to add one.
  `--no-agents` skips it. The developer talks to the agent they already have
  from the first minute, without `agents init` to discover.

### Added

- **`specgate draft --check <change-id>`** (ADR-0029, phase 1): the checklist a
  draft change must pass before anyone reviews it — a scenario and a kind for
  every requirement (D1, D2), a scenario on each surface an actor uses (D3), a
  measure for every non-functional requirement (D4), a source for every cited
  law (D5), every stated value either in the brief or listed in
  `assumptions.md` (D6), every open question blocking something (D7), and a
  size a person can review (D8). A rule that cannot run says so instead of
  passing. Works on any change, drafted by an agent or by hand.
- **`specgate status` notes D4 and D5 on the project's own specification**: a
  non-functional requirement that promises a quantity ("fast", "scalable")
  without stating it, and a business rule that cites a law with no source.
  Notes, never failures. D4 flags a promised quantity, not every qualitative
  constraint: on the Golden State packs the first version flagged 4
  requirements about offline use, privacy and devices, none of them omissions.
- **MCP tool `specgate_verify`** (ADR-0030): the agent working from an OpenSpec
  spec gets the same check `specgate verify` runs, inside its own loop.
- **A weekly check that `verify` still reads OpenSpec.** OpenSpec releases
  weekly; `e2e/openspec-compat.mjs` installs the latest, lets it write and
  archive a change, checks `verify` fails then passes on it, and reads
  OpenSpec's own repository with nothing unreadable. Runs every Monday and on
  demand with a version (`openspec-compat.yml`).

### Fixed

- **No command's output is cut short when piped.** On macOS, Node writes to a
  pipe asynchronously and `process.exit()` does not wait: a JSON document over
  64 KB reached the program reading it truncated at exactly 65,536 bytes. 0.14.4
  fixed `plan`; twenty-eight more commands exited the same way. Every command
  now runs with blocking stdio, so the write completes before the exit.
- **MCP tools accept an OpenSpec project.** Every tool refused a directory
  without `spec.md` as "not a spec-driven project", so `specgate_verify` could
  not run on the projects it was built for. A directory with `openspec/` is a
  project too.

## [0.15.0] — 2026-10-08

### Changed

- **The agent slash command `/specgate:verify` is now `/specgate:check`**, the
  name of the command it runs. `specgate verify` is the OpenSpec check below,
  and two things called "verify" doing different things is one too many.
  `specgate update` moves `.claude/commands/specgate/verify.md` (and the older
  `csda/verify.md`) to `check.md`, keeping the team's edits.

### Added

- **`specgate verify` — gate what OpenSpec calls done** (ADR-0030). Reads
  `openspec/` in place, without writing to it. An archived change claims the
  current scenarios of every requirement it added or modified. The check
  fails while one of them has no test naming its id
  (`openspec:<capability>/<requirement>/<scenario>`), while the suite is red
  (`--run`), or after a scenario's text changed since `--record` pinned it.
  `--since <ref>` gates only claims made after the ref, so adopting it never
  fails a project for its past. `--ids` prints the ids to name; `--format github` annotates the spec lines; `actions/verify` runs it on pull requests.
  Read against OpenSpec's own repository: 747 scenarios, 108 claims, including
  its archived history from before the structured format.

## [0.14.6] — 2026-10-08

### Fixed

- **The harness no longer fails an attempt for a regenerated matrix.** The
  write-scope guard counted any change to `docs/specs/traceability.md` as an
  edit to the contract, and on a derived project the matrix changes the
  moment tests name their scenarios and anything runs `specgate`. A matrix
  identical to its own regeneration is not an edit; a hand edit still fails.
- **The harness publishes a requirement it ran before.** `--push` uses
  `--force-with-lease`, which trusts the local remote-tracking ref; once the
  branch had been merged and deleted on the remote, that ref was stale and
  every second-round push was refused ("stale info") although the
  requirement had passed. The ref is now refreshed from the remote first.

## [0.14.5] — 2026-10-08

### Fixed

- **The pack drift gate checks every scenario of a requirement.** It compared
  a requirement's first matrix row with the pack's first scenario, which was
  right only while each requirement had one: once the Golden State packs gave
  requirements API scenarios, `validate --against-lock` reported 30 of them
  as drifted while every scenario was in place.

## [0.14.4] — 2026-10-08

### Fixed

Found when the Golden State packs gained API and screen scenarios for 30
requirements already delivered:

- **A scenario added after delivery is no longer reported as done.** Linked
  by mention, every row of a requirement got the tests that name the
  requirement, so 52 new scenarios inherited the old tests and `status` said
  99/99 done. Once a requirement's tests name one of its scenario ids, each
  scenario is proved only by the tests that name it. A scenario without one
  is a `Draft` row — pending in `status`, `NEEDS_TEST` in `plan`, picked up by
  the harness — while the requirement keeps its status. Delivering it again
  judges those rows as Implemented, so an untested scenario still fails.
- **`plan` counts a row with no test as not done.**
- **`plan --json` is complete through a pipe.** It exited before stdout
  drained, so a plan over 64 KB reached the harness cut at 65,536 bytes
  ("plan produced invalid JSON").

## [0.14.3] — 2026-10-08

### Fixed

Found running the harness and upgrading packs on the Golden State
Reinforcing app with 0.14.2:

- **`specops sync` brings a pack's changes to the trace fields.** A pack that
  added `depends_on` moved the lock to the new tag while every capability
  spec answered "kept (local edits preserved)": the trace line is where the
  pack's model links and the project's `status` meet, and the text merge kept
  the local line. Trace lines are now merged field by field — what the pack
  changed since the baseline takes the pack's value, everything else keeps
  the project's.
- **`specops sync` regenerates a generated matrix** instead of merging it.
  It rendered each pack into an empty directory, so a derived project got a
  hand-kept matrix back and a "CONFLICT (no merge base)" on
  `docs/specs/traceability.md`.
- **Domain catalogs are shared by every pack.** `aggregates.md`, `events.md`,
  `commands.md`, `use-cases.md` and `domain-model.md` held the rows of the
  last pack installed; a pack's rows now replace the rows with the same id
  and join the rest.
- **`plan` lists every scenario of a requirement once,** and counts a
  requirement done only when all of its scenarios are; it listed the last one
  once per scenario and dropped the others. An artifact cell naming several
  files is checked file by file.
- **The adoption baseline leaves the plan once delivered.** `test='npm test'`
  and `artifact='existing codebase'` are a command and a description, not
  files, so the baseline was planned — and handed to the harness — forever.
- **`pack lint` notes a requirement with no scenario.** Sixteen of
  forty-six requirements shipped without one and lint said nothing.

## [0.14.2] — 2026-10-07

### Fixed

Found adopting the Golden State Reinforcing app with six domain packs on the
published 0.14.1:

- **A pack keeps a generated matrix generated.** Installing a pack wrote
  matrix rows and turned the project back into a hand-kept matrix; `matrix --migrate` then wrote 47 placeholder sections into `spec.md` titled after
  use cases. Now each requirement's use case, command, aggregate, event and
  context go into the `csda:trace` of its section — the pack's capability
  spec, or a new `spec.md` section carrying the pack's own description — and
  the matrix is regenerated.
- **Capability requirements get a row per tagged scenario**, like `spec.md`
  ones. They got a single scenario-less row, so packs and archived changes
  never showed their scenarios.
- **The harness prompt reads capability specs and every scenario.** It read
  only `spec.md` — telling the agent "no text, stop" for any pack or archived
  requirement — and showed one scenario of a requirement that has several.
- **The harness runs each requirement once.** It processed one plan row per
  scenario: a requirement with two scenarios ran two paid agent sessions on
  the same branch.
- **`setup_cmd`** prepares each fresh worktree before the agent (`harness init` proposes `npm ci` / `pnpm install` / `yarn install` from the
  lockfile), so the agent can run the tests it writes and `check` no longer
  needs `npm ci` in `test_cmd`. The generated prompt prefix teaches linking by
  mention instead of "the test named in the matrix".
- **Private pack repositories in CI.** The GitHub job uses a `SPECOPS_TOKEN`
  secret when present, and `pack_unavailable` says the repository needs
  credentials instead of "check network access".

## [0.14.1] — 2026-10-07

### Fixed

Found by building a real product — the Golden State Reinforcing app, with its
domain packs in a specops repository:

- **`pack lint` sees scenarios.** It read `scenario.requirement`; the schema
  names the field `requirement_id`, so a requirement covered only by a
  scenario failed `--strict` as unreferenced.
- **The YAML reader takes what YAML libraries write**: indentless sequences
  (`key:` then `- item` at the same indent), long strings folded over several
  lines, and the `''` / `\"` escapes inside quotes. A pack generated with
  PyYAML's defaults failed with "Unexpected YAML token".
- **"tag work" is not a vague step.** The vague-step check matched the bare
  word _work_; it now flags verdicts ("it works", "should work"), not trade
  terms.
- **A requirement can have several scenarios.** On a generated matrix a
  requirement with two scenarios has two rows, and the gate called it a
  duplicate id — so any requirement with more than one scenario, including
  every pack that ships them, failed `check`. Rows with distinct scenario ids
  are accepted there; a hand-kept matrix keeps the strict rule, and
  `specgate matrix --migrate` moves a project to the generated one after
  `specops add`.
- **A pack template that already carries its `@REQ`/`@SCN` tags expands
  cleanly.** `expand` reported "declares … which is not in the template" for
  every pre-tagged scenario.
- **Pushes to `main` were never refused by GitHub**: in zsh, `$R:refs/…` is
  the `:r` modifier. The release process now quotes the refspec.

## [0.14.0] — 2026-10-07

### Changed

- **`done` will not close a requirement no test mentions.** On a generated
  matrix the requirement being closed is judged as delivered, so `done` refuses
  what the next `check` would — it used to judge it as still `Draft`, write
  Implemented, and leave `[TDD-1]` for CI.
- **`status` after adoption points at a first real requirement**
  (`specgate new "…"`), then at `specgate done REQ-NNN` for the newest one —
  not "`specgate check` — write REQ-001's test" for the baseline.
- **The documentation site has a new design ("Editorial").** A warm paper
  ground, a serif display face (Newsreader) over a quiet sans (Instrument
  Sans), one deep green accent, and a warm dark theme from the same tokens —
  so the diagrams follow. The landing page is rebuilt around the five-command
  loop, what each status owes, the four roles on a team and the harness, with
  reveal-on-scroll and a slow parallax that both stop under reduced motion.
  The pack gallery is redesigned to match: centred, monograms instead of emoji,
  a search bar of its own, and install commands that no longer overflow.

### Fixed

Found by following the documentation step by step on the published 0.13.0:

- **The docs' recipes run as written.** Adding a scenario no longer tells you
  to hand-edit the generated matrix (whose next regeneration removed the row);
  getting started no longer copies an example file that only exists inside the
  package; the `plan --format json` sample and the agent recipe use the real
  keys (`next`, `actionable`, …); an unclosed code fence no longer swallows the
  `--strict-coverage` section; the `Deferred` status, which does not exist, is
  gone.
- **An orphan feature on a generated matrix is told to tag its scenario**, not
  to add a row the next `check` removes.
- **`Deprecated` owes nothing.** It failed `[TDD-1]`, while `req rm` past Draft
  recommends Deprecated — the advice was a loop.
- **`done --json` (and MCP) says why the gate refused**: the validate findings
  come before `done_validate_failed`, instead of that code alone.
- **MCP tools declare their argument**: `specgate_change_*` an `id`,
  `specgate_req_*` a `requirement` or `title`.
- **Generated text teaches the current loop**: the adopted `spec.md` header,
  the retro-fill advice, readiness fixes and the harness prompt recommend
  `specgate new`, a test that mentions the id and `done` — `req link` only for
  hand-kept matrices.

### Added

- **The documentation site tells the current story.** The landing page opens
  on `init` and the five-command loop — status, new, a test that mentions the
  requirement, done, check — with a section on what the author, the reviewer,
  CI and the agent each do. Three new pages: [How Specgate thinks](docs/concepts.md)
  (six ideas: what each status owes, where the matrix comes from), [The MCP
  server](docs/mcp.md) (install, tools, the contract-edit guard) and an
  [FAQ](docs/faq.md). The landing still taught `onboard`/`adopt`, a four-command
  loop on `plan` and `validate`, and a harness gating on `--strict-tdd`.

### Fixed

- **The pack gallery names Specgate and installs what it shows.** Every card
  offered `npx create-spec-driven-app expand --pack-root ./packs …` — the old
  package name, against a `./packs` folder the reader does not have. Cards now
  show `specgate specops add` from this repository, pinned to the release tag.
- **A change to the site generator redeploys the site.** The Pages workflow
  only watched `docs/**`, so the diagram fix reached `main` and was never
  published.
- **Diagrams render on every docs page.** A blank line inside an inlined SVG
  ended Markdown's HTML block, so the rest of the diagram showed as a block of
  escaped markup on _Domain packs_ and in _Specs that cannot lie_. Blank lines
  are dropped when a diagram is inlined, and a test fails on any page showing
  diagram markup as text.
- **`mcp install --help` names the clients it supports.** It offered
  `vscode` and `kiro`, which fail with `unsupported_client`; it supports
  `claude` and `cursor`. The docs no longer mention a `windsurf` client either.

## [0.13.0] — 2026-10-07

### Added

- **The README teaches the five-command loop** — the test mention as the link,
  `done` gating, `ci init` detection, the MCP server in the package — and
  points to the first-PR guide. npm shows it from this release, with a link to
  the documentation site.
- **[Your team's first pull request](docs/first-pr.md)** — what the author
  writes, what the reviewer reads (and skips), and every failure a first PR
  meets with its fix.
- **`ci init` detects the provider** from the repository's CI files or its
  `origin` remote. `init` ends by suggesting `specgate ci init`, which answered
  "--provider is required".

- **The E2E suite covers every command** (61/61): ALM against a stand-in Jira
  server, and MCP from `mcp install` to a tool call over stdio.

### Changed

- **`done` runs the gate before it writes.** Closing a requirement as
  `Implemented`, `Verified` or `Released` now runs what `check` runs and writes
  nothing when it fails. Plain `done` used to print ✔ over a scenario of
  unfilled `<placeholders>` and no test, and the next `check` — the one in CI —
  failed on the same requirement. `--no-check` writes the status without it;
  `--check`/`--strict` still work and are now the default for those statuses.

### Fixed

- **Fix lines and agent rules speak the generated matrix.** On a generated
  matrix, `[TDD-1]`–`[TDD-3]` no longer tell you to edit a matrix column, and
  `change instructions apply` no longer names an `In Dev` status that does not
  exist or `req link`: mention the requirement in the test, close it with
  `done`, run `check`.
- **The daily loop over MCP.** `check` and `new` were not MCP tools, so an
  MCP-only client (Claude Desktop, Cursor) could not add a requirement or run
  the gate; they are now `specgate_check` and `specgate_new`. Every tool that
  takes an argument besides the project directory — `new`'s title, `done`'s
  requirement, a change id — declares it in its schema; it used to be passed
  only if an agent guessed to send it.
- **The MCP server starts.** `mcp install`, `agents init` and the Claude plugin
  configured clients to run `npx -y @specgate/mcp-server`, a package that was
  never published: every client set up that way started nothing. The server now
  ships inside the CLI package as `specgate mcp serve`, its tools call the CLI
  that serves them, and it announces that CLI's version. Re-run `mcp install`
  (or `agents init`) to rewrite an existing config.
- **`change archive` writes the feature file the delta describes.** It only
  copied `.feature` files an author had placed inside the change folder — which
  neither the template nor `change instructions` asks for — so the documented
  cycle archived a matrix row naming a feature file that never existed. When
  the change brings none, the delta's scenarios are rendered as Gherkin, tagged
  `@REQ-NNN` (and `@SCN-NNN` when the scenario has one). An author's file still
  wins.
- **A requirement archived into a capability spec can be closed.** On a
  generated matrix, `done` and `req link` wrote only to `spec.md`, so an archived
  requirement got "has no section in spec.md" and a pointer to `req add`. They
  now write its `csda:trace` comment in the capability spec, and archived
  requirements link tests and code by mention like any other.
- **A freshly installed pack no longer fails its own lock gate.** `expand`
  wrote matrix rows per scenario, so a requirement the pack declares without a
  scenario yet — the multi-tenant pack's REQ-004 — never reached the matrix,
  and `validate --against-lock` failed right after `specops add` with
  `pack_requirement_missing`. The `specops sync` it suggested re-expanded the
  same matrix. With a lockfile, `ci init`'s workflow runs that gate, so every
  project installing such a pack had a red CI from the first commit. The
  requirement now gets a `Draft` row with no scenario. Found by the new E2E
  packs journey.
- **Asking any command for help is never an error.** `specgate ci --help`,
  `pack`, `specops`, `harness`, `config`, `agents`, `alm` and `mcp` answered
  "Unknown … sub-command: --help" over the global usage; `expand`,
  `harness prompt` and `mcp install` refused `--help` as an unknown argument or
  a missing value. A group now lists its sub-commands with their summaries, and
  each of the three answers with its own usage. Found by a new E2E journey that
  asks every command on the surface.

### Added

- **E2E coverage is measured and can only grow.** The end-to-end suite is split
  by area (`e2e/journeys/*.mjs`) and runs its files in parallel; each journey
  declares the commands it covers. `npm run e2e:coverage` compares them with
  the command surface and with `e2e/uncovered.json` — commands not covered yet,
  a list that can only shrink — and fails a new command that has neither. A
  unit test and the E2E workflow run it. Journeys for the utilities — `doctor`,
  `fix`, `plan`, `report`, `req list/done/rm`, `config`, `schema`,
  `completion`, `studio`, `onboard` — take it from 14 to 34 of 60 commands, and
  offline journeys for packs — `specops add/diff/sync/remove` against a local
  git remote with tags, `pack bundle` for an air-gapped install, `pack init/lint/infer`, `expand` — to 43, and the change cycle (`new` → `archive`
  → delivered with `done`), `change author` reverting an agent's write outside
  the change, `harness init/prompt/run/report` and `specops contribute` to 55.

## [0.12.1] — 2026-10-07

**Java builds run the current CLI.** The Maven and Gradle plugins were running
a CLI frozen at 0.7.0 under the tool's pre-rename package name, with a weaker
gate. The plugins are installed from source, so the fix reaches a build when
the plugin is rebuilt from this tag: `git checkout v0.12.1`, then
`mvn install` in `packages/maven-plugin` or `gradle publishToMavenLocal` in
`packages/gradle-plugin`. MCP tools are now named `specgate_*`; old names keep
working.

### Fixed

- **The Maven and Gradle plugins ran a CLI frozen at 0.7.0.** Their launcher
  ran `npx create-spec-driven-app@<version>` — the package's pre-rename name,
  last published as 0.7.0 — and the image `ghcr.io/rsaglobaltech/csda`. With
  the default version, `latest`, every Java build ran 0.7.0: none of the gate
  fixes, the five verbs or the generated matrix. They now run
  `@rsaglobaltech/specgate` and `ghcr.io/rsaglobaltech/specgate`. Pin
  `csda.version` to a 0.12+ release; a pin below 0.8.0 no longer resolves.
- **The Maven and Gradle gate is the one gate.** `csda:validate` and
  `csdaValidate` ran `validate --strict-tdd`, weaker than what `ci init`
  generates. They run `validate --strict` now; the `csda.strictTdd` setting
  keeps its name and still turns the gate off (structural checks only).
  A Java build may go red where it passed: that is a link or scenario the
  other gates already refused.

### Changed

- **MCP tools are named `specgate_*`.** The generated tools were `csda_*`, the
  last place the old name faced an agent. Calls by the old names keep
  resolving, so an agent config that allow-lists `csda_status` still works;
  only the new names are listed. `validate_project`, `plan`,
  `mark_requirement_done`, `lint_pack`, `read_spec`, `list_requirements` and
  `update_traceability` are unchanged.

## [0.12.0] — 2026-10-07

**The agent works the same loop as the team.** The slash commands `agents init`
writes are now the daily loop — `/specgate:explore`, `new`, `apply`, `verify`,
`done` — and teach that naming `REQ-NNN` in a test or in the code is the link.
The Claude plugin's gate hook regenerates the matrix before it judges. The
documentation enters through `init` and five commands. Run `specgate update`
once to refresh agent files generated by an earlier version.

### Changed

- **The documentation teaches one way in.** `getting-started` starts with
  `init` and a five-command first requirement; `quickstart`, `writing-specs`,
  `tutorial` and `comparisons` stop teaching `onboard`, `adopt`, `req link` and
  `plan` as the main path (all of them still work and are documented).

- **The agent's commands are the daily loop.** `agents init` writes
  `/specgate:explore` (status), `/specgate:new`, `/specgate:apply`,
  `/specgate:verify` (now `check`) and `/specgate:done`, plus
  `/specgate:propose` and `/specgate:archive` for requirements that already
  shipped and `/specgate:onboard` (now `init`). The existing names are kept, so
  `specgate update` refreshes them in place. The project rules teach that a
  test or source file naming `REQ-NNN` is the link, instead of `req link`.
- **The Claude plugin's `Stop` hook regenerates a generated matrix before
  judging**, so a test the agent just wrote is evidence rather than a
  `matrix_stale` block.

## [0.11.0] — 2026-10-07

**A matrix nobody edits.** The traceability matrix is now generated for every
new project: requirements from `spec.md`, scenarios from their tags, tests and
code from the files that mention the requirement, status from `done`. The daily
loop is five verbs — `init`, `status`, `new`, `check`, `done` — and no step edits
the matrix or runs `req link`. Existing projects are untouched until they run
`specgate matrix --migrate`, which changes nothing unless the result is
identical row for row. This is the first release published only after an
end-to-end run of the installed package on Linux, macOS and Windows.

**Known limit:** a domain pack writes its own matrix, so `specops add` / `expand`
turns a project back to a hand-kept matrix and says so.

### Changed

- **New projects start with a generated matrix.** `init` and `adopt` write the
  matrix and immediately switch it to generated, so nobody maintains it:
  a test that names its requirement is the link. `--keep-matrix` keeps it
  hand-maintained. `req` leaves the short help, which is now the five verbs —
  `init`, `status`, `new`, `check`, `done` — and `new` and `status` stop
  recommending `req link` on a generated project.

- **Code is linked the way tests are.** On a generated matrix, a source file
  that mentions `REQ-NNN` is that requirement's technical artifact, so `req link`
  is not needed for either column. `plan` and `harness run` stop warning that a
  row "declares no test/production artifact" there — the mention is the link.

### Fixed

- **`done --check` and the harness gate refresh a generated matrix first.**
  A test written since the last regeneration made the matrix stale, so the
  gate refused the very test that made the requirement deliverable.

### Added

- **An end-to-end run of the installed package.** `npm run e2e` packs the
  checkout, installs the tarball into an empty directory and drives the binary
  through the journeys a team takes — adopt, `new` → test → `done --strict`, a
  stale matrix, a hand-kept matrix migrated, `ci init`, the harness, an upgrade
  from the last published version. It runs as the `E2E` workflow on every pull
  request on Linux, macOS and Windows, and `publish-npm.yml` publishes a tag
  only if it passes.

- **`specgate matrix` — a traceability matrix nobody edits.** The matrix can be
  generated instead of maintained: requirements and titles from `spec.md`,
  scenarios from `@REQ-NNN @SCN-NNN` tags, tests from files that mention the
  requirement, status from `status=` in the section's `csda:trace` comment —
  which also holds any link derivation cannot see. `--migrate` switches an
  existing project over and refuses, changing nothing, unless the generated
  matrix is identical row for row. Once generated, `check` refreshes it and
  `validate` fails with `matrix_stale` when it no longer matches its sources.
  Opt-in: a project that does not migrate is untouched. First part of phase 3
  of the team-simplification plan.
- **On a generated matrix, the commands write its sources.** `done` sets
  `status=` and `req link` / `req add --feature …` record links in the
  requirement's `csda:trace` comment in `spec.md` — an edit to the row would
  be undone by the next regeneration. `new`, `req rm` and `change archive`
  regenerate the matrix; `status`, `plan` and `check` read it fresh;
  requirements archived into capability specs are derived too. `fix` reports
  there is nothing to repair, and the MCP add-row tool refuses with a pointer
  to `specgate new`. `expand` writes the pack's own matrix, which makes the
  project hand-kept again — it says so, and `matrix --migrate` switches back.

## [0.10.0] — 2026-10-06

**Five verbs.** A team said the tool was hard to absorb; this release is the
answer's first half. The short help is now the whole daily loop — `init`,
`status`, `new`, `check`, `done`, plus `req` until the matrix is generated —
and each verb does what used to take several commands. Nothing was removed:
every older command still works and is in `--help --all`.

Agent files generated by earlier versions are named `csda`; run
`specgate update` once to move them to `specgate`, keeping your edits.

### Added

- **`specgate check` — the gate under one name.** `validate --strict`, then the
  project's tests (`--test-cmd`, or `test_cmd:` in `harness.config.yaml`). It
  replaces `validate` in the daily help. Without a test command it passes and
  says it checked the specification, not the code. First verb of phase 1 of
  the team-simplification plan.

- **`specgate new "<title>"` — a requirement in one step.** A draft
  `## REQ-NNN` in `spec.md`, a scenario tagged `@REQ-NNN @SCN-NNN` under
  `features/` with `<placeholder>` steps, and the matrix row linked to it —
  what used to take `req add`, two hand edits and `req link`.
- **`scenario_placeholder_step`.** An unfilled `<placeholder>` in a plain
  Scenario is an error under `--strict-scenarios`. Measured first: a scenario
  of three template steps passed `validate --strict` and `done --strict` with
  its requirement Implemented.

### Changed

- **The short help is the daily loop.** `specgate --help` lists `init`, then
  `status`, `new`, `req`, `check` and `done` — nothing else. `change`, `plan`,
  `validate`, `adopt` and `onboard` keep working and are in `--help --all`. A
  test fails if a line is added, so growing it is a decision.
- **One name in the agent too: `/specgate:*`.** The generated slash commands
  were `/csda:*`, the tool's old name, so a team typed `specgate` in the
  terminal and `/csda:apply` in their agent. Every generated file moves:
  `.claude/commands/specgate/`, `.cursor/rules/specgate.mdc`,
  `.windsurf/rules/specgate.md`, `.clinerules/specgate.md`,
  `.agents/rules/specgate.md`, and the Claude plugin is named `specgate`.
  **Upgrading:** `specgate update` moves each `csda` file — and its baseline —
  to the new path before merging, so edits survive. Files from `agents init`
  before this release have no baseline; `update` reconstructs one from the
  old name, and where that guess is wrong the merge reports a conflict rather
  than choosing. When both names exist it touches neither (`rename_conflict`).
  The `csda:` annotations in spec files keep their name (ADR-0024).
- **The committed Claude plugin is regenerated.** `packages/claude-plugin` had
  not been rebuilt since 0.6.0: its gate hook still ran
  `npx csda validate --strict-tdd`.
- **`specgate init` is the one way in.** In a repository that already has code
  it adopts it in place — the same as `adopt`, touching no code — instead of
  scaffolding a second project inside the first; running it again says the
  repository is already spec-driven and exits 0. `--new` forces a scaffold, and
  `--yes`, `--config`, `--out` and `--multi-stack` keep scaffolding, so no
  script that calls `init` changes behaviour. `adopt` and `onboard` leave the
  short help and keep working. `adopt`'s next steps now teach `check`, `new`,
  `status` and `ci init`.
- **`status` lists the queue itself.** One line per requirement — its title and
  what it still needs — split into _Ready to close_ and _To do_, capped at 12
  per group. `Next` names a requirement (`specgate done REQ-003 --strict`)
  instead of answering `specgate plan`. `--json` gains a `requirements` array.
  `plan` leaves the daily help and keeps the full detail.
- **`plan` no longer says "code & test exist" over a row with no code.** A
  declared code path is optional; the heading now says _its declared test and
  code exist_.
- **The scenario rules are owed on delivery, like the files.** A Draft row's
  feature file is not held to `--strict-scenarios`, so a fresh `specgate new`
  does not turn CI red. The three rules that make a suite report a pass it
  never ran — no steps, keyword case, Outline without Examples — apply to
  every row.
- **`done --strict` is the whole gate.** It ran a subset without
  `--strict-scenarios`; it now runs `validate --strict`.
- **`req link --status` is refused instead of silently dropped.** It printed a
  tick and left the row `Draft`. The status changes through `specgate done`,
  which can check the requirement first.

- **The harness and the agent `Stop` hook run the same gate as CI.** Both ran
  `validate --strict-tdd` while `ci init` generated `--strict`, so the harness
  could mark a requirement Implemented on a `src/…` file that did not exist and
  leave the next CI run red. They now run `validate --strict`.

### Fixed

- **`update` no longer takes the project's `README.md` for the Claude
  plugin's.** Same path, different file: it adopted the project README as the
  opt-in plugin's and wrote it a baseline, so the next run would have merged
  the plugin's README into it. Opt-in tools now count only where installed.
- **`--strict-links` no longer fails a requirement that has not been delivered.**
  A `Draft` or `In Dev` row names where the work is going to land; with
  `--strict` as the CI gate, every team that declared paths before writing them
  had a red build, and in the harness one pending requirement's paths failed
  its sibling's worktree. Only `Implemented`, `Verified` and `Released` rows owe
  their files now.
- **`done --check` and `harness run` check the requirement they are closing.**
  They validate before the status flips, so the requirement was still `Draft`
  and the rule above would have skipped it. They now hold it to what a
  delivered row owes.

## [0.9.0] — 2026-10-06

### Added

- **`prompt_precedents` shows the agent an accepted requirement from the same
  bounded context.** Everything else in the prompt is normative — facts,
  Gherkin, `AI_RULES.md`, the definition of done — and none of it is an
  example. An agent with no conversation history has never seen what an
  accepted implementation looks like in your repository, so it invents a house
  style and the next attempt is spent correcting it.

  Three rules keep the section from doing harm: the same bounded context only
  (a precedent from elsewhere teaches conventions that do not apply, with the
  authority of having been accepted), `Verified` rather than `Implemented`
  (one means the code exists, the other means somebody checked it), and an
  earlier requirement only. It says in as many words that it is an example of
  shape and not of behaviour. Nothing qualifying means no section rather than
  an empty one, and a moved artifact never stops a run.

  Off by default. Closes #106.

- **`pack infer` stops making five corrections you had to make by hand.** The
  same operation inferred from two scenarios is proposed once rather than twice
  with two ids; a `When` that reads becomes a query with a `QRY-` id, which the
  pack model already distinguished and inference did not; names drop glue words,
  so "10 more vehicles enter the facility" gives `MoreVehiclesEnterFacility`
  rather than spending its four-word budget on "the"; field names are proposed
  from `<placeholders>` and `key: value` pairs, each with a `TODO` for its type;
  and `--from` repeats and accepts a directory, so a command shared by three
  files is proposed once.

  `--llm` is _not_ here: ADR-0014 defers it, and reopening that needs an ADR
  rather than a flag. Everything above stays a skeleton to review with every
  guess carrying its `TODO` — an inference that stops looking like a guess is
  the failure mode the ADR names. Closes #32.

  Also fixes a latent bug in the renderer: an empty list rendered as a bare `[]`
  on its own line, which the project's YAML reader rejects. Nothing had an empty
  list to render until queries arrived.

- **`adversary_profile` lets a second agent try to break a green
  implementation.** The advisory reviewer that already exists returns prose; an
  adversary returns a test, and a test either fails or it does not. After the
  gate passes and the work is committed, it is asked for one case the
  requirement should handle and might not; the project's tests then run again
  with it in place.

  A failing probe is a recorded warning and **never** a verdict. An adversary
  can always assert a behaviour nobody specified, so letting it fail the run
  would block correct work and make it a second judge — the gate stays the only
  one. Runs once per requirement, on a green gate only, and its writes are
  discarded so the branch carries the implementer's work alone. Closes #107.

- **`harness run --verbose`** streams the gate command's output as it runs,
  on stderr. Without it the output only appeared when the gate failed, so a run
  that takes minutes showed nothing and a hung test looked like a working one.
  Stdout stays reserved for `--format json`. Closes #34.

### Fixed

- **Every place that recommends a gate now recommends the gate.** `--strict`
  became the one gate in #174, but `specgate --help --all`, its example,
  `status`, `fix`, `change`, the instructions written for agents, the MCP tool
  description, the README, seven documentation pages and two templates still
  sold `--strict-tdd` — which passes a requirement whose test file is gone.
  The individual `--strict-*` flags keep working.
- **`req add|link|rm|done --help` answer with the subcommand's own help.** They
  printed the parent usage, whose last line tells you to run exactly that.
- **The `spec.md` written by `adopt` describes `req add` as it is.** It still
  said `req add` "does not write a section here" after it started writing one.

- **`git worktree add` raced itself under `--concurrency`.** Each requirement
  runs in its own process and every one creates a worktree in the same
  repository; git writes `.git/worktrees/<name>/` incrementally, so a sibling
  read an entry that was half there and failed with `failed to read … /commondir`. Worse, the failure was _attributed_: the run reported the
  requirement as failed with "the agent produced no files", so a race in the
  harness read as the agent's fault.

  `git worktree add` is now serialised across processes with a lock directory
  in `.git/`. Only the creation is inside it — the agent and the gate stay
  parallel. Closes #158.

- **MCP could edit the specification it was being measured against.** The
  prompt said not to; nothing enforced it. Tools that write a protected path
  are refused unless a change is open, with the list declared once on the
  command surface and the escape hatch written down in `.csda/config.json`
  rather than passed with the call. Closes #138.

### Changed

- **Pull requests target `develop`, not `main`.** `main` is the branch releases
  are cut from and the first thing an evaluator sees, so it does not get to be
  red — not even briefly. A green `develop` is fast-forwarded into `main` and
  the release is cut from there. CI runs on pushes to both.

## [0.8.1] — 2026-09-01

### Changed

- **The npm package is `@rsaglobaltech/specgate`.** 0.8.0 could not be published
  under the unscoped name:

  ```
  npm error 403 Forbidden - PUT https://registry.npmjs.org/specgate
             - You may not perform that action with these credentials.
  ```

  Not a permissions problem. npm compares a new package name against existing
  ones with punctuation removed, and
  [`spec-gate`](https://www.npmjs.com/package/spec-gate) normalises to exactly
  `specgate`, so the registry refuses the name to everyone and reports it as a
  credentials error. ADR-0024 had checked availability with `npm view specgate`
  → 404, which says _not published_ and never _creatable_; the
  [2026-09-01 addendum](docs/specs/adr/0024-the-tool-is-renamed-the-format-is-not.md)
  records both the decision and the bad check that led to it.

  The scope is what makes the name reachable at all, and it is the one the
  package already carries on GitHub Packages — so the tool now answers to a
  single spelling in both registries rather than two.

  **Only the install line changes.** The tool is still Specgate, the binary is
  still `specgate`, and `csda` and `create-spec-driven-app` remain alias
  binaries. The repository and the Docker image `ghcr.io/rsaglobaltech/specgate`
  are untouched — 0.8.0 published the image and the GitHub Packages copy
  successfully, which is why this ships as 0.8.1 rather than re-cutting a tag
  that is already live.

  Every scaffolded CI config, the pre-commit hook, the GitHub Action, the VS
  Code extension's `cliPath` default and the MCP server's fallback command all
  name the scoped package, so a project generated today installs something that
  resolves.

## [0.8.0] — 2026-09-01

The release that makes the new name real. Everything since 0.7.0 shipped under
`create-spec-driven-app`; this is the first version published as `specgate`, and
the one that finishes the rename past the layer where it had stopped.

### Changed

- **The tool is now called Specgate.** npm package `specgate`, binary
  `specgate`. `create-spec-driven-app` described a scaffolder in the
  `create-react-app` mould, and the product stopped being one several minors
  ago — it has a change lifecycle, an enforcing gate, an agent harness,
  versioned domain packs and ALM sync. The new name states the differentiator:
  the gate enforces the specs.

  **Nothing breaks.** `csda` and `create-spec-driven-app` both remain as alias
  binaries, and neither is removed in the 0.x line — an `npx` invocation that
  worked before still works.

  **The on-disk format is deliberately unchanged.** `csda:trace`, `csda:value`,
  `csda:allow-placeholders` and the `.csda/` directory keep their names. Those
  are not branding: they are a parsed format and a config directory that live
  inside _user_ repositories, and renaming them would be a silent breaking
  change to every adopted project — surfacing as "requirement not found" rather
  than as "your marker prefix changed". Reading both prefixes is a real
  migration feature, not a find-and-replace, and it is not built here.
  [ADR-0024](docs/specs/adr/0024-the-tool-is-renamed-the-format-is-not.md)
  records the decision so the mismatch is not mistaken for an oversight.

  **Distribution identity moves with it.** Sibling packages become
  `@specgate/*` (never published under the old scope — verified 404, so nothing
  to deprecate), the VS Code extension becomes `specgate-vscode` (unpublished,
  so no installs to orphan), and new Docker tags land under
  `ghcr.io/<owner>/specgate`. Images already published as `csda` are never
  rebuilt in place and keep working.

  `docs/release-process.md` gains the one-time cutover: the exact `npm deprecate` invocation for `create-spec-driven-app`, why the old package is
  deprecated and never unpublished (npm blocks reusing an unpublished name, and
  a pinned dependency would break for no gain), and the sequencing constraint —
  the rename and the release that publishes `specgate` are one event, because
  the README describes the tool by its new name.

  Two things caught by tests rather than by reading: the Docker workflow's smoke
  test still pulled the old image name after pushing the new one, and the MCP
  server resolved its own version by matching the package name literally, so it
  would have announced `0.0.0` over the wire. Both now match either spelling.

  Historical records keep the old name where it was accurate when written:
  earlier CHANGELOG entries, ADRs 0008–0010, the published article and the case
  study are left alone.

  **The cutover reaches the scaffolding this time.** Every template CI config
  installed `create-spec-driven-app`, pinned or floating at `@latest` — so a
  project generated after the deprecation would have installed a deprecated name
  frozen at 0.7.0 forever. They install `specgate`, and the template placeholder
  is `{{SPECGATE_VERSION}}`, renamed in lockstep with its writer.

  **`csda <sub>` became `specgate <sub>` across every surface a user reads**:
  the landing page (regenerated from its storyboard, not hand-edited), the
  guides, CLI help and error text, agent prompts and the scaffolding templates.
  `tests/unit/docs-truth.test.ts` enforced the opposite rule and is inverted
  rather than deleted — it rejects either alias followed by a real sub-command,
  and never matches the frozen `csda:`, `.csda` or `csda_` spellings.

  **The pack schema `$id` keeps `spec-driven.dev`.** An `$id` is the identity of
  v1, not a URL anything fetches; changing it is a schema-version event, not a
  rename.

The release that starts checking content instead of only paperwork. Every check
until now answered "are these documents internally consistent?"; none answered
"does the code say what the spec says?". These do — for the narrow slice where
that question has an honest answer. The reasoning, including what was
deliberately _not_ built, is [ADR-0023](docs/specs/adr/0023-checking-content-gate-or-report.md).

### Added

- **`csda validate --strict-requirements`** fails when a requirement in
  `docs/specs/capabilities/**/spec.md` states no obligation (`SHALL`, `MUST`,
  `SHOULD`, `MAY`, `DEBE`, `DEBERÁ`), or opens with `IF` and never resolves with
  `THEN`. It does **not** parse EARS grammar — no regex tells "the system" from
  a response clause reliably, and a check claiming a grammar it cannot parse is
  the H13 mistake. These two rules are what a regex can assert honestly.

  The point is upstream of any code checking: `- Max 5 failed attempts per hour per user` is not something a machine can hold code to. RFC 2119 detection also
  stops being duplicated — `DeltaSpec` enforced it for requirements inside a
  change while a capability spec at rest was never checked; both now read one
  definition.

- **`csda validate --strict-links`** fails when a Feature file, Technical
  artifact or Test artifact the matrix declares as a path no longer exists on
  disk. A cell may anchor a line range (`src/auth/login.ts#L15-L89`); the anchor
  is not part of the path.

  Opt-in, and that was measured rather than assumed: the first version ran
  unconditionally on the theory that a missing path has no legitimate reading,
  and the test suite disproved it at once — a `Draft` or `In Dev` row routinely
  names the file a requirement is _going to_ land in. Planning ahead is not
  documentary drift.

- **Declared-value drift in `csda report`.** Annotate a value on both sides —
  `value_<id>=<literal>` in a `csda:trace` comment, `csda:value <id>=<literal>`
  in the source — and the report classifies each identifier as `matched`,
  `diverging`, `spec_only` or `code_only`, with `file:line` for the code side.
  `--record` gains `valuesTotal`, `valuesMatched` and `valuesDiverging`, and the
  sparkline gains a second dotted series once the whole history carries them.
  All additive: an older history line simply lacks the fields.

  This is the case the other gates structurally cannot catch — spec and code
  both present, both internally consistent, and disagreeing. **It is a report,
  not a gate**, and that is a deliberate rejection of `--strict-values`: the
  cost of annotating grows with the number of checkable facts while coverage
  does not, and the fraction of requirements that reduce to a scalar shrinks as
  a system gets more complex. A hard gate over a partial, hand-maintained
  annotation set would mostly measure who remembered to annotate.

  It compares strings and does not interpret units. `15m` and `900000` are
  different values here, on purpose.

- **`csda change new <id> --from-value-drift <REQ-ID>:<value_id>`** turns a
  diverging value into a reviewable change. It writes a `## MODIFIED Requirements` delta carrying the full requirement, with the structured
  `value_<id>` rewritten to the value the code declares.

  **The prose is left alone.** Turning "expires after 15 minutes" into "after
  30" would be guessing how a sentence should read on someone's behalf, so it
  leaves an explicit `TODO:` instead — the same restraint `pack infer` already
  applies to what it cannot infer (ADR-0014). Four named exits rather than a
  half-written change directory, including `value_drift_already_matches`:
  proposing a change when there is nothing to change is worse than refusing.

  The other two routes out of a divergence needed no new command and got none —
  fixing the code (the report already gives `file:line`) and retiring the
  requirement (`--capability` with a `## REMOVED Requirements` section).

### Fixed

- **The gate approved an agent that wrote nothing (H19).** The gate runs _before_
  `csda done`, so at gate time the requirement is still `Draft` — and
  `--strict-tdd`'s "no `Test Artifact = TBD` past Draft" rule does not apply to a
  Draft row. `done` then moved the status to `Implemented` and nothing validated
  again.

  Reproduced against a freshly generated project with
  `--agent "cat {prompt_file} > /dev/null"`: **`✅ REQ-000 pass (1 attempt)`**.
  The branch carried the archived prompt and one changed line — the matrix row
  moved to `Implemented`, its Test artifact still `TBD`. No code, no test. It is
  H1's root cause exactly: the gate approving what it did not check.

  The harness now refuses an attempt whose diff is empty, before the gate rather
  than after — a green gate over an empty diff proves nothing, and stopping
  early also spares the project's test command. The archived prompt does not
  count as work, because the harness writes it itself. This is a hard failure
  rather than another opt-in flag: `--strict-artifacts` cannot catch it (it
  compares against the paths the row declares, and a row declaring none has
  nothing to compare), and an agent that produced no files has no legitimate
  reading — the condition ADR-0023 sets for a gate. The attempt ends at a new
  `no-op` stage, kept separate from `gate` in the run record because the fix is
  never in the code: it is the agent's write permissions or its prompt.

- **A generated project did not pass its own gates (H20).**
  `templates/base/spec.md.tpl` §8 shipped a pre-filled `REQ-001` example, and
  `traceability.md.tpl` carries only `REQ-000` — so every project born from
  `csda init` failed `validate --strict-tdd` with `[TDD-3]` before anyone wrote
  a line. `ensureTraceabilityCoverage` could not save it: it reconciles feature
  files that have no row, not requirements.

  Worse than a red gate on day one: `csda harness run` on a new project **burned
  all three agent attempts** failing on something the agent neither caused nor
  could fix. And it contradicted the README's L2 — _"a PR gate enforcing spec and
  test coverage, ~1 hour"_ — since the gate was red before the hour started.

  The placeholder row is gone, replaced by a comment pointing at
  `csda req add "<what the requirement does>"`, which writes the row in `spec.md`
  **and** in the matrix at once. The example use case no longer references a
  requirement id that does not exist. A generated project now passes all four of
  its gates, pinned by a test that runs them — the defect was invisible from
  inside, because plain `validate` was green throughout.

  Found while building the fixture to reproduce H19.

- **The test suite was asserting the defect.** Sixteen harness tests handed the
  runner `true {prompt_file}` — a command that reads nothing, writes nothing and
  exits 0 — as the stand-in for "an agent whose work passes the gate", and one
  more used a scripted agent with an empty write list. Every assertion built on
  them was pinning H19 as correct behaviour. They now use an agent that writes
  one file, which is the cheapest thing a real agent does. Same shape as H3,
  where a test weakened its own clean-tree check in order to pass.

### Changed

- **The support policy is a commitment now, not an intention (`GATE-G5`).**
  `docs/release-process.md` carried an escape clause saying the post-1.0 policy
  held only until the clause itself was deleted. It is deleted, and its absence
  is the commitment: from 1.0 on, one supported line plus the previous minor for
  **six months** from the day its successor ships — security and correctness
  fixes both, features not backported.

  What that costs is written down beside it, because a promise nobody costed is
  how the paragraph came to need an escape hatch in the first place: two lines
  need a release path for six months after every minor, and a fix landing on
  `main` has to be evaluated against the previous minor rather than only forward.

- **`SECURITY.md` listed `0.2.x` as the supported version — five minors late.**
  Nobody had revisited the table since it was written, so the security policy
  was making a support claim that had been false since 0.3.0. Corrected to
  `0.7.x`, with a note that the table moves with the release or it becomes the
  same kind of unchecked statement it exists to prevent.

### Documentation

- **The four opt-in gates are documented together** in
  [validating.md](docs/validating.md), with what each one deliberately does not
  check. **`--strict-scenarios` shipped in 0.7.0 and appeared in no user-facing
  document** — only in `docs/specs/harness.md`. A gate users cannot find is a
  gate that does not exist for them.

- **`ADR-0023`** records the rule the three additions follow: a content check is
  a gate only when failing it is always a defect; otherwise opt-in, or a report;
  and no check asserts a grammar it does not parse.

### Fixed

- **`specgate adopt` did not run at all.** `templates/adopt/spec.md.tpl` asks
  for `{{PROPOSED_REQUIREMENTS}}` and nothing supplied it, so the brownfield
  entry point died on `Missing variable 'PROPOSED_REQUIREMENTS' required by template` for every repository.

  Two parallel branches caused it. P6 taught `adopt` to seed one requirement per
  capability `onboard` reads off the layout, and added `--monorepo` and
  `--no-capabilities`; the clean-architecture refactor branched before that and
  rewrote `adopt` from the pre-P6 source. Merging both kept P6's template and
  the refactor's code, so the placeholder outlived the function that filled it.

  The same merge reverted `onboard` from 722 lines to 295, losing declared-module
  discovery, the layered-project descent, the Python package roots and the
  H14/H16/H17 fixes — which is why `proposeCapabilities` answered `[]` for every
  repository in the corpus. All of it is back, in its clean-architecture home,
  including `findAdoptedAncestor`: onboard runs on repositories that are not
  spec-driven yet, so resolving upwards to an adopted ancestor reports a
  different codebase than the one asked about (H16). The ancestor is named,
  never substituted.

- **`validate` stopped saying when an adoption was never retro-filled (H15).**
  Lost to the same merge. A project whose only scenario is the adoption baseline
  says so again — still a pass, never an error, because a gate that rejects a
  fresh adoption is a gate nobody installs.

- **Three MCP tools had been deleted and four renamed.** #138 generated the tool
  registry from the command surface and, in doing so, removed `read_spec`,
  `list_requirements` and `update_traceability` and renamed the rest to
  `csda_*`. A tool id lives in someone else's agent config. The three that are
  not a CLI command behind a shell now live outside the generated file, so
  regeneration cannot eat them again, and all seven published names resolve.

- **The MCP tool generator never wrote the file it generates.** `OUT_FILE`
  resolved from `__dirname`, which is `dist/scripts/` once compiled, so every
  run reported success into build output while the committed registry drifted
  from the surface it is derived from.

- **`validate_project` could not work over MCP.** The generated shell always
  passed `--project-dir`, and `validate` takes a positional `<dir>` and rejects
  the flag — so the most used tool of the seven failed with "Unknown flag(s)"
  and an empty payload. The surface already records which form a command takes
  in `json.args`; the generator reads it instead of assuming. Alongside it,
  `ensureProjectDir` had been reduced to a type check (a directory that is not
  spec-driven now gets a reason, not an empty failure) and the CLI command line
  was parsed with `split(" ")` (an interpreter path with a space in it now
  survives).

  `validate_project` returns the CLI's JSON document verbatim rather than the
  bespoke `{ passed, errors, warnings }` summary it used to flatten it into —
  one envelope, branch on the contract, per ADR-0017.

- **The IntelliJ plugin, `mcp install` and `agents init` invoked a package that
  does not exist.** All three named `@spec-driven/lsp-server` or
  `@spec-driven/mcp-server`; that scope was never published. They name
  `@specgate/*` now, which is what the packages actually publish.

- **The documented Docker pipeline could not have worked.** `docs/automation.md`
  told readers to pull `ghcr.io/rsaglobaltech/csda:0.2.1` and then run
  `specgate validate` inside it, and an image tagged before the rename has no
  `specgate` binary. The examples move to `ghcr.io/rsaglobaltech/specgate` and
  the note says why the image and the command name travel together. The
  Dockerfile's entrypoint is `specgate` rather than the alias.

- **The shell completions did not register `specgate`** — the primary binary was
  the one name that did not complete. All three shells now register all three
  names.

- **The landing page claimed 24 commands against a surface of 25.**

- **CI had not run this repository's own gate since the rename.** The rename
  commit changed the _references_ to `bin/specgate.{ts,js}` in `ci.yml`,
  `CONTRIBUTING.md` and `AI_RULES.md` without renaming the file, so the step
  named "Validate this repository against its own spec gate" ran
  `node bin/specgate.js validate .` against a path that did not exist and every
  test job failed. The entry point is `bin/specgate.ts` now, as those three
  documents already said. All three binaries — `specgate`, `csda` and
  `create-spec-driven-app` — point at it, and the shim's entry-point check
  accepts either basename so an installation carrying the old shim keeps
  dispatching.

- **The test suite could not locate the repository root on Windows.** Thirty-nine
  test files resolved it with `__dirname.split("/tests")[0]`, and `__dirname` on
  Windows is `…\dist\tests\unit` — the separator never matched, so the split
  returned the whole path and every spawned CLI was looked for under
  `dist\tests\unit\bin\`. The split is separator-agnostic now. It had been
  masked: the `adopt` regression above failed those files on every platform, so
  nothing distinguished "broken everywhere" from "broken on Windows".

## [0.7.0] — 2026-08-23

The release that closes the gate on itself. Every item below came from running
the loop and finding it approving work it had not checked — H13, H14, H15 and
H16, all four measured before anything was written and reproduced after.

### Added

- **`csda validate --strict-scenarios`** applies the pack's eight scenario
  quality rules to `features/**/*.feature`. The rules moved into the domain, so
  `pack lint`, `validate`, `doctor` and `harness run` reach the same verdict
  instead of three drifting copies. `doctor` reports them as advisories, which
  is the gradual path for a repository brought in with `csda adopt`.

- **`csda harness run --skip-not-ready`** skips a requirement an agent could not
  succeed at — no feature file, unmet dependencies, `Deprecated`, or `Needs Clarification`. `csda plan --format json` now carries `ready` and `blockers[]`
  per requirement, each blocker with a fix. Default is to warn and run it
  anyway; an unrunnable scenario skips regardless, because an empty scenario
  passes and a green run over one proves nothing.

- **`csda harness run --resume`** continues an interrupted run: it re-attaches to
  the branch and, when git still knows of one, to the worktree holding the
  agent's uncommitted work. Where it picks up is read from the prompt archive,
  not the run ledger — the ledger is written when a run _finishes_, so an
  interrupted run leaves none.

- **`csda harness run --budget-seconds` and `--max-requirements`** put a ceiling
  on a run. Asked before starting each requirement, never mid-attempt.
  Exhausting one is not an error: the run ends normally, names what it never
  started, and still writes its ledger.

- **`csda harness run --strict-artifacts`** fails an attempt whose green diff
  never touches the paths the matrix declares for the requirement. A warning by
  default — work can legitimately land in a shared module.

- **A write-scope guard.** Before the gate, the harness checks the agent has not
  edited the contract it is judged against: `spec.md`, `AI_RULES.md`,
  `features/**`, `docs/specs/**`, `.specops.lock`, `harness.config.yaml`.
  Configurable through `protected_paths` and `allow_paths`. Creating a file that
  did not exist is allowed; modifying one that did is not.

- **The gate reads Cucumber's message protocol** when it can. `--format message`
  answers whether a scenario for the requirement exists, ran, had steps and
  passed — where the exit code only said "zero". Opt in with `message_report:`,
  or let the harness add the flag to a direct `cucumber-js` invocation.

- **`csda harness report`** gains where attempts end, which requirements spend
  every attempt, a series over time, and `--mark-false-failure REQ-NNN --reason "…"`. The real-failure rate reads `—` until somebody marks one: nothing
  recorded can tell a gate that was wrong from work that was.

- **`depends_on`** on a pack's requirements. The harness cuts a dependent's
  branch from its predecessor's rather than from the run's base. Cycles and
  broken references are refused when the pack is validated, not at run time.

- **An agent profile per requirement.** A profile that declares `match:` selects
  itself, so one run can give different requirements different agents and
  different tool allowances. `cost_per_run_hint` lets a profile declare roughly
  what a run of it costs; the report multiplies it out, labelled as declared
  rather than measured.

- **`@REQ-NNN @SCN-NNN` tags** on every scenario `csda expand` and `csda init`
  write. `validate` uses them to check the matrix points at a scenario that
  exists — which nothing did before. A file carrying no tags is left alone.

### Changed

- **`scenario_has_no_steps` and `keyword_case_invalid` are errors on their own**,
  without `--strict`. They used to be style opinions that `--strict` promoted,
  CI ran `--strict`, and the packs still went out with 27 scenarios that
  executed nothing. Both messages name the file, the line and the spelling that
  works.

- **`schemas/pack.schema.json` describes the format that exists** (1.3.0 →
  1.4.0). It required full CQRS on every use case and command, so ten of the
  eleven curated packs failed the schema ADR-0020 calls the authority — while
  all eleven passed `pack lint`. Required is now what the installer needs;
  everything else is optional and validated when present. The shipped packs are
  validated against it in the suite, which nothing did before. **No pack changed
  and none had to**: this relaxes and corrects.

### Fixed

- **The eleven curated packs rendered empty domain documents.** The schema said
  `context` and `invariants`, the packs write `bounded_context` and
  `responsibilities`, and the renderer read the schema's names — so installing
  any pack produced `| AGG-001 | Invoice | - | - |` with the values right there
  in the pack under other names. Aggregates now render their context and
  responsibilities, and events their producer.

- **`validatePackModel` never checked an aggregate's bounded context.** It read
  `aggregate.context`; every pack writes `bounded_context`, and an empty
  reference is skipped — so the cross-reference was inert on all eleven.
  `pack lint` had its own check and caught it, which is why nobody noticed the
  installer's did not.

- **`parseYamlLite` split inline sequences on every comma**, including the ones
  inside quotes, so `responsibilities: ["Invoice line items, totals, status, aging"]` parsed as four items carrying stray quote characters.

### Security

- **A pack repository could make git run a command.** `csda expand --pack-repo`
  and `csda specops contribute` passed a caller-named repository straight to
  `git clone`. Two shapes turn that into execution, both of them git behaving as
  documented: a value beginning with `-` is read as an option, so
  `--upload-pack=<cmd>` runs `<cmd>`; and `ext::` is a transport whose job is to
  run a command.

  Both are refused now, with a message that says what to use instead, and the
  positional arguments are separated with `--`. Passing the value as its own
  argv element was never the defence — git parses argv, not the shell.

- **Fifteen regular expressions could backtrack quadratically.** All the same
  shape: `\s` matching a newline in a line-oriented pattern, or a lazy group
  followed by `\s*$`. Line patterns use `[ \t]` now and capture to the end of
  the line, trimming in code.

- **Two YAML writers escaped the quote but not the backslash**, so a value
  ending in `\` escaped its own escape and broke out of its string.

- **Matrix trace lines are parsed onto a prototype-less object**, since the keys
  come out of a file.

Found by putting the branch through CodeQL for the first time. Twenty-one alerts
were fixed rather than dismissed; nothing was waved through to make a release
date.

- **The published CLI did nothing on Windows.** `bin/create-spec-driven-app.js`
  is a two-line shim that `require`s the built entry point, so `require.main` is
  the shim and the guard recognised it by name — with
  `filename.endsWith("bin/create-spec-driven-app.js")`, which never matches on
  Windows, where `filename` carries backslashes. The CLI loaded, dispatched
  nothing, and exited 0 **with no output on either stream**.

  Found by putting this branch through CI for the first time: 437 tests failed
  on Windows and not one message said why, because there was no message. It
  survived because both machines it was developed on use `/`.

- **`csda validate .` on this repository had been failing since the clean
  architecture refactor.** Splitting `scripts/init_pack.ts` dropped its
  `csda:allow-placeholders` marker, so the command's own `{{VAR}}` output read
  as an unrendered project. It went unnoticed for six days because the gate
  being run was `test:all` plus the linters, and the selfcheck lives in
  `npm run verify`. Found by running the release gate, which is what it is for.

- **`csda pack init` still scaffolded `GIVEN / WHEN / THEN`.** The 27 shipped
  files were fixed; the file that writes new ones was not, so every pack created
  since started with an example scenario Cucumber saw as empty.

- **The scenarios shipped in the curated packs were never executed.** 27 of the
  28 scenarios under `packs/**` wrote their keywords in upper case —
  `GIVEN` / `WHEN` / `THEN` — and Gherkin keywords are case-sensitive. Cucumber
  read those lines as the scenario's _description_, so the scenario existed with
  **zero steps**, and an empty scenario passes: `1 scenario (1 passed) · 0 steps · exit 0`.

  Every project seeded with `csda specops add` therefore inherited an acceptance
  criterion that approves anything, and a harness run over those requirements
  was not verifying them. Measured on one file before and after: 0 steps and
  exit 0 became 3 steps and exit 1.

  `csda pack lint --strict` had approved them, because its own matcher is
  case-insensitive and saw three steps where the runner saw none. A new test
  parses every `.feature` and `.feature.tpl` this repository ships with
  `@cucumber/gherkin` — the parser that will actually run them — and fails on
  any scenario with no steps, so this cannot come back. Bringing the linter
  itself to parity with Cucumber is separate work.

  **If you already installed a pack**, `csda specops diff` will report drift in
  the rendered feature files. That is this correction arriving. Reviewing it as
  intent rather than as a file diff is what `csda specops diff --as-change` is
  for.

## [0.6.0] — 2026-08-18

### Fixed

- **A failed run destroyed the agent's work.** The gate failing meant `continue`,
  and the worktree was deleted at the end — so the branch came back identical to
  its base and there was nothing to review. Diagnosing a failure cost a second
  full agent run with `--keep-worktrees`, fifteen minutes to recover what the
  first run already had.

  The attempt is now committed on the branch with a `wip(REQ-NNN): FAILED the gate — do not merge as is` subject. The requirement stays `Draft`, because
  `csda done` never ran, so nothing about the matrix claims the work is good. A
  human reads it and decides; git just stops throwing it away. The report says
  whether the work was preserved, and distinguishes that from an agent that
  produced no files at all — one is a code problem, the other a prompt or
  permissions problem.

- **A gate that ran the whole suite instead of one scenario now says so.** If
  a filter silently fails to apply — a runner config pinning its own paths will
  override the CLI argument — the gate rejects correct work and the failure is
  indistinguishable from broken code. It cost two agent runs to explain the
  first time. The harness cannot know how many tests _should_ run, but it can
  notice a command that asked for one feature against output reporting many, and
  warn. A hint, not a verdict: a genuine failure must not be explained away.

- **A failing gate did not say which command it ran.** A gate that silently does
  the wrong thing — running a whole suite because a filter did not apply — fails
  identically to a real failure. That cost two agent runs to explain on REQ-002,
  where the work was correct and the gate rejected it.

- **The default `--timeout` is 1200s, up from 600.** Both real runs disproved the
  old value: the first REQ-001 attempt hit 900s while the agent installed
  dependencies and worked. A default that times out on ordinary work makes every
  first attempt a wasted one.

- **A failing `harness run` told you nothing you could act on.** The gate's full
  output — the assertion, the file, the line — was captured and then reduced to
  its first line by the report, so a failure read `Gate failed at: test command`
  and stopped there. With the worktree removed by default, there was nothing
  left to inspect either.

  The report now prints the tail of the gate output, where runners put the
  actual failure, and names the two flags that give more: `--format json` for
  everything, `--keep-worktrees` to reproduce it. Found by running REQ-002 and
  being unable to tell why it had failed.

- **`validate` scanned gitignored files.** The skip list is fixed and cannot
  know what a given project ignores, so a gitignored build directory containing
  `{{VAR}}` — documentation of the placeholder syntax, in this case — failed the
  gate with findings the project had already declared were not source.

  The scan now asks git what it ignores, and skips that as well as the fixed
  list. Best-effort: no git, no repository, or a git that errors falls back to
  the fixed list rather than refusing to scan, because a check that needs git
  to run is a worse failure than the one it prevents. A tracked file with the
  same placeholder is still reported — the fix narrows the scan, it does not
  weaken it.

- **`csda doctor` now names the installation it is running from**, and its
  version and path.

  Reported by a user whose `csda -v` kept printing 0.1.2 after installing "the
  latest". The tool was right — it _was_ 0.1.2, from a global install made
  months earlier. `npx create-spec-driven-app@latest` runs a temporary copy and
  never touches a global one, so the two answer different questions and nothing
  said so. Three minor versions behind, with no way to notice.

  Doctor distinguishes a global install, a project dependency, an npx cache copy
  and a local checkout, and prints the path. No network call: which version is
  newest is not doctor's business, and a lookup would break the offline and
  air-gapped modes the tool promises.

- **Doctor's Node check read `>= 20`** for a release after the floor moved to 22. It now reads the floor from `package.json` rather than repeating it — the
  same drift the floor guard exists to prevent, in the one file the guard did
  not cover.

## [0.5.0] — 2026-08-17

### Fixed

- **The gate could not run the scenario it was gating.** `test_cmd` was a fixed
  string with no substitution, and the gate runs _before_ `csda done` — so the
  requirement is still Draft and `validate --strict-tdd` does not demand its
  test either. Between them, `harness run` could mark a requirement Implemented
  with its scenario never executed.

  Verified rather than argued, with a requirement left unimplemented:
  `validate --strict-tdd` passed, the project's `verify` passed, and the
  scenario was undefined. Both gate steps green on work nobody did.

  The gate command now substitutes `{req}`, `{scenario}` and `{feature_file}`,
  so a project can write
  `test_cmd: "npm ci && npm run verify && npm run test:e2e -- {feature_file}"`.
  With that, the same no-op agent fails at the requirement's own scenario.

- **The harness blocked its own second run.** It archived each prompt into the
  _project_ directory, which left untracked files behind — and the harness
  refuses to start on a dirty tree. The archive now goes in the worktree, where
  `git add -A` commits it with the work, so the prompt arrives in the branch
  under review. That is what an audit copy was for.

- **A fresh worktree has no `node_modules`**, because it carries only what git
  tracks. Not a code change but the generated `harness.config.yaml` now says so
  and shows `npm ci &&` in front of the gate: the first real run lost an attempt
  to a 900-second timeout while the agent installed dependencies.

## [0.4.0] — 2026-08-17

### ⚠️ Breaking

- **The Node floor is 22.** `package.json` declares `>=22`, and CI tests 22 and
  24 across Linux, macOS and Windows — the floor and the current LTS, so a break
  at either end shows up.

  Node 20 left LTS maintenance in April 2026, so the matrix was testing against
  an unsupported runtime and proving nothing. An `npx` invocation that used to
  work and now refuses to run is breaking, whatever else this were called.

  Raised everywhere at once rather than only where it was noticed: the root
  `engines`, the three publishable packages (which still said `>=18`), every
  workflow's `setup-node`, the Docker image, the CI templates handed to users,
  and the prose in the README and the guides.

  **The policy is now written down**: the floor is a maintained LTS, and when
  one leaves maintenance the floor moves in the next release. See
  `docs/release-process.md`.

### Changed

- **`@cucumber/cucumber` 13.** It had been parked for a release because its
  `engines` wanted Node 22 while ours said 20 — the concrete cost of a stale
  floor. The BDD suite passes unchanged.

### Added

- **A test holds the floor in one piece.** It checks the root `engines`, every
  publishable package, each workflow, the CI matrix covering the floor itself,
  the Dockerfile, the templates generated for users, the prose in four guides,
  and that cucumber's own requirement is satisfied. Those had drifted before —
  the packages said 18 while the CLI needed 20 — and a floor only some places
  agree on is not a floor.

## [0.3.0] — 2026-08-17

### ⚠️ Breaking

- **`plan --json` and `report --json` now use camelCase inside `requirements`.**
  `0.2.0` announced the camelCase rename as a breaking change and applied it to
  the top-level keys only. The nested `requirements` array — the one array an
  agent actually iterates — kept `scenario_id`, `feature_file`,
  `technical_artifact`, `test_artifact`, `feature_exists`, `technical_exists`
  and `test_exists`. They are now `scenarioId`, `featureFile`,
  `technicalArtifact`, `testArtifact`, `featureExists`, `technicalExists` and
  `testExists`.

  Half-applied was the worst of the three options: the contract document said
  camelCase, the output disagreed, and nothing failed. The row objects keep
  snake_case internally — that is the matrix's own column vocabulary — so the
  rename happens at the emit boundary only.

  `summary` and `byCategory` are still keyed by the category enum
  (`NEEDS_IMPLEMENTATION` and friends). Those are values, not field names.

### Changed

- **One pack format, with `schemas/pack.schema.json` as its authority**
  ([ADR-0020](docs/specs/adr/0020-pack-format-standard.md)). The schema, the
  validator, the installer, `pack init` and every shipped pack had drifted into
  three descriptions that disagreed, and nothing compared them. The result:
  **all eleven curated packs failed to install**, `pack init` generated packs
  the installer refused, and `pack lint` called every one of them clean.

  - `outputs.features` is gone; `outputs.files` is the only output shape.
  - Domain invariants move from `rules` to a new **`business_rules`**. `rules`
    keeps its narrow meaning — how the pack renders. Two different ideas were
    sharing one key, and that collision is what broke installation.
  - A scenario now requires only what the installer needs: `id`,
    `requirement_id`, `target`, `template`, `feature`, `scenario`, `status`.
    `use_case`, `command`, `aggregate`, `events`, `technical_artifacts` and
    `test_artifact` are optional and validated when present, so a front-end
    pack no longer has to invent a command to satisfy a validator.
  - **`contracts` is a supported project type.** It was in the schema and in
    `pack init` while the installer rejected it outright.

  **No pack that ever installed stops installing.** Every change is a
  relaxation or an addition: the scenario rules got looser, `business_rules`
  and `contracts` are new, and `outputs.features` was never implemented by
  anything. Verified against eight packs authored outside this repository, all
  on `schema_version` 1.1.0 — every one still installs untouched. What needs
  migrating is the shape that never worked, and `pack lint` now names exactly
  what is wrong with it.

- **The CLI is called `csda` in every place it is a command.** The package
  ships two binaries — `create-spec-driven-app` and the `csda` alias — and the
  two were used interchangeably, so the same command appeared under different
  names depending on which guide or which `--help` you landed on. 92
  occurrences across 38 files now use the alias: usage strings, docblocks,
  guides, templates and the landing page.

  **Nothing about invocation changed.** Both binaries still work, and the
  bootstrap line is deliberately untouched: `npx create-spec-driven-app@latest`
  runs before anything is installed, at which point `csda` does not yet exist.
  npm links, the package name and file paths keep the long name too, as does
  `completion`, which registers both binaries on purpose.

  A guard scans the docs and sources so it cannot drift back.

### Added

- **`mobile` is a first-class `PROJECT_TYPE`**, and a pack flavour. Building a
  mobile app previously meant declaring `frontend` and setting the stack, so the
  type recorded in the generated project was untrue and the AI rules it
  inherited talked about responsive behaviour and route navigation.

  `templates/mobile/AI_RULES.md.tpl` is not a copy of the front-end one. It
  states as acceptance criteria the things a mobile app actually gets wrong:
  offline is a state rather than an error, the OS can kill the process at any
  moment, iOS/Android divergence is declared rather than assumed, a permission
  is a flow with a denial branch, deep links are cold entry points, and passing
  store review is part of done. The baseline scenario is a cold start that needs
  no network, not a request to `/`.

  A test pins all four places that list project types — `init`, the wizard,
  `pack init` and the JSON Schema enum — because a type accepted by one and
  refused by another is how `contracts` became scaffoldable and impossible to
  install.

- **`agent_profile` in `harness.config.yaml`**, resolved from
  `.harness/profiles.yaml`. A team commits the agent commands it uses — local,
  CI, a different vendor — and each environment picks one by name, instead of
  committing a single default somebody pays for by accident. An explicit
  `agent:` wins over a profile.

  It comes from a real pilot that was already configured this way: the file
  declared `agent_profile: local-claude` with a matching `profiles.yaml`, the
  CLI read neither, and `harness run` reported "No agent configured" while the
  config plainly declared one.

- **An unknown key in `harness.config.yaml` is now an error.** That silent
  shrug is what let the above go unnoticed. A key nobody reads is worse than a
  missing one, because the file looks configured.

- **Supply-chain documentation and a licence gate.** `docs/supply-chain.md`
  covers pack pinning, the content digest that catches a moved tag, GPG
  signing, and both air-gapped paths — `CSDA_OFFLINE=1` against the cache and
  `pack bundle` for a network that has never seen the pack. `CSDA_OFFLINE`
  appeared in no guide before, so a feature built for closed networks was
  invisible to anyone on one.

  A CycloneDX SBOM is generated on every push and retained 90 days, and
  `scripts/license_check.ts` fails the build on a licence outside an allow-list
  of permissive terms. Both come from `npm sbom` rather than a third-party
  generator — adding a dependency to document having none would be a poor trade.
  Available locally as `npm run sbom` and `npm run licenses`.

- **Pack drift is checked by default in generated CI.** `csda ci init` emits
  `validate --against-lock` for GitHub, GitLab, Azure and Jenkins, guarded on
  `.specops.lock` existing so a project without packs is unaffected.

  Signature verification stays opt-in. `require_signed_packs: true` as a default
  would fail every project installing a pack whose tags are unsigned, and a
  default that fails on correct usage teaches people to switch the check off.

- **Compatibility windows are enforced, not just described.** `pack.yaml`'s
  `schema_version` and `.specops.lock`'s `specops_version` were both written by
  the CLI and read by nothing, so a file from a newer version was accepted and
  then misread field by field. Both now fail up front, naming the versions and
  the upgrade command. Older files still load — only _newer than this CLI_ is
  refused.

- **`SECURITY.md`, `MAINTAINERS.md` and `CODEOWNERS`**, with private
  vulnerability reporting enabled so the policy points at a channel that
  exists. `main` is protected with required checks. Approving reviews are
  deliberately off while there is one maintainer — requiring one would make
  `main` unmergeable — and that exception is written down rather than left to
  look like an oversight.

- **Running the gate with no Node on the build agent** is documented in
  `docs/automation.md`: a pinned `ghcr.io/rsaglobaltech/csda` image as a GitLab
  job image or Jenkins docker agent, and the Maven plugin bound to the `verify`
  phase. The generated configs all call `npx`, which a Java shop's agent does
  not have — the reason the image and the plugins exist in the first place.

- **`csda harness init`** — scaffolds `harness.config.yaml` and
  `.harness/prompt-prefix.md`. The config was documented in the tutorial and
  named in `harness run`'s own error message long before anything created it,
  so every project hand-copied it out of a guide.

  It detects the gate from whichever build file is present (`package.json`,
  `pom.xml`, Gradle, Cargo, Go, Python) and **leaves `test_cmd` commented out
  when it cannot tell**. That absence is the point: `test_cmd` is an extra gate
  on top of the `validate --strict-tdd` the harness always runs, so an unset
  key is safe, while a placeholder like `echo "set this"` exits 0 and would let
  the harness mark requirements done without running a single test.

  `agent:` is left unset too. Which agent runs the loop is the operator's
  choice and their credentials, and a default in a committed file is a default
  somebody pays for by accident.

- **`pack lint` runs the installer's own validation.** "Lint passes" now means
  "this pack can be installed". It previously checked cross-references only, so
  a pack that could never be applied reported clean.
- **`pack init` produces an installable pack**, including the template files
  its `pack.yaml` declares. It used to write `pack.yaml` alone, so the pack it
  generated failed at the very next step it told you to run.
- **`--json` on `pack lint` and `specops diff`**, completing the agent
  contract. `specops diff` already had `--format json`; it now accepts `--json`
  and emits camelCase like everything else.
- **`parseYamlLite` understands inline flow sequences** (`[Invoice, Payment]`).
  The curated packs used them 54 times, and each one parsed as a literal string
  and then failed a cross-reference check against an aggregate nobody declared.
- **A test installs every pack in `packs/` into a scaffolded project.** Nothing
  exercised those packs before — not CI, not a test — which is why the drift
  went unnoticed for as long as it did.

- **`csda init --no-sample-req`**, implied by `--from-pack`. `init` seeds
  REQ-000 with a health scenario so a new project has one worked example; a
  domain pack installed afterwards brings its own requirements, often including
  its own health one, and `include_existing_rows` carries the starter forward
  beside them. The result was two requirements describing the same thing —
  found by dogfooding, where the studio app ended up with REQ-000 and the
  pack's REQ-015 both about deployment health.

  `--from-pack` knows a pack is coming and skips the starter. A plain `init`
  cannot know, so **`doctor` now reports the leftover** with the row to delete.
  It stays quiet when no pack is installed, and when the row has been filled in
  — an adapted REQ-000 belongs to the project, not to the scaffold.

- **`--json` on `report`, `fix` and `req list`.** Twelve commands now honour
  the agent contract, which is the figure `docs/agents.md` had been claiming.
  `report --json` is shorthand for `--format json --stdout`; `fix --json`
  requires `--yes` or `--dry-run`, because prompting an agent that never writes
  to stdin is a hang rather than a question.
- **`tests/unit/json-contract.test.ts`** — runs all twelve against a real
  scaffolded project and asserts one parseable document on stdout, a `status`
  array, and no snake_case field names at any depth.

### Fixed

- **Every harness prompt read "(none declared)".** `harness run` feeds the
  prompt builder by shelling out to `plan --format json`, so the camelCase
  rename above landed on one side of that seam only: the scenario, feature
  file and both artefacts came out blank, and no Gherkin was inlined. The
  builder now accepts both spellings, and a test scaffolds a project, asks the
  real CLI for its plan and feeds the first requirement to the real builder.

  It went unnoticed because the builder's unit fixture was written in the old
  vocabulary and pinned a shape `plan` no longer produces.

- **`init` plus a domain pack produced two requirements for the same thing.**
  The scaffold seeds REQ-000 with a health scenario; a pack installed afterwards
  brings its own, and `include_existing_rows` carried the starter forward beside
  it. `--from-pack` now skips the starter, and `doctor` reports the leftover for
  the plain `init` path — staying quiet when no pack is installed, and when the
  row has been filled in.

- **`req list --json` printed the human table and ignored the flag.** Worse
  than rejecting it: the caller believes it received a document. Empty matrix
  cells (`-`, `TBD`) now emit as `null` rather than as strings an agent would
  mistake for paths.

## [0.2.1] — 2026-08-16

### Fixed

- **The Docker image is built for arm64 as well as amd64.** `0.2.0` shipped
  amd64 only, so `docker run ghcr.io/rsaglobaltech/csda` — which the README
  tells people to use — failed on every Apple Silicon laptop and every ARM CI
  runner. The workflow needed QEMU alongside buildx to cross-build.

  The 0.2.0 image tag could not be rebuilt in place: re-running a workflow
  against an old tag checks out the workflow _as it was at that tag_, which did
  not yet have the fix. Hence a patch release rather than moving a published
  tag.

## [0.2.0] — 2026-08-16

Three months of work that never shipped. `0.1.4` went to npm in May and the
change lifecycle, SpecOps contribution loop, agent contract, artefact schemas
and brownfield onboarding have all landed since.

### ⚠️ Breaking

- **Command JSON output is camelCase throughout.** `plan`, `status`, `report`,
  `studio`, `pack infer` and `harness run` emitted `schema_version` and
  `project_dir` alongside nested camelCase keys — `studio` managed both in one
  document. ADR-0017 fixes camelCase, so they are normalised: `schemaVersion`,
  `projectDir`, `nextSteps`, `orphanFeatures`, `nextCommand`, `implementedPct`,
  `byCategory`, `needsTest`, `baselinePresent`.

  **On-disk formats are unaffected.** `pack.yaml` keeps `schema_version` and
  `.specops.lock` keeps `pack_id` and `specops_version` — those are file
  schemas, not command output, and renaming them would break every existing
  pack and lockfile.

  If you parse `plan --format json`, update those key names. The flag itself
  still works; `--json` is now accepted everywhere as the shorter spelling.

- **`csda --help` shows nine commands, not twenty-four.** (This entry said
  "eight, not twenty-one" until the numbers were counted in August 2026.) The
  full surface is
  behind `--help --all`, or set it as the default with
  `csda config set profile full`.

### Added

- **Change lifecycle** — `csda change new | list | show | status | validate | archive`. Modify a spec that already shipped through a reviewable delta.
  Archiving merges it into the spec tree, writes the traceability rows and
  materialises the feature files.
- **`csda change instructions <artifact>`** — the single context engine.
  Returns the template, the rules the validator enforces, the project's stack
  and what writing the artefact unblocks. `harness run` and the generated slash
  commands both consume it.
- **`csda agents init`** — slash commands and instruction files for Claude
  Code, Cursor, Copilot, Windsurf, Aider, Gemini, Cline and Codex, from one
  definition.
- **`csda onboard`** — reads an existing repository and proposes the
  capabilities its layout already implies, with the evidence for each.
- **`csda schema which | init | fork | validate`** — the artefact graph a
  change follows is now configurable. Ships `spec-driven` and `bdd-first`.
- **`csda update`** — three-way merges generated files after a CLI upgrade,
  preserving local edits and reporting conflicts rather than resolving them.
- **`csda init --from-pack <repo>@<tag>`** — scaffold and install a pinned pack
  in one step. An unpinned reference is refused.
- **`csda req`, `csda status`, `csda fix`, `csda studio`, `csda config`,
  `csda completion`** — the daily loop, recovered from an unmerged branch.
- **`specops diff --as-change`** — review a pack version bump as intent rather
  than as a file diff. **`specops contribute`** sends a local change back
  upstream. **`validate --against-lock`** fails CI on drift from the locked
  version.
- **`csda adopt`, `csda doctor`, `csda report`, `csda ci init`,
  `csda alm sync`** — brownfield adoption, diagnostics, an HTML coverage
  dashboard, CI gate generation for four providers, and Jira / Azure Boards
  synchronisation.
- **Maven and Gradle plugins**, an official Docker image, air-gapped pack
  bundles, pack integrity digests, and monorepo validation.
- **Language context** — `csda config set language es|pt`. Generated prose
  follows it; `SHALL`, `GIVEN`/`WHEN`/`THEN` and the section headings never do.
- **Language server** (`packages/lsp-spec-driven`) and an IntelliJ scaffold.
- **`docs/specs/agent-contract.md`** — generated from the source, with CI
  failing when it drifts.

### Fixed

- **`csda change archive` deleted user content.** It rebuilt `traceability.md`
  from its rows alone, discarding every other section of the file — the
  non-functional requirements, test inventories and notes — and reported
  success. It now replaces only the matrix table.
- **`validate` scanned `node_modules/`**, so any project with dependencies
  installed hit false placeholder findings from template libraries. It also
  flagged `.tpl` files, which are unrendered by definition. Both fixed, and the
  scan is now shared with `doctor`, which had drifted into reporting 64 false
  positives.
- **`DOCKER_SUPPORT=false` left an orphaned devcontainer** pointing at the
  `docker-compose.yml` that `init` had just deleted.
- **The coverage gate never enforced anything** — `c8` was missing
  `--check-coverage`, so the declared thresholds were decorative.
- **`doctor` reported every archived requirement as a stale matrix row**,
  because it compared against root `spec.md` alone and did not know about
  `docs/specs/capabilities/`.
- Windows CI ran unit tests only; it now runs the full suite. The Gradle plugin
  failed `validatePlugins` on Gradle 9. The Pages deploy had been broken since
  the TypeScript migration.

### Changed

- `docs/` is reorganised into task guides, none over 300 lines. The README is
  121 lines, down from 397. `docs/tutorial.md` deliberately stays long: it is
  one narrative, and splitting it would make it worse.
- `validate` diagnostics carry stable snake_case codes and a `fix`, and
  `--strict-tdd` emits one diagnostic per violation instead of a prose block.

## [0.1.4] — 2026-05-15

Harness prompt prefix, `harness prompt`, audit log, and the bootstrap document.

## [0.1.0-beta.1] — 2026-05-06

First tagged pre-release.
