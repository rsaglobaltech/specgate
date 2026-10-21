# Proposal: id-clash

## Intent

Found rehearsing with two developers on two clones: PET-103 and PET-104 were opened at nearly the same moment and both reserved REQ-010. Reservation reads every branch the clone knows (REQ-152), but neither clone had fetched the other's branch.

## Scope

In scope: fetch before reserving ids for a ticket (REQ-163); `change_id_clash` from `check` and the ticket report (REQ-164).
