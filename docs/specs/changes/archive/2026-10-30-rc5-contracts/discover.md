# Discover: rc5-contracts

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

In the fourth run of the 1.0 candidate over several repositories, the repository that holds the agreements
between the others could not deliver anything: its first requirement wrote one agreement, and the check
refused it because the later requirements already pointed at agreements they had not written yet. The
other repositories' requirements pointed at nothing of it, so the build ran them all at once.

## Use case

The agreements' repository delivers one requirement at a time, each writing its own agreement; the check
holds each requirement to its agreement when it is delivered. A part that shares a criterion with the
agreements' repository is told, while it is reviewed, which of its requirements points at none of them.

## Acceptance criteria

- AC-1: a requirement not yet delivered may point at an agreement still to be written; the check warns,
  and says it becomes a failure once the requirement is delivered.
- AC-2: a delivered requirement, and the one being delivered, still fail the check when their agreement
  is not there.
- AC-3: in a story with an agreements' repository, a requirement of another part sharing a criterion with
  it, that points at none of its requirements or agreements, is named by the check.
