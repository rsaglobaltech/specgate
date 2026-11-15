# Proposal: check-capability

## Intent

Found handing a ticket over from agentkit: PAY-123 has no epic, so `propose --from-ticket --check` said it was ready, agentkit created the branch, and only then did opening the change fail with "No capability for PAY-123". The developer learns that a capability is missing once the branch exists.

## Scope

`--check`, in a Specgate project, says which capability the change would go to, from `--capability` or the epic's mapping, as `capability` in its JSON; with none, it warns `ticket_no_capability` and names the capabilities that exist. A warning: the ticket itself is ready, the repository has to say where it goes.

## Out of scope

Guessing the capability from the ticket's components or labels.
