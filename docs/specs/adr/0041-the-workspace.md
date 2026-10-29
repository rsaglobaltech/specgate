# ADR-0041 — A workspace of repositories, and qualified ids

## Status

Accepted — 2026-10-29. First piece of the 1.0 line
([enterprise-sdd-gap.md](../enterprise-sdd-gap.md), item 1). Delivered by the change
`workspace` (REQ-290..298).

## Context

Specgate's gate is one repository's: one `spec.md`, one matrix, one `check`. A
product made of services, a web app and a contracts repository has nowhere to
answer "where does the product stand", to run one gate across its parts, to say
that a requirement of the tracking service waits for an API of the contracts
repository, or to split one business story into the change each repository
needs. Ids collide too: every repository has a `REQ-012`.

## Decision

1. **A workspace repository** holds `specgate.workspace.yaml`: the members, each
   with a name, a path relative to the workspace, an optional git URL, a role
   (`service`, `web`, `library`, `contracts`) and its capabilities. It can be a
   Specgate project itself or not; its stories live in `docs/stories/<id>/`.
2. **Members stay whole.** Each keeps its own spec, matrix and gate, unchanged.
   The workspace never writes a member's specification: it asks members through
   the CLI (`status --json`, `check --json`, `change new`), so it sees exactly
   what each member's own gate sees.
3. **Qualified ids.** Inside a member `REQ-012` is the id. Across the workspace
   it is `<repo>:REQ-012`. A member may write a qualified id in its prose and
   in `depends=`; its own validation leaves a qualified dependency to the
   workspace (`RequirementGraph.external`), and `workspace check` resolves it:
   the repository exists, has the requirement, and — for a dependency — has
   delivered it (Implemented, Verified or Released).
4. **A story is the business's, its changes are each repository's.** `workspace
   propose` records the story (`story.yaml`: id, title, sub-changes) and opens a
   change of the same name in each member, its proposal linked back. The story
   is done when every sub-change is archived in its member — the members'
   archives are the source, nothing is copied.
5. **The last check is a fact of the workspace**, written to
   `.specgate/workspace-check.json` (git-ignored) and read by `status`, so
   `status` stays cheap.

## The model

`workspace status --json` returns, under `workspace`:

```json
{
  "schemaVersion": 1,
  "name": "truck-flote",
  "dir": "/work/truck-flote-workspace",
  "repos": [
    {
      "name": "tracking",
      "role": "service",
      "path": "../truck-flote-tracking",
      "url": "https://github.com/acme/truck-flote-tracking.git",
      "exists": true,
      "branch": "develop",
      "requirements": { "total": 10, "done": 3, "pending": 7 },
      "gate": { "state": "passed", "at": "2026-10-29T18:02:11.000Z" }
    }
  ],
  "stories": [
    {
      "id": "follow-shipment",
      "title": "El cliente sigue su envío",
      "done": false,
      "subchanges": [
        { "repo": "tracking", "change": "follow-shipment", "state": "archived" },
        { "repo": "web", "change": "follow-shipment", "state": "open" }
      ]
    }
  ]
}
```

`requirements` is null when the member's `status` cannot be read; `gate.state`
is `passed`, `failed` or `not run`; a sub-change is `open`, `archived` or
`missing`. New keys may be added; these are not renamed or removed within
`schemaVersion: 1`. The workspace live view builds on this model.

## Consequences

- No 0.27 project changes: a repository outside a workspace works as before.
  The one behaviour that changes inside a repository is that
  `depends=<repo>:REQ-NNN` is no longer an unknown dependency.
- Members are found by path. A workspace checked out elsewhere needs its
  members cloned beside it at those paths (`url` says from where).
- `workspace check` runs every member's gate in turn; it is as slow as their
  sum. Running them in parallel is left for later.
- Sub-issues per repository in a tracker, aggregated cost and the live view
  are later changes on this model.
