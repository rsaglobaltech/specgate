# Discover: roles-approvals

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

In a company, product, architecture, security and quality each answer for a
part of a change. Today one person approves the whole draft, nobody can tell
who agreed to which version, and a change keeps its approval after someone
rewrites what was agreed. The specialists who must constrain the work —
security, performance, infrastructure — have no place of their own: they can
only hope the agent reads the right page.

## Use case

1. The team says who holds each role.
2. Product approves the business story, the architect the design, the
   developers the tasks; each layer may need more than one person.
3. Nothing is built until every layer it needs is approved; a layer that is
   changed afterwards waits for a new approval.
4. Anyone can see who approved which version, also after the change is closed.
5. Each specialist role writes its own constraints once; they reach the work
   they concern, and the report says which were used.
6. In the studio, a person sees the approvals of each layer and approves the
   layer they own.

## Acceptance criteria

- AC-1: The team names the people of each role; a person outside a role cannot approve its layer.
- AC-2: Each layer has its own approvals, and how many it needs can be set.
- AC-3: Who approved which version of each layer is kept, also once the change is closed.
- AC-4: Changing an approved layer asks for its approval again.
- AC-5: Nothing is built from a change whose layers are not approved, unless the team keeps the old way.
- AC-6: A role's constraints reach the work they concern, and the report and the live view say which were used.
- AC-7: Each role's constraints are checked by a reviewer that only advises.
- AC-8: The studio shows the approvals of each layer and lets a person approve the layer they own.
