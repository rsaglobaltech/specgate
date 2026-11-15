# Delta — harness

## ADDED Requirements

### Requirement: REQ-375 — Ticking a task is not an edit of the contract

The system SHALL not refuse an attempt as `agent_touched_protected_path` for a change to a change's `tasks.md` whose only difference is the box of its tasks (`- [ ]`, `- [x]`, `- [X]`), as delivering a requirement writes it, and SHALL keep refusing any other edit of that file; the implementing prompt SHALL say that the harness ticks the requirement's tasks itself.

#### Scenario: SCN-375a — The agent ticks the task it delivered

- GIVEN an approved layered change of two requirements
- WHEN the agent implements REQ-002 and ticks its task in tasks.md
- THEN the attempt is not refused for a protected path

#### Scenario: SCN-375b — The agent rewrites a task

- GIVEN the same change
- WHEN the agent rewords REQ-002's task in tasks.md
- THEN the attempt is refused with `agent_touched_protected_path`, naming tasks.md

<!-- specgate:trace status=Implemented test=tests/unit/rc4-ticks.test.ts actor=Developer kind=functional -->
