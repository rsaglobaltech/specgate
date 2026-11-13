# Roles, budget and protected paths

Three limits on what the harness's agent may do: split the work so no session
grades its own tests, cap what one requirement may cost, and keep the agent
away from the files that define its contract and its instructions.

**You need:** a project where `specgate harness run` already works
([The harness](harness.md), [Agent setup](agent-setup.md)).

## A tester and an implementer

One agent that writes both the code and the tests that judge it can make the
tests agree with whatever it wrote. `roles:` splits each attempt into two
sessions, in this order:

```yaml
# harness.config.yaml
roles: [tester, implementer]
```

1. The **tester** writes the failing tests the requirement's scenarios call
   for, and no production code.
2. The **implementer** writes the code that makes them pass, and changes no
   test.

Each role stays in its lane. After the tester, any file it wrote that is not a
test is put back; after the implementer, any test it changed is put back. Each
one is reported as `lane_crossed`, naming the role and the file. Build
manifests (`package.json`, `pom.xml`, `build.gradle`) are left to either. A
test is a file the derived matrix counts as one: a name such as `a.test.ts`,
`test_a.py`, `a_test.go` or `ATest.java`, or a file under `test/`, `tests/`,
`src/test/` or `e2e/`.

Each session gets `SPECGATE_ROLE` (`tester` or `implementer`) in its
environment, so one agent command can serve both. The run record names both
roles for each attempt. `roles:` combines with `attempt_profiles`, and the
profile of the attempt runs both roles. It also combines with `review_profile`,
whose reviewer still runs first on a retry. The only value accepted is
`[tester, implementer]`.

## A budget per requirement

```yaml
# harness.config.yaml
max_cost_usd: 5
```

The harness adds up the `cost` each session reports in its final usage line,
which `specgate harness events` writes for Claude Code. Once a requirement's
total reaches the limit, no further session starts for it, whether that is the
implementer after the tester or a retry. The gate still judges what was
already written; when it fails, the requirement fails with `budget_exceeded`,
what it spent and the limit. An agent that reports no cost counts as free, and
the run warns `cost_unknown` once per requirement. `--budget-seconds` and
`--max-requirements` limit the whole run; this limits one requirement.

## What the agent may not touch

The agent works against a contract, and editing the contract would make a green
gate meaningless. By default it may not change `spec.md`, `AGENTS.md`,
`AI_RULES.md`, `features/**/*.feature`, `docs/specs/**`, `.specops.lock`, or
`harness.config.yaml`. Nor may it change the files that steer an agent:
`CLAUDE.md`, `.claude/**`, `.cursor/**`, `.github/**` and `.mcp.json`. An
attempt that does fails with `agent_touched_protected_path`, and the next
attempt is shown the diff. A new feature file is allowed, because a requirement
may need one. A new instruction file is not: a `CLAUDE.md` or a hook the agent
creates steers the next session as surely as an edited one.
`protected_paths:` replaces the list, and `allow_paths:` names exceptions.

## Next

- [The harness](harness.md): one turn in sequence, worktrees and chains
- [Agent setup](agent-setup.md): profiles, ladders and reviewers
