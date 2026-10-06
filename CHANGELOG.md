<!-- csda:allow-placeholders — release notes quote the {{VAR}} template syntax. -->
# Changelog

Notable changes, newest first. Follows [Keep a Changelog](https://keepachangelog.com/)
and [Semantic Versioning](https://semver.org/).

The release process is in [`docs/release-process.md`](docs/release-process.md).

## [Unreleased]

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
  what it still needs — split into *Ready to close* and *To do*, capped at 12
  per group. `Next` names a requirement (`specgate done REQ-003 --strict`)
  instead of answering `specgate plan`. `--json` gains a `requirements` array.
  `plan` leaves the daily help and keeps the full detail.
- **`plan` no longer says "code & test exist" over a row with no code.** A
  declared code path is optional; the heading now says *its declared test and
  code exist*.
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

  `--llm` is *not* here: ADR-0014 defers it, and reopening that needs an ADR
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
  read an entry that was half there and failed with `failed to read …
  /commondir`. Worse, the failure was *attributed*: the run reported the
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
  → 404, which says *not published* and never *creatable*; the
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
  inside *user* repositories, and renaming them would be a silent breaking
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

  `docs/release-process.md` gains the one-time cutover: the exact `npm
  deprecate` invocation for `create-spec-driven-app`, why the old package is
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
deliberately *not* built, is [ADR-0023](docs/specs/adr/0023-checking-content-gate-or-report.md).

### Added

- **`csda validate --strict-requirements`** fails when a requirement in
  `docs/specs/capabilities/**/spec.md` states no obligation (`SHALL`, `MUST`,
  `SHOULD`, `MAY`, `DEBE`, `DEBERÁ`), or opens with `IF` and never resolves with
  `THEN`. It does **not** parse EARS grammar — no regex tells "the system" from
  a response clause reliably, and a check claiming a grammar it cannot parse is
  the H13 mistake. These two rules are what a regex can assert honestly.

  The point is upstream of any code checking: `- Max 5 failed attempts per hour
  per user` is not something a machine can hold code to. RFC 2119 detection also
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
  names the file a requirement is *going to* land in. Planning ahead is not
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
  diverging value into a reviewable change. It writes a `## MODIFIED
  Requirements` delta carrying the full requirement, with the structured
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

- **The gate approved an agent that wrote nothing (H19).** The gate runs *before*
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
  could fix. And it contradicted the README's L2 — *"a PR gate enforcing spec and
  test coverage, ~1 hour"* — since the gate was red before the hour started.

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
  entry point died on `Missing variable 'PROPOSED_REQUIREMENTS' required by
  template` for every repository.

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
  commit changed the *references* to `bin/specgate.{ts,js}` in `ci.yml`,
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
  succeed at — no feature file, unmet dependencies, `Deprecated`, or `Needs
  Clarification`. `csda plan --format json` now carries `ready` and `blockers[]`
  per requirement, each blocker with a fix. Default is to warn and run it
  anyway; an unrunnable scenario skips regardless, because an empty scenario
  passes and a green run over one proves nothing.

- **`csda harness run --resume`** continues an interrupted run: it re-attaches to
  the branch and, when git still knows of one, to the worktree holding the
  agent's uncommitted work. Where it picks up is read from the prompt archive,
  not the run ledger — the ledger is written when a run *finishes*, so an
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
  every attempt, a series over time, and `--mark-false-failure REQ-NNN --reason
  "…"`. The real-failure rate reads `—` until somebody marks one: nothing
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
  inside quotes, so `responsibilities: ["Invoice line items, totals, status,
  aging"]` parsed as four items carrying stray quote characters.

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
  read those lines as the scenario's *description*, so the scenario existed with
  **zero steps**, and an empty scenario passes: `1 scenario (1 passed) · 0 steps
  · exit 0`.

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

  The attempt is now committed on the branch with a `wip(REQ-NNN): FAILED the
  gate — do not merge as is` subject. The requirement stays `Draft`, because
  `csda done` never ran, so nothing about the matrix claims the work is good. A
  human reads it and decides; git just stops throwing it away. The report says
  whether the work was preserved, and distinguishes that from an agent that
  produced no files at all — one is a code problem, the other a prompt or
  permissions problem.

- **A gate that ran the whole suite instead of one scenario now says so.** If
  a filter silently fails to apply — a runner config pinning its own paths will
  override the CLI argument — the gate rejects correct work and the failure is
  indistinguishable from broken code. It cost two agent runs to explain the
  first time. The harness cannot know how many tests *should* run, but it can
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
  latest". The tool was right — it *was* 0.1.2, from a global install made
  months earlier. `npx create-spec-driven-app@latest` runs a temporary copy and
  never touches a global one, so the two answer different questions and nothing
  said so. Three minor versions behind, with no way to notice.

  Doctor distinguishes a global install, a project dependency, an npx cache copy
  and a local checkout, and prints the path. No network call: which version is
  newest is not doctor's business, and a lookup would break the offline and
  air-gapped modes the tool promises.

- **Doctor's Node check read `>= 20`** for a release after the floor moved to
  22. It now reads the floor from `package.json` rather than repeating it — the
  same drift the floor guard exists to prevent, in the one file the guard did
  not cover.

## [0.5.0] — 2026-08-17

### Fixed

- **The gate could not run the scenario it was gating.** `test_cmd` was a fixed
  string with no substitution, and the gate runs *before* `csda done` — so the
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
  *project* directory, which left untracked files behind — and the harness
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
  the upgrade command. Older files still load — only *newer than this CLI* is
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
  against an old tag checks out the workflow *as it was at that tag*, which did
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

- **Change lifecycle** — `csda change new | list | show | status | validate |
  archive`. Modify a spec that already shipped through a reviewable delta.
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
