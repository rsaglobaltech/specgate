# Specify a system that already runs

At the end of this page your existing code has its first requirements, each one
`Draft` and citing the lines it was read from, and the gate is on in CI without
failing on the gaps the project already had.

**You need:** a repository adopted with `specgate init` (or `specgate adopt`),
git, and an agent you can run from the command line
([Choosing your agent](agent-setup.md)).

## 1. See the modules

```bash
specgate reverse --modules
```

```
  billing                          java     41 file(s)
  orders                           java     63 file(s)
```

The candidates are what the repository already declares: Maven and Gradle
modules, npm workspaces, the packages of a Go module, and the folders under
`src/` or `apps/` that hold code. Each comes with its stack and its number of
code files, tests included. No agent runs. With `--json`, the list is
`reverse.modules`.

When nothing is found, name the folder yourself: `specgate reverse src/billing`.

## 2. Reverse one module

```bash
specgate reverse orders --agent "claude -p < {prompt_file}"
```

Without `--agent`, the `agent:` of `harness.config.yaml` runs. The agent gets
the module's source, test and schema files, and answers one JSON file:
requirements, their scenarios, and the `source` each was read from. Specgate
writes the change `docs/specs/changes/reverse-orders/` from that answer:

```markdown
### Requirement: REQ-041 — A shipped order cannot be cancelled

The system SHALL refuse to cancel an order whose status is SHIPPED.

#### Scenario: SCN-041a — A shipped order

- GIVEN an order with status SHIPPED
- WHEN its owner cancels it
- THEN the cancellation is refused

<!-- specgate:trace status=Draft actor=Developer kind=functional source=orders/src/main/java/x/Cancel.java:12 -->
```

What holds whatever the agent does:

- **Every requirement is `Draft`.** Code says what the system does, not what it
  should do. A person moves a requirement past Draft once they have read it
  against its source.
- **Every requirement cites its code** in `source=`.
- **A suspected defect is a question, not a requirement.** Behaviour the agent
  marks as suspect goes to the change's `questions.md`. Writing it as a
  requirement would make the bug the contract.
- **Nothing else changes.** `spec.md` and the capability specs are untouched,
  and every write the agent makes outside its answer file is undone and named.
- **A change that does not validate is not kept.** Neither is an answer
  without a source, without a scenario, or that is not JSON.

One module per run, reviewed before the next: a whole repository reversed at
once is more than anyone reads.

## 3. Review it

Read each requirement against the lines its `source=` cites, answer
`questions.md`, then continue as with any change:
`specgate change validate reverse-orders`, a test that names each requirement,
`specgate apply`, `specgate archive`.

When a cited file is deleted or moved, `specgate validate` warns
`source_missing` and names it. It does not fail the gate: moving code is not a
broken contract. Read the requirement against where the code went, and update
its `source=`.

## 4. Turn the gate on without a red build

An existing project usually has gaps the gate finds on day one, such as rows
marked Implemented with no test. Record them once:

```bash
specgate check --baseline
git add docs/specs/gate-baseline.json
```

From then on, `specgate check` and `specgate validate` fail only on a finding
that is not in `docs/specs/gate-baseline.json`. Each run says how many it let
through (`baselined`), and names each baselined finding that no longer occurs
(`baseline_fixed`), so that you can run `check --baseline` again and the file
shrinks.

A finding is matched by its code, its file and its requirement, never by its
wording. The baseline holds the traceability findings of `validate --strict`
(the TDD rules and the matrix checks). The other checks still fail as before:
when one does, `check --baseline` says so and records what it could.

## Next

- [Writing specs](writing-specs.md)
- [Validating](validating.md)
