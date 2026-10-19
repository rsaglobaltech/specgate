# AGENTS.md — {{PROJECT_NAME}}

{{PROJECT_TYPE}} project · architecture: {{ARCHITECTURE}} · domain: {{DOMAIN}}
Stack: {{STACK}} · API: {{API_STYLE}} · Testing: {{TESTING}}

This project uses spec-driven development with `specgate`. `spec.md`,
`features/` and `docs/specs/` are the contract your work is judged against.

## Work

The loop is propose → test → apply → archive:

1. `specgate status` — what is left, and the next requirement.
2. New behaviour: `specgate propose <change-id>`, then write its delta.
3. Write the test first and name the requirement in it (`REQ-007`, and its
   scenario `SCN-007a` when there is one). That mention is the link.
4. Implement until `specgate check` passes: specs, links, coverage, tests.
5. `specgate apply REQ-007` — refused unless the gate passes.
6. `specgate archive <change-id>` — only once every requirement in it is
   applied, and only when the person reviewing the change says so.

Each step in detail: the `/specgate:*` commands, or
`specgate change instructions <artifact> --json`.

## From a plan or brief

`specgate propose --from-brief` names the next module of `docs/brief.md`;
`specgate propose --from-brief <module>` opens it and writes `DRAFTING.md` —
follow it, then re-run until "Ready to review". Never archive a draft
yourself: a person reviews it, and it is archived after it is applied.

## Never

- Edit `spec.md`, `features/`, `docs/specs/` or this file to make a test pass.
- Choose or replace the stack; if a field above is TBD, stop and ask.
- Say work is done that `specgate check` has not passed.

## Project rules

{{STACK_RULES}}
{{ARCHITECTURE_MODELING_RULES}}
{{ARCHITECTURE_CHECKS}}
