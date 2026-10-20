# Proposal: brief-cards

## Intent

"Write the brief" taught the four front-matter fields and left the brief itself
to one sentence. Nothing tied the text to the modules, so the agent drafting
one module read all of it; the checks that fail most (D6) depended on how the
brief stated numbers and labels, and nobody said so; and the tool accepted
briefs it should have refused — `actors: [Admin]`, `surfaces: web`, a template
with every section still a comment. Building agentkit and the pilots showed
it, and Birgitta Böckeler's review of Kiro, spec-kit and Tessl names the same
risks: one workflow for every size, and more markdown to review than code.

Decision record: [ADR-0038](../../../adr/0038-brief-cards.md). Analysis:
agentkit's `docs/brief-proposal.md`.

## Scope

In scope:

- The front matter's shapes, reported as shapes (REQ-135).
- `specgate propose --from-brief --check`: the brief rules, before any agent
  runs; a draft is not opened over an error (REQ-136).
- `## Module: <name>` sections with Rules, Examples and Questions — Example
  Mapping's cards — as each module's scope (REQ-137), and warnings that make a
  rule testable, EARS among them (REQ-138).
- The template written by `--new-brief` (REQ-139).
- `DRAFTING.md` quotes the module's section and its values; D6 stops reading
  HTML comments as the brief (REQ-140).
- `--agent` proposes module sections from pasted notes, keeping every line
  (REQ-141).
- The page rewritten in eight steps, and when no brief is needed (REQ-142).

Out of scope:

- Judging whether a rule is right or needed: that stays with the reviewer.
- EARS as an error: a warning until it is measured on two projects.

## Approach

Rules over the brief's text, decidable and each with a fix, like the D-rules
over a draft. A brief without module sections keeps working as before; the
sections make the checks — and the draft — sharper.
