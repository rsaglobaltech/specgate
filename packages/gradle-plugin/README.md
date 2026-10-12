# specgate-gradle-plugin

Run the Specgate spec gate from Gradle — Java teams need no
local Node.js toolchain. The Gradle counterpart of
[`specgate-maven-plugin`](../maven-plugin); both resolve the CLI identically.

## Tasks

| Task | What it does |
| --- | --- |
| `specgateValidate` | Runs `validate . --strict` (the gate `specgate ci init` generates); **fails the build** when the gate fails. Wired into `check`. |
| `specgatePlan` | Lists requirements still needing a test/code/status (`--format=json` for CI). |
| `specgateDoctor` | Full diagnosis with a fix per finding. |

## Usage

Apply the plugin:

```groovy
plugins {
  id 'com.rsaglobaltech.specgate' version '0.1.4'
}
```

`gradle check` (and `build`) now fails if a requirement is missing its
feature file, its test artifact, or its traceability row. Run the gate on its
own with `gradle specgateValidate`.

Configure via the `specgate { }` block — every knob also has a `-Pspecgate.*`
command-line override:

```groovy
specgate {
  version = '0.1.4'                      // pin the CLI version in CI (-Pspecgate.version)
  launcher = 'docker'                    // force docker in air-gapped runners (-Pspecgate.launcher)
  dockerImage = 'registry.internal/specgate' // internal mirror (-Pspecgate.dockerImage)
  strictTdd = true                       // -Pspecgate.strictTdd
}
```

## Launcher resolution

| Property | Default | Meaning |
| --- | --- | --- |
| `specgate.launcher` | `auto` | `npx` when Node is on PATH, otherwise `docker` (official image, project mounted at `/workspace`). |
| `specgate.version` | `latest` | CLI version (npx tag / docker tag). Pin it in CI. |
| `specgate.dockerImage` | `ghcr.io/rsaglobaltech/specgate` | Override with your internal mirror in air-gapped environments. |
| `specgate.strictTdd` | `true` | Runs the gate, `validate --strict` (the name is kept for existing builds). Set `false` (or `gradle specgateValidate --no-strict-tdd`) to run the structural checks only. |
| `specgate.format` | `text` | `specgatePlan` output; `json` (or `gradle specgatePlan --format=json`) for CI. |
| `specgate.projectDir` | `${projectDir}` | Point at the repo root in multi-project builds. |

## Build from source

```bash
cd packages/gradle-plugin
gradle build      # compiles + runs the launcher tests
```
