# ADR-0041 — Adoption reads areas of the product, never kinds of code, and proposes no requirement

## Status

Accepted — 2026-11-10. Prompted by issue #412. Delivered by the changes
`onboarding-fixes` (REQ-471, REQ-472) and `technical-folders` (REQ-476 … REQ-478).

## Context

`onboard` and `adopt` read the capabilities an existing codebase implies off
its layout, so a team does not start from a blank page. Two things went wrong
on real projects:

- **Proposals counted as work.** `adopt` seeded one Draft requirement per
  capability. `status` counted them ("4 of 9 done" after a real change), the
  "Next" after every `apply` pointed at them, and the matrix filled with rows
  like `REQ-002 Components · TBD` nobody could turn into a requirement.
- **Kinds of code read as areas.** A directory split turned every child into a
  capability. `components`, `hooks`, `utils` are conventions for kinds of code
  in React and TypeScript projects, not things the product does. The layer rule
  (`looksLayered`: `domain`, `application`, `infrastructure` …) applied to
  declared modules only, never to directory splits, and frontend names were on
  no list. Adding names to a list fixes one framework and misses the next.

## Decision

1. **Adoption proposes areas, never requirements.** The areas go to
   `docs/specs/adoption.md` with their folders, file counts and tests; spec.md
   and the matrix start with the baseline alone. A person specifies one
   behaviour at a time (`specgate new`). Earlier adoptions' proposals are
   flagged (`proposal_unspecified`).
2. **A split organised by kind of code proposes nothing.** When at least two
   children, and at least half, are named by a kind of code — the layer names
   (`domain`, `application`, `infrastructure`, `adapters`, `ports`, `api`,
   `web`, `ui`, `persistence`, `repository`, `core`, `common`, `shared`, `util`,
   `utils`, `config`, `client`, `server`, …) or the frontend ones
   (`components`, `hooks`, `helpers`, `types`, `styles`, `store`, `stores`,
   `lib`, `libs`, `constants`, `contexts`, `providers`, `layouts`, `services`,
   `models`, `controllers`, `middlewares`, `interfaces`, `dto`, …) — the split
   is by kind and says nothing about the product. In a mixed split, kind-named
   children are left out. A ratio over a list keeps a new framework's extra
   name from turning the rule wrong; silence beats a confident wrong answer.
3. **The baseline names no path that is not one.** REQ-001 carries no test and
   no artifact until a test names it.

## Consequences

- A project organised by kind gets no areas — `onboard` says why — and starts
  from `specgate new`, as a flat library always did.
- `onboard`, once adopted, points at one behaviour, never a folder-named change.
- Adoption changed by default (0.33.0, and this change): projects adopted
  earlier keep their seeded rows until someone specifies or removes them;
  `status` and `doctor` say which.
