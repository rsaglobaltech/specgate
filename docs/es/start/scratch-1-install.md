<!-- translation-of: 7d1bff785d56 -->
# Desde cero · 1 — Instala y configura

> **La versión corta** de un proyecto nuevo, en seis comandos: [Empezar](../start.md). Esta página es el mismo paso en detalle, con la salida grabada.

<!-- specgate:goal -->
**Cuando termines:** un proyecto nuevo con Specgate configurado, que sabe cómo ejecutar tus tests,
y un gate que pasa, antes de que exista un solo requisito.
<!-- specgate:endgoal -->

**Antes de empezar:** Node.js 22 o posterior, y Git.

El ejemplo es el que graba la página de inicio: reservas de pistas para un
club de tenis, en Node sin más. Tu stack será otro; los comandos no.

| Quién | Hace qué en esta fase |
| --- | --- |
| **Tú** | Creas el proyecto como lo hace tu stack, ejecutas cuatro comandos |
| **Tu agente** | Nada todavía |
| **El gate** | Se ejecuta una vez, sobre una especificación vacía, para probar la instalación |

## 1. Crea el proyecto con tus propias herramientas

Specgate escribe especificaciones, no código de la aplicación. Empieza el
proyecto como lo empieza tu stack —`npm init`, Spring Initializr, `cargo new`,
`django-admin startproject`, un generador de monorepos— y ponlo bajo git:

```bash
mkdir court-bookings && cd court-bookings
git init
npm init -y
npm pkg set scripts.test="node --test"   # npm init writes a "no test specified" stub
```

## 2. Configura Specgate — `specgate init`

Instala Specgate como dependencia de desarrollo y después configúralo:

```bash
npm install --save-dev @rsaglobaltech/specgate
npx specgate init
```

Estas páginas escriben los comandos como `specgate status`. Si lo instalaste
así, escribe `npx specgate status`. En un stack sin `package.json`, ejecútalo
sin instalarlo: antepón a cada comando
`npx @rsaglobaltech/specgate@latest`.

`init` ve el `package.json`, así que configura Specgate **en el sitio**, en
esta carpeta, y no toca código. Escribe la especificación (`spec.md`), el
contrato del agente (`AGENTS.md`) que lee todo agente de código, la
**matriz de trazabilidad** —la tabla que enlaza cada requisito con su
escenario, su código y su test— y un escenario baseline:

<!-- specgate:out-scratch-init:begin — generated; edit the source, not this block -->
```text
$ specgate init
  ◆ specgate · init

  ℹ  Existing code found (package.json) — adopting this repository in place. Nothing in your code is touched.
  ℹ  To scaffold a separate new project instead: specgate init --new

  Stack detection: package.json ──────────────────────────
    · Project: court-bookings
    · Stack: Node.js
    · Test command: npm test
    + spec.md
    + features/adoption/baseline.feature
    + docs/specs/traceability.md
    + docs/specs/adr/README.md
    + docs/specs/glossary.md
    + AGENTS.md
    + README.md   was missing
  ℹ  🚦 Policy: .specgate/gate.yaml — the standard preset; edit a rule to change what fails
  ℹ  🚦 CI: .github/workflows/spec-gate.yml — the spec gate; `specgate ci status` says what it checks
    · Traceability: generated from spec.md, tags and tests (`specgate matrix`)

  Summary ────────────────────────────────────────────────
    · Files written: 7
    · Files skipped (already present): 0
  ▲  This does not certify your code yet — it certifies the skeleton.
     A green `validate` right now means the structure is in place, not that any
     behaviour is covered. It starts meaning something when the requirements below
     are real and their scenarios are linked to tests.

… 19 more lines
```
<!-- specgate:out-scratch-init:end -->

Las líneas que el bloque corta configuran el agente: con Claude Code instalado,
`init` escribe `agent: claude … --permission-mode acceptEdits …` en
`harness.config.yaml`. En una terminal pregunta antes; sin terminal —ejecutado
por un agente o un script— lo configura sin preguntar. `specgate config set agent
"<command>"` lo cambia.

Dos palabras de esa salida están escritas para código existente, porque para
`init` una carpeta con `package.json` *es* código existente: "adopting", y
`REQ-001 — Existing behaviour is preserved`. En un proyecto recién creado ese
requisito se cumple trivialmente. Déjalo como está; cuando la app exista, un
test de que arranca —que nombre `REQ-001`— lo cierra como cualquier otro.

<!-- specgate:note -->
**¿Ha creado una subcarpeta?** En una terminal, en una carpeta sin ningún
archivo de build, `init` genera un proyecto aparte (`<slug>/` con `spec.md`,
`docs/`, CI y archivos de contenedor) a partir de un asistente breve; sin
terminal, configura la carpeta en el sitio. Crea primero tu proyecto, como
arriba, y ejecuta `init` dentro de él, o usa `init --new` a propósito cuando
quieras el andamiaje completo.
<!-- specgate:endnote -->

## 3. Dile cómo ejecutar tus tests, una vez

```bash
specgate config set test_cmd "node --test"
```

<!-- specgate:out-scratch-test-cmd:begin — generated; edit the source, not this block -->
```text
$ specgate config set test_cmd "node --test"
  ✔  test_cmd = node --test
     harness.config.yaml
     `check` and `apply` now run it.
```
<!-- specgate:out-scratch-test-cmd:end -->

A partir de ahora `check` y `apply` ejecutan tu suite como parte del gate. Usa
el comando de tu stack: `npm test`, `./mvnw -B verify`, `pytest`, `go test ./...`.

## 4. Ejecuta el gate

```bash
specgate check
```

<!-- specgate:out-scratch-check:begin — generated; edit the source, not this block -->
```text
$ specgate check
  ◆ specgate · check   court-bookings

  ·  Policy         .specgate/gate.yaml (standard): coverage warning, use_cases warning, scope warning, controls warning
  ·  Ids            not compared with a base — no base branch (pass --base <branch>)
  ✔  Specification   validate --strict
  ✔  Tests           node --test
  ·  Architecture    not checked — specgate config set arch_cmd "<command>"

  ✔  Gate passed — the specification and `node --test`
```
<!-- specgate:out-scratch-check:end -->

En verde. Como advirtió `init`, esto certifica el esqueleto, no el
comportamiento: todavía no hay nada que certificar. Eso cambia en la siguiente
fase, cuando el brief se convierte en requisitos.

## Has terminado cuando…

- `specgate check` termina con `✔  Gate passed — the specification and` y tu comando de tests.
- `spec.md`, `AGENTS.md`, `features/` y `docs/specs/traceability.md` existen y están en un commit.

```bash
git add -A && git commit -m "Specgate set up"
```

## Si algo sale mal

| Ves | Significa | Haz |
| --- | --- | --- |
| `Gate passed — the specification` y *"nothing here runs your tests"* | No hay ningún comando de tests configurado | `specgate config set test_cmd "<your command>"` |
| Apareció una carpeta nueva `<slug>/` | No había archivo de build, así que `init` generó un proyecto | Crea primero el proyecto y después ejecuta `init` dentro |
| `command not found: specgate` | Está instalado en el proyecto, no en tu PATH | Escribe `npx specgate` delante del comando, como en `npx specgate check` |

**¿Quieres más que tests en el gate?** `specgate quality init` escribe los
[checks de calidad](../quality.md) para tu stack —cobertura y mutación de lo
que añade cada change, SAST, secretos, dependencias—, cada uno ejecutado en Docker.

**¿Usas un agente?** `specgate agents init --tool claude` (o `cursor`,
`copilot`, `gemini`, …) le instala los comandos `/specgate:*`. Consulta
[Agentes](../agents.md).

## Siguiente

¿Tienes un plan o el brief de un cliente? [Escribe el brief](write-the-brief.md) primero,
y después sigue con la **[fase 2: del brief a una especificación comprobada →](scratch-2-specify.md)**
