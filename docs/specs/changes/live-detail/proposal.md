# Proposal: live-detail

## Intent

Watching a long run in `/live`, an adopter clicked a requirement and saw only its steps: what it says, where its spec and tests live and how earlier attempts went meant leaving the page. The header scrolled away, every module stayed open, the traceability matrix was elsewhere, and the sidebar and the centre listed the same modules twice while nothing said which model ran, how full its context was, what it cost or what it was told.

## Scope

In scope:

- A requirement opens into tabs: Steps, Requirement (text, scenarios, spec file and line, assumptions), Tests and files, Attempts, and Agent (model, context window, tokens, cost, turns, and the prompt it was given).
- A sticky header and run summary; a Traceability view with the matrix as it stands, filtered as the viewer types, one accordion per module.
- The centre is a matrix by module: one row per module, one segment per requirement, queued ones included.
- The sidebar is the run's work queue: now (with model, context and output tokens), needs attention, up next with an estimate, finished recently.
- `harness events --from claude` records the agent's session (model, context per message, the session's totals and cost); `harness run` keeps the queue and each attempt's prompt beside the events, git-ignored.

Out of scope:

- Agents other than Claude Code report no session: their attempts show none.
- Prices: the cost is the one the agent reports, never computed.

## Approach

The live model folds three new event types (`agent`, `usage`, `prompt`) next to the steps and keeps them out of the step list; studio serves `/live/req/<id>.json`, `/live/req/<id>/prompt/<n>.txt` and `/live/matrix.json`, and the page reads them, every value set as text.
