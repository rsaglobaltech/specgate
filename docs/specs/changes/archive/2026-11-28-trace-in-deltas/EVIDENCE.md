# Evidence — trace-in-deltas

> Written by `specgate evidence trace-in-deltas` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-825 — A delta's trace value cut at a space is reported

- No before: `specgate evidence before REQ-825`
- No screenshots: `specgate doctor` says how to have the runner keep them

### An actor cut in a delta

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title An actor cut in a delta
  actor A as Developer
  participant S as System
  Note over A,S: a change whose delta's trace says `actor=Product owner`
  A->>S: the Developer runs `specgate change validate triage`
  S-->>A: it warns that `actor=Product owner` is read as `actor=Product`, with `actor="Product owner"` to write, and says nothing once it is quoted
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
  ICommand <|.. CreateSpecDrivenAppCommand
  BaseCommand <|-- CliCommand
  ICommand <|.. BaseCommand
```

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
  ICommand <|.. CreateSpecDrivenAppCommand
  BaseCommand <|-- CliCommand
  ICommand <|.. BaseCommand
```

</details>
