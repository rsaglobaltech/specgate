# Evidence — evidence-html

> Written by `specgate evidence evidence-html` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-818 — The evidence as one web page

- No before: `specgate evidence before REQ-818`
- No screenshots: `specgate doctor` says how to have the runner keep them

### One page, pictures inside

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title One page, pictures inside
  actor A as Developer
  participant S as System
  Note over A,S: draft-orders whose REQ-031 has a before and an after, each with a screenshot
  A->>S: the Developer runs `specgate evidence draft-orders --html`
  S-->>A: EVIDENCE.html exists beside EVIDENCE.md, holds both screenshots as `data:image/png#59;base64` and REQ-031's title, loads Mermaid from `cdn.jsdelivr.net/npm/mermaid@`, and names no file it needs beside it
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### Classes — TypeScript

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class ScenarioOutcome {
    <<interface>>
    +scenario : string
    +passed : boolean
    +time : string
    +step : string
    +reason : ReadonlyArray~string~
  }
  class RequirementDiagrams {
    <<interface>>
    +base : string
    +sequences : Array~
    +classes : Array~
  }
  class PageRequirement {
    <<interface>>
    +id : string
    +title : string
    +before : boolean
    +after : boolean
    +screenshots : number
    +sequences : number
    +classes : number
  }
  class Side {
    <<interface>>
    +name : 'before' | 'after'
    +doc
    +from : string
  }
  class Picture {
    <<interface>>
    +source : string
    +copied : string
    +tooBig : boolean
  }
  class CallPair {
    <<interface>>
    +key : string
    +before : HttpCall
    +after : HttpCall
    +changed : boolean
  }
  class RequirementEvidence {
    <<interface>>
    +id : string
    +title : string
    +hasBefore : boolean
    +hasAfter : boolean
    +screens : ReadonlyArray~
    +tooBig : ReadonlyArray~string~
    +media : ReadonlyArray~string~
    +scenarios : ReadonlyArray~
    +calls : ReadonlyArray~CallPair~
    +ai : ReadonlyArray~
    +attempts : ReadonlyArray~AttemptEvidence~
    +diagrams : RequirementDiagrams
    +checks : ReadonlyArray~
  }
  class AttemptEvidence {
    <<interface>>
    +n : number
    +failed : ReadonlyArray~ScenarioOutcome~
    +ai : ReadonlyArray~Record~string, unknown~~
  }
  class HttpCall {
    <<interface>>
    +method : string
    +path : string
    +status : number
    +statusText : string
    +ms : number
    +request : string
    +response : string
  }
  CallPair --> "1" HttpCall : before
  CallPair --> "1" HttpCall : after
  RequirementEvidence --> "0..*" CallPair : calls
  RequirementEvidence --> "0..*" AttemptEvidence : attempts
  RequirementEvidence --> "1" RequirementDiagrams : diagrams
  AttemptEvidence --> "0..*" ScenarioOutcome : failed
  style ScenarioOutcome fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style RequirementDiagrams fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style PageRequirement fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style Side fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style Picture fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style CallPair fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style RequirementEvidence fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style AttemptEvidence fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style HttpCall fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
```

New since the base: `ScenarioOutcome`, `RequirementDiagrams`, `PageRequirement`, `Side`, `Picture`, `CallPair`, `RequirementEvidence`, `AttemptEvidence`, `HttpCall`.

New since the base.
