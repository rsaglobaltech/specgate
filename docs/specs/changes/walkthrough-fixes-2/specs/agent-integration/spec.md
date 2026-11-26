# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-781 — The Claude Code plugin, generated in a project, goes under .claude/

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL, on `specgate agents init --tool claude-plugin` in a Specgate project, write the plugin under `.claude/specgate-plugin/`, where the guard never judges a file as source, and SHALL write it at the given `--project-dir` when that is not a Specgate project.

#### Scenario: SCN-781a — The next call goes through

- GIVEN a Specgate project where `agents init --tool claude-plugin` ran, and a change open with no test yet
- WHEN an agent's tool asks to run `ls`
- THEN the plugin is under `.claude/specgate-plugin/`, nothing of it is at the root, and the call is allowed

### Requirement: REQ-782 — A requirement waiting for an answer is never handed to an agent

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL, in `specgate harness run`, skip a requirement marked Needs Clarification before it makes a worktree or a branch or starts an agent, saying it waits for an answer.

#### Scenario: SCN-782a — Asked for by name

- GIVEN REQ-004 marked Needs Clarification in an approved change
- WHEN the developer runs `specgate harness run --req REQ-004`
- THEN no agent runs, no branch `harness/REQ-004` exists, and the output says it waits for an answer

### Requirement: REQ-783 — A client's answer is a source for its requirements' values

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL accept, in the draft checklist's rule D6, a value a scenario states when the Answer of an answered question that blocks the scenario's requirement states it, as it accepts a value the brief states.

#### Scenario: SCN-783a — The fee the client gave

- GIVEN REQ-004's scenario charging "5 euros", the brief silent on the fee, and Q1, blocking REQ-004, answered "5 euros"
- WHEN the draft is checked
- THEN no `D6_unlisted_value` names "5 euros"; with Q1 unanswered, one does

### Requirement: REQ-784 — A ready draft names the approval next

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL name `specgate change approve <change>` as the next step of a draft that is ready to review and not approved — in `propose --from-brief`'s numbered steps, before `specgate apply`, and wherever a module's next command is given — and `specgate apply` once a person approved it.

#### Scenario: SCN-784a — Ready to review

- GIVEN the bookings draft passes its checklist and nobody approved it
- WHEN the developer runs `specgate propose --from-brief bookings`
- THEN its steps name `specgate change approve draft-bookings`, then `specgate apply`

### Requirement: REQ-785 — A branch that changes no control is reported as changing none

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL compare, in `specgate check --base`, the sealed acceptance tests as they are at the base with the branch's, so that a branch that changes no control names none.

#### Scenario: SCN-785a — Identical to main

- GIVEN main with a sealed acceptance test, and a branch from it with no change
- WHEN the developer runs `specgate check --base main`
- THEN no `controls_changed_on_branch` is reported

### Requirement: REQ-786 — Diff fails on a pack it cannot render; sync fails on an id clash

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL exit non-zero from `specgate specops diff` when a pack's expansion fails, and from `specgate specops sync` when, after the merge, `spec.md` holds a requirement id twice, naming the ids and saying to give the project's requirement a free id.

#### Scenario: SCN-786a — The pack's REQ-006 and the project's

- GIVEN a project with its own REQ-006, and a pack version that adds a REQ-006
- WHEN the developer runs `specgate specops sync --pack-version <new>`
- THEN it fails naming REQ-006, and does not say there was no conflict
