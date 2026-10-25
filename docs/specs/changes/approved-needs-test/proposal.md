# Proposal: approved-needs-test

## Intent

`specgate apply REQ-002 --status Approved` wrote Approved on a requirement that no test named, and said nothing. Approved is past Draft, so the next `validate --strict` failed TDD-1 for it, and every gate that judges the whole project failed with it: in an adopter's project, 76 requirements marked Approved before their tests turned every `harness run` red, three attempts each, whatever requirement the agent was working on. Any other word passed to `--status` was written as it came, too.

## Scope

`apply` and `done` refuse a status that is not one of theirs, and refuse a status that owes a test (Approved, as Implemented, Verified and Released already do) while no test names the requirement, with the TDD-1 reason and the fix, writing nothing. `--no-check` still writes it, and warns that `validate --strict` will fail TDD-1 until a test names the requirement.

## Out of scope

Scoping the harness gate to the requirement under test: a project already red before the harness starts is caught by the harness's own pre-flight (REQ-174).
