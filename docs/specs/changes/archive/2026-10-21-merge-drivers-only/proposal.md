# Proposal: merge-drivers-only

## Intent

Found rehearsing a ticket end to end on a brownfield project: the merge drivers live in each clone's git config, so every developer has to register them, and the only way was `specgate harness init`, which also writes `harness.config.yaml` and `.harness/prompt-prefix.md`. The developer's tree is left dirty with files that belong to whoever sets up the harness, and a tool that sets up a clone (agentkit) cannot register the drivers without that.

## Scope

`specgate harness init --merge-drivers` registers the merge drivers in the clone's git config, adding their rules to `.gitattributes` only when they are missing, and writes nothing else. The messages that tell a clone to register the drivers name this form.

## Out of scope

Registering the drivers without git.
