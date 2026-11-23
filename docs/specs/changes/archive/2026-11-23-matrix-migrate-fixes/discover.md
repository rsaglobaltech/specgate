# Discover: matrix-migrate-fixes

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

Running `specgate matrix --migrate --dry-run` on specgate itself (2026-11-23)
showed two faults of the generated matrix that any project can hit. A source
file under a folder named `spec/` — `scripts/cli/commands/spec/DoneCommand.ts`
— was read as a test, so the matrix said a requirement was tested by code. And
the migration wrote a `## REQ-NNN` section into `spec.md` for every requirement
of the hand-kept matrix, those an open change still owns included: they lost
their feature file and would have been stated twice once archived. And it
refused to migrate because 291 rows named more code and tests than the
hand-kept matrix ever listed: a gain, read as a loss.

## Use case

1. The Developer runs `specgate matrix --migrate --dry-run` on a hand-kept matrix.
2. Only real tests fill the test column, and a requirement of an open change is
   left to its change: it joins the matrix when it is archived.

## Acceptance criteria

- AC-1: a file under a `spec/` or `specs/` folder that is not at the project's root, and whose name is not a test's, is code, not a test.
- AC-2: migrating never writes into `spec.md` a requirement an open change owns or a capability spec states; the rows of what an open change adds or modifies wait for its archive, and the migration says how many.
- AC-3: a row the generated matrix only fills in further — more code, more tests — is kept, and said so for review.
