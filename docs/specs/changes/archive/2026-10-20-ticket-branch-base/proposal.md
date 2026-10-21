# Proposal: ticket-branch-base

## Intent

Found rehearsing on a years-old codebase (spring-petclinic, gitflow): the
clone's default branch is `main`, the team works from `develop`, and the
ticket's branch was cut from `origin/main` — without the company POM, the
adoption and `alm.config.yaml`, so the agent drafted in a tree that had none of
them. `check` would likewise have warned `ticket_key_missing` for every commit
of `develop`. And the German summary "Groß-/Kleinschreibung" made the change id
`gro-kleinschreibung`.

## Scope

In scope: the base of a ticket's branch and of `ticket_key_missing`
(REQ-148, modified); readable ids from German and accented summaries (REQ-161).
