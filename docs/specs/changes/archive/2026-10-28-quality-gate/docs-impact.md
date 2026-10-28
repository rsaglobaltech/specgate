# Documentation to update

The register of every page to write or change before the next release. It
covers this change and the work already merged on the branches it builds on,
which shipped code without its guide:

- **A** — the visual studio (REQ-204..210, branch `feat/studio-app`)
- **B** — the studio's route from an empty folder to the report, and
  `--profile` (REQ-211..217, branch `feat/studio-route`)
- **C** — this change, quality and security in the gate (REQ-218..234, ADR-0040)

Rules that apply to every page (from the repository): a guide under `docs/`
stays at or under 300 lines (`docs-truth` test); `docs/*.md` is never run
through prettier (it rewrites the tables); terminal output shown in a guide is
recorded, not typed (`npm run docs:terminal`, `npm run docs:journey`, checked
in CI); a command a page names must exist (`docs-truth`).

## New pages

| Page | For | Contents |
| --- | --- | --- |
| `docs/studio.md` | A, B | What the studio is; `specgate studio` and its flags; the route's seven steps and when each opens; simple and advanced mode; Spanish and English; the new-project step and what it writes; the brief form and its markdown mode; drafting in the background, one at a time, stopping it; questions and the "the spec says it" confirmation; review, notes, approve; build, the agent picker, stopping after the current requirement; the report and its download; `/live` and `/overview`; security model (loopback only, per-start token, JSON POST, 405 on other methods); what each action runs underneath (the table of endpoint → command) |
| `docs/quality.md` | C | Why (the failure modes of ADR-0040); `quality:` levels and what each enables (the table of design.md §5); `checks:` reference (name, run, when, gate, sarif, timeout, env, scope, baseline) and the placeholders; the stages and where each runs; the baseline: taking it, accepting, how fingerprints work, why moved code is not new; diff coverage and mutation score: thresholds, report formats read, what the agent is told; Java presets (Maven and Gradle) and Node presets, each with the plugin to declare; the `commits` check and Conventional Commits 1.0.0 (types, scope, `!`, `BREAKING CHANGE`, `commit_types:`); platform checks and their environment variables; running scanners in Docker (`runner`, images, caches, `quality doctor --pull`, CI warm-up); suppressions; troubleshooting (slow PIT, missing report, a tool without SARIF). Split into `quality.md` and `quality-presets.md` if it passes 300 lines |

## Pages to change

| Page | For | What changes |
| --- | --- | --- |
| `README.md` | A, B, C | The studio as the way in for someone who does not want the commands; one line on quality levels |
| `docs/getting-started.md` | A, B | A third path: "open the studio in an empty folder" |
| `docs/quickstart.md` | B, C | `specgate studio` as an alternative first step; `quality: basic` in the first config |
| `docs/new-project.md` | B, C | The studio's new-project step as an alternative to `specgate init`; quality level chosen there |
| `docs/start/scratch-1-install.md` | B, C | Mention the studio route; `harness init` now writes the quality preset of the stack |
| `docs/start/scratch-3-build.md` | B, C | `--profile` on `harness run`; checks in the gate; recordings regenerated |
| `docs/start/scratch-4-prove.md` | C | `check` runs the quality stages; reading a failing check |
| `docs/start/existing-1-adopt.md` | C | `adopt` writes the preset commented; take the baseline before the first delivery |
| `docs/start/existing-4-ci.md` | C | `specgate check --ci` runs the `ci` stage; secrets for platform checks in CI |
| `docs/start/write-the-brief.md` | B | The brief can be written in the studio's form; the form's fields map to the front matter and cards |
| `docs/from-a-brief.md` | B | Drafting a module from the studio; `--profile` on `propose --from-brief` |
| `docs/harness.md` | B, C | Profiles chosen per run (`--profile`) and from the studio; the `attempt`/`end` checks inside the loop and what the agent receives; the run record's `checks` |
| `docs/harness-report.md` | C | The quality columns per requirement |
| `docs/agent-setup.md` | B | `.harness/profiles.yaml` as the list the studio shows; presets the studio writes (claude-sonnet, claude-opus, codex) |
| `docs/validating.md` | C | The gate's order now: validate --strict → arch → checks by stage → tests; baseline |
| `docs/reviewing-changes.md` | A | `change approve` and `change note`; Review in the studio |
| `docs/supply-chain.md` | C | Dependency and secret scanning presets; tokens only from the environment |
| `docs/commands.md` | A, B, C | Rows: `change approve`, `change note` (done), `harness run --profile` (done), `studio` (done); new: `quality list`, `quality init`, `quality baseline`, `quality run`; `check --ci` stage |
| `docs/concepts.md` | A, C | The studio's place in the lifecycle; quality checks as part of the gate |
| `docs/faq.md` | A, C | "Can I use it without the terminal?"; "Does Specgate replace Sonar/Snyk?" (no: it runs them) |
| `docs/troubleshooting.md` | B, C | The studio says the folder has files; build refused because the tree is dirty; a check's report not found; token not set |
| `docs/automation.md` | A | The studio's API is local and token-guarded, not an automation surface |
| `docs/tutorial.md` | A, B | A short "the same, from the studio" box per stage (exception to the 300-line rule already) |
| `docs/forja/java.md`, `docs/forja/generated-project.md` | C | After F4: the quality plugins in the generated pom and `quality: strict` |
| `docs/specs/adr/0028-architecture-conformance-is-part-of-the-gate.md` | C | Status: points 3 and 4 implemented through ADR-0040 |
| `docs/specs/adr/0040-quality-and-security-in-the-gate.md` | C | Proposed → Accepted on delivery |
| `docs/release-process.md` | all | The release table row for the version (one line; the page is at its limit) |
| `CHANGELOG.md` | A, B, C | Added: the studio app; the route; `--profile`; `change approve`/`note`; harness stop from the studio; quality checks, baseline, diff coverage, mutation score, presets, Conventional Commits check. Fixed: the dry run's agent line |

## Terminal recordings to regenerate

- `npm run docs:terminal` and `npm run docs:journey` in Linux (WSL), after any
  change to the output of `harness run --dry-run`, `harness prompt`, `check`
  or `status`; the checks in CI compare them byte for byte.

## Screenshots

- The studio pages (route, new project, brief form, drafts, build with the
  agent picker, report) for `docs/studio.md`, light theme, 1440 px, taken from
  a demo project, never from a real person's project.
