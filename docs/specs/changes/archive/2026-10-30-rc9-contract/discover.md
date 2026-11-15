# Discover: rc9-contract

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

In the seventh run of the 1.0 candidate over several repositories, the agreements' repository was built
first and its agreements were complete, yet the service offered its own ways in and the web used a stand-in
of its own: the parts were built in order and still did not speak to each other. The parts named which of
the agreements' requirements they waited for, never which agreement they honour, and nothing compared what
was built with what was agreed.

## Use case

A part of a story that serves or uses an agreement names that agreement, not only the requirement that wrote
it. Whoever builds it reads the agreement itself, word for word. Once it is delivered, the product owner is
told when the part neither offers nor uses what it names.

## Acceptance criteria

- AC-1: a part can name an agreement kept in another repository of the workspace, and the workspace check
  says when it names one that does not exist — a failure once the part is delivered, a notice before.
- AC-2: a part of a story that waits for an agreements' requirement and names none of its agreements is
  pointed out, with the agreements it could name.
- AC-3: whoever builds a requirement that names an agreement is given the agreement as it is written, and
  told to honour exactly it.
- AC-4: for a delivered requirement that names an agreement, the check says when nothing in its repository
  offers or uses what the agreement describes.
