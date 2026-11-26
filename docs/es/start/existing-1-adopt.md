<!-- translation-of: efd39e86d6af -->
# Proyecto existente · 1 — Adopta sin tocar código

> **La versión corta** de un proyecto existente, en seis comandos: [Empezar](../start.md). Esta página es el mismo paso en detalle, con la salida grabada.

<!-- specgate:goal -->
**Cuando termines:** Specgate configurado sobre un código que ya funciona, sin cambiar
una sola línea de él, y un gate que pasa con tus tests existentes.
<!-- specgate:endgoal -->

**Antes de empezar:** Node.js 22 o posterior, un repositorio Git con un archivo
de build (`package.json`, `pom.xml`, `build.gradle`, `go.mod`, `pyproject.toml`,
`Cargo.toml`, …), y una suite de tests que pasa.

El ejemplo es un pequeño servicio de facturación en Node con dos módulos
(`src/invoices`, `src/customers`) y sus propios tests. Los proyectos Maven,
Gradle, Go, Python, Cargo y .NET siguen el mismo camino. El código que prueba
la fase 3 es `src/invoices/total.js`, que recibe las líneas y el tipo de IVA:

```js
/** Sum of the lines, VAT included, rounded to the cent. */
function total(lines, vatRate) {
  const net = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  return Math.round(net * (1 + vatRate) * 100) / 100;
}

module.exports = { total };
```

Su test, `test/total.test.js`, llama a `total(lines, 0.21)` y todavía no nombra
ningún requisito: la fase 3 añade el nombre.

| Quién | Hace qué en esta fase |
| --- | --- |
| **Tú** | Ejecutas cinco comandos, lees lo que proponen |
| **Specgate** | Lee el archivo de build y la estructura; solo escribe archivos de especificación |
| **El gate** | Ejecuta tu suite existente, para probar la instalación |

<!-- specgate:diagram adopt-existing -->

## 1. Instala Specgate en el proyecto

```bash
cd your-existing-repo
npm install --save-dev @rsaglobaltech/specgate
```

Estas páginas escriben los comandos como `specgate status`. Si lo instalaste
así, escribe `npx specgate status`. En un proyecto sin `package.json`,
ejecútalo sin instalarlo: antepón a cada comando
`npx @rsaglobaltech/specgate@latest`.

## 2. Mira antes de escribir nada — `specgate onboard`

```bash
specgate onboard
```

<!-- specgate:out-existing-onboard:begin — generated; edit the source, not this block -->
```text
$ specgate onboard
  🧭 onboarding  ~/invoicing

  1. What this is
     stack:  Node.js
     tests:  npm test
     detected from package.json

  2. Specs
     · not adopted yet — `specgate adopt` writes the skeleton without touching code

  3. Capabilities this codebase already implies
     · Invoices             src/invoices  (2 files)
     · Customers            src/customers  (1 files)

     A proposal, not a verdict. Merge, split or rename them.

  Next
     specgate adopt
```
<!-- specgate:out-existing-onboard:end -->

`onboard` no escribe nada. Nombra el stack y el comando de tests que encontró,
y las **capacidades** —áreas del producto, como las facturas— que tu estructura
ya implica. Son una propuesta para discutir, no un veredicto.

## 3. Adopta — `specgate init`

```bash
specgate init
```

<!-- specgate:out-existing-init:begin — generated; edit the source, not this block -->
```text
$ specgate init
  ◆ specgate · init

  ℹ  Existing code found (package.json) — adopting this repository in place. Nothing in your code is touched.
  ℹ  To scaffold a separate new project instead: specgate init --new

  Stack detection: package.json ──────────────────────────
    · Project: invoicing
    · Stack: Node.js
    · Test command: npm test
    + spec.md
    + features/adoption/baseline.feature
    + docs/specs/traceability.md
    + docs/specs/adr/README.md
    + docs/specs/glossary.md
    + AGENTS.md
    + docs/specs/adoption.md   2 areas found in the code
    + README.md   was missing
  ℹ  🚦 Policy: .specgate/gate.yaml — the standard preset; edit a rule to change what fails
  ℹ  🚦 CI: .github/workflows/spec-gate.yml — the spec gate; `specgate ci status` says what it checks
    · Traceability: generated from spec.md, tags and tests (`specgate matrix`)

  Summary ────────────────────────────────────────────────
    · Files written: 8
    · Files skipped (already present): 0
    · Areas found in the code: 2 — invoices, customers (docs/specs/adoption.md, not requirements)
  ▲  This does not certify your code yet — it certifies the skeleton.
     A green `validate` right now means the structure is in place, not that any
     behaviour is covered. It starts meaning something when the requirements below
… 20 more lines
```
<!-- specgate:out-existing-init:end -->

`init` (lo mismo que `adopt` en un repositorio con código) escribe `spec.md`,
`AGENTS.md`, un escenario baseline y la matriz de trazabilidad generada, y
solo archivos que aún no existen. Las áreas que lee del código (Invoices,
Customers) van a `docs/specs/adoption.md` con sus carpetas y sus tests: un mapa
desde el que especificar, no requisitos. Guarda el comando de tests y el agente
que detecta, preguntando antes, y termina con una lista de lo que está listo.
Sin terminal en la que preguntar —un script, CI, la herramienta de un agente—
no pregunta: guarda ambos, el agente como `agent: claude --output-format
stream-json --verbose --permission-mode acceptEdits -p < {prompt_file} |
specgate harness events --from claude` en `harness.config.yaml`. Lee esa
línea, y cámbiala con `specgate config set agent "<command>"` si tu agente no
debe editar sin preguntar.

## 4. Comprueba el comando de tests que guardó, o configúralo

```bash
specgate config set test_cmd "node --test"
```

<!-- specgate:out-existing-test-cmd:begin — generated; edit the source, not this block -->
```text
$ specgate config set test_cmd "node --test"
  ✔  test_cmd = node --test
     harness.config.yaml
     `check` and `apply` now run it.
```
<!-- specgate:out-existing-test-cmd:end -->

## 5. Ejecuta el gate

```bash
specgate check
```

<!-- specgate:out-existing-check:begin — generated; edit the source, not this block -->
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
<!-- specgate:out-existing-check:end -->

En verde, con tus propios tests dentro, y con una advertencia honesta: de
momento esto certifica el esqueleto, no el código. La fase 2 lo cambia.

El código antiguo tiene hallazgos antiguos. `specgate quality init` y después
`specgate quality baseline --accept` registran lo que hay hoy, para que solo
falle lo que añade un change. Consulta [Checks de calidad y seguridad](../quality.md).

## Has terminado cuando…

- `specgate check` termina con `✔  Gate passed` y tu comando de tests.
- `git diff` muestra archivos de especificación nuevos y **ningún cambio** bajo `src/` ni en tus tests.

## Variaciones

- **La detección se equivocó:** `specgate adopt --var STACK="Spring Boot 3, Java 21" --var TEST_CMD="./mvnw -B verify"`.
- **No quieres propuestas:** `specgate init --no-capabilities`.
- **Un monorepo** (módulos Maven/Gradle, workspaces de npm o pnpm, miembros de
  Cargo, módulos de Go): `specgate adopt --monorepo` adopta cada módulo y escribe
  `specops.config.yaml`; `specgate validate .` imprime entonces una línea por módulo.
- **Ya usas OpenSpec:** puede que no necesites adoptar nada: `specgate verify`
  pone en el gate los changes archivados de OpenSpec contra los tests. Consulta [Ya usas OpenSpec](../openspec.md).

## Si algo sale mal

| Ves | Significa | Haz |
| --- | --- | --- |
| `The gate failed` con tus tests en rojo | Tu suite ya fallaba | Corrige u omite primero esos tests: el gate no certificará una suite en rojo |
| `Gate passed — the specification` y *"nothing here runs your tests"* | No hay comando de tests | `specgate config set test_cmd "<your command>"` |
| Apareció una carpeta nueva `<slug>/` | No se encontró ningún archivo de build, así que `init` generó un proyecto | Ejecútalo en la raíz del repositorio, donde está el archivo de build; o `adopt --var STACK=…` |

¿Quieres primero el camino entero en una página? [Un ejemplo completo: un servicio adoptado de principio a fin](../case-studies/case-1.md).

## Siguiente

**[Fase 2: escribe aquello de lo que dependes →](existing-2-specify.md)**
