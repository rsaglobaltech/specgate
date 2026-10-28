# Proposal: gate-steps-live

## Intent

The sixth truck-flote run (S54) watched a requirement for 19 minutes: `harness run` printed
`attempt 1/3` and nothing else, and `/live` showed nothing. The agent's steps reach the live view only
when its command pipes Claude Code's stream through `specgate harness events`; the gate wrote one event
per stage when the stage ended, and the quality checks all ran before any of theirs was written. A
semgrep check that hung for 15 minutes looked exactly like a gate at work.

## Scope

- Each gate step — the setup command, `validate --strict`, the end-to-end test, the architecture check,
  the test command and each quality check — is an event when it starts and when it ends, with its
  duration, whatever the agent command is; `harness run` prints a line for each (REQ-273).
- `/live` shows the step that is running by its name, with how long it has run (REQ-274).
- The studio's Build places the running requirement in Programa, Prueba, Revisa la calidad or Guarda
  from those steps, and names the step (REQ-275).
