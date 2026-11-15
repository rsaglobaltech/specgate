# Discover: adopt-scope-areas

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

REQ-337 (the 1.0 line) said `adopt --scope` proposes requirements for the area
it names. Since REQ-471, adoption proposes no requirement at all: the areas it
finds are listed for a person to specify. The two met when the lines were
merged; the scoped adoption must follow the newer rule.

## Use case

A team adopts one area of a large system: it names the area, and gets that
area's parts listed to specify, the rest of the system left as it is.

## Acceptance criteria

- AC-1: Only the parts under the named area are listed to specify.
- AC-2: The specification and the baseline scenario say which area was adopted.
- AC-3: An area that does not exist is refused before anything is written.
