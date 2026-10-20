# Proposal: agent-contract-monorepo

## Intent

Found on a real project scaffolded by forja (Spring API in `apps/api`, Next.js
in `apps/web`, npm workspaces at the root): `AGENTS.md` said "Stack: Node.js".
The root `package.json` was read and `apps/api/pom.xml` never was — and an
agent that trusts its contract would write the domain in the wrong language.
The same contract said nothing about tickets, the way that project's work
arrives.

## Scope

In scope: stacks of a workspace monorepo's apps (REQ-153); the ticket path in
`AGENTS.md` (REQ-154).
