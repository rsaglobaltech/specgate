# ADR-0047 — Evidence before and after: each change shows what the flow did, and what it does now

## Status

Proposed — 2026-11-27. To be delivered by the change `evidence-before-after`
(REQ-803..807). Builds on the evidence `apply` keeps (REQ-680), the red run of
a bug (REQ-682, REQ-683), the sealed acceptance tests' first run (REQ-794) and
trust levels (ADR-0046).

## Context

Review is moving from reading code to looking at evidence of what a change
does: screenshots, a video of the flow, a sequence diagram — and reading the
code only where the risk calls for it. A project run on 2026-11-27 asked for
exactly that: for a web change, a picture of the screen before and after and a
short video of the flow up to it; for a backend change, a sequence or class
diagram before and after; always a view of each flow as it was and as it is.

Specgate keeps half of it. After a green `apply` with `bdd: required`,
`.specgate/evidence/<REQ>/` holds the scenario run and what the browser left in
`test-results/` (REQ-680): the after, only. Nothing keeps the before, nothing
draws a backend change, and nothing puts the two side by side where a reviewer
looks.

## Decision

1. **The before is the red run, not the base commit.** The scenarios that will
   judge the requirement already run before any code: when a person seals the
   acceptance tests (REQ-794), when a bug is reproduced (REQ-683). That run is
   kept as `.specgate/evidence/<REQ>/before/`, and `specgate evidence before
   <REQ>` takes it on demand. On an existing screen it shows the screen as it
   was; on a new one, where the flow stopped. A second checkout of the base
   commit, installed and started, was rejected: it doubles the cost of every
   delivery for a picture the red run already gives. The agent's `apply` step
   says to take it once the test is written and before the code; taking it
   when the acceptance tests are sealed comes later.
2. **The after is what `apply` keeps today**, where it keeps it: the folder's
   `evidence.json`, `bdd.log` and `artifacts/`, which the steps review and the
   outside judge's controls already read. `evidence.json` names the before.
3. **Specgate does not drive the browser.** It keeps what the project's runner
   writes. Screenshots and video are the project's Playwright settings
   (`screenshot: 'on'`, `video: 'on'`); `specgate doctor` says when they are
   off, with the lines to add. No browser becomes a dependency: Specgate keeps
   zero runtime dependencies.
4. **Backend changes are drawn, deterministically.** Mermaid, which GitHub
   renders:
   - a sequence diagram per scenario, from its steps — the requirement's actor,
     the system, and the calls the steps name (`POST /api/bookings`) — as the
     spec said at the base and as it says now;
   - a class diagram of the files the requirement's code column links, at the
     base (`git show <base>:<file>`) and now, for TypeScript, JavaScript, Java,
     Kotlin, C# and Python: classes, their public members, what they extend.
     Approximate by design, and labelled so.
   No model draws them: a gate's evidence must come out the same twice. An
   agent may add its own diagrams beside them.
5. **One page per change.** `specgate evidence <change>` writes
   `docs/specs/changes/<change>/EVIDENCE.md`: per requirement, before and
   after side by side — the first and last screenshot of each scenario,
   copied next to the page under a size cap, the diagrams inline, the video and
   trace named by their path under `.specgate/evidence/`. It is committed with
   the change, archived with it, and the pull request links it.
6. **Nothing is refused for want of evidence** in this change: a missing before
   is reported, not failed. A later change may let a trust level require it.

## Consequences

- A reviewer starts from EVIDENCE.md, and opens the code when it shows risk.
- `.specgate/evidence/<REQ>/` gains `before/`; nothing that reads it today
  moves.
- Screenshots in the repository: bounded by the cap, first and last of each
  scenario only. Videos and traces stay out of git.
- A project without `bdd: required` gets diagrams and no pictures: its
  scenarios never run.

## Rejected

- Running the base commit in a second worktree: a second install and start for
  every requirement.
- Driving a browser from Specgate (Playwright as a dependency, or our own
  screenshot step): the project's runner already knows its app, its login and
  its data.
- Diagrams drawn by a model inside the gate: not reproducible.
- Committing videos: too large for a repository; CI keeps them as artifacts.
