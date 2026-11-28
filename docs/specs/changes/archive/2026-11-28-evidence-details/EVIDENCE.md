# Evidence — evidence-details

> Written by `specgate evidence evidence-details` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-815 — The page says why each scenario was red

- No before: `specgate evidence before REQ-815`
- No screenshots: `specgate doctor` says how to have the runner keep them

### Red before, green after

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title Red before, green after
  actor A as Developer
  participant S as System
  Note over A,S: REQ-031 whose before log has `✘ … › Paying @REQ-031 (18.7s)` failing at `Then the response is 422` with `Expected: 422` and `Received: 500`, and whose after log has `✓ … › Paying @REQ-031 (10.5s)`
  A->>S: the Developer runs `specgate evidence draft-orders`
  S-->>A: the page's row for Paying shows ✘ 18.7s with `Expected: 422 · Received: 500` before, and ✓ 10.5s after
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

## REQ-816 — The page shows each call to the service, before and after

- No before: `specgate evidence before REQ-816`
- No screenshots: `specgate doctor` says how to have the runner keep them

### 500 then 422

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title 500 then 422
  actor A as Developer
  participant S as System
  Note over A,S: REQ-031's before trace with `POST /api/orders` answered 500, and its after trace with the same call answered 422 `{"code":"order_unclear"}`, and a `POST /api/session` answered `{"token":"abc"}`
  A->>S: the Developer runs `specgate evidence draft-orders`
  S-->>A: the page shows `POST /api/orders` with 500 before and 422 after, the after's body with `order_unclear`, and the session's token as `«hidden»`, never `abc`
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### Classes — TypeScript

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class CreateSpecDrivenAppCommand {
    +execute(args : string[])
  }
  class ScenarioOutcome {
    <<interface>>
    +scenario : string
    +passed : boolean
    +time : string
    +step : string
    +reason : ReadonlyArray~string~
  }
  class Finding {
    <<interface>>
    +level : 'ok' | 'warn' | 'error'
    +check : string
    +detail : string
    +fix : string
  }
  class DoctorCommand {
    -findings : Finding[]
    +const
    -ok(check : string, detail : string)
    -warn(check : string, detail : string, fix : string)
    -recordError(check : string, detail : string, fix : string)
    -walk(dir : string) string[]
    -readIfExists(p : string) string | null
    -describeInstall()
    -checkEnvironment()
    -checkStructure(dir : string)
    -readSpecTree(dir : string) string | null
    -checkTraceability(dir : string)
    +if(spec)
  }
  class ICommand {
    <<interface>>
    +execute(args : string[])* Promise~void~| void
  }
  class BaseCommand {
    <<abstract>>
    #args : string[]
    +BaseCommand(args : string[])
    +execute()* Promise~void~| void
    #error(msg : string)
    #info(msg : string)
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
  class BriefData {
    <<interface>>
    +exists : boolean
    +markdown : string
    +findings : Finding[]
  }
  class StatusAnswer {
    <<interface>>
    +schemaVersion : 1
    +projectDir : string
    +total : number
    +pending : number
    +counts : Record~string, number~
    +orphanFeatures : string[]
    +packs : unknown[]
    +requirements : Array~
    +brief
    +nextCommand : string | null
    +status : Finding[]
  }
  ICommand <|.. CreateSpecDrivenAppCommand
  BaseCommand <|-- DoctorCommand
  ICommand <|.. BaseCommand
  DoctorCommand --> "0..*" Finding : findings
  CallPair --> "1" HttpCall : before
  CallPair --> "1" HttpCall : after
  RequirementEvidence --> "0..*" CallPair : calls
  RequirementEvidence --> "0..*" AttemptEvidence : attempts
  RequirementEvidence --> "1" RequirementDiagrams : diagrams
  AttemptEvidence --> "0..*" ScenarioOutcome : failed
  BriefData --> "0..*" Finding : findings
  StatusAnswer --> "0..*" Finding : status
  style ScenarioOutcome fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style RequirementDiagrams fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style PageRequirement fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style Side fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style Picture fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style CallPair fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style RequirementEvidence fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style AttemptEvidence fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style HttpCall fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style Finding fill:#fff4d6,stroke:#b7791f,stroke-width:2px
```

New since the base: `ScenarioOutcome`, `RequirementDiagrams`, `PageRequirement`, `Side`, `Picture`, `CallPair`, `RequirementEvidence`, `AttemptEvidence`, `HttpCall`. Changed: `Finding` — added `+level : 'ok' | 'warn' | 'error'`, `+check : string`, `+detail : string` — removed `+severity : 'error' | 'warning' | 'info'`, `+code : string`, `+message : string`, `+target : string`, `+file : string`, `+line : number`.

<details><summary>At the base</summary>

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class CreateSpecDrivenAppCommand {
    +execute(args : string[])
  }
  class Finding {
    <<interface>>
    +severity : 'error' | 'warning' | 'info'
    +code : string
    +message : string
    +target : string
    +fix : string
    +file : string
    +line : number
  }
  class DoctorCommand {
    -findings : Finding[]
    +const
    -ok(check : string, detail : string)
    -warn(check : string, detail : string, fix : string)
    -recordError(check : string, detail : string, fix : string)
    -walk(dir : string) string[]
    -readIfExists(p : string) string | null
    -describeInstall()
    -checkEnvironment()
    -checkStructure(dir : string)
    -readSpecTree(dir : string) string | null
    -checkTraceability(dir : string)
    +if(spec)
  }
  class ICommand {
    <<interface>>
    +execute(args : string[])* Promise~void~| void
  }
  class BaseCommand {
    <<abstract>>
    #args : string[]
    +BaseCommand(args : string[])
    +execute()* Promise~void~| void
    #error(msg : string)
    #info(msg : string)
  }
  class BriefData {
    <<interface>>
    +exists : boolean
    +markdown : string
    +findings : Finding[]
  }
  class StatusAnswer {
    <<interface>>
    +schemaVersion : 1
    +projectDir : string
    +total : number
    +pending : number
    +counts : Record~string, number~
    +orphanFeatures : string[]
    +packs : unknown[]
    +requirements : Array~
    +brief
    +nextCommand : string | null
    +status : Finding[]
  }
  ICommand <|.. CreateSpecDrivenAppCommand
  BaseCommand <|-- DoctorCommand
  ICommand <|.. BaseCommand
  DoctorCommand --> "0..*" Finding : findings
  BriefData --> "0..*" Finding : findings
  StatusAnswer --> "0..*" Finding : status
```

</details>

## REQ-817 — The page shows what the AI model decided

- No before: `specgate evidence before REQ-817`
- No screenshots: `specgate doctor` says how to have the runner keep them

### The model's verdict

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title The model's verdict
  actor A as Developer
  participant S as System
  Note over A,S: a `bdd_cmd` that writes `{"model":"llama3.2","input":"Haz eso","output":{"category":"C"},"ms":812}` to `$SPECGATE_AI_LOG`
  A->>S: the Developer runs `specgate evidence before REQ-031`, then `specgate evidence draft-orders`
  S-->>A: the page shows, before, `llama3.2`, `Haz eso`, `{"category":"C"}` and `812 ms`
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
