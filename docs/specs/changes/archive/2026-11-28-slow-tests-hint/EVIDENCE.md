# Evidence — slow-tests-hint

> Written by `specgate evidence slow-tests-hint` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-802 — A slow delivery names the faster command

- No before: `specgate evidence before REQ-802`
- No screenshots: `specgate doctor` says how to have the runner keep them

### The whole suite, slowly

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title The whole suite, slowly
  actor A as Developer
  participant S as System
  Note over A,S: `test_cmd` is `node slow.js`, which takes longer than the limit, and no `test_cmd_affected`
  A->>S: the Developer runs `specgate apply REQ-001`
  S-->>A: REQ-001 is Implemented, and the output names `specgate config set test_cmd_affected "node slow.js {files}"` and `docs/fast-gate.md`
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### Already scoped

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title Already scoped
  actor A as Developer
  participant S as System
  Note over A,S: the same slow command, as `test_cmd_affected` with `{files}`
  A->>S: the Developer runs `specgate apply REQ-001`
  S-->>A: the output does not name `test_cmd_affected`
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.
