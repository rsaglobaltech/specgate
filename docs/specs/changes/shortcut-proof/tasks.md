# Tasks

> Owner: developer — each task is verifiable and names the requirement it
> delivers (REQ-NNN).

## 1. Specification

- [x] 1.1 Write the delta spec for each affected capability
- [x] 1.2 Run `specgate change validate`

## 2. Implementation

- [ ] 2.1 REQ-742 — source written by any means before its test stops the session
- [ ] 2.2 REQ-743 — step definitions changed after the code began fail the gate
- [ ] 2.3 REQ-744 — a delivery says the source files its design does not name

## 3. Proof

- [ ] 3.1 REQ-742, REQ-743, REQ-744 — run the exam again with the model that took the shortcuts: trap, trap-scenarios, unrequested, with Specgate, in the sandbox
