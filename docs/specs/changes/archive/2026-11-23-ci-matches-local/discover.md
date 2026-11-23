# Discover: ci-matches-local

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A second timed run of the documented path, on the two kinds of project the
first outside teams have. Nothing stopped either, but the pipeline written at
adoption did not run what the gate runs on the developer's machine: it carried
its own copy of the test command, with a build step added that the saved
command lacked, and a later change of the test command never reached it. The
same output also said no agent was detected and, two lines on, that an agent
was set — two different things under one word.

## Use case

A team adopts the tool and trusts that a gate green on a laptop is green in
the pipeline, because both run the same command, kept in one place.

## Acceptance criteria

- AC-1: After adoption the pipeline runs the test command the project saved, with no copy of its own, so changing it once changes both.
- AC-2: Where the project has a build step, the saved command includes it, as the pipeline's did; a command the person gave is taken as written.
- AC-3: A pipeline file that was already there is left as it is.
- AC-4: Adoption tells the agent's commands, which it did not install, from the agent the build runs, which it set.
