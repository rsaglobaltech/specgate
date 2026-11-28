# Evidence — urbanops-run

> Written by `specgate evidence urbanops-run` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-820 — Determining whether is no condition

- No before: `specgate evidence before REQ-820`
- No screenshots: `specgate doctor` says how to have the runner keep them

### The operator determines whether

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title The operator determines whether
  actor A as Product
  participant S as System
  Note over A,S: a module whose rule is "El operador determina si el reporte corresponde a un servicio municipal."
  A->>S: the Product owner runs `specgate propose --from-brief --check`
  S-->>A: no `B11_condition_last` is listed for it, and "La incidencia se cierra si el técnico la resuelve." still has one
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### Classes — TypeScript

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class Card {
    <<interface>>
    +text : string
    +line : number
  }
  class ModuleSection {
    <<interface>>
    +name : string
    +line : number
    +source : string
    +prose : string
    +rules : readonly Card[]
    +examples : readonly Card[]
    +questions : readonly Card[]
  }
  class BriefBody {
    <<interface>>
    +text : string
    +modules : readonly ModuleSection[]
  }
  ModuleSection --> "0..*" Card : rules
  ModuleSection --> "0..*" Card : examples
  ModuleSection --> "0..*" Card : questions
  BriefBody --> "0..*" ModuleSection : modules
```

<details><summary>At the base</summary>

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class Card {
    <<interface>>
    +text : string
    +line : number
  }
  class ModuleSection {
    <<interface>>
    +name : string
    +line : number
    +source : string
    +prose : string
    +rules : readonly Card[]
    +examples : readonly Card[]
    +questions : readonly Card[]
  }
  class BriefBody {
    <<interface>>
    +text : string
    +modules : readonly ModuleSection[]
  }
  ModuleSection --> "0..*" Card : rules
  ModuleSection --> "0..*" Card : examples
  ModuleSection --> "0..*" Card : questions
  BriefBody --> "0..*" ModuleSection : modules
```

</details>

## REQ-821 — On main, the evidence compares with the commit before the change

- No before: `specgate evidence before REQ-821`
- No screenshots: `specgate doctor` says how to have the runner keep them

### Delivered on main

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title Delivered on main
  actor A as Developer
  participant S as System
  Note over A,S: a project on `main` whose change `draft-orders` was committed, then `Orders.refund()` added in a later commit
  A->>S: the Developer runs `specgate evidence draft-orders`
  S-->>A: EVIDENCE.md says "Changed: `Orders` — added `+refund()`", not "Unchanged since the base"
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

## REQ-822 — The adoption baseline is not a feature runner's scenario

- No before: `specgate evidence before REQ-822`
- No screenshots: `specgate doctor` says how to have the runner keep them

### Migrated with the baseline

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title Migrated with the baseline
  actor A as Developer
  participant S as System
  Note over A,S: a project with `features/adoption/baseline.feature` untagged and `bdd: required`
  A->>S: the Developer runs `specgate check`, then `specgate migrate bdd`, then `specgate check` again
  S-->>A: the first check warns `bdd_baseline_runs`, the migration tags the scenario `@skip` and says so, and the second check does not warn
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
  class MigrateCommand {
    +execute()
  }
  class ChangeFeature {
    <<interface>>
    +requirement : string
    +file : string
    +contents : string
    +scenarios : string[]
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
  ICommand <|.. CreateSpecDrivenAppCommand
  BaseCommand <|-- MigrateCommand
  ICommand <|.. BaseCommand
  style MigrateCommand fill:#fff4d6,stroke:#b7791f,stroke-width:2px
```

Changed: `MigrateCommand` — `execute()` rewritten.

<details><summary>At the base</summary>

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class CreateSpecDrivenAppCommand {
    +execute(args : string[])
  }
  class MigrateCommand {
    +execute()
  }
  class ChangeFeature {
    <<interface>>
    +requirement : string
    +file : string
    +contents : string
    +scenarios : string[]
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
  ICommand <|.. CreateSpecDrivenAppCommand
  BaseCommand <|-- MigrateCommand
  ICommand <|.. BaseCommand
```

</details>

## REQ-823 — apply shows the scenarios as a stage

- No before: `specgate evidence before REQ-823`
- No screenshots: `specgate doctor` says how to have the runner keep them

### Delivered with its scenarios

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title Delivered with its scenarios
  actor A as Developer
  participant S as System
  Note over A,S: REQ-031 approved, with `bdd: required` and a `bdd_cmd` that passes for `@REQ-031`
  A->>S: the Developer runs `specgate apply REQ-031`
  S-->>A: the output shows `Scenarios` and the command after `Tests`, and REQ-031 is delivered
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

## REQ-824 — Each sequence says whether the run agrees

- No before: `specgate evidence before REQ-824`
- No screenshots: `specgate doctor` says how to have the runner keep them

### A refusal the code reading missed

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title A refusal the code reading missed
  actor A as Developer
  participant S as System
  Note over A,S: a screen's scenario whose sequence, read from the code, ends in `201 Created`, and the server's log recording `POST /api/orders` answered 422 during the scenario
  A->>S: the Developer runs `specgate evidence draft-orders`
  S-->>A: under the sequence the page says "Read from the code, and the run differs: it ends in `201 Created`#59; `POST /api/orders` answered 422."
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
  class SequenceCheck {
    <<interface>>
    +state : 'matches' | 'differs' | 'unchecked' | 'steps'
    +text : string
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
  style SequenceCheck fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style HttpCall fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style Attempt fill:#fff4d6,stroke:#b7791f,stroke-width:2px
```

New since the base: `ScenarioOutcome`, `RequirementDiagrams`, `PageRequirement`, `Side`, `Picture`, `CallPair`, `RequirementEvidence`, `AttemptEvidence`, `SequenceCheck`, `HttpCall`. Changed: `Attempt` — added `+n : number`, `+command : string`, `+exitCode : number`, `+at : string` — removed `+road : string`, `+input`.

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
