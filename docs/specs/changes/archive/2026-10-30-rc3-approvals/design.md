# Design: rc3-approvals

> Owner: architect

## Modules

- AC-1, AC-2 — `contentHash` in `packages/core/src/domain/Approvals.ts` hashes a layer with every task
  box read as open (`- [x]` and `- [X]` as `- [ ]`), so a tick leaves the hash as it was and any other
  edit changes it.
- AC-3 — `layerApprovals` also accepts a record whose hash is of the text as written (`rawContentHash`),
  the form 1.0.0-rc.1 and rc.2 recorded.
- AC-4 — `removeTempFile` in `scripts/lib/temp-file.ts`: removes a file, retries a few times on
  `EBUSY`/`EPERM` (Windows holds a file a moment after the process that read it ended), and then leaves it
  for the system instead of throwing. Every prompt file the CLI removes goes through it: `change author`,
  the confined drafting agents, the harness.

## Mechanisms

The approval gate, `change archive` and the studio's Review all read `layerApprovals`; changing the
hash there changes it for all of them.
