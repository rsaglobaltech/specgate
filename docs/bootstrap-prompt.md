# 🪄 Bootstrap prompt — Phase 1

Hand this prompt to your coding agent (opencode, Claude, Aider, Cursor)
the first time you sit down in a fresh project, **after** you have run
`specgate init` and `specgate specops add` but **before** you start the harness
loop. It is the only freeform-AI step in the whole flow — every later
requirement goes through `specgate harness run`, which builds its own
prompt deterministically.

> Why a separate prompt? The harness implements **one REQ at a time**.
> Project-level scaffolding — build manifest, wired BDD framework, hex
> skeleton, the first bounded context end-to-end — is not "a REQ", so it
> does not belong in the harness. This prompt is what wires the project so
> the harness can take over.

---

## How to use it

1. Run `specgate init` and `specgate specops add` so the project has `spec.md`,
   `AI_RULES.md` and `features/**/*.feature`.
2. Open your coding agent inside the project directory.
3. Paste the prompt below verbatim, then say "go".
4. When the agent says it is done, run:
   ```bash
   specgate validate . --strict
   <your test command>      # e.g. mvn -B test
   specgate plan
   ```
   `validate --strict` and the project test command must pass. `plan`
   should show the remaining REQs as pending. **This is Phase 1's
   acceptance test — do not move on until both are green.**
5. Commit: `git commit -am "phase 1: bootstrap"`.
6. From now on, every REQ is `specgate harness run`'s job.

After Phase 1 is in, the universal directives from this prompt belong in
**`harness.config.yaml: prompt_prefix`** (or `prompt_prefix_file`) so they
ride along on every per-REQ harness invocation without being retyped.

---

## The prompt

```text
You are my **Lead Technical Architect** and **Senior Engineer**.

## Active Project Boundary (Critical)
- Treat the **current working directory** as the only active project scope.
- Do **NOT** scan or reason over sibling projects or the whole monorepo by default.
- Read files only inside the active project unless an explicit path is provided by the Product Owner.

## Source of Truth (Read-Only for You)
- `@./AI_RULES.md` — stack, architectural constraints, workflow rules.
- `@./spec.md` — the domain map.
- `@./features/**/*.feature` — the executable acceptance criteria.
- `@./docs/specs/traceability.md` — the requirement ↔ code matrix; `specgate done` owns it.

You **must not** rewrite, refine, or "improve" any of those files.

## Execution Policy (Non-Negotiable)
- Start coding from this prompt — do **not** stop at a plan.
- Prioritise executable implementation and passing tests over narrative summaries.
- Respect the architectural constraints in `AI_RULES.md` (Hexagonal / Clean / DDD as declared).
- Use `csda` to introspect — never to rewrite specs:
  - `specgate plan`                — which REQs are pending and what is missing.
  - `specgate validate . --strict` — the gate you must satisfy.
  - `specgate pack lint --pack-root <cached pack dir> --pack <id> --graph` — visualise the domain.

## Phase 1 — Goal
Make the project executable end-to-end:
1. **Build manifest + dependencies** — create `pom.xml` / `build.gradle` /
   `package.json` (whichever the stack in `AI_RULES.md` calls for) with
   runtime and test deps that match the declared `TESTING` value (e.g.
   JUnit 5 + Cucumber + Testcontainers).
2. **BDD wiring** — wire the BDD framework so it executes the existing
   `features/**/*.feature` files at their current location. Do **not**
   modify the feature text. Filter discovery to whichever REQ you take
   first; widen as more REQs land.
3. **Hexagonal skeleton** — set up the package/folder layout
   (`domain`, `application`, `infrastructure`/`adapter`) per the
   architectural constraints in `AI_RULES.md`.
4. **First bounded context, end-to-end** — pick the highest-priority
   bounded context in `spec.md` and implement enough domain model + one
   adapter so the first scenario passes through.
5. **Stop.** Subsequent requirements go through `specgate harness run`, not
   you.

## Acceptance (Phase 1 is "done" when…)
- `specgate validate . --strict` passes.
- `<your test command>` passes — with at least one scenario executed for
  real (not skipped, not Pending).
- `specgate plan` lists the still-pending REQs cleanly.
- `docs/specs/traceability.md` remains valid (you did not edit it).
- Working tree is committable: build manifests in place, hex skeleton
  present, no orphan files.

## Deliver
- A short summary at the end with:
  - the build manifest you created (and why),
  - the BDD wiring approach (config, runner class, discovery filter),
  - the first bounded context you picked and the files you created,
  - the test command that proves Phase 1 (so the Product Owner can run it),
  - any architectural call you made that the next REQs will inherit.

Start. Do not ask permission for tactical decisions inside the scope above.
```

---

## What changed vs. the older Base Prompt

If you used the older `Phase 1 Bootstrap` prompt that talked about
"Mode Detection" between Domain-pack and Generated-project mode, you can
drop those sections. With `csda` the mode is decided **before** the agent
is invoked — by the time you paste this prompt, the project is always in
Generated-project mode. The prompt above also names the `csda` commands
explicitly so the agent can self-introspect, and ties the acceptance
criteria to `validate --strict` + the project test command so "done"
is a hard-edged definition, not a feel.

---

## Recommended `harness.config.yaml`

After Phase 1 is in, lift the **universal** sections of the prompt above
(Role, Active Project Boundary, Execution Policy) into a file the harness
prepends to every per-REQ prompt:

```yaml
# harness.config.yaml
harness_version: 1
agent: 'opencode run "$(cat {prompt_file})"'
test_cmd: "mvn -B test"
max_attempts: 3
prompt_prefix_file: ./.harness/prompt-prefix.md
```

```markdown
<!-- .harness/prompt-prefix.md -->

# Role

You are the Lead Technical Architect and Senior Backend Engineer.

# Active Project Boundary

- Current directory is the only scope. Do NOT scan siblings.

# Execution Policy

- Start coding. No planning-only output.
- Hexagonal architecture is non-negotiable (see AI_RULES.md).
- Never modify AI_RULES.md, spec.md, or features/\*_/_.feature.
```

Verify what the agent will receive at any time with:

```bash
specgate harness prompt REQ-NNN
```
