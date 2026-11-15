# Discover: rc6-deps

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

In the fifth run of the 1.0 candidate over several repositories, the architects of the service and the
web wrote down which requirement of the agreements' repository each of their requirements waits for, but
only in their design, after the requirements had been written. The build reads what a requirement waits
for from the requirement itself, so it ran every part at once. In the agreements' repository, the design
quoted the pattern a citation follows, and the check took the quoted pattern for a citation.

## Use case

The architect who decides that a requirement waits for another repository is told to write it into that
requirement as well, so the build orders the parts by it. A pattern the design only quotes is not taken
for a citation.

## Acceptance criteria

- AC-1: the instructions for the design tell the architect that what a requirement needs from another
  repository goes into the requirement, and name the warning the check gives when it does not.
- AC-2: a pattern quoted in the design, with a placeholder in place of the operation, is not reported as
  a citation missing from the requirements.
