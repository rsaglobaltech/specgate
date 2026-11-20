# Discover: undecided-stack

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A project adopted before it has any code states its stack as unknown, and its
agent contract forbids the agent from choosing one and tells it to stop. The
agent stops, as it should, and neither it nor the person is told what to do
next: the contract names a marker adoption never writes, no command records
the decision, and nothing else in the tool mentions it. Issue #502.

## Use case

A person adopts an empty folder and asks an agent to build a requirement. The
agent stops at the undecided stack and names the command to run; the person
runs it, and the agent goes on.

## Acceptance criteria

- AC-1: Adoption that cannot read the stack states it, and the test toolchain, with the marker the agent contract names, and the contract says how the person decides: a command, or a generated application.
- AC-2: The decision is recorded through the configuration commands, which write it into the contract and leave the team's own text as it was.
- AC-3: While the stack or the test toolchain is undecided, the status and the diagnosis say so with the command; once decided they say nothing.
- AC-4: A project whose stack was read from its build files is asked nothing.
