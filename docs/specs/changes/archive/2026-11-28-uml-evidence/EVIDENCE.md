# Evidence — uml-evidence

> Written by `specgate evidence uml-evidence` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-811 — The requirement's code as a UML class diagram

- No before: `specgate evidence before REQ-811`
- No screenshots: `specgate doctor` says how to have the runner keep them

### A use case and its port

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title A use case and its port
  actor A as Developer
  participant S as System
  Note over A,S: `ReviewOrder.java`, which names REQ-041, holding a `private final Classifier classifier` and `public Mono<Decision> execute(String text)`, `Classifier` an interface implemented by `AiClassifier`, and `Decision` an enum `ALLOW, DENY`
  A->>S: the evidence diagrams of REQ-041 are drawn
  S-->>A: the class diagram shows `ReviewOrder --> "1" Classifier : classifier`, `Classifier <|.. AiClassifier`, `+execute(text : String) Mono~Decision~` and `Decision` as `<<enumeration>>` with `ALLOW` and `DENY`
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
  class UmlParam {
    <<interface>>
    +name : string
    +type : string
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
  class Piece {
    <<interface>>
    +head : string
    +block : string | null
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
  UmlMember --> "0..*" UmlParam : params
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
  style UmlParam fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style UmlMember fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style UmlType fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style Piece fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style RequirementDiagrams fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style Section fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style Indexed fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style CallPair fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style RequirementEvidence fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style AttemptEvidence fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
```

New since the base: `ScenarioSteps`, `UmlParam`, `UmlMember`, `UmlType`, `Piece`, `RequirementDiagrams`, `Section`, `Indexed`, `CallPair`, `RequirementEvidence`, `AttemptEvidence`.

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

## REQ-812 — A scenario followed through the code as a UML sequence

- No before: `specgate evidence before REQ-812`
- No screenshots: `specgate doctor` says how to have the runner keep them

### From the endpoint to the port

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title From the endpoint to the port
  actor A as Developer
  participant S as System
  Note over A,S: `OrderController` mapped to `POST /api/orders` with `@ResponseStatus(HttpStatus.CREATED)`, calling `review.execute(text)`, and `ReviewOrder.execute` calling `classifier.classify(text)`
  A->>S: POST /api/orders
  S-->>A: the sequence has lifelines `:OrderController`, `:ReviewOrder` and `:AiClassifier`, the messages `execute(text : String)` and `classify(text : String)` in that order, and the reply `201 Created` to the actor
```

· Read from the code, not checked against the run: its trace holds no call to the service — a call made from the server, out of the browser's sight, is not in it.

New since the base.

### No endpoint in the code

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title No endpoint in the code
  actor A as Developer
  participant S as System
  Note over A,S: a scenario that sends `POST /api/unknown`, which no controller declares
  A->>S: it is drawn
  S-->>A: the diagram is the one from its steps, with `participant S as System`
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
  class UmlParam {
    <<interface>>
    +name : string
    +type : string
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
  class Piece {
    <<interface>>
    +head : string
    +block : string | null
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
  UmlMember --> "0..*" UmlParam : params
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
  style UmlParam fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style UmlMember fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style UmlType fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style Piece fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style RequirementDiagrams fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style Section fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style Indexed fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style CallPair fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style RequirementEvidence fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
  style AttemptEvidence fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px
```

New since the base: `ScenarioSteps`, `UmlParam`, `UmlMember`, `UmlType`, `Piece`, `RequirementDiagrams`, `Section`, `Indexed`, `CallPair`, `RequirementEvidence`, `AttemptEvidence`.

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
