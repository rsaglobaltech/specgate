# Getting started

Specgate turns what a product must do into requirements, scenarios that pin
them down, and tests that name them — and refuses to call anything done until
the test passes. Three things to do, in order.

## 1. Install it

You need **Node.js 22 or later**, and the test runner your project already
uses (`npm test`, `./mvnw verify`, `pytest`, `go test ./...` — Specgate runs
it, it does not replace it).

```bash
npm install -g @rsaglobaltech/specgate     # the command is `specgate`
specgate --help                            # or, without installing: npx @rsaglobaltech/specgate@latest --help
```

A coding agent (Claude Code, Codex, Cursor, Copilot, Aider…) is optional. Every
step works by hand; the agent is a faster pair of hands.

## 2. Pick your path

<!-- specgate:cards cols=3 -->
- [From scratch](start/scratch-1-install.md) — A new product, maybe a client's brief. Five steps: install, turn the brief into checked requirements, build the first one, prove it, keep the loop going.
- [An existing project](start/existing-1-adopt.md) — Code that already works. Five steps: adopt it without touching a line, write down one behaviour you rely on, close it with a test you already have, put the gate in CI.
- [You cloned a spec-driven repo](quickstart.md) — Someone else set it up. Five minutes to see where the project stands and close your first requirement.
<!-- specgate:endcards -->

Each path is **five short steps, one page each**. A bar at the top of every
page shows where you are; every terminal on those pages is real output,
recorded from the CLI — a check fails the build when a page and the CLI
disagree.

**Starting from a plan or a client's brief?** Most projects do: read
[Write the brief](start/write-the-brief.md) after step 1. Your plan goes in
`docs/brief.md` as it is, and your agent can propose the four fields Specgate
needs at its top.

## 3. Learn the daily loop

Once a project is set up, the day is five commands:

<!-- specgate:steps -->
### `specgate status` — where you stand

What is left, requirement by requirement, and the one command to run next.
`specgate` on its own does the same.

### `specgate new "<what it does>"` — one more requirement

Its sentence in `spec.md`, a scenario to fill in, and its row in the matrix.

### A test that names it

Write a test that mentions `REQ-007` — that mention is the link. Nothing to
declare.

### `specgate done REQ-007` — close it

Marked `Implemented` only if the gate passes for it: the specification, the
link and your test suite.

### `specgate check` — before a pull request

The whole gate. The same command runs in CI.
<!-- specgate:endsteps -->

At the foot of `status` sits **Gato**, the cat that keeps the gate. It grows as
requirements close and falls sick when `check` is red;
[what it means](start/scratch-5-every-day.md#gato-the-cat-that-keeps-the-gate).

## The two paths side by side

| Step | From scratch | An existing project |
| --- | --- | --- |
| 1 | [Install and set up](start/scratch-1-install.md) | [Adopt, touching no code](start/existing-1-adopt.md) |
| 2 | [Specify](start/scratch-2-specify.md) — the brief becomes a checked draft, a module at a time | [Specify](start/existing-2-specify.md) — one behaviour you rely on |
| 3 | [Build](start/scratch-3-build.md) — test first, by hand or with the harness | [First requirement](start/existing-3-first-requirement.md) — the test you have names it |
| 4 | [Prove](start/scratch-4-prove.md) — `done`, `check`, `report` | [CI](start/existing-4-ci.md) — the gate on every pull request |
| 5 | [Every day](start/scratch-5-every-day.md) — CI and the loop | [Every day](start/existing-5-every-day.md) — one module at a time |

## Upgrading from 0.18 or earlier?

Since 0.19 everything is called `specgate`: the markers in your specs
(`<!-- specgate:trace … -->`), the `.specgate/` folder and the `SPECGATE_*`
variables. A project on the old `csda:` format fails `validate` with
`old_format` and the command to migrate it, once
([ADR-0032](specs/adr/0032-one-name-everywhere.md)).

## Already on OpenSpec?

Keep writing your specs with OpenSpec. `specgate verify` reads `openspec/` in
place, never writes to it, and fails when an archived change claims a scenario
no test names. Nothing to migrate: [Already on OpenSpec](openspec.md).

## Then

- [Every command, grouped by when you need it](commands.md)
- [Write good requirements and scenarios](writing-specs.md)
- [Hand the loop to an agent — the harness](harness.md)
- [Six real products built this way](projects/index.md)
