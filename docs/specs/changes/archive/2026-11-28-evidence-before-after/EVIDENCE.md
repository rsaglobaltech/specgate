# Evidence — evidence-before-after

> Written by `specgate evidence evidence-before-after` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-803 — A requirement's run before its code is kept as its before

- No before: `specgate evidence before REQ-803`
- No screenshots: `specgate doctor` says how to have the runner keep them

### Before the code, red

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title Before the code, red
  actor A as Developer
  participant S as System
  Note over A,S: `bdd: required`, a `bdd_cmd` whose run for REQ-031 fails and writes `test-results/checkout/screenshot.png`
  A->>S: the Developer runs `specgate evidence before REQ-031`
  S-->>A: `.specgate/evidence/REQ-031/before/run.json` holds the command with `@REQ-031` and a non-zero exit code, and `before/artifacts/checkout/screenshot.png` exists
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### Classes — TypeScript

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
    +n : number
    +command : string
    +exitCode : number
    +at : string
  }
  class HelpRow {
    <<interface>>
    +group : string
    +icon : string
    +summary : string
    +order : number
  }
  class JsonContract {
    <<interface>>
    +key : string
    +gate : boolean
    +args : string
    +flag : string
  }
  class Subcommand {
    <<interface>>
    +name : string
    +script : string[]
    +argsFrom : number
    +help : HelpRow
    +json : JsonContract
    +mcp : string | boolean
    +mcpArg : string
    +editsContract : boolean
  }
  class Command {
    <<interface>>
    +name : string
    +script : string[]
    +subcommands : Subcommand[]
    +help : HelpRow
    +coreHelp : HelpRow
    +json : JsonContract
    +mcp : string | boolean
    +mcpArg : string
    +editsContract : boolean
  }
  class JsonContractRow {
    <<interface>>
    +command : string
    +nullShapeKey : string
    +gate : boolean
  }
  class HelpListing {
    <<interface>>
    +label : string
    +icon : string
    +summary : string
    +order : number
  }
  class HelpSection {
    <<interface>>
    +group : string
    +title : string
    +rows : HelpListing[]
  }
  Subcommand --> "1" HelpRow : help
  Subcommand --> "1" JsonContract : json
  Command --> "0..*" Subcommand : subcommands
  Command --> "1" HelpRow : help
  Command --> "1" HelpRow : coreHelp
  Command --> "1" JsonContract : json
  HelpSection --> "0..*" HelpListing : rows
  style Attempt fill:#fff4d6,stroke:#b7791f,stroke-width:2px
```

Changed: `Attempt` — added `+n : number`, `+command : string`, `+exitCode : number`, `+at : string` — removed `+road : string`, `+input`.

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
  class HelpRow {
    <<interface>>
    +group : string
    +icon : string
    +summary : string
    +order : number
  }
  class JsonContract {
    <<interface>>
    +key : string
    +gate : boolean
    +args : string
    +flag : string
  }
  class Subcommand {
    <<interface>>
    +name : string
    +script : string[]
    +argsFrom : number
    +help : HelpRow
    +json : JsonContract
    +mcp : string | boolean
    +mcpArg : string
    +editsContract : boolean
  }
  class Command {
    <<interface>>
    +name : string
    +script : string[]
    +subcommands : Subcommand[]
    +help : HelpRow
    +coreHelp : HelpRow
    +json : JsonContract
    +mcp : string | boolean
    +mcpArg : string
    +editsContract : boolean
  }
  class JsonContractRow {
    <<interface>>
    +command : string
    +nullShapeKey : string
    +gate : boolean
  }
  class HelpListing {
    <<interface>>
    +label : string
    +icon : string
    +summary : string
    +order : number
  }
  class HelpSection {
    <<interface>>
    +group : string
    +title : string
    +rows : HelpListing[]
  }
  Subcommand --> "1" HelpRow : help
  Subcommand --> "1" JsonContract : json
  Command --> "0..*" Subcommand : subcommands
  Command --> "1" HelpRow : help
  Command --> "1" HelpRow : coreHelp
  Command --> "1" JsonContract : json
  HelpSection --> "0..*" HelpListing : rows
```

</details>

## REQ-804 — A delivery keeps its after beside its before

- No before: `specgate evidence before REQ-804`
- No screenshots: `specgate doctor` says how to have the runner keep them

### Delivered after its before

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title Delivered after its before
  actor A as Developer
  participant S as System
  Note over A,S: REQ-031 with a before
  A->>S: `specgate apply REQ-031` delivers it with its scenarios green
  S-->>A: `.specgate/evidence/REQ-031/evidence.json` has exit code 0 and names the before's exit code, and `before/run.json` is unchanged
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### Classes — TypeScript

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
    +n : number
    +command : string
    +exitCode : number
    +at : string
  }
  style Attempt fill:#fff4d6,stroke:#b7791f,stroke-width:2px
```

Changed: `Attempt` — added `+n : number`, `+command : string`, `+exitCode : number`, `+at : string` — removed `+road : string`, `+input`.

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

## REQ-805 — Doctor says when the runner keeps no pictures

- No before: `specgate evidence before REQ-805`
- No screenshots: `specgate doctor` says how to have the runner keep them

### Playwright without screenshots

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title Playwright without screenshots
  actor A as Developer
  participant S as System
  Note over A,S: `bdd_cmd` runs `npx bddgen && npx playwright test`, and `playwright.config.ts` with no `screenshot:` under `use`
  A->>S: the Developer runs `specgate doctor`
  S-->>A: it warns `doctor_evidence_media`, its fix naming `screenshot: 'on'` and `video: 'on'`
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
  class QuestionsAnswer {
    <<interface>>
    +questions
    +status : Finding[]
  }
  class MatrixAnswer {
    <<interface>>
    +matrix
    +status : Finding[]
  }
  class ReportAnswer {
    <<interface>>
    +schemaVersion : 1
    +projectDir : string
    +total : number
    +implemented : number
    +pending : number
    +implementedPct : number
    +byCategory : Record~string, number~
    +needsTest : string[]
    +orphanFeatures : string[]
    +specops : unknown
    +requirements : Array~Record~string, unknown~&
    +declaredValues : unknown
    +coverage
    +capability : string
    +status : Finding[]
  }
  class GateStage {
    <<interface>>
    +stage : 'ids' | 'changes' | 'validate' | 'architecture' | 'tests' | 'quality'
    +name : string
    +gate : boolean
    +command : string | null
    +result : 'passed' | 'failed' | 'skipped' | 'not run'
    +ms : number | null
    +findings : Finding[]
  }
  class LastCheckAnswer {
    <<interface>>
    +lastCheck
    +status : Finding[]
  }
  class HarnessStopAnswer {
    <<interface>>
    +stop
    +status : Finding[]
  }
  class ChangeAnswer {
    <<interface>>
    +change
    +status : Finding[]
  }
  class BriefFormAnswer {
    <<interface>>
    +form : BriefForm
    +status : Finding[]
  }
  class AgentAskAnswer {
    <<interface>>
    +plan
    +status : Finding[]
  }
  ICommand <|.. CreateSpecDrivenAppCommand
  BaseCommand <|-- DoctorCommand
  ICommand <|.. BaseCommand
  DoctorCommand --> "0..*" Finding : findings
  BriefData --> "0..*" Finding : findings
  StatusAnswer --> "0..*" Finding : status
  QuestionsAnswer --> "0..*" Finding : status
  MatrixAnswer --> "0..*" Finding : status
  ReportAnswer --> "0..*" Finding : status
  GateStage --> "0..*" Finding : findings
  LastCheckAnswer --> "0..*" Finding : status
  HarnessStopAnswer --> "0..*" Finding : status
  ChangeAnswer --> "0..*" Finding : status
  BriefFormAnswer --> "0..*" Finding : status
  AgentAskAnswer --> "0..*" Finding : status
  style Finding fill:#fff4d6,stroke:#b7791f,stroke-width:2px
```

Changed: `Finding` — added `+level : 'ok' | 'warn' | 'error'`, `+check : string`, `+detail : string` — removed `+severity : 'error' | 'warning' | 'info'`, `+code : string`, `+message : string`, `+target : string`, `+file : string`, `+line : number`.

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
  class QuestionsAnswer {
    <<interface>>
    +questions
    +status : Finding[]
  }
  class MatrixAnswer {
    <<interface>>
    +matrix
    +status : Finding[]
  }
  class ReportAnswer {
    <<interface>>
    +schemaVersion : 1
    +projectDir : string
    +total : number
    +implemented : number
    +pending : number
    +implementedPct : number
    +byCategory : Record~string, number~
    +needsTest : string[]
    +orphanFeatures : string[]
    +specops : unknown
    +requirements : Array~Record~string, unknown~&
    +declaredValues : unknown
    +coverage
    +capability : string
    +status : Finding[]
  }
  class GateStage {
    <<interface>>
    +stage : 'ids' | 'changes' | 'validate' | 'architecture' | 'tests' | 'quality'
    +name : string
    +gate : boolean
    +command : string | null
    +result : 'passed' | 'failed' | 'skipped' | 'not run'
    +ms : number | null
    +findings : Finding[]
  }
  class LastCheckAnswer {
    <<interface>>
    +lastCheck
    +status : Finding[]
  }
  class HarnessStopAnswer {
    <<interface>>
    +stop
    +status : Finding[]
  }
  class ChangeAnswer {
    <<interface>>
    +change
    +status : Finding[]
  }
  class BriefFormAnswer {
    <<interface>>
    +form : BriefForm
    +status : Finding[]
  }
  class AgentAskAnswer {
    <<interface>>
    +plan
    +status : Finding[]
  }
  ICommand <|.. CreateSpecDrivenAppCommand
  BaseCommand <|-- DoctorCommand
  ICommand <|.. BaseCommand
  DoctorCommand --> "0..*" Finding : findings
  BriefData --> "0..*" Finding : findings
  StatusAnswer --> "0..*" Finding : status
  QuestionsAnswer --> "0..*" Finding : status
  MatrixAnswer --> "0..*" Finding : status
  ReportAnswer --> "0..*" Finding : status
  GateStage --> "0..*" Finding : findings
  LastCheckAnswer --> "0..*" Finding : status
  HarnessStopAnswer --> "0..*" Finding : status
  ChangeAnswer --> "0..*" Finding : status
  BriefFormAnswer --> "0..*" Finding : status
  AgentAskAnswer --> "0..*" Finding : status
```

</details>

## REQ-806 — A requirement is drawn before and after, the same way every time

- No before: `specgate evidence before REQ-806`
- No screenshots: `specgate doctor` says how to have the runner keep them

### A call added to a flow

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title A call added to a flow
  actor A as Developer
  participant S as System
  Note over A,S: REQ-031 whose scenario at the base sends `POST /api/orders`, and now also `POST /api/payments`
  A->>S: its diagrams are drawn
  S-->>A: the before has one call and the after two, both from the actor to the system
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### A method added to a class

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title A method added to a class
  actor A as Developer
  participant S as System
  Note over A,S: `src/orders.ts`, linked to REQ-031, whose class `Orders` has `place()` at the base and `place()` and `refund()` now
  A->>S: its diagrams are drawn
  S-->>A: the after's class `Orders` lists `refund()`, marked as added
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### Classes — TypeScript

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class ScenarioSteps {
    <<interface>>
    +title : string
    +steps : ReadonlyArray~string~
  }
  class ClassShape {
    <<interface>>
    +name : string
    +parents : ReadonlyArray~
    +members : ReadonlyArray~string~
  }
  class UmlMember {
    <<interface>>
    +kind : 'field' | 'method' | 'constructor'
    +visibility : Visibility
    +name : string
    +type : string
    +params : ReadonlyArray~UmlParam~
    +isStatic : boolean
    +isAbstract : boolean
    +annotations : string
    +body : string
  }
  class UmlType {
    <<interface>>
    +name : string
    +kind : 'class' | 'abstract' | 'interface' | 'record' | 'enum'
    +pkg : string
    +file : string
    +parents : ReadonlyArray~
    +members : ReadonlyArray~UmlMember~
    +literals : ReadonlyArray~string~
    +annotations : string
    +outer : string
  }
  class RequirementDiagrams {
    <<interface>>
    +base : string
    +sequences : Array~
    +classes : Array~
  }
  class Section {
    <<interface>>
    +actor : string
    +artifact : string
    +scenarios : Array~ScenarioSteps &
  }
  class Indexed {
    <<interface>>
    +types : UmlType[]
    +sources : Map~string, string~
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
  class Prefs {
    <<interface>>
    +mode : Mode
    +lang : Lang
    +theme : Theme
    +folded : boolean
  }
  class ShellProps {
    <<interface>>
    +project : string
    +section : Section
    +prefs : Prefs
    +onPrefs : (p: Prefs)
    +badges : Partial~Record~Section, number~~
    +children : ComponentChildren
  }
  UmlType --> "0..*" UmlMember : members
  Section --> "0..*" ScenarioSteps : scenarios
  Indexed --> "0..*" UmlType : types
  RequirementEvidence --> "0..*" CallPair : calls
  RequirementEvidence --> "0..*" AttemptEvidence : attempts
  RequirementEvidence --> "1" RequirementDiagrams : diagrams
  ShellProps --> "1" Section : section
  ShellProps --> "1" Prefs : prefs
  ShellProps --> "1" Prefs : onPrefs
  ShellProps --> "1" Section : badges
  style ScenarioSteps fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style ClassShape fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style UmlMember fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style UmlType fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style RequirementDiagrams fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style Section fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style Indexed fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style CallPair fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style RequirementEvidence fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style AttemptEvidence fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
```

New since the base: `ScenarioSteps`, `ClassShape`, `UmlMember`, `UmlType`, `RequirementDiagrams`, `Section`, `Indexed`, `CallPair`, `RequirementEvidence`, `AttemptEvidence`.

<details><summary>At the base</summary>

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class Prefs {
    <<interface>>
    +mode : Mode
    +lang : Lang
    +theme : Theme
    +folded : boolean
  }
  class ShellProps {
    <<interface>>
    +project : string
    +section : Section
    +prefs : Prefs
    +onPrefs : (p: Prefs)
    +badges : Partial~Record~Section, number~~
    +children : ComponentChildren
  }
  ShellProps --> "1" Prefs : prefs
  ShellProps --> "1" Prefs : onPrefs
```

</details>

## REQ-807 — One page shows a change's evidence

- No before: `specgate evidence before REQ-807`
- No screenshots: `specgate doctor` says how to have the runner keep them

### One before, one missing

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title One before, one missing
  actor A as Developer
  participant S as System
  Note over A,S: draft-orders with REQ-031, which has a before and an after with screenshots, and REQ-032, delivered with no before
  A->>S: the Developer runs `specgate evidence draft-orders`
  S-->>A: EVIDENCE.md shows REQ-031's two screenshots side by side, and says REQ-032 has no before with `specgate evidence before REQ-032`
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
