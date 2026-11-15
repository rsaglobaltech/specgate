# Discover: studio-layers

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A 1.0 change is approved layer by layer, each by whoever holds its role. The
redesigned studio offered one Approve for the whole draft and did not show the
layers, so a product owner using the studio could not see what was approved,
by whom, nor approve their own layer; in a team's studio, an approval would
have been recorded as the machine's identity, not the signed-in person's.

## Use case

A product owner opens a change in the studio, sees Discover, Design and Tasks
with who approved each, and approves the Discover; signed in through the team's
proxy, the approval is theirs.

## Acceptance criteria

- AC-1: Each written layer shows its owner, its approvals against the quorum, and who gave them.
- AC-2: A person can approve each layer whose role they hold, and only those.
- AC-3: In a team's studio, the approval is the signed-in person's.
