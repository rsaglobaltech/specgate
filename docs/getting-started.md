# Getting started

**Starting from scratch, or bringing code you already have?**

Specgate works the same way in both cases — requirements, scenarios that
pin them down, tests that name them, and a gate that refuses "done" until
the test passes — but the first hour is different. Pick your path; each is
five short phases, one page each, with every command's real output.

<!-- specgate:cards cols=3 -->
- [From scratch](start/scratch-1-install.md) — A new product and a client's brief. Install, turn the brief into checked requirements, build the first one, prove it, keep the loop going.
- [An existing project](start/existing-1-adopt.md) — A codebase that already works. Adopt it without touching a line, write down one behaviour you rely on, close it with the test you already have, gate it in CI.
- [You cloned a spec-driven repo](quickstart.md) — Someone else set it up. Five minutes to see where the project stands and close your first requirement.
<!-- specgate:endcards -->

**Starting from a plan or a client's brief?** Most projects do. Read
[Write the brief](start/write-the-brief.md) first: your plan saved as
`docs/brief.md`, and the four fields Specgate needs at its top — your agent can
propose them.

## The two journeys at a glance

| Phase | From scratch | An existing project |
| --- | --- | --- |
| 1 | [Install and set up](start/scratch-1-install.md) — `specgate init`, the test command, the first green gate | [Adopt, touching no code](start/existing-1-adopt.md) — `onboard`, `init`, the first green gate |
| 2 | [Write the brief](start/write-the-brief.md), then [from the brief to a checked spec](start/scratch-2-specify.md) — `specgate draft`, a module at a time, archive | [Write down what you rely on](start/existing-2-specify.md) — `specgate new`, a real scenario |
| 3 | [Build the first requirement](start/scratch-3-build.md) — test first, by hand or with the harness | [Close the first requirement](start/existing-3-first-requirement.md) — the test you already have names it |
| 4 | [Prove it](start/scratch-4-prove.md) — `done`, `check`, `report` | [Put the gate in CI](start/existing-4-ci.md) — `ci init`, `check` on every pull request |
| 5 | [Every day](start/scratch-5-every-day.md) — CI and the five-command loop | [Every day](start/existing-5-every-day.md) — one module at a time |

Every output on those pages is recorded from the CLI by
`npm run docs:journey`, and a check fails the build when a page and the CLI
disagree — so what you see is what you will get.

## What you need

- **Node.js 22 or later.** Specgate has no runtime dependencies.
- **A test runner your project already uses** — `node --test`, `npm test`,
  `./mvnw -B verify`, `pytest`, `go test ./...`. Specgate runs it; it does not
  replace it.
- **Optionally, a coding agent** — Claude Code, Codex, Cursor, Copilot, Aider
  and others. Every step works by hand; the agent is a faster pair of hands, and
  [the harness](harness.md) lets it build requirements unattended.

```bash
npx @rsaglobaltech/specgate@latest --help    # no install
npm install -g @rsaglobaltech/specgate       # or install it; the binary is `specgate`
```

## Already on OpenSpec?

Keep writing your specs with OpenSpec. `specgate verify` reads `openspec/` in
place, never writes to it, and fails when an archived change claims a scenario
no test names — so what OpenSpec calls done is proved. Nothing to migrate:
[Already on OpenSpec](openspec.md).

## Then

- [Every command, grouped by when you need it](commands.md)
- [Write good requirements and scenarios](writing-specs.md)
- [Hand the loop to an agent — the harness](harness.md)
- [Six real products built this way](projects/index.md)
