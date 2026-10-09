# AGENTS.md — {{PROJECT_NAME}}

{{PROJECT_TYPE}} project · architecture: {{ARCHITECTURE}} · domain: {{DOMAIN}}
Stack: {{STACK}} · API: {{API_STYLE}} · Testing: {{TESTING}}

This project uses spec-driven development with `specgate`. `spec.md`,
`features/` and `docs/specs/` are the contract your work is judged against.

## Work

1. `specgate status` — what is left, and the next requirement.
2. Write the test first and name the requirement in it (`REQ-007`, and its
   scenario `SCN-007a` when there is one). That mention is the link.
3. Implement until `specgate check` passes: specs, links, coverage, tests.
4. `specgate done REQ-007` — refused unless the gate passes.

Each step in detail: the `/specgate:*` commands, or
`specgate change instructions <artifact> --json`.

## Never

- Edit `spec.md`, `features/`, `docs/specs/` or this file to make a test pass.
- Choose or replace the stack; if a field above is TBD, stop and ask.
- Say work is done that `specgate check` has not passed.

## Project rules

{{STACK_RULES}}
{{ARCHITECTURE_MODELING_RULES}}
{{ARCHITECTURE_CHECKS}}
