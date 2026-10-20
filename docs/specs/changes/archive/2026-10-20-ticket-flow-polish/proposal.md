# Proposal: ticket-flow-polish

## Intent

Found on the real board. KAN-13 and KAN-14 were opened on two branches; REQ ids no longer collide (REQ-152) but scenario ids could: a change only names the scenario it starts at, and a sibling change drafted later starts at the same one. And `status`, in a project whose work comes from Jira, suggested `specgate new`.

## Scope

In scope: a reserved scenario range per change (REQ-157); status suggesting the ticket path (REQ-158).
