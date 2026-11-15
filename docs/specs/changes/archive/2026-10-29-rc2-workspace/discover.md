# Discover: rc2-workspace

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The first run of the 1.0 candidate on a product made of several repositories
(truck-flote, split in five repositories) delivered a story across three repositories, and
showed what a team still had to do by hand: turn the client's brief into
stories, copy each story's intent into every repository, name what one
repository needs from another, start the repositories in the right order, and
read a garbled title and a story with no cost.

## Use case

1. Product saves the client's brief in the workspace repository and asks for
   the stories it holds; an agent can draft each story's intent and criteria.
2. Product splits a story across the repositories it names; every repository
   receives the story's intent and criteria, and the other repositories of the
   story.
3. The workspace builds the story's repositories in the order their
   requirements depend on each other, and shows what the story cost.

## Acceptance criteria

- AC-1: The workspace repository takes the client's brief and proposes its stories.
- AC-2: An agent can draft a story's intent and criteria from the brief, and writes nothing else.
- AC-3: The status of a workspace repository speaks of the workspace.
- AC-4: Every repository of a story receives the story's intent and criteria.
- AC-5: A repository whose criteria drift from the story is reported.
- AC-6: Every repository of a story is told the story's other repositories and how to name what it needs from them.
- AC-7: A repository waiting on another's requirement is built after it.
- AC-8: The live view shows a story's title as it is written.
- AC-9: A story's cost counts its delivered parts.
- AC-10: The repositories get short names, shown in readable columns.
- AC-11: What a story's build writes is not committed.
