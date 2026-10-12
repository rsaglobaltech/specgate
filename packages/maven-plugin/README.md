# specgate-maven-plugin

Run the Specgate spec gate from Maven — Java teams need no
local Node.js toolchain.

## Goals

| Goal | What it does |
| --- | --- |
| `specgate:validate` | Runs `validate . --strict` (the gate `specgate ci init` generates); **fails the build** when the gate fails. Binds to `verify`. |
| `specgate:plan` | Lists requirements still needing a test/code/status (`-Dspecgate.format=json` for CI). |
| `specgate:doctor` | Full diagnosis with a fix per finding. |

## Usage

One-off, no POM changes:

```bash
mvn com.rsaglobaltech:specgate-maven-plugin:0.1.4:validate
```

Wired into every `mvn verify`:

```xml
<build>
  <plugins>
    <plugin>
      <groupId>com.rsaglobaltech</groupId>
      <artifactId>specgate-maven-plugin</artifactId>
      <version>0.1.4</version>
      <executions>
        <execution>
          <goals><goal>validate</goal></goals>
        </execution>
      </executions>
    </plugin>
  </plugins>
</build>
```

## Launcher resolution

| Property | Default | Meaning |
| --- | --- | --- |
| `specgate.launcher` | `auto` | `npx` when Node is on PATH, otherwise `docker` (official image, project mounted at `/workspace`). |
| `specgate.version` | `latest` | CLI version (npx tag / docker tag). Pin it in CI. |
| `specgate.dockerImage` | `ghcr.io/rsaglobaltech/specgate` | Override with your internal mirror in air-gapped environments. |
| `specgate.strictTdd` | `true` | Runs the gate, `validate --strict` (the name is kept for existing builds). Set `false` to run the structural checks only. |
| `specgate.projectDir` | `${project.basedir}` | Point at the repo root in multi-module builds. |

## Build from source

```bash
cd packages/maven-plugin
mvn install
```
