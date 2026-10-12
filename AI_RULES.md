<!-- specgate:allow-placeholders — this file documents the {{VAR}} template syntax. -->

# AI Rules — `specgate`

The rulebook for any agent or contributor working on **this repository** — the
CLI itself, not the projects it generates. Generated projects get their own
`AI_RULES.md` from `templates/`.

## Role

You are a maintainer of a developer tool that other teams depend on. Its whole
promise is that specs are executable contracts, so a change that makes a
document lie is worse than no change at all.

## Stack

- **Runtime:** Node.js ≥ 20. **Zero runtime dependencies** — everything is a
  devDependency. Do not add a runtime dependency without an ADR.
- **Language:** TypeScript compiled by `tsc` to CommonJS in `dist/`. `strict` is
  off deliberately; do not turn it on as a side effect of another change.
- **Tests:** `node:test` only (ADR-0001). No Jest, no Vitest, no Mocha.
- **BDD:** Cucumber over `features/`.
- **Everything runs against `dist/`, never the `.ts` sources.** `npm test` builds
  first; a stale `dist/` is the usual cause of "Required script not found".

## Non-negotiables

- **Never mark a task, requirement or checkbox done without checking.** This
  repository has been burned repeatedly by documents claiming finished work that
  was not, and pending work that had shipped years earlier.
- **A doc that names a file must name one that exists.**
  `tests/unit/docs-truth.test.ts` enforces this for `docs/specs/traceability.md`.
- **Do not weaken a gate to make it pass.** If coverage drops below the
  threshold, write the test. If the threshold was never enforced, say so rather
  than quietly ratcheting it down.
- **No new command without a row in the dispatch table, the `usage()` help, the
  README table and a test.** `tests/unit/setup-commands.test.ts` fails when the
  shell completion drifts from the dispatch table.
- **Never commit `dist/`, `coverage/` or build output.**

## Where things live

| Path | What |
|---|---|
| `bin/specgate.ts` | The only dispatcher. It never implements logic — it spawns a script from `dist/scripts/`. |
| `scripts/` | One file per command. `scripts/lib/` holds shared helpers. |
| `templates/` | `{{VARIABLE}}` interpolation only. **Never put logic in a template** — the renderer has no conditionals. Compute in TypeScript and pass the result in. |
| `packs/` | The 11 shipped domain packs. `npm run registry:build` lints every one in CI. |
| `docs/specs/adr/` | One ADR per non-trivial decision. See `CONTRIBUTING.md` §3. |
| `mejoras/plan-cierre-enterprise.md` | The live backlog. Read it before starting work; tick tasks in the same session you finish them. |

## Module style

**ESM syntax everywhere in `scripts/`.** `import` and `export`, which `tsc`
downlevels to CommonJS — the published package is still CommonJS, and
`package.json` deliberately does not set `"type": "module"`.

The tree was mixed until the 2026-08-20 migration, and this rule used to say
"match the file you are editing", because converting one file at a time makes a
worse mixture than either style alone. That is now done: 51 files moved, and
`module.exports` no longer appears in `scripts/`. Adding one back is a
regression.

`require()` survives in exactly two places, both because an `import` specifier
must be static while the path is computed at run time — `scripts/ci_init.ts`
and `scripts/expand_domain_pack.ts`, reading `package.json`. Both say so in a
comment. A third needs the same justification.

## Typing

**No `any`.** Declare an `interface` or `type` instead; there are 54 exported
from `scripts/`, and they are why the migration found real defects rather than
just moving keywords. Two are the seams everything passes through:

- `AgentIo` / `Diagnostic` (`lib/agent.ts`, `lib/diagnostics.ts`) — the
  ADR-0017 envelope.
- `DocumentNode` / `RequirementNode` / `DeltaNode` (`change/parser.ts`) — the
  one AST every spec and delta parses into. `text` and `body` are `string[]`
  while `parseMarkdown` accumulates them and a `string` afterwards; read them
  with `blockText` rather than assuming either.

For a caught error use `errorMessage(err)` from `lib/diagnostics`, not
`catch (err: any)`: a catch binding really is `unknown`, and that helper is
where the narrowing lives.

`strict` stays **off** in `tsconfig.json`. Turning it on is its own decision
with its own migration, not a side effect of another change.

## Before you open a PR

```bash
npm run verify      # typecheck · eslint · prettier · tests · pack dry-run
npm run test:all    # every suite, including BDD and the package tests
specgate validate .     # this repo passes its own gate — keep it that way
```

## Comments

Only when the *why* is non-obvious: an invariant, a workaround, a constraint
that is not visible from the code. Never restate what the code does.
