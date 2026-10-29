# Discover: org-steering

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

An organization with many teams agrees on how it builds software — its
principles — and every team should follow the same, current version of them.
Today each repository writes its own rules, nobody can say which teams follow
the latest ones, and a rule that matters is only checked when someone remembers.

People also change behaviour without a specification ("a quick fix"), and the
gap between what is specified and what the product does grows unseen. Teams
that publish their interfaces as contracts cannot tell which operations are
specified by a requirement. And a large existing system cannot be specified at
once: the team needs to start with the area it is touching.

## Use case

1. The organization publishes its principles with a version; each repository
   takes them, and the gate says which version it follows and when it is behind.
2. A principle that can be checked automatically is checked by the gate.
3. A change of behaviour made without a specification is reported, and a team
   can decide to make it block the merge.
4. A requirement can name the interface operation it specifies; the gate says
   when the operation does not exist, and which operations no requirement covers.
5. A team adopting an existing system specifies only the area it is touching, and
   is told when what it is about to specify is too big to review.

## Acceptance criteria

- AC-1: the gate names the version of the principles a repository follows, and says when a newer one exists where they came from.
- AC-2: a principle with an automatic check fails the gate when the check fails, unless it is marked as advice.
- AC-3: principles can be delivered the way the organization already shares specifications.
- AC-4: a change of behaviour since the base that names no requirement and touches no requirement's test is reported, with the change and its files.
- AC-5: a team can make that report block the merge.
- AC-6: a requirement that names an interface operation fails validation when the operation does not exist.
- AC-7: one command lists the operations no requirement covers and the requirements naming operations that do not exist.
- AC-8: adoption can be limited to one area, and says so in what it writes.
- AC-9: adoption says when it found more areas than a person can review, and how to start with one.
