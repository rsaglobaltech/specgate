# Discover: strict-links

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A requirement's test is any test file that names its id, "a comment is
enough". A project run on 2026-11-27 found that this lets a requirement be
delivered by a test that never exercises it: a comment that mentions the id
links the file, and `apply` judges that the suite passes. A team that wants
the link to mean a test was written for the requirement has no way to ask for
it.

## Use case

The team writes `link: strict` in the gate policy; from then on a test links a
requirement only by naming it in the test itself, and `apply` says so when a
comment was all there was.

## Acceptance criteria

- AC-1: under `link: strict`, a mention inside a comment does not link a test; one in a test's name, tag, string or code does.
- AC-2: without it, nothing changes.
- AC-3: the policy reads the key, rejects any other value, and the file `init` writes shows it.
