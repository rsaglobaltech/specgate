<!-- translation-of: e65726e27016 -->
# Proyecto existente · 4 — Pon el gate en CI

> **La versión corta** de un proyecto existente, en seis comandos: [Empezar](../start.md). Esta página es el mismo paso en detalle, con la salida grabada.

<!-- specgate:goal -->
**Cuando termines:** cada pull request ejecuta el gate, así que un requisito marcado como hecho
nunca más puede quedarse sobre código en rojo, y adoptarlo no te pide
arreglar antes el pasado.
<!-- specgate:endgoal -->

**Antes de empezar:** la [fase 3](existing-3-first-requirement.md) está hecha:
REQ-004 está aplicado y su change archivado. El proyecto está en un host de Git
con CI (GitHub, GitLab, Azure DevOps o Jenkins).

| Quién | Hace qué en esta fase |
| --- | --- |
| **Tú** | Haces commit del archivo de CI que escribió `adopt`, y miras qué comprueba |
| **CI** | Ejecuta `specgate check` en cada pull request |

## 1. El gate ya está en CI

`specgate adopt` (o `init` en una carpeta con código) lo escribió:
`.github/workflows/spec-gate.yml`, o el archivo del CI que tu repositorio ya
usa, nunca encima de un archivo que exista. Mira qué comprueba y qué le
falta:

```bash
specgate ci status
```

<!-- specgate:out-existing-ci:begin — generated; edit the source, not this block -->
```text
$ specgate ci status
  ◆ specgate · ci status   .github/workflows/spec-gate.yml

  ✔  the specification (validate --strict)
  ✔  the project's tests (check runs test_cmd)
  ✔  the architecture check (check runs arch_cmd)
  ✔  Ubuntu, macOS and Windows
  ✔  the requirement ids against the base branch (check --base)
  ✔  the quality checks (quality run)
  ✔  the pack drift (validate --against-lock)
  ✔  the pending-work plan (plan --format json)

  ✔  Everything specgate can check runs in CI.
```
<!-- specgate:out-existing-ci:end -->

Un `specgate init` más antiguo escribía `.github/workflows/specs.yml`, que solo
validaba la especificación: `specgate ci init --provider github` muestra lo que
añade el gate, y `--replace` lo sustituye. Cada paso del gate dice qué
comprueba y qué borrar para quitarlo; `--minimal` (solo GitHub) escribe un
único job de Ubuntu que ejecuta `specgate check` sin rama base: sin
comparación de ids, sin deriva de packs, sin plan.

## 2. Comprueba en local lo que ejecutará CI

```bash
specgate check
```

<!-- specgate:out-existing-check-green:begin — generated; edit the source, not this block -->
```text
$ specgate check
  ◆ specgate · check   invoicing

  ·  Policy         .specgate/gate.yaml (standard): coverage warning, use_cases warning, scope warning, controls warning
  ·  Ids            not compared with a base — no base branch (pass --base <branch>)
  ✔  Specification   validate --strict
  ✔  Tests           node --test
  ·  Architecture    not checked — specgate config set arch_cmd "<command>"

  ✔  Gate passed — the specification and `node --test`
```
<!-- specgate:out-existing-check-green:end -->

Esto es lo que hace seguro el gate sobre código antiguo: los requisitos que
siguen en `Draft` están **exentos**, y las áreas que encontró la adopción
están en `docs/specs/adoption.md`, fuera de la especificación, hasta que las
describas. El gate le exige al código lo que has escrito, y solo eso. Cada
requisito que aplicas sube el listón en uno.

El job ejecuta `specgate check` con los ids comparados con la rama base y,
cuando los [checks de calidad](../quality.md) están configurados, `specgate quality run
--stage ci` en Ubuntu, donde se ejecuta Docker.

## 3. Haz commit y abre una pull request

```bash
git add -A && git commit -m "Specgate: the gate in CI"
```

La primera pull request muestra el job ejecutando tu especificación y tu
suite. A partir de ahí, una pull request que rompe el redondeo de REQ-004
falla, con el id del requisito en el fallo.

## 4. Convierte el job en un check obligatorio

Un job que falla solo bloquea un merge cuando la rama lo exige. En GitHub:
**Settings → Branches → Branch protection rules**, protege tu rama principal
y añade el job del gate en **Require status checks to pass before merging**.
GitLab y Azure DevOps tienen el mismo ajuste para merge requests y pull
requests.

## ¿Ya usas OpenSpec?

Si el proyecto guarda sus specs en `openspec/`, `specgate verify --since
origin/main` pone en el gate solo lo que afirmen los changes de OpenSpec a
partir de ahora, y las afirmaciones anteriores se reportan, no fallan. Tiene
su propia action de CI; consulta [Ya usas OpenSpec](../openspec.md).

## Has terminado cuando…

- El archivo de CI está en un commit y el job está en verde en una pull request.
- El job es un check obligatorio en tu rama principal.
- Un test roto a propósito hace fallar el job (pruébalo una vez).

## Si algo sale mal

| Ves | Significa | Haz |
| --- | --- | --- |
| `…already exists — refusing to overwrite.` | Tienes un archivo de workflow en esa ruta | `--stdout` y pega el job, o `--force` |
| `Unknown provider: circleci` | No es un proveedor soportado | Ejecuta `npx @rsaglobaltech/specgate@latest check` como paso en cualquier CI |
| El job pasa en local y falla en CI | A CI le falta tu toolchain de tests | Instálala antes del paso `check` |

## Siguiente

**[Fase 5: cada día →](existing-5-every-day.md)**
