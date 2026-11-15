# Decisions, decision rights and the stack

At the end of this page your architecture decisions are numbered records that
are replaced rather than rewritten, the agent knows which decisions are not its
own to take, and the stack is written down once for the agent, the gate and
the next person.

**You need:** a Specgate project (`specgate init`).

## Record a decision

```bash
specgate adr new "Use Postgres for orders"
```

This writes `docs/specs/adr/0001-use-postgres-for-orders.md` with the next
free number, the status `Proposed`, today's date and three sections to fill
in: Context, Decision and Consequences. Set the status to `Accepted` once it is
agreed.

## Replace one, without rewriting it

An ADR records the reasons a decision was right when it was made. When it stops
being right, write a new one:

```bash
specgate adr supersede 0001 "Use SQLite at the edge"
```

The new ADR names the one it replaces (`**Supersedes:** ADR-0001`). The old
one changes in one line, its status, which becomes `Superseded by 0002`.
Everything else in it stays as written. An ADR already superseded, or one with
no `Status` line, is refused before anything is written.

```bash
specgate adr list --json      # every ADR: number, title, status
```

## Decision rights: what the agent may decide

Some changes are decisions even when a requirement needs them. Say which ones
the agent may take in `docs/specs/decision-rights.md`:

```markdown
| Decision   | Right | Checked in                             |
| ---------- | ----- | -------------------------------------- |
| dependency | ask   | a dependency added to a build manifest |
| migration  | ask   | a file added to a migration folder     |
| public-api | agent | an operation added to an OpenAPI file  |
```

`agent` lets the agent decide; `ask` keeps the decision for a person. The
harness puts the table in the agent's prompt and checks the diff of every
attempt:

| Decision | What counts as taking it |
| --- | --- |
| `dependency` | A new entry in `package.json`, `composer.json`, `pom.xml`, `build.gradle`, `go.mod`, `requirements*.txt`, `pyproject.toml`, `Cargo.toml`, `Gemfile` or a `.csproj`. |
| `migration` | A new file under `migrations/`, `migration/`, `db/migrate/`, `alembic/versions/` or `db/changelog/`. |
| `public-api` | More operations (`get`, `post`, …) in an `openapi*` or `swagger*` file than before. |

An attempt that takes a decision kept for a person fails before the gate:

```
⚠  REQ-014: decision_right_exceeded — dependency in package.json (left-pad)
```

The next attempt is told what to undo, and that it can ask instead with
`specgate ask <REQ> "<what you need, and why>"`. The rights are read from the
committed file, and `docs/specs/**` is protected, so an agent cannot grant
itself a right.

## The stack file

```bash
specgate stack
```

```
  migration    Flyway                 pom.xml: flyway-core
  service      Spring Boot            pom.xml: spring-boot-starter-web
  api          REST (Spring Web)      pom.xml: spring-boot-starter-web
```

This writes `docs/specs/stack.md` with two tables. **Layers** lists migration,
persistence, service, API, UI and end-to-end, each with its technology and the
evidence it was read from (a dependency in a manifest, or a folder).
**Commands** lists build, test, affected-test and end-to-end.

- When `harness.config.yaml` sets no `test_cmd`, `specgate check` and the
  harness run the stack file's test command.
- A command you correct in the file is kept the next time `specgate stack`
  runs. The layers are always detected again.
- A second run on an unchanged project changes nothing, so the file is safe to
  regenerate in CI and commit.

## Next

- [The harness](harness.md)
- [Lanes, roles and limits](harness-roles.md)
