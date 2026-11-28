# Evidence — brief-guides

> Written by `specgate evidence brief-guides` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-796 — The brief's guides are printed on request

- No before: `specgate evidence before REQ-796`
- No screenshots: `specgate doctor` says how to have the runner keep them

### The cards guide

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title The cards guide
  actor A as Developer
  participant S as System
  Note over A,S: `docs/brief.md` whose front matter lists `courses` and `lessons`, and no `#35;#35; Module:` section
  A->>S: `specgate propose --from-brief --guide cards` runs
  S-->>A: it prints the guide to propose the module sections, naming `courses` and `lessons`, and `docs/specs/BRIEF-CARDS.md` does not exist
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### The setup guide while the front matter has problems

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title The setup guide while the front matter has problems
  actor A as Developer
  participant S as System
  Note over A,S: `docs/brief.md` whose front matter lists no module
  A->>S: `specgate propose --from-brief --guide setup` runs
  S-->>A: it prints the guide to propose the front matter, and `docs/specs/BRIEF-SETUP.md` does not exist
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### No module to write cards for

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title No module to write cards for
  actor A as Developer
  participant S as System
  Note over A,S: `docs/brief.md` whose front matter lists no module
  A->>S: `specgate propose --from-brief --guide cards --json` runs
  S-->>A: it fails with `draft_guide_no_modules`, whose fix names `--guide setup`
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

## REQ-797 — The draft skill sends the agent to a guide that exists

- No before: `specgate evidence before REQ-797`
- No screenshots: `specgate doctor` says how to have the runner keep them

### The step names the command

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title The step names the command
  actor A as Developer
  participant S as System
  Note over A,S: the `draft` step as `specgate agents init` writes it
  A->>S: an agent reads it
  S-->>A: it names `specgate propose --from-brief --guide setup` and `--guide cards`, and neither `docs/specs/BRIEF-SETUP.md` nor `docs/specs/BRIEF-CARDS.md`
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### The overview names the cards guide

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title The overview names the cards guide
  actor A as Developer
  participant S as System
  Note over A,S: `docs/brief.md` with a complete front matter listing `courses` and `lessons`, and no `#35;#35; Module:` section
  A->>S: `specgate propose --from-brief` runs
  S-->>A: its output names `specgate propose --from-brief --guide cards`
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.
