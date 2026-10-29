# Discover: workspace-live

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A product made of several repositories is built by several agents at once, one
per repository. Today a person watches one repository at a time: to know where
a business story stands — which part is built, which waits, what it cost — they
open each repository's live view in turn and add it up by hand.

## Use case

1. A person opens the live view of the workspace.
2. They see one panel per repository: what it is building now, the step it is
   on and for how long, and what its agent is doing.
3. They see each story with its part in every repository: open, being built,
   delivered, missing, or waiting on another repository's part, named.
4. They see what each story and each repository has cost so far.
5. From the workspace, they start the build of a story's parts, every
   repository at once.

## Acceptance criteria

- AC-1: the live view of a workspace shows every repository, with the requirement in flight, its step and how long it has run, and the agent's last action.
- AC-2: each story shows its part in every repository as open, being built, delivered or missing, and a part held by an undelivered requirement of another repository names it.
- AC-3: the cost so far is shown per repository and per story, in money and minutes.
- AC-4: one command starts the build of every open part of a story, in every repository at once, and starts none when one repository's base already fails.
- AC-5: the same view is available as data for other tools.
