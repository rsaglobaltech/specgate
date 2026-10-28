# Proposal: truck-flote-run3

## Intent

The third truck-flote run, with Specgate 0.27.3 and forja 1.0.3 only, found
three things on the way from the client's brief to its front matter (S37–S39
in that project's `docs/specgate-issues.md`):

- the client's `brief.md` at the repository's root was not noticed: forja's
  template in `docs/brief.md` was all `status` and `draft` saw (S37);
- `draft` said "Your brief has no front matter yet" over a front matter that
  was only incomplete (S38);
- the agent named the actors in English over a Spanish brief, and B9 flagged
  all five as never mentioned (S39).

## Scope

In scope: the three above. Out of scope: moving a file for the person.
