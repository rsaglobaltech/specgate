# Getting started

Specgate turns what a product must do into requirements, scenarios that pin
them down, and tests that name them, and it refuses to call anything done
until the test passes. This page installs it and sends you to the guide that
fits your situation: two choices, then the four verbs you use every day.

**You need:** Node.js 22 or later, git, and the test runner your project
already uses (`npm test`, `./mvnw verify`, `pytest`, `go test ./...`).
Specgate runs your tests; it does not replace them. A coding agent (Claude
Code, Codex, Cursor, Copilot, Aider…) is optional: every step works by hand.

## 1. Install it

In a project that has a `package.json`, add Specgate as a development
dependency and run it with `npx specgate`:

```bash
npm install --save-dev @rsaglobaltech/specgate
npx specgate --help
```

Anywhere else (an empty folder, a Java or Python project), run it without
installing:

```bash
npx @rsaglobaltech/specgate@latest --help
```

The guides write each command as `specgate` and its arguments. Type `npx`
in front of it when Specgate is installed in the project, or
`npx @rsaglobaltech/specgate@latest` in place of `specgate` when it is not.

## 2. Where do you start?

<!-- specgate:cards cols=3 -->
- [A new project](start/scratch-1-install.md) — An empty folder, maybe a client's brief. Five short steps: set up, turn the plan into checked requirements, build the first one, prove it, keep the loop going.
- [Existing code](start/existing-1-adopt.md) — A codebase that already works. Five short steps: adopt it without touching a line, write down one behaviour you rely on, prove it with a test you already have, put the gate in CI.
- [Joining a project](quickstart.md) — Someone else set Specgate up. See where the project stands and deliver your first requirement.
<!-- specgate:endcards -->

Each journey is five short pages. A bar at the top of every page shows where
you are, and every terminal on those pages is real output recorded from the
CLI.

<!-- specgate:note -->
**Generate a new project with forja.** forja, a companion tool, generates a
whole application (a TypeScript web and mobile monorepo, or a Spring Boot or
Quarkus API with a web app) with Specgate already adopted. It is optional:
Specgate works on any project you create yourself.
See [forja: Getting started](forja/getting-started.md).
<!-- specgate:endnote -->

## 3. Where does the work come from?

Every piece of work becomes a **change**: a folder that holds the requirements
being added or modified until they are built. You can open one in three ways:

| You have | Open the change with | Guide |
| --- | --- | --- |
| One behaviour to add or change | `specgate propose <change-id>` | [Propose one change](start/existing-2-specify.md) |
| A client brief, or a plan for a new product | `specgate propose --from-brief` | [Write the brief](start/write-the-brief.md), then [From a client brief](from-a-brief.md) |
| A Jira story with acceptance criteria | `specgate propose --from-ticket <KEY>` | [From a Jira ticket](from-a-ticket.md) |

A codebase that is years old and gets its work as Jira tickets combines two
rows: adopt the code, then let the specification grow ticket by ticket. See
[An existing codebase, with Jira](existing-project-with-jira.md).

Not sure which one? [A brief, a ticket, or neither?](faq.md#a-brief-a-ticket-or-neither)

## 4. The four verbs

Once a project is set up, the day is four verbs: `propose`, `apply`, `status`
and `archive`. `check` runs the same gate before a pull request and in CI.

<!-- specgate:steps -->
### `specgate propose add-pdf-invoices` — open a change

Creates `docs/specs/changes/add-pdf-invoices/` with a proposal, a **delta**
(the requirements and scenarios this change adds or modifies) and a range of
`REQ` ids reserved for it. Write the requirement and its scenario in the delta.

### A test that names it

Write a test that mentions `REQ-007`. That mention is the link: there is
nothing to declare. Then write the code.

### `specgate apply REQ-007` — deliver one requirement

Refused while no test names the requirement. Then it runs the gate (the
specification, the link and your test suite) and marks the requirement
`Implemented` only if the gate passes. Without an id, it takes the next one.
`apply` does not commit: commit when it is green.

### `specgate status` — where you stand

What is left, requirement by requirement, including those of an open change,
and the one command to run next.

### `specgate archive add-pdf-invoices` — close the change

Once every requirement in the change is `Implemented`, merges the delta into
the specification, the traceability matrix and `features/`. It refuses while
one is pending. Archive on your branch, before the pull request, so the spec
and the code reach review together.

### `specgate check` — before a pull request

The whole gate. CI runs the same command.
<!-- specgate:endsteps -->

The words used here (change, delta, gate, traceability matrix) are defined in
[Concepts](concepts.md#vocabulary).

## The two journeys side by side

| Step | A new project | Existing code |
| --- | --- | --- |
| 1 | [Install and set up](start/scratch-1-install.md) | [Adopt, touching no code](start/existing-1-adopt.md) |
| 2 | [Specify](start/scratch-2-specify.md) — the brief becomes a checked draft, a module at a time | [Specify](start/existing-2-specify.md) — one behaviour you rely on |
| 3 | [Build](start/scratch-3-build.md) — test first, by hand or with the harness | [First requirement](start/existing-3-first-requirement.md) — the test you have names it |
| 4 | [Prove](start/scratch-4-prove.md) — `apply`, `check`, `report` | [CI](start/existing-4-ci.md) — the gate on every pull request |
| 5 | [Every day](start/scratch-5-every-day.md) — CI and the loop | [Every day](start/existing-5-every-day.md) — one module at a time |

## Already on OpenSpec?

Keep writing your specs with OpenSpec. `specgate verify` reads `openspec/` in
place, never writes to it, and fails when an archived change claims a scenario
no test names. Nothing to migrate: [Already on OpenSpec](openspec.md).

## Next

- [Concepts](concepts.md) — the ideas behind every command, and the vocabulary
- [Command reference](commands.md) — every command, grouped by when you need it
