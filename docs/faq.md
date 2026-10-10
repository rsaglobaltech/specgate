# Frequently asked questions

The questions teams ask in the first week, with the short answer and where the
long one lives.

---

## Adopting it

### Does it work on a repository that already exists?

Yes, and that is the common case. `specgate init` sees the code
(`pom.xml`, `package.json`, `go.mod`, `pyproject.toml`, `Cargo.toml`, …),
adopts the repository in place and touches no source file. The gate is green
the same day because a `Draft` requirement owes nothing yet.
→ [Getting started](getting-started.md)

### Which languages and build tools?

Any. Specgate reads markdown, Gherkin and file names; the link between a
requirement and a test is a mention of `REQ-NNN`, which any language can
carry in a comment or a test name. Your own test command runs your suite.

### Do I need Node.js?

Node.js 22 or later for the CLI. Without it: the Docker image
(`ghcr.io/rsaglobaltech/specgate`), or the Maven and Gradle plugins on a JVM
build agent.

### Do I have to use DDD, hexagonal architecture or CQRS?

No. Patterns are optional; principles are not
([ADR-0022](specs/adr/0022-patterns-are-optional-principles-are-not.md)). The matrix has columns for use cases,
commands, aggregates and events; leave them as `-` if your system has none.

### Do I need Cucumber?

No. Scenarios are written in Gherkin so they *can* be executed and so the gate
can check them, but the gate links a requirement to whatever test mentions it.
If you do run Cucumber, the gate reads its message protocol and refuses a
scenario that ran zero steps.

### How do we stop using it?

Delete `spec.md`, `features/`, `docs/specs/` and the CI job. Adoption never
touched your code, so nothing else depends on it.

---

## Day to day

### Does every pull request need a new requirement?

No. A bugfix or a refactor that does not change contracted behaviour adds
none, and the gate only asks for what delivered requirements owe.
→ [Your team's first pull request](first-pr.md)

### Who edits the traceability matrix?

Nobody. It is generated from `spec.md`, the scenario tags and the files that
mention each requirement. Commit what `specgate check` regenerates; CI fails
with `matrix_stale` when you forget. → [How Specgate thinks](concepts.md)

### Two branches both changed the matrix and now it conflicts.

Take either side and run `specgate matrix`: it is regenerated from the merged
sources, so the conflict resolves itself.

### `done` refuses. Can I force it?

`specgate done REQ-NNN --no-check` writes the status without the gate. Use it
when the gate is wrong, say so in the pull request — and open an issue,
because a wrong gate is a bug.

### `check` says it checked the specification, not the code.

No test command is configured, so nothing ran your tests. Run
`specgate config set test_cmd "npm test"` once, or pass `--test-cmd "npm test"`. Until then a green
`check` means the specification is consistent, nothing more.

### What does a reviewer look at?

The requirement, its scenario and the test that mentions it — not the matrix.
The one thing the gate cannot catch is a test that names a requirement and
does not test it. → [Your team's first pull request](first-pr.md#the-reviewer-what-to-read-what-to-skip)

---

## Agents

### Which AI agent does it need?

None. Every command works by hand. `specgate init` installs the slash commands
for the agents it finds in your project (`CLAUDE.md`, `.cursor/`, …); `specgate agents init`
writes them for any other, with slash commands and rules for Claude Code, Cursor, Copilot, Windsurf,
Aider, Gemini, Cline, Codex or Antigravity. → [Agent tools](agents.md)

### Can an agent rewrite the spec to make its own test pass?

Not quietly. Over MCP, tools that write the specification refuse unless a
change is open or the team set `mcpAllowContractEdits`. In the harness,
touching `spec.md`, `features/**` or the rules fails the attempt.
→ [The MCP server](mcp.md) · [The harness](harness.md)

### Will the harness merge its work?

Never. It leaves one branch per requirement and stops. Merging is a judgement,
and a tool that merges its own work removes the last place a person reviews it.

### What does a harness run cost?

Whatever your agent costs. The harness measures wall-clock time; a profile
may declare a cost hint, and `specgate harness report` multiplies it out and
says the figure is declared, not measured.

---

## Security and operations

### Does the CLI send telemetry?

No. It makes network calls only when you ask for something remote: an ALM
sync, a pack fetched from a git URL, or `npx` downloading the package itself.

### Can it run air-gapped?

Yes. Use the Docker image or a vendored package, and install packs from a git
bundle (`specgate pack bundle`). → [Supply chain](supply-chain.md)

### What does it install?

One package with zero runtime dependencies. Every release ships a CycloneDX
SBOM, and its licence policy is a build gate. → [Supply chain](supply-chain.md)

### How do we pin the version in CI?

`specgate ci init` writes the job with the version that generated it
(`npx @rsaglobaltech/specgate@<version>`), so CI does not change behaviour the
day a new release is published.

---

## Compared with others

### How is this different from OpenSpec or Spec Kit?

Mostly in what happens after the specification is written: a matrix CI
enforces, Gherkin a runner can execute, versioned domain packs and an
unattended harness. OpenSpec is smaller, and if you only want the change loop
it is the better fit. → [Comparisons](comparisons.md)
