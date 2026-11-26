# Sealed acceptance tests

The agent that implements a requirement should not also write the test that
judges it: a wrong test is then followed, or written, by the same hand.
Sealed acceptance tests separate the roles. Someone else writes them, a person
approves them, and from then on the agent cannot change them — the gate runs
them with your own test command.

Specgate reads no test. It only controls who may change one, so this works in
any language your project tests in: JUnit, pytest, Playwright, Cucumber steps.

## 1. Write them — not the implementing agent

Write the acceptance tests from the change's specification and design, never
from the source: a person, or another agent that sees only `spec.md`,
`features/` and `docs/specs/`. Name the requirement and the scenario in each
test's title (`REQ-014 SCN-014 — peak rate above the threshold`).

List each file in `docs/specs/changes/<change-id>/acceptance-tests.md`, one
line per file, with the scenarios of the change it proves:

```markdown
- test/acceptance/pricing.spec.ts — SCN-014, SCN-015
- src/test/java/PricingIT.java — SCN-014
```

This is not `acceptance.md`: that file is the business sign-off checklist
`specgate acceptance <change-id>` writes.

## 2. Approve and seal them — a person, at a terminal

The change itself is approved first (`specgate change approve <change-id>`).
Then a person reads the tests against the scenarios and seals them:

```bash
specgate change approve <change-id> --layer acceptance
```

It refuses, recording nothing, when a listed file is missing, when a line
names no scenario of the change, or when the change is not approved. Run with
no terminal — by an agent's tool — it refuses with `approve_needs_person`.

Each file is recorded in the change's `approvals.json` by its sha256.

## 3. Tell the gate how to run them

```bash
specgate config set acceptance_cmd "npx playwright test {files}"
```

`{files}` stands for the sealed paths. Other examples: `pytest {files}`,
`mvn -q verify -Dit.test=PricingIT`. Specgate installs nothing.

## What the gate and the guard do

`specgate check` (and so `apply`) has an `acceptance` stage:

| Finding | When | What to do |
| --- | --- | --- |
| `acceptance_not_sealed` | a sealed file changed or is gone | restore it (`git checkout -- <file>`), or have a person approve the new version |
| `acceptance_red` | `acceptance_cmd` exits non-zero | fix the code — the test is the contract |
| `acceptance_no_command` | tests are sealed and no `acceptance_cmd` is set | set it (step 3) |

The rule is `acceptance` in `.specgate/gate.yaml`: an error in `strict` and
`standard`, a warning in `minimal` ([gate policy](gate/policy.md)).

Where Specgate's hooks run ([the guards](agents.md#the-guards)), a write, an
edit, a patch or a shell command that changes a sealed test is refused with
`acceptance_sealed`; a sealed test that names a requirement counts as the test
written first. Where no hook runs, the [outside judge](harness.md) sees the
change and fails the run.

## After the change is archived

The seal stays. A sealed test of an archived change is still checked and still
guarded. To change one, open a change that lists it in its own
`acceptance-tests.md`, and have a person approve it: the new seal replaces the
old.

## Next

- [Change a shipped requirement](reviewing-changes.md) — the whole review, from propose to archive
- [The gate's policy](gate/policy.md) — the rule `acceptance` and the others
- [What a failure means](gate/failures.md) — every code, with its fix
