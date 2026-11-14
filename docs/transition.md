# Handing over: release notes, acceptance and user guides

At the end of this page a release has notes nobody typed, each change has
been signed off by a person who saw it work, and each kind of user has a guide
to what they can do. Everything comes from the specification you already keep.

**You need:** a Specgate project in git, with changes archived as you deliver
them (`specgate archive`).

## Say what kind of change it is

```bash
specgate propose rounding --kind bug
specgate propose pdf-invoices --kind enhancement
```

The kind is written as `kind:` in the change's `change.yaml`, and shown by
`specgate change show`, `specgate change list` and `specgate status --json`.
Any other kind is refused with `change_kind_unknown`.
`specgate propose --from-ticket` sets it for you: `bug` for a Jira issue of
type Bug, `enhancement` for anything else.

## Release notes

```bash
specgate release-notes v1.0.0..v1.1.0
specgate release-notes v1.0.0..v1.1.0 --out RELEASE.md
```

These are the changes archived between the two refs (tags, branches or
commits), in three groups: **Enhancements**, **Fixes**, then **Other
changes** (a change that declares no kind). Each change has the first
paragraph of its proposal's Intent and the requirements it added or modified,
with their titles. A requirement it removed is not listed, because it was not
delivered. An unknown ref is refused with `ref_unknown`.

```markdown
## Enhancements

### pdf-invoices

Customers asked for invoices they can forward to their accountant.

- REQ-007 — Invoices download as PDF
```

## Acceptance a person signs

The gate proves the tests pass. It cannot prove that the behaviour is what the
business asked for. Acceptance is that second check, made by a person and
written down:

```bash
specgate acceptance pdf-invoices
```

This writes `docs/specs/changes/pdf-invoices/acceptance.md`, with one
unchecked item per scenario of the change, under its requirement, and the
scenario's steps below each item. The person checks an item (`- [x]`) once
they have seen it work, then signs:

```bash
specgate acceptance pdf-invoices --sign "Ana Pérez"
```

- While an item is unchecked, signing is refused with `acceptance_incomplete`,
  which names the open items.
- Once every item is checked, the file records the name and the date, and each
  of the change's requirements that is Implemented becomes **Verified**. The
  gate already passed when they were applied, so it is not run again.
- The file lives in the change folder, so it is reviewed in the pull request
  and archived with the change.

## A user guide per actor

```bash
specgate guide                     # every actor
specgate guide --actor Customer    # one
```

This writes `docs/guide/<actor>.md`, with one section per delivered
requirement (Implemented, Verified or Released) whose trace says
`actor=<that actor>`, ordered by capability. Each section has the
requirement's text and its scenarios as numbered steps. Draft work is left
out, so the guide never describes something that does not exist yet.

## Next

- [Change a shipped requirement](reviewing-changes.md)
- [Writing specs](writing-specs.md)
