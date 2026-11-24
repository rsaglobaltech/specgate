# Discover: compat-sandboxed

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

On 2026-11-24 an exam run of OpenCode with a free model, approving its own
commands and in no sandbox, saw that `specgate` was a decoy, concluded it was
being examined, and spent nine minutes on the Developer's disk: it read earlier
exam results, searched all of the Developer's home for the hidden test, and
reached it. It wrote nothing outside its copy and opened no key. The exam had
dropped the sandbox to spare a login. An agent that approves its own commands
reads whatever the Developer can read.

The Developer will use OpenCode with free models and Specgate, and wants to
watch these runs as before.

## Use case

1. The Developer runs the exam for OpenCode; each run's agent works inside a sandbox that holds its copy and nothing else of the machine.
2. The sandbox reaches the agent's provider and the package registry, and no other host — not the providers whose keys the sandbox could use.
3. The Developer watches the run live, and reads its verdict as for any other run.
4. When the batch ends, or is interrupted, no sandbox is left.

## Acceptance criteria

- AC-1: with a sandbox asked for, the agent runs inside it and sees only the run's own folder.
- AC-2: the sandbox's network is its tool's provider and the registry; every other host its kit allows is denied.
- AC-3: Specgate inside the sandbox is this checkout's at the levels that have it, and is not there at B.
- AC-4: a tool that approves its own commands is not run outside a sandbox unless the Developer says so in words.
- AC-5: nothing of the exam's own — its results, its tasks' hidden checks, the host's paths — reaches the agent's folder or its environment.
- AC-6: no sandbox of a batch outlives it.
