# Already on OpenSpec

Keep writing your specs with [OpenSpec](https://github.com/Fission-AI/OpenSpec).
Specgate checks that what OpenSpec calls done is done: every scenario an
archived change claims has a test that names it. It reads `openspec/` in place
and never writes to it.

```bash
npx @rsaglobaltech/specgate@latest verify          # the check
npx @rsaglobaltech/specgate@latest verify --ids    # every scenario id, to name in tests
```

## How a scenario is named

Each scenario gets a stable id from its capability, requirement and scenario
titles:

```
openspec:<capability>/<requirement>/<scenario>
openspec:billing/refunds/a-refund-over-the-limit-needs-approval
```

A test is linked to a scenario by naming its id anywhere — the test title, a
comment. That mention is the only link; there is nothing else to declare.

```ts
// openspec:billing/refunds/a-refund-over-the-limit-needs-approval
it("a refund over the limit needs approval", () => { … });
```

## What fails, and what is only reported

| Code                    | Means                                                             |          |
| ----------------------- | ----------------------------------------------------------------- | -------- |
| `V1_unproved_claim`     | an archived change claims a scenario no test names                | fails    |
| `V2_failing_suite`      | with `--run`, the test command fails                              | fails    |
| `V3_criterion_changed`  | a scenario's text changed since it was last verified (`--record`) | fails    |
| `V4_unknown_reference`  | an archived change names a requirement the spec no longer has     | reported |
| `V5_unreadable`         | a spec or task file does not parse                                | fails    |
| `V6_orphan_name`        | a test names an id that does not exist                            | reported |
| `V7_unclaimed_coverage` | scenarios with no claim and no test, as a percentage              | reported |

An active change whose tasks are all ticked is reported, not gated: it is not
archived yet, so it claims nothing.

## Adopting it on a project with history

```bash
specgate verify --since origin/main   # gate only what changed after this ref
specgate verify --run                 # also run the suite (npm test by default)
specgate verify --record              # after a green run, pin each verified scenario's text
```

`--since` lets you adopt without fixing the past first: older claims are
reported, new ones are gated. `--record` writes `.specgate/verify.lock`, so a
scenario edited later must be verified again (V3).

## In CI

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 } # `since` needs history
- uses: rsaglobaltech/specgate/actions/verify@main
  with:
    run: "true"
    test-cmd: "npm test"
```

Without `since`, the action gates only claims made after the pull request's
base commit. `--format github` turns findings into annotations on the spec
lines. The same check is the MCP tool `specgate_verify`.

## What this is not

`verify` does not run Specgate's own workflow — no `spec.md`, no matrix, no
packs. It is the one thing a team on OpenSpec asks of it: that "done" is
proved. Decided in [ADR-0030](specs/adr/README.md); the specification is
[verify-foreign-specs](specs/verify-foreign-specs.md).
