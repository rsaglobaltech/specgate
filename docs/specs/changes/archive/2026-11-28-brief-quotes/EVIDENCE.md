# Evidence — brief-quotes

> Written by `specgate evidence brief-quotes` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-799 — A requirement's brief quote is in the brief

- No before: `specgate evidence before REQ-799`
- No screenshots: `specgate doctor` says how to have the runner keep them

### A quote the brief never wrote

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title A quote the brief never wrote
  actor A as Developer
  participant S as System
  Note over A,S: a brief that says "A member recovers access with their email." and REQ-011 quoting `> Brief: "Access is never recovered."`
  A->>S: the draft is checked
  S-->>A: `D17_quote_not_in_brief` names REQ-011 at the quote's line
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### The brief's sentence, wrapped and quoted

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title The brief's sentence, wrapped and quoted
  actor A as Developer
  participant S as System
  Note over A,S: the same brief, its sentence wrapped over two lines, and REQ-011 quoting `> Brief: "A member *recovers* access with their email"`
  A->>S: the draft is checked
  S-->>A: no `D17_quote_not_in_brief` is reported
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### Classes — TypeScript

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class Diagnostic {
    <<interface>>
    +severity : 'error' | 'warning' | 'info'
    +code : string
    +message : string
    +target : string
    +fix : string
    +file : string
    +line : number
  }
  class DraftFiles {
    <<interface>>
    +language : string | null
    +deltas : ReadonlyArray~
    +brief : string
    +assumptions : string
    +archivedAssumptions : string
    +specText : string
    +idsInUse : ReadonlyMap~string, string~
    +questions : string
    +maxRequirements : number
    +specs : ReadonlyArray~
    +useCases : string
    +catalog : string
    +useCaseSpecs : Readonly~Record~string, string~~
    +stateMachines : ReadonlyArray~
  }
  class DraftReport {
    <<interface>>
    +requirements : number
    +scenarios : number
    +skipped : ReadonlyArray~
    +status : Diagnostic[]
  }
  class Req {
    <<interface>>
    +id : string
    +name : string
    +text : string
    +line : number
    +file : string
    +trace : Record~string, string~
    +scenarios : Array~
    +modified : boolean
  }
  DraftReport --> "0..*" Diagnostic : status
  style Diagnostic fill:#fff4d6,stroke:#b7791f,stroke-width:2px
```

Changed: `Diagnostic` — added `+code : string`, `+target : string`, `+fix : string`, `+file : string`, `+line : number`.

<details><summary>At the base</summary>

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class Diagnostic {
    <<interface>>
    +message : string
    +severity : 'error' | 'warning' | 'info'
  }
  class DraftFiles {
    <<interface>>
    +language : string | null
    +deltas : ReadonlyArray~
    +brief : string
    +assumptions : string
    +archivedAssumptions : string
    +specText : string
    +idsInUse : ReadonlyMap~string, string~
    +questions : string
    +maxRequirements : number
    +specs : ReadonlyArray~
    +useCases : string
    +catalog : string
    +useCaseSpecs : Readonly~Record~string, string~~
    +stateMachines : ReadonlyArray~
  }
  class DraftReport {
    <<interface>>
    +requirements : number
    +scenarios : number
    +skipped : ReadonlyArray~
    +status : Diagnostic[]
  }
  class Req {
    <<interface>>
    +id : string
    +name : string
    +text : string
    +line : number
    +file : string
    +trace : Record~string, string~
    +scenarios : Array~
    +modified : boolean
  }
  DraftReport --> "0..*" Diagnostic : status
```

</details>
