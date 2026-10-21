# Proposal: publish-reservation

Found with two developers on two clones: `propose --from-ticket` pushed the ticket's branch empty and left the change, with the ids it reserved, uncommitted on one disk. No other clone could see the reservation, so neither fetching before reserving (REQ-163) nor `change_id_clash` (REQ-164) could catch PET-103 and PET-104 both taking REQ-010.

In scope: commit and push the opened change on the ticket's branch (REQ-165).
