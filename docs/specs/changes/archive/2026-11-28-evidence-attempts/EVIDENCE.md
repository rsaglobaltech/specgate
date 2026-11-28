# Evidence — evidence-attempts

> Written by `specgate evidence evidence-attempts` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-819 — A failed delivery is kept as an attempt

- No before: `specgate evidence before REQ-819`
- No screenshots: `specgate doctor` says how to have the runner keep them

### Flaky, then delivered

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title Flaky, then delivered
  actor A as Developer
  participant S as System
  Note over A,S: REQ-031 whose scenarios fail twice — the AI log saying `{"category":"A"}` — and then pass
  A->>S: the Developer runs `specgate apply REQ-031` three times, then `specgate evidence draft-orders`
  S-->>A: attempts 1 and 2 are kept, the first refusal names `attempts/1`, `evidence.json` lists both, and the page's "Failed attempts" shows each with `Received: 202` and `{"category":"A"}`
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
  class ScenarioRun {
    <<interface>>
    +command : string
    +exitCode : number
    +ms : number
    +output : string
    +startedAt : number
  }
  class Attempt {
    <<interface>>
    +n : number
    +command : string
    +exitCode : number
    +at : string
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
  style Attempt fill:#fff4d6,stroke:#b7791f,stroke-width:2px
```

New since the base: `ScenarioOutcome`, `RequirementDiagrams`, `PageRequirement`, `Side`, `Picture`, `CallPair`, `RequirementEvidence`, `AttemptEvidence`, `HttpCall`. Changed: `Attempt` — added `+n : number`, `+command : string`, `+exitCode : number`, `+at : string` — removed `+road : string`, `+input`.

<details><summary>At the base</summary>

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class ScenarioRun {
    <<interface>>
    +command : string
    +exitCode : number
    +ms : number
    +output : string
    +startedAt : number
  }
  class Attempt {
    <<interface>>
    +road : string
    +input
  }
```

</details>
