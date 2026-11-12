# Tasks

## 1. Specification

- [x] 1.1 Write the delta spec (REQ-520 … REQ-527)
- [x] 1.2 Run `specgate change validate`

## 2. Implementation

- [ ] 2.1 REQ-520 — agent ask proposes a plan and writes nothing
- [ ] 2.2 REQ-521 — mentions in the request become the agent's context
- [ ] 2.3 REQ-522 — a plan is kept in the git folder until it is applied or discarded
- [ ] 2.4 REQ-523 — in spec mode the agent may change only the specification
- [ ] 2.5 REQ-524 — apply writes exactly the plan, and only on the base it was made on
- [ ] 2.6 REQ-525 — apply runs the plan's checks and says what they found
- [ ] 2.7 REQ-526 — no agent, a failing agent and an empty plan are answers
- [ ] 2.8 REQ-527 — the agent's plans through the API
- [ ] 2.9 the CHANGELOG, `types/api.d.ts`, `docs/agent-ask.md`, the command reference and the agent contract
