# Evidence — trace-values

> Written by `specgate evidence trace-values` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-798 — A trace value cut at a space is reported, and read alike everywhere

- No before: `specgate evidence before REQ-798`
- No screenshots: `specgate doctor` says how to have the runner keep them

### An unquoted actor with a space

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title An unquoted actor with a space
  actor A as Developer
  participant S as System
  Note over A,S: a requirement whose trace says `actor=Adulto responsable kind=functional`
  A->>S: `specgate validate` runs
  S-->>A: it warns that `actor=Adulto responsable` is read as `actor=Adulto`, and to write `actor="Adulto responsable"`
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### A quoted actor

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title A quoted actor
  actor A as Developer
  participant S as System
  Note over A,S: a requirement whose trace says `actor="Adulto responsable"`
  A->>S: the domain view and the actors diagram read it
  S-->>A: its actor is `Adulto responsable`, and `specgate validate` warns about nothing in it
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
  class ViewFlow {
    <<interface>>
    +actor : string | null
    +command : string | null
    +policy : string | null
    +trigger : string | null
    +outcomes : string[]
    +systems : string[]
    +views : string[]
    +placed : string
    +requirement : string
  }
  class ViewStep {
    <<interface>>
    +n : number
    +actor : string
    +activity : string
    +object : string
    +to : string[]
  }
  class ViewStory {
    <<interface>>
    +title : string
    +primaryActor : string | null
    +actorKinds : Record~string, string~
    +steps : ViewStep[]
    +comments : string[]
  }
  class ViewIntegration {
    <<interface>>
    +direction : 'inbound' | 'outbound'
    +with : string
    +kind : string
    +relationship : string | null
    +messages : Array~
  }
  class ViewModule {
    <<interface>>
    +slug : string
    +name : string
    +purpose : string
    +classification
    +roles : string[]
    +integrations : ViewIntegration[]
    +terms : Array~
    +rules : string[]
    +flows : ViewFlow[]
    +stories : ViewStory[]
    +views : string[]
    +questions : string[]
    +assumptions : string
    +metrics : string
  }
  class DomainView {
    <<interface>>
    +source : 'workshop' | 'spec'
    +modules : ViewModule[]
  }
  class SpecRequirement {
    <<interface>>
    +id : string
    +title : string
    +module : string
    +actor : string | null
    +scenarios : string[]
  }
  class SpecUseCase {
    <<interface>>
    +id : string
    +name : string
    +actor : string | null
    +module : string | null
    +steps : Array~
  }
  class ValidateSpecsCommand {
    -io : AgentIo | null
    -notes : Diagnostic[]
    -reportedOnly
    -failsOnTemplateObligations
    -policyNote
    -checkStateMachines(targetDir : string, traceContent : string)
    -checkApprovedRequirements(targetDir : string, ids : string[])
    -agent() AgentIo
    -logInfo(msg : string)
    -logError(msg : string)
    -usage()
    -logFix(lines : string | string[])
    -failOnOldFormat(targetDir : string)
    -warnUnreadTraces(targetDir : string)
    -logWarn(msg : string)
    -checkUseCases(targetDir : string, traceContent : string)
    -reportOnly(rule : Rule, findings : readonly Diagnostic[]) boolean
    -isAdoptionSkeletonOnly(targetDir : string, featureFiles : string[])
    -fail(code : string, msg : string, exitCode, fix : string | string[] | null)
    -sharedSpecDrift(rootDir : string, projectRel : string) string[]
    -validateMonorepo(targetDir : string, strictTdd : boolean, strictScenarios : boolean, strictRequirements : boolean, strictLinks : boolean, strictCoverage : boolean)
    -checkScenarioQuality(targetDir : string, featureFiles : string[], delivering)
    -featureFilesOwed(targetDir : string, delivering : string) (rel: string) =~boolean
    -checkScenarioTags(targetDir : string, traceContent : string)
  }
  class AgentDocument {
    <<interface>>
    +status : Diagnostic[]
  }
  class AgentIo {
    <<interface>>
    +json : boolean
    +emit(payload : AgentDocument, renderHuman : ())*
    +emitAndGate(payload : AgentDocument, renderHuman : ())*
    +fail(nullShape : AgentDocument, diags : Diagnostic[])* never
    +usage(nullShape : AgentDocument, diags : Diagnostic[])* never
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
  BaseCommand <|-- ValidateSpecsCommand
  ICommand <|.. BaseCommand
  ViewStory --> "0..*" ViewStep : steps
  ViewModule --> "0..*" ViewIntegration : integrations
  ViewModule --> "0..*" ViewFlow : flows
  ViewModule --> "0..*" ViewStory : stories
  DomainView --> "0..*" ViewModule : modules
  ValidateSpecsCommand --> "1" AgentIo : io
  ValidateSpecsCommand --> "0..*" Diagnostic : notes
  AgentDocument --> "0..*" Diagnostic : status
  AgentIo ..> AgentDocument
  AgentIo ..> Diagnostic
  style Diagnostic fill:#fff4d6,stroke:#b7791f,stroke-width:2px
  style ValidateSpecsCommand fill:#fff4d6,stroke:#b7791f,stroke-width:2px
```

Changed: `Diagnostic` — added `+code : string`, `+target : string`, `+fix : string`, `+file : string`, `+line : number`. Changed: `ValidateSpecsCommand` — `warnUnreadTraces()` rewritten.

<details><summary>At the base</summary>

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class CreateSpecDrivenAppCommand {
    +execute(args : string[])
  }
  class Diagnostic {
    <<interface>>
    +message : string
    +severity : 'error' | 'warning' | 'info'
  }
  class ViewFlow {
    <<interface>>
    +actor : string | null
    +command : string | null
    +policy : string | null
    +trigger : string | null
    +outcomes : string[]
    +systems : string[]
    +views : string[]
    +placed : string
    +requirement : string
  }
  class ViewStep {
    <<interface>>
    +n : number
    +actor : string
    +activity : string
    +object : string
    +to : string[]
  }
  class ViewStory {
    <<interface>>
    +title : string
    +primaryActor : string | null
    +actorKinds : Record~string, string~
    +steps : ViewStep[]
    +comments : string[]
  }
  class ViewIntegration {
    <<interface>>
    +direction : 'inbound' | 'outbound'
    +with : string
    +kind : string
    +relationship : string | null
    +messages : Array~
  }
  class ViewModule {
    <<interface>>
    +slug : string
    +name : string
    +purpose : string
    +classification
    +roles : string[]
    +integrations : ViewIntegration[]
    +terms : Array~
    +rules : string[]
    +flows : ViewFlow[]
    +stories : ViewStory[]
    +views : string[]
    +questions : string[]
    +assumptions : string
    +metrics : string
  }
  class DomainView {
    <<interface>>
    +source : 'workshop' | 'spec'
    +modules : ViewModule[]
  }
  class SpecRequirement {
    <<interface>>
    +id : string
    +title : string
    +module : string
    +actor : string | null
    +scenarios : string[]
  }
  class SpecUseCase {
    <<interface>>
    +id : string
    +name : string
    +actor : string | null
    +module : string | null
    +steps : Array~
  }
  class ValidateSpecsCommand {
    -io : AgentIo | null
    -notes : Diagnostic[]
    -reportedOnly
    -failsOnTemplateObligations
    -policyNote
    -checkStateMachines(targetDir : string, traceContent : string)
    -checkApprovedRequirements(targetDir : string, ids : string[])
    -agent() AgentIo
    -logInfo(msg : string)
    -logError(msg : string)
    -usage()
    -logFix(lines : string | string[])
    -failOnOldFormat(targetDir : string)
    -warnUnreadTraces(targetDir : string)
    -logWarn(msg : string)
    -checkUseCases(targetDir : string, traceContent : string)
    -reportOnly(rule : Rule, findings : readonly Diagnostic[]) boolean
    -isAdoptionSkeletonOnly(targetDir : string, featureFiles : string[])
    -fail(code : string, msg : string, exitCode, fix : string | string[] | null)
    -sharedSpecDrift(rootDir : string, projectRel : string) string[]
    -validateMonorepo(targetDir : string, strictTdd : boolean, strictScenarios : boolean, strictRequirements : boolean, strictLinks : boolean, strictCoverage : boolean)
    -checkScenarioQuality(targetDir : string, featureFiles : string[], delivering)
    -featureFilesOwed(targetDir : string, delivering : string) (rel: string) =~boolean
    -checkScenarioTags(targetDir : string, traceContent : string)
  }
  class AgentDocument {
    <<interface>>
    +status : Diagnostic[]
  }
  class AgentIo {
    <<interface>>
    +json : boolean
    +emit(payload : AgentDocument, renderHuman : ())*
    +emitAndGate(payload : AgentDocument, renderHuman : ())*
    +fail(nullShape : AgentDocument, diags : Diagnostic[])* never
    +usage(nullShape : AgentDocument, diags : Diagnostic[])* never
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
  BaseCommand <|-- ValidateSpecsCommand
  ICommand <|.. BaseCommand
  ViewStory --> "0..*" ViewStep : steps
  ViewModule --> "0..*" ViewIntegration : integrations
  ViewModule --> "0..*" ViewFlow : flows
  ViewModule --> "0..*" ViewStory : stories
  DomainView --> "0..*" ViewModule : modules
  ValidateSpecsCommand --> "1" AgentIo : io
  ValidateSpecsCommand --> "0..*" Diagnostic : notes
  AgentDocument --> "0..*" Diagnostic : status
  AgentIo ..> AgentDocument
  AgentIo ..> Diagnostic
```

</details>
