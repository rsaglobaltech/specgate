# Discover: harness-capabilities

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The 1.1 part of issue #466. A person watching a run could only ask it to stop
after the requirement in progress; one time limit covered an agent's hour and a
linter's seconds alike; a run's budget counted one requirement at a time and a
session that reported nothing was free; an agent out of quota ended the run
even with another agent configured; and the agent inherited every credential
of the shell that started it.

## Use case

A team runs the harness overnight with two agents, a budget and their cloud
credentials in the shell; in the morning someone stops a run that went wrong.

## Acceptance criteria

- AC-1: A person can end a run at once, with everything it started, and resume it later.
- AC-2: Each kind of command can have its own time limit.
- AC-3: A run can have a cost ceiling of its own, a requirement a token ceiling, and a session that reports no cost need not count as free.
- AC-4: An agent that cannot run now gives way to the next one configured.
- AC-5: The project decides which variables the agent gets, and is told which secret-looking ones it would inherit.
