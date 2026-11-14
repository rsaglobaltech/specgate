# Proposal: transition-outputs

## Intent

AIUP's Transition phase hands the business three documents: an acceptance
protocol derived from the test cases, a user guide with one chapter per actor,
and business release notes. Its change flow also classifies every change by
intent, Bug or Enhancement. Specgate stops at `archive`: what a release
delivered, what a stakeholder must accept and how a user does it are all in
the repository — archived changes, delivered requirements, scenarios, actors —
but nothing turns them into something a customer reads. Unlike AIUP, we can
generate all three without an agent.

## Scope

In scope:

- REQ-542: `specgate release-notes <from>..<to>` from the changes archived
  and the requirements delivered between two git refs.
- REQ-543: `specgate acceptance <change>` writes a checklist from the
  change's scenarios; `--sign <name>` records the acceptance and moves its
  requirements to `Verified`.
- REQ-544: `specgate guide` writes `docs/guide/<actor>.md`, one chapter per
  actor, from the delivered requirements and their scenarios.
- REQ-545: `propose --kind bug|enhancement` records the change's kind, which
  the release notes group by.

Out of scope:

- Rewriting the text with an agent: the output is the spec's own words; a team
  that wants prose can pass it to its agent.

## Approach

All three read the parsed specification and git history the matrix already
uses. A release's changes are the `docs/specs/changes/archive/*` folders added
between the refs; the guide orders an actor's requirements by capability. The
acceptance file lives in the change folder, so it is reviewed and archived
with it.
