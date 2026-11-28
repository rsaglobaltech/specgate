# Evidence — workspace-runner

> Written by `specgate evidence workspace-runner` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-809 — The evidence keeps what a workspace's runner wrote

- No before: `specgate evidence before REQ-809`
- No screenshots: `specgate doctor` says how to have the runner keep them

### A screenshot in a workspace

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title A screenshot in a workspace
  actor A as Developer
  participant S as System
  Note over A,S: a project whose `package.json` declares the workspace `apps/*`, and a `bdd_cmd` that writes `apps/web/test-results/flow/test-finished-1.png`
  A->>S: the Developer runs `specgate evidence before REQ-001`
  S-->>A: `.specgate/evidence/REQ-001/before/artifacts/apps/web/flow/test-finished-1.png` exists, and `run.json` lists it
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

## REQ-810 — Doctor sees a workspace's runner and its Playwright config

- No before: `specgate evidence before REQ-810`
- No screenshots: `specgate doctor` says how to have the runner keep them

### playwright-bdd in a workspace

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title playwright-bdd in a workspace
  actor A as Developer
  participant S as System
  Note over A,S: a project with `bdd_cmd: npm run test:bdd -- --grep "{tags}"`, the workspace `apps/web` whose `playwright.config.ts` uses playwright-bdd with no `screenshot` or `video`, and a well-formed feature file
  A->>S: the Developer runs `specgate doctor`
  S-->>A: the scenarios line does not say "no Gherkin runner", and `doctor_evidence_media` is reported
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
