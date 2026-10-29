# Design: roles-approvals

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `packages/core/src/domain/Approvals.ts` — pure rules: who holds a role, what a
  layer's approvals are worth against its current text, whether a change is
  approved (AC-1, AC-2, AC-4).
- `scripts/lib/approvals.ts` — the project side: `roles:` and `approvals:` read
  from `harness.config.yaml`, the git identity, `approvals.json` in the change.
- `scripts/lib/role-packages.ts` — `harness/<role>.md` packages, which apply to
  a requirement, the prompt section, and their use across runs (AC-6).
- `change approve`, the harness run, the review check, `harness report`, the
  live model and the studio call them.

## Mechanisms

- AC-1 — `roles: { product: [ana@acme.eu], architect: [...], developer: [...] }`;
  an entry matches the git `user.email` or `user.name`, case-insensitive. A role
  nobody is named for is open to anyone, so a team of one keeps working.
- AC-2 — `change approve <id> --layer discover|design|tasks` records one approval;
  `approvals.quorum: { design: 2 }` sets how many distinct people a layer needs
  (default 1). Without `--layer`, the person approves every layer they own.
- AC-3 — each approval is a line of `approvals.json` in the change folder:
  layer, who (name, email), the role, the layer's content hash, the date. The
  folder moves to the archive whole, so the record stays.
- AC-4 — an approval counts only while the layer's hash is the one approved; an
  edit leaves it stale and the layer waits again. `approved:` in `change.yaml`
  is written when every layer is approved and read through the same rule.
- AC-5 — `approvals.required`: `layered` (default: a 1.0 change needs its
  approvals before the harness builds it), `always` (also 0.27 changes) or
  `never` (the 0.27 behaviour). The harness skips such a requirement before any
  worktree, naming the missing layers and the command.
- AC-6 — a package is Markdown with a front matter: `role`, `owner`, `version`,
  `applies-to` with `kind`, `capability` and `tag` lists. It applies when every
  dimension it lists matches the requirement (any value of a list). The
  implementing prompt gets a "Role constraints" section; the prompt event, the
  run record and `harness report` name the packages as `role@version`.
- AC-7 — the builtin review check asks for one advice line per package; the
  review stays advisory, so a package never fails the gate.
- AC-8 — `/api/drafts` carries each layer's approvals and whether the viewer
  owns it; `/api/approve` takes an optional `layer`.

## Channels

- `approvals.json` (change folder), `harness/<role>.md` (project root), the
  `prompt` event's `packages`, the run record's `packages`.

## Decisions

- ADR-0043: roles, layer approvals and role packages. Rejected: approvals in
  `change.yaml` (one line per approval, merge conflicts on every sign-off);
  approval as an error in `validate` (a draft is legitimately unapproved while
  it is written — the harness is where building starts).
