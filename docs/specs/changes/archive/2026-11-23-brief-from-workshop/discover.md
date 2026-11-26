# Discover: brief-from-workshop

## Context

Enterprise teams model their domain in DDD workshops — Domain Storytelling, Event Storming, Bounded Context Canvas — with tools such as DDD Toolbox. Today the brief is typed by hand, so the workshop is written twice. The studio's issue #59 agreed: the boards become the brief's modules, the agent drafts from them in the team's language, and the repository keeps a readable model per context.

## Acceptance criteria

- AC-1: a workshop's boards give one readable model per context, and the brief's modules, actors and cards.
- AC-2: a module from a workshop is drafted from its model; its values count as stated.
- AC-3: one command imports and drafts the first module.
- AC-4: their exported files only — no code, assets or SDK of the tool's.
