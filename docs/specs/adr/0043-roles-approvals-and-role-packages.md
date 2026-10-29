# ADR-0043 — Roles, an approval per layer, and role packages

## Status

Accepted — 2026-10-29. Items 3 and 5 of the 1.0 line
([enterprise-sdd-gap.md](../enterprise-sdd-gap.md)). Delivered by the change
`roles-approvals` (REQ-310..319). Builds on the three layers of ADR-0042.

## Context

ADR-0042 gave each layer of a change an owner — product the Discover, the
architect the Design, the developer the Tasks — but `change approve` still
records one date for the whole change, by anyone, and keeps it after the
approved text is rewritten. Nobody can say who agreed to which version. And
the roles that constrain the work without owning a layer — security,
performance, infrastructure — have no place to say it once: their rules reach
the agent only if someone pastes them into a prompt prefix that applies to
everything.

## Decision

1. **Roles in `harness.config.yaml`.** `roles:` maps a role to the people who
   hold it, each an email or a name matched to the git identity of whoever runs
   the command, case-insensitive. A role nobody is named for is open to anyone,
   so a team of one, or a project that never names roles, keeps working.
2. **An approval per layer, by its owner.** `change approve <id> --layer
   discover|design|tasks` records one; without `--layer` the person approves
   every written layer they own. `approvals.quorum.<layer>` sets how many
   distinct people a layer needs (default 1).
3. **What was approved is a hash.** Each approval is a line of `approvals.json`
   in the change folder: layer, name and email, role, the sha256 of the layer's
   text, the date. It moves to the archive with the change, which makes it the
   audit record. An approval counts only while the layer's text has that hash:
   an edit re-opens the layer. The `approved:` line of `change.yaml` is
   rewritten from the approvals, never read for a change whose layers are
   written; a change with only a delta keeps the 0.27 meaning of that line.
4. **The harness waits — the 1.0 default.** `approvals.required` is `layered`
   (default: a change of the layered schema needs its approvals), `always`
   (also 0.27 changes) or `never` (the 0.27 behaviour). An unapproved
   requirement is skipped before any worktree or agent, with
   `harness_not_approved`, the layers that wait and the command.
5. **Role packages.** `harness/<role>.md`: a front matter (`role`, `owner`,
   `version`, `applies-to` with `kind`, `capability`, `tag` lists) and the
   constraints in Markdown. A package applies when every dimension it lists
   matches the requirement — any value of a list — and with no `applies-to` to
   everything. The implementing prompt gets a "Role constraints" section; the
   `prompt` event, the run record and `harness report` name the packages as
   `role@version`.
6. **A reviewer per package that only advises.** The builtin review check asks
   for one line per package (`- security: OK` or `- security: ADVICE — …`). The
   advice never decides the verdict: a package is the owner's view, and only the
   gate fails an attempt.
7. **The studio.** Review shows each layer's approvals, how many it needs and
   whether the viewer owns it, with a button for the layer they own; the
   viewer is the git identity of the folder the studio serves.

## Consequences

- **Breaking:** a change created by 1.0 (`layered`) is not built until it is
  approved; `approvals: { required: never }` restores the 0.27 behaviour.
- Approval is not a `validate` error: a draft is legitimately unapproved while
  it is written. The harness and the studio's Build are where building starts,
  so that is where it is enforced.
- Rejected: approvals as lines of `change.yaml` (every sign-off a merge
  conflict); trusting the git author of a commit as the approver (a rebase or a
  squash rewrites it, and a bot commits for people).
- A name in `roles:` is as trustworthy as the git identity on the machine. A
  signed approval (a signed commit or tag of `approvals.json`) is the next step
  for a team that needs more than that.
