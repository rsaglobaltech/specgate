# Joining a project

Someone else set Specgate up; you need the loop. Setting it up yourself? See
**[Start](start.md)**.

With the repository cloned and its dependencies installed, run these from its
folder (`npx specgate` uses the version the team pinned):

```bash
npx specgate status                 # what is left, and the next command
npx specgate propose <change-id>    # open a change; write its delta
npx specgate apply REQ-007          # after a test names REQ-007: the gate, then Implemented
npx specgate archive <change-id>    # every requirement applied: merge the change
npx specgate check                  # before the pull request — CI runs the same
```

Work from a Jira ticket? `npx specgate propose --from-ticket KAN-13` — see
[From a Jira ticket](from-a-ticket.md).

## Next

- [Concepts](concepts.md#vocabulary) — the words
- [Your team's first pull request](first-pr.md) — what the author writes, what the reviewer reads
