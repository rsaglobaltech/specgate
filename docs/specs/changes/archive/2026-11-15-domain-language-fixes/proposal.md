# Proposal: domain-language-fixes

## Intent

Two defects in the domain-language checks, found by auditing the guides
against the code:

- `rule_duplicate` counts the open deltas too, so a MODIFIED delta that
  restates a requirement with `BR-` rules reports that requirement's own rule
  ids as used twice. Changing a requirement with rules is refused.
- `actor_unknown` matches an actor ignoring case, but the actors diagram
  matches it exactly: `actor=customer` with the brief's `Customer` is not
  warned about, and is left out of the diagram.

## Scope

In scope:

- A rule id restated by the same requirement, in an open delta, is not a duplicate.
- The actors diagram matches an actor ignoring case, and draws it under the brief's spelling.

Out of scope:

- Any other check of the domain language.

## Approach

`duplicateRules` keeps the requirement that first used each id and reports a
later use only by another requirement, or a second use in the same file.
`renderActors` maps each requirement's actor to the brief's spelling before
drawing.
