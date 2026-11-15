# Discover: rc7-order

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

In the sixth run of the 1.0 candidate over several repositories, the parts of the story were written at
the same time. The service's architect found nothing in the agreements' repository yet and designed an
agreement of its own; the web then relied on the service directly, and the agreements were built but
used by no one. Before the build, the workspace check also showed as failures the requirements that
wait for another repository, though the build orders them.

## Use case

A part that uses the agreements is written once the agreements say something; the person who wants it
written anyway says so. A requirement still being drafted that waits for another repository is shown as
the order the story is built in, not as a failure.

## Acceptance criteria

- AC-1: writing the specs, design or tasks of a part that shares a criterion with the agreements'
  repository is refused while the agreements' part specifies nothing, saying which part to write first.
- AC-2: the refusal can be overridden explicitly, and does not apply once the agreements' part has a
  requirement, nor to previewing the instructions.
- AC-3: in the workspace check, a requirement of an open change that waits for another repository's
  undelivered requirement is a warning; a delivered requirement that does still fails.
