# Discover: rc3-workspace

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The second run of the 1.0 candidate on truck-flote's five repositories took the
client's brief to a story drafted by an agent and carried it into four
repositories, and still left a team to do by hand: name the stories of the
brief, keep the client's open questions from being forgotten, tell each
repository which criteria are its own, and keep the story's guidance out of the
business layer. Each repository's author did not hear of the others, and a
later repository started before what it waited for was delivered.

## Use case

1. Product saves the client's brief in the workspace and lets an agent propose
   its stories and the repositories each touches.
2. The agent drafting a story writes its criteria, which repository answers
   each, and the client's questions in their own file; the story is split only
   once those questions are answered.
3. Each repository's author and builder hears of the story's other repositories
   and names what it waits for; the story is built in that order, and what is
   left waiting is named.

## Acceptance criteria

- AC-1: An agent can propose the stories of the brief, and the repositories each touches, without changing the client's text.
- AC-2: Each criterion of a story names the repositories that answer it, and each repository sees which are its own.
- AC-3: A criterion no repository answers, or two claim, is reported.
- AC-4: A story's questions for the client are kept apart, and the story is not split while one is open, unless the person says so.
- AC-5: A story written by the agent keeps none of the hints of its blank form.
- AC-6: What Specgate writes in a repository's business layer reads as business, not as technique.
- AC-7: Whoever writes a repository's part of a story hears of the story's other repositories and how to name what it waits for.
- AC-8: A repository's requirement waiting on another's undelivered requirement is not built, and the person is told what it waits for.
