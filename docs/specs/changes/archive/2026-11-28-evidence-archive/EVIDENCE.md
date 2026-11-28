# Evidence — evidence-archive

> Written by `specgate evidence evidence-archive` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-813 — Archive closes the change's evidence

- No before: `specgate evidence before REQ-813`
- No screenshots: `specgate doctor` says how to have the runner keep them

### The page goes with the change

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title The page goes with the change
  actor A as Developer
  participant S as System
  Note over A,S: draft-orders, whose REQ-031 is Implemented with a before and an after, in a project with `bdd: required`
  A->>S: the Developer runs `specgate archive draft-orders`
  S-->>A: the archived change holds EVIDENCE.md with REQ-031's section
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### No before, required

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title No before, required
  actor A as Developer
  participant S as System
  Note over A,S: the same change with REQ-032 Implemented with no before, and `evidence: required`
  A->>S: the Developer runs `specgate archive draft-orders`
  S-->>A: it is refused with `archive_no_before` naming REQ-032#59; with `--force` it is archived
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
  class ChangeOptions {
    <<interface>>
    +projectDir : string
    +json : boolean
    +strict : boolean
    +rebased : boolean
    +dryRun : boolean
    +force : boolean
    +full : boolean
    +capability : string | null
    +fromValueDrift : string | null
    +req : string
    +layer : string
    +modify : string[]
    +schema : string
    +reserve : number
    +kind : string
    +yes : boolean
    +artifact : string
    +agent : string
    +agentProfile : string
    +positional : string[]
  }
  class CliCommand {
    +CliCommand(args : string[], verb : 'propose' | 'archive' | null)
    +execute()
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
  class GatePolicy {
    <<interface>>
    +source : 'file' | 'default'
    +preset : Preset
    +rules : Readonly~Record~Rule, Level~~
    +enforceFrom : string
    +bdd : 'required'
    +link : 'strict'
    +evidence : 'required'
    +problems : ReadonlyArray~
  }
  ICommand <|.. CreateSpecDrivenAppCommand
  BaseCommand <|-- CliCommand
  ICommand <|.. BaseCommand
  style GatePolicy fill:#fff4d6,stroke:#b7791f,stroke-width:2px
```

Changed: `GatePolicy` — added `+link : 'strict'`, `+evidence : 'required'`.

<details><summary>At the base</summary>

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class CreateSpecDrivenAppCommand {
    +execute(args : string[])
  }
  class ChangeOptions {
    <<interface>>
    +projectDir : string
    +json : boolean
    +strict : boolean
    +rebased : boolean
    +dryRun : boolean
    +force : boolean
    +full : boolean
    +capability : string | null
    +fromValueDrift : string | null
    +req : string
    +layer : string
    +modify : string[]
    +schema : string
    +reserve : number
    +kind : string
    +yes : boolean
    +artifact : string
    +agent : string
    +agentProfile : string
    +positional : string[]
  }
  class CliCommand {
    +CliCommand(args : string[], verb : 'propose' | 'archive' | null)
    +execute()
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
  class GatePolicy {
    <<interface>>
    +source : 'file' | 'default'
    +preset : Preset
    +rules : Readonly~Record~Rule, Level~~
    +enforceFrom : string
    +bdd : 'required'
    +problems : ReadonlyArray~
  }
  ICommand <|.. CreateSpecDrivenAppCommand
  BaseCommand <|-- CliCommand
  ICommand <|.. BaseCommand
```

</details>

## REQ-814 — The evidence page compares with the base the person names

- No before: `specgate evidence before REQ-814`
- No screenshots: `specgate doctor` says how to have the runner keep them

### The base named

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title The base named
  actor A as Developer
  participant S as System
  Note over A,S: a change whose code changed since the commit `base-tag`
  A->>S: the Developer runs `specgate evidence draft-orders --base base-tag`
  S-->>A: the diagrams at the base are those of `base-tag`
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
