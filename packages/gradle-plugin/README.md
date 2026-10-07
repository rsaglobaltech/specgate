# csda-gradle-plugin

Run the Specgate spec gate from Gradle — Java teams need no
local Node.js toolchain. The Gradle counterpart of
[`csda-maven-plugin`](../maven-plugin); both resolve the CLI identically.

## Tasks

| Task | What it does |
| --- | --- |
| `csdaValidate` | Runs `validate . --strict` (the gate `specgate ci init` generates); **fails the build** when the gate fails. Wired into `check`. |
| `csdaPlan` | Lists requirements still needing a test/code/status (`--format=json` for CI). |
| `csdaDoctor` | Full diagnosis with a fix per finding. |

## Usage

Apply the plugin:

```groovy
plugins {
  id 'com.rsaglobaltech.csda' version '0.1.4'
}
```

`gradle check` (and `build`) now fails if a requirement is missing its
feature file, its test artifact, or its traceability row. Run the gate on its
own with `gradle csdaValidate`.

Configure via the `csda { }` block — every knob also has a `-Pcsda.*`
command-line override:

```groovy
csda {
  version = '0.1.4'                      // pin the CLI version in CI (-Pcsda.version)
  launcher = 'docker'                    // force docker in air-gapped runners (-Pcsda.launcher)
  dockerImage = 'registry.internal/csda' // internal mirror (-Pcsda.dockerImage)
  strictTdd = true                       // -Pcsda.strictTdd
}
```

## Launcher resolution

| Property | Default | Meaning |
| --- | --- | --- |
| `csda.launcher` | `auto` | `npx` when Node is on PATH, otherwise `docker` (official image, project mounted at `/workspace`). |
| `csda.version` | `latest` | CLI version (npx tag / docker tag). Pin it in CI. |
| `csda.dockerImage` | `ghcr.io/rsaglobaltech/specgate` | Override with your internal mirror in air-gapped environments. |
| `csda.strictTdd` | `true` | Runs the gate, `validate --strict` (the name is kept for existing builds). Set `false` (or `gradle csdaValidate --no-strict-tdd`) to run the structural checks only. |
| `csda.format` | `text` | `csdaPlan` output; `json` (or `gradle csdaPlan --format=json`) for CI. |
| `csda.projectDir` | `${projectDir}` | Point at the repo root in multi-project builds. |

## Build from source

```bash
cd packages/gradle-plugin
gradle build      # compiles + runs the launcher tests
```
