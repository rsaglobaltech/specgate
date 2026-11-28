# Evidence — matrix-line-endings

> Written by `specgate evidence matrix-line-endings` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-808 — A matrix checked out with CRLF is current

- No before: `specgate evidence before REQ-808`
- No screenshots: `specgate doctor` says how to have the runner keep them

### CRLF, same rows

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title CRLF, same rows
  actor A as Developer
  participant S as System
  Note over A,S: a project whose generated matrix is current, rewritten with CRLF line endings
  A->>S: the Developer runs `specgate validate`
  S-->>A: no `matrix_stale` is reported
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### CRLF, a row changed

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title CRLF, a row changed
  actor A as Developer
  participant S as System
  Note over A,S: the same matrix with CRLF line endings and one row's status changed
  A->>S: the Developer runs `specgate validate`
  S-->>A: `matrix_stale` is reported
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.
