# Discover: gate-runs-scenarios

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

Specgate's promise is that only code that does what was decided gets through.
Measured on 2026-11-24 with real agents (80 runs): Codex built 1.00 a day capped
at 20.00 to a test that contradicted a scenario saying 0.50 and 10.00, nine times
of ten, and the gate passed ten times of ten — it saw a test that names the
requirement and passes. With the scenarios executed the gate failed ten times of
ten. So the means exists; it is not used where it matters:

- `specgate apply` runs a requirement's scenarios when the project requires them.
- `specgate check` — what CI runs — does not: it checks that a runner and the files exist.
- `specgate harness run` — the studio's Build, the swarm — marks the requirement delivered without running them.
- A project that does not require them gets one warning for the whole project, and each requirement is delivered as if checked.

## Use case

1. An agent builds a requirement through the harness, to a test that says something else than its scenario.
2. The harness gate runs the requirement's scenarios, fails, and tells the agent which scenario and why.
3. In CI, `specgate check` runs the delivered requirements' scenarios: code changed later to say something else fails there too.
4. In a project whose scenarios nobody runs, each delivery says so, and the Developer sees how many requirements stand on a test alone.

## Acceptance criteria

- AC-1: with executable scenarios required, the harness gate runs the requirement's scenarios and a failure goes back to the agent.
- AC-2: with executable scenarios required, `specgate check` runs the scenarios of the delivered requirements and fails naming the requirement and the scenario.
- AC-3: where scenarios are not executed, a delivery says its scenarios were not run, and the project's status counts those requirements.
