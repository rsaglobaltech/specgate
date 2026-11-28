# Evidence — strict-links

> Written by `specgate evidence strict-links` (ADR-0047): each requirement before its code and after it.
> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.

## REQ-800 — With `link: strict`, a comment does not link a test

- No before: `specgate evidence before REQ-800`
- No screenshots: `specgate doctor` says how to have the runner keep them

### A comment is not a link

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title A comment is not a link
  actor A as Developer
  participant S as System
  Note over A,S: `link: strict`, and `tests/login.test.js` whose only mention of REQ-007 is `// REQ-007: covered elsewhere`
  A->>S: the matrix is derived
  S-->>A: REQ-007 has no test, and `specgate apply REQ-007` is refused with `apply_no_test`, its fix saying a comment does not count under `link: strict`
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### A test's name is a link

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title A test's name is a link
  actor A as Developer
  participant S as System
  Note over A,S: `link: strict`, and `tests/login.test.js` with `test("REQ-007: a locked account is refused", …)`, and `const url = "http://x/REQ-008"` under a `// REQ-009` comment
  A->>S: the matrix is derived
  S-->>A: REQ-007 and REQ-008 are linked to `tests/login.test.js`, and REQ-009 is not
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### Classes — TypeScript

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class SourceFile {
    <<interface>>
    +path : string
    +source : string
  }
  class DerivationSources {
    <<interface>>
    +spec : string
    +features : ReadonlyArray~SourceFile~
    +tests : ReadonlyArray~SourceFile~
    +capabilities : ReadonlyArray~SourceFile~
    +code : ReadonlyArray~SourceFile~
    +links : 'strict'
  }
  class DerivedRequirement {
    <<interface>>
    +id : string
    +title : string
    +trace : Record~string, string~
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
  DerivationSources --> "0..*" SourceFile : features
  DerivationSources --> "0..*" SourceFile : tests
  DerivationSources --> "0..*" SourceFile : capabilities
  DerivationSources --> "0..*" SourceFile : code
  style DerivationSources fill:#fff4d6,stroke:#b7791f,stroke-width:2px
  style GatePolicy fill:#fff4d6,stroke:#b7791f,stroke-width:2px
```

Changed: `DerivationSources` — added `+links : 'strict'`. Changed: `GatePolicy` — added `+link : 'strict'`, `+evidence : 'required'`.

<details><summary>At the base</summary>

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class SourceFile {
    <<interface>>
    +path : string
    +source : string
  }
  class DerivationSources {
    <<interface>>
    +spec : string
    +features : ReadonlyArray~SourceFile~
    +tests : ReadonlyArray~SourceFile~
    +capabilities : ReadonlyArray~SourceFile~
    +code : ReadonlyArray~SourceFile~
  }
  class DerivedRequirement {
    <<interface>>
    +id : string
    +title : string
    +trace : Record~string, string~
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
  DerivationSources --> "0..*" SourceFile : features
  DerivationSources --> "0..*" SourceFile : tests
  DerivationSources --> "0..*" SourceFile : capabilities
  DerivationSources --> "0..*" SourceFile : code
```

</details>

## REQ-801 — The gate policy reads `link`

- No before: `specgate evidence before REQ-801`
- No screenshots: `specgate doctor` says how to have the runner keep them

### A value the policy does not know

```mermaid
%%{init: {"theme": "neutral"}}%%
sequenceDiagram
  title A value the policy does not know
  actor A as Developer
  participant S as System
  Note over A,S: `.specgate/gate.yaml` with `link: tags`
  A->>S: the policy is read
  S-->>A: it has the problem "link `tags` is not mention or strict", and the fix names `link: strict`
```

· Drawn from the steps: no endpoint in the code answers them.

New since the base.

### Classes — TypeScript

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
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
  style GatePolicy fill:#fff4d6,stroke:#b7791f,stroke-width:2px
```

Changed: `GatePolicy` — added `+link : 'strict'`, `+evidence : 'required'`.

<details><summary>At the base</summary>

```mermaid
%%{init: {"theme": "neutral"}}%%
classDiagram
  class GatePolicy {
    <<interface>>
    +source : 'file' | 'default'
    +preset : Preset
    +rules : Readonly~Record~Rule, Level~~
    +enforceFrom : string
    +bdd : 'required'
    +problems : ReadonlyArray~
  }
```

</details>
