# Discover: harness-lanes

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

0.35 split an attempt into a tester and an implementer under the key
`roles:`. The 1.0 line uses `roles:` for the people who hold product,
architect and developer, and approve each layer of a change. One key cannot
mean both: a 1.0 project naming its people could not run the harness, and a
0.35 project's sessions would be read as people.

## Use case

A team splits the agent's work into a tester and an implementer, and names
who approves each layer, in the same file, without either reading the other.
A team upgrading from 0.35 gets the old key renamed for it.

## Acceptance criteria

- AC-1: The tester and implementer sessions are named by their own key.
- AC-2: The 0.35 spelling is refused with the way out, never read as people.
- AC-3: The 1.0 migration renames the 0.35 key and nothing else.
