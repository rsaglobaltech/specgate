# Lanes, roles and limits

What the harness's agent may do, and who decides: split the work into lanes so
no session grades its own tests, cap what one requirement may cost, keep the
agent away from the files that define its contract, and wait for the people who
hold each role to approve.

**You need:** a project where `specgate harness run` already works
([The harness](harness.md), [Agent setup](agent-setup.md)).

## A tester and an implementer

One agent that writes both the code and the tests that judge it can make the
tests agree with whatever it wrote. `lanes:` splits each attempt into two
sessions, in this order:

```yaml
# harness.config.yaml
lanes: [tester, implementer]
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

Each session gets `SPECGATE_LANE` (`tester` or `implementer`) in its
environment, so one agent command can serve both. The run record names both
lanes for each attempt. `lanes:` combines with `attempt_profiles`, and the
profile of the attempt runs both lanes. It also combines with `review_profile`,
whose reviewer still runs first on a retry. The only value accepted is
`[tester, implementer]`. 0.35 called this key `roles:`; 1.0 refuses the old
spelling and `specgate migrate 1.0` renames it, because `roles:` now names
people (below).

## A budget per requirement

```yaml
# harness.config.yaml
max_cost_usd: 5
```

The harness adds up the `cost` each session reports in its final usage line,
which `specgate harness events` writes for Claude Code. Once a requirement's
total reaches the limit, no further session starts for it, whether that is the
implementer after the tester or a retry. When the limit is reached between the
tester and the implementer, the implementer does not start and the requirement
fails with `budget_exceeded`, what it spent and the limit, without being gated.
When it is reached by an attempt's last session, the gate still judges that
attempt; no retry starts after it. An agent that reports no cost counts as free, and
the run warns `cost_unknown` once per requirement. `--budget-seconds` and
`--max-requirements` limit the whole run; this limits one requirement.

The whole run, and tokens, have ceilings too (REQ-585):

```yaml
max_run_cost_usd: 20      # no requirement starts once the run's sessions reported $20
max_tokens: 2000000       # one requirement's input, output and cache tokens
require_known_cost: true  # a session that reports no cost fails (cost_unknown)
timeouts: { agent: 1800, setup: 600, tests: 300, review: 600 }   # seconds; else --timeout
```

An agent that cannot run now (out of quota) gives way to the next profile of
`attempt_profiles` (REQ-586).

## What the agent may not touch

The agent works against a contract, and editing the contract would make a green
gate meaningless. By default it may not change `spec.md`, `AGENTS.md`,
`AI_RULES.md`, `features/**/*.feature`, `docs/specs/**`, `.specops.lock`, or
`harness.config.yaml`. Nor may it change the files that steer an agent:
`CLAUDE.md`, `.claude/**`, `.cursor/**`, `.github/**` and `.mcp.json`. An
attempt that does fails with `agent_touched_protected_path`, and the next
attempt is shown the files, with the diff of any it edited. A new file under
the contract paths is allowed — a feature file, a file under `docs/specs/` —
because a requirement may need one; editing or deleting an existing one is
not. A new instruction file is not allowed either: a `CLAUDE.md` or a hook the agent
creates steers the next session as surely as an edited one.
`protected_paths:` replaces the list, and `allow_paths:` names exceptions.

**Its environment.** The agent inherits the shell's variables, credentials
included; each run names the ones that look like secrets. `agent_env:` lists
what it gets instead — those, plus `PATH`, the home and temp folders, the locale
and the harness's own `SPECGATE_*` (REQ-587):

```yaml
agent_env: [ANTHROPIC_API_KEY]
```

## Approvals and role packages

A requirement of a 1.0 change is built once the change is approved, each
layer by its owner ([reviewing changes](reviewing-changes.md#a-person-approves-the-draft));
until then the harness skips it with `harness_not_approved`.

What a role asks of the work goes in `harness/<role>.md`, written once
(ADR-0045):

```markdown
---
role: security
owner: sec@acme.eu
version: 2
applies-to:
  capability: [payments]
---
Never log a card number. Validate every amount on the server.
```

It applies when every dimension it lists (`kind`, `capability`, `tag`)
matches the requirement. The prompt gets it under "Role constraints", the
review check gives one line of advice per package, and the live view, the
run record and `harness report` name each package as `role@version`.

## Next

- [The harness](harness.md): one turn in sequence, worktrees and chains
- [Agent setup](agent-setup.md): profiles, ladders and reviewers
