# Proposal: technical-folders

## Intent

Issue #412, from a tester onboarding a TypeScript + React (Ink) CLI: `onboard`
lists every child of `src/` as a capability — `components`, `hooks`, `utils` —
and `adopt` seeded one requirement each. 0.33.0 already keeps adoption's areas
out of spec.md, the matrix, `status` and "Next" (REQ-471, REQ-472); the areas
themselves are still read off folder names that say what *kind* of code they
hold, not what the product does, and `onboard` still points at
`specgate propose describe-components`. The baseline REQ-001 carries
`test='npm test'` and `artifact='existing codebase'`, which are not paths, so
`plan` reports them missing.

## Scope

In scope:

- A directory split organised by kind of code proposes nothing; kind-named
  children of a mixed split are left out (ADR-0041).
- `onboard` on an adopted project points at one behaviour, not a folder.
- The baseline names no path that is not one.

Out of scope:

- Detecting areas from anything but folders (routes, packages' exports).

## Approach

`splitIntoCapabilities` applies the layer rule `looksLayered` already applies to
declared modules — a ratio, not a growing list — over the layer names plus the
kind-of-code names frontends use. Accepted by the person who reported it via
the issue's own proposal; recorded as ADR-0041.
