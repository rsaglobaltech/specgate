# Proposal: onboarding-fixes

## Intent

Testers onboarded an existing local project and had to ask Claude to set
everything up. Reproduced on specgate 0.32.1:

- `specgate studio` refuses to start in a folder that is not a project yet
  ("docs/specs/traceability.md not found") — and Adopt lives in the studio's
  Settings, so the studio can never be used to onboard.
- `adopt` detects the test command (`npm test`, `mvn test`, `pytest`…) and only
  writes it into spec.md's text: `test_cmd` stays unset, so `specgate check` is
  green while running no test. The agent is set in two unrelated places
  (`agents init` for its instructions, `config set agent` for Build).
- `adopt` seeds one requirement per folder it guesses an area from — "Auth",
  "Payments" — with a `TBD` test, no scenario, no feature: in the matrix they
  read as real requirements nobody can tell the purpose of, and `status`
  counts them as work.
- The documentation has many overlapping doors (getting-started, quickstart,
  new-project, ten start pages, a 9,000-word home page).

## Scope

In scope:

- `adopt` saves what it detects (test command, agent) — asking first when
  interactive, applying with `--yes` — and ends with one readiness list.
- The areas it finds go to `docs/specs/adoption.md` with their evidence, not
  into spec.md or the matrix; earlier adoptions' unspecified proposals are
  flagged with how to fix them.
- `agents init --tool <tool>` also sets the agent Build runs.
- The studio opens any folder: one that is not a project gets a start screen
  that adopts it, with a preview first.
- One short Start page, two paths; the old doors point to it.

Out of scope:

- The studio creating a new project from an empty folder (it shows the
  command); the wizard stays in the terminal.

## Approach

Approved with the person who reported it on 2026-11-10: both the terminal and
the studio are doors with the same result; specgate configures what it detects
and asks when someone is there to answer; the documentation becomes concise.
