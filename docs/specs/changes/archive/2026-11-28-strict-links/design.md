# Design: strict-links

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`packages/core/src/domain/CodeComments.ts` (new), `packages/core/src/domain/DerivedMatrix.ts`, `packages/core/src/infrastructure/DerivedMatrixSources.ts`, `scripts/lib/gate-policy.ts`, `scripts/cli/commands/spec/DoneCommand.ts`, `docs/gate/policy.md`, `docs/es/gate/policy.md`, and their tests.

## Mechanisms

AC-1 — `withoutCodeComments(path, source)` blanks every comment by the file's extension — `//` and `/* */` for the C family, `#` for Python, Ruby, shell and Elixir, all three for PHP — with a scanner that steps over `'…'`, `"…"` and `` `…` `` strings, so `"http://x"` is kept. Blanking keeps every other character where it was. `readDerivationSources` reads `link:` from the policy file into `sources.links`; under `strict`, `deriveRows` builds the tests' mention index over the blanked sources, for requirements and scenarios alike. The code column and `test=` are untouched.

AC-2 — `links` is absent unless the file says `strict`, and the index is built from the files as read.

AC-3 — `parseGatePolicy` accepts the `link` key, keeps `link: "strict"`, and reports any value other than `mention` or `strict`. `gatePolicyTemplate` writes `# link: strict` with its meaning. `apply_no_test`'s fix adds, under `link: strict`, that a comment does not count.

## Decisions

Opt-in: a project whose tests link by comment today would see its delivered requirements lose their tests. Requiring a test's name or tag only was rejected: each stack names tests differently, while comment syntax is a handful of shapes. Python docstrings are strings, and stay a link. The agent guards' test-first rule, which lets code be written once a test names the requirement, still reads any mention: the plugin's scripts stand alone, and `apply` refuses the requirement at the end. Left for a change of its own.
