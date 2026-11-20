# Discover: agent-runs-tests

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A first run of the unattended loop with a real agent, on the two kinds of
project the first outside teams have. Both requirements were delivered at the
first attempt, but in both the agent was refused every time it tried to run
the project's tests. It wrote the test and the code without running either,
said so in its last message, and the gate was the first thing to run them. On
a harder requirement every attempt would be written blind, and the step where
a new test is seen to fail before the code exists never happens.

## Use case

A team hands a requirement to the agent and expects it to work as a developer
does: write the test, see it fail, write the code, see it pass — before the
gate judges the result.

## Acceptance criteria

- AC-1: With the agent set up the documented way, the agent can run the project's test command, and no other command.
- AC-2: The agent is told which command that is, so it does not try variants that are refused.
- AC-3: The run says what the agent was allowed to run.
- AC-4: A person who chose the agent's permissions themselves keeps them as written.
