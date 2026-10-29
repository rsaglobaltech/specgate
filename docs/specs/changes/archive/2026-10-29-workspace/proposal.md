# Proposal: workspace

## Intent

Item 1 of [enterprise-sdd-gap.md](../../../enterprise-sdd-gap.md), the first piece of
the 1.0 line: a product made of several repositories — services, a web app,
a contracts repository — has no place that knows them all. Specgate's gate is
one repository's; a business story that crosses three of them, a requirement
of one that waits for an API of another, and "where does the product stand"
had no answer.

## Scope

- `specgate.workspace.yaml` in a workspace repository names the members, their
  path, URL, role and capabilities; `workspace init` writes it (REQ-290).
- `workspace status`: each member's requirements, branch and last gate (REQ-291),
  as a JSON model other views build on (REQ-298).
- `workspace check`: each member's own `specgate check`, aggregated (REQ-292);
  qualified ids `<repo>:REQ-NNN` resolved (REQ-293); a dependency on another
  member's requirement waits until it is delivered (REQ-295).
- Inside a member, `REQ-NNN` stays the id, and `depends=<repo>:REQ-NNN` is left
  to the workspace (REQ-294).
- A workspace story: `workspace propose <story> --repos …` opens a change in each
  member, linked back (REQ-296); the story is done when every member archived its
  part (REQ-297).

The model is ADR-0041.
