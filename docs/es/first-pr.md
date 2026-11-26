<!-- translation-of: b38a0718c1de -->
# El primer pull request de tu equipo con Specgate

Para quienes escriben el pull request y para quienes lo revisan.
Da por hecho que el repositorio ya ha ejecutado `specgate init`; si no, el
[Inicio rápido](quickstart.md) lo deja listo en diez minutos.

---

<!-- specgate:diagram pr-lanes -->

## Una vez por repositorio

```bash
specgate init        # adopts the existing code; writes spec.md, the matrix and
                     # the gate as a CI job — for the CI .github/, .gitlab-ci.yml, …
                     # or the origin remote shows; GitHub when nothing does
specgate ci status   # what the gate checks, and what it lacks
git add -A && git commit -m "chore: adopt Specgate"
```

El job de CI ejecuta `specgate check` en cada pull request —la especificación,
después tus tests— tras preparar lo que necesita el proyecto: un JDK para un
`pom.xml` o `build.gradle`, `npm ci` para un lockfile. Es el mismo `check` que
ejecutas en tu máquina, así que un verde allí es un verde en CI. Ejecuta el
`test_cmd` que configuraste (`specgate config set test_cmd …`), o el que
detecta; sin ninguno todavía, `check` valida la especificación, dice que el
comando de tests no está configurado y cómo configurarlo, y pasa.

### Haz del gate un check obligatorio

Un job de CI en rojo solo bloquea un merge cuando el repositorio lo exige. En
GitHub, abre **Settings → Branches**, añade una regla de protección para la
rama a la que apuntan los pull requests (`main`, y `develop` si la usas), y activa:

1. **Require a pull request before merging.**
2. **Require status checks to pass before merging**, y después busca y
   selecciona los checks del job que escribió `specgate ci init`. Se ejecuta en
   tres sistemas, así que GitHub lista `spec-gate (ubuntu-latest)`,
   `spec-gate (macos-latest)` y `spec-gate (windows-latest)`: selecciona los
   tres (el job `--minimal` es simplemente `spec-gate`). Aparecen en la lista
   cuando el job se ha ejecutado en un pull request.

GitLab (ramas protegidas, "Pipelines must succeed") y Azure DevOps (una
política de rama de build validation) tienen el mismo ajuste. Sin él, un pull
request puede hacer merge con el gate en rojo.

---

## Quien escribe: un change, un pull request

```bash
specgate status                     # what is open, and the next command
specgate propose invoices-pdf       # discover, design, tasks, a delta, REQ ids reserved
```

`propose` abre `docs/specs/changes/invoices-pdf/` con `change.yaml`,
`discover.md`, `design.md`, `tasks.md` y el delta. Escribe dos cosas en él:

1. **`discover.md`**: por qué existe el change: quién tiene el problema, el caso
   de uso y sus criterios de aceptación. Quien revisa lo lee primero;
   `design.md` dice cómo, `tasks.md` los pasos.
2. **El delta, `specs/invoices-pdf/spec.md`**: cada requisito como
   `### Requirement: REQ-007 — <name>`, una obligación con `SHALL` o `MUST`,
   un escenario de viñetas simples `- GIVEN` / `- WHEN` / `- THEN` con valores
   reales, no "datos válidos", y un comentario de traza con su tipo:
   `<!-- specgate:trace kind=functional … -->` (o `non-functional`,
   `business-rule`). La aprobación rechaza un requisito sin `kind=`
   (`approve_blocked`). La plantilla que escribió `propose` aún no se juzga:
   `check` dice `delta not written yet, not judged until it is` y pasa;
   en cuanto empiezas a escribirlo, un paso que aún tiene su `<placeholder>` falla
   (`scenario_steps_unwritten`).

No toques `docs/specs/traceability.md`. Es generado.

Después una persona aprueba el change, en una terminal (un agente no puede:
`approve_needs_person`), o en Review del studio:

```bash
specgate change approve invoices-pdf   # --layer discover|design|tasks for one layer
```

La aprobación escribe los archivos feature del change (`features/…`), con sus
escenarios listos para ejecutarse antes de que haya código. `apply` rechaza un
change que nadie aprobó (`change_not_approved`), y un requisito editado después
de la aprobación hace fallar el gate (`approved_requirement_changed`) hasta que
se vuelve a aprobar.

Después escribe el test, y **menciona en él el requisito**. La mención es el
enlace; no hay nada más que declarar:

```js
// REQ-007 SCN-007a — customers download invoices as PDF
test("a paid invoice downloads as a PDF", () => {
  /* … */
});
```

Escribe el código, y después entrega el requisito y cierra el change:

```bash
specgate apply                      # the next requirement: refused while no test names it,
                                    # Implemented only when the gate passes
specgate archive invoices-pdf       # every requirement Implemented: merged into the specs
specgate check                      # the whole gate, the one CI runs
```

Mientras el change está abierto sus requisitos ya cuentan: `status` los lista,
`apply` juzga el proyecto tal como quedará después de archive y escribe el
estado en el delta. `archive` se niega mientras quede uno pendiente, y nombra
el `specgate apply REQ-…` que ejecutar. Así la especificación y el código hacen
merge juntos, en este pull request, después de que el gate pasara.

Commitea todo lo que tocaron `approve`, `archive` y `check`: la carpeta del
change movida a `docs/specs/changes/archive/`, el spec de la capacidad, el
archivo feature, los tests, el código **y** `docs/specs/traceability.md`. Una
matriz olvidada deja un diff ruidoso en el siguiente pull request (mira `matrix_stale` abajo).

Un requisito demasiado pequeño para un change: `specgate new "<title>"` lo
escribe directamente en `spec.md` con un escenario por rellenar, y `specgate
apply REQ-007` lo entrega igual.

### A partir de un ticket

Cuando el trabajo es una historia de Jira, el mismo pull request parte del
ticket. Las diferencias:

- Abre el change con `specgate propose --from-ticket KAN-13`. Crea la rama
  `feature/KAN-13-…` y hace push de ella.
- Empieza cada mensaje de commit con la clave: `KAN-13 REQ-151: normalize plates`.
- Ejecuta `specgate archive <change-id>` en la rama, commitea, y después abre
  el pull request con `specgate alm pr <change-id>`. Archive va primero, para
  que la especificación y el código lleguen juntos a revisión.

La configuración y el ciclo completo están en [A partir de un ticket de Jira](from-a-ticket.md).

### Correcciones y refactors

Una corrección de bug o un refactor que no cambia el comportamiento contratado
**no necesita un requisito nuevo**. El gate se ejecuta en cada pull request,
pero solo pide lo que debe un requisito entregado; un PR que no añade ninguno
no debe nada nuevo.

Si la corrección cambia lo que promete un requisito entregado, cambia su
sección de `spec.md` y su escenario en el mismo PR. Para un cambio mayor de un
comportamiento ya entregado, usa un [change](reviewing-changes.md).

---

## El revisor: qué leer y qué saltarse

El gate ya demostró la parte mecánica: cada requisito entregado tiene un
escenario, el escenario tiene pasos reales, un test lo nombra, y los ficheros a
los que apunta la matriz existen. **No lo vuelvas a comprobar a mano.** Dedica
la revisión a lo que ninguna herramienta puede juzgar:

| Lee                                   | Pregunta                                                                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| La sección `## REQ-NNN` en `spec.md`  | ¿Es una sola obligación? ¿Podrían dos personas probarla y coincidir? ¿Es lo que pedía el ticket?                                               |
| El escenario                          | ¿Describen Given / When / Then _este_ comportamiento con valores reales, o un camino feliz genérico? ¿Falta el caso límite interesante?        |
| El test que menciona `REQ-NNN`        | ¿Comprueba lo que dice el _Then_ del escenario, o solo que nada lanza una excepción? Un test que menciona el ID y no comprueba nada pasa el gate. |
| El discover y el estado               | `discover.md` dice por qué. Cada requisito está `Implemented` —si no, `archive` no se habría ejecutado— y su código está en este PR.            |

Sáltate `docs/specs/traceability.md`. Se genera a partir de los ficheros de
arriba —`check`, en local y en CI, lo regenera antes de juzgar—, así que un
diff ahí es una consecuencia, no una decisión.

Lo único que el gate no puede atrapar es un test que nombra un requisito y no
lo prueba. Ese es el trabajo de quien revisa, y son los cinco minutos más
valiosos de la revisión.

---

## Cuando `check` falla

Cada fallo dice qué está mal y cómo arreglarlo, y la mayoría llevan un código
entre corchetes que puedes buscar. Los que se encuentra un primer PR:

### `scenario_placeholder_step`

```
✖  features/invoices.feature:4 unfilled placeholder in "given <the state before the action>" … [scenario_placeholder_step]
```

Un archivo feature aún tiene los `<placeholders>` que escribió `new`. Un
requisito Draft puede conservarlos; uno que se está entregando no, porque
Cucumber reporta un escenario de placeholders como `0 steps · exit 0`. Escribe
los pasos reales.

En el delta de un change el mismo problema es `scenario_steps_unwritten`, y hace
fallar `check` en cuanto el change está abierto (`check_change_invalid`):
escribe el escenario antes de hacer push del change.

### `matrix_stale`

```
  ✖  docs/specs/traceability.md no longer matches spec.md, the feature tags and the tests.
     Run `specgate matrix` and commit the result — `specgate check` does it for you.
```

Solo desde `specgate validate` ejecutado por sí solo: cambió un test o una
etiqueta y la matriz regenerada no se commiteó. `specgate check` —lo que
ejecuta el job de CI que escribió `specgate ci init`— regenera primero la
matriz y no falla por ella. Ejecuta `specgate check` en local y commitea `traceability.md`.

### `[TDD-1]`: entregado sin test

```
✖  --strict-tdd violations detected:
[TDD-1] Test artifact is TBD but status is 'Implemented' (scenario: SCN-007a)
   TDD-1: Write a test that mentions the requirement (REQ-NNN) — that is the link; …
```

`check` lo reporta bajo `validate --strict` y falla con
`check_validate_failed`. El requisito está más allá de Draft y ningún test lo
menciona: normalmente se renombró o se borró el test. Menciona `REQ-007` en el
test que lo cubre, o vuelve a poner `status=Draft` en su comentario `specgate:trace`.

### `declared_artifact_missing`

```
✖  docs/specs/traceability.md REQ-007's test artifact `test/invoice.test.js` does not exist. [declared_artifact_missing]
```

Ha desaparecido un fichero al que el requisito apunta _explícitamente_: una
ruta escrita en su comentario `specgate:trace` (`test='…'`, `artifact='…'`), o
en una matriz mantenida a mano. Restáuralo, o corrige la ruta. Un test enlazado
solo por mencionar el requisito no produce esto: borra ese test y obtienes `[TDD-1]`.

### `requirement_template_obligation`

El requisito dice estar entregado mientras su sección `## REQ-NNN` todavía dice
"The system MUST satisfy: <title>." con la nota que dejó `specgate new` debajo.
Escribe la obligación real y borra la nota. Un Draft aún no debe nada.

### `check_tests_failed` / `done_tests_failed`

Fallaron los tests del proyecto. Solo se ejecutan cuando hay un comando de
tests configurado (`--test-cmd "npm test"`, o `specgate config set test_cmd "npm test"` una vez).
Sin él, `check` y `apply` dicen que comprobaron la especificación y no el
código: lee ese aviso como "no se ejecutó nada", no como un pase.

### `apply_no_test`

Ningún test menciona todavía el requisito. Nómbralo en el test que lo cubre
(`REQ-007`, y su escenario `SCN-007a`), y vuelve a ejecutar `specgate apply
REQ-007`.

### `done_validate_failed`

`apply` ejecutó el gate y falló; la salida de encima dice por qué. No se
escribió nada. Corrígelo y vuelve a ejecutar `apply`. `apply --no-check`
escribe el estado de todos modos: resérvalo para el caso raro en que sabes que
el gate se equivoca, y dilo en el PR.

### `archive_requirements_pending`

`archive` encontró un requisito del change que no está `Implemented`. Ejecuta
el `specgate apply REQ-…` que nombra; `--force` no se salta esto.

---

## El acuerdo que tomar como equipo

Bastan tres frases. Ponlas en la guía de contribución del repositorio:

1. Un pull request que entrega comportamiento lleva su requisito, su
   escenario y un test que lo menciona, como un change, archivado en el mismo
   pull request.
2. `specgate check` está en verde antes de pedir revisión.
3. Quien revisa lee el requisito, el escenario y el test, no la matriz.

---

## Siguiente

- [Los cuatro verbos, y el resto](commands.md)
- [Escribe un escenario que merezca la pena probar](writing-specs.md)
- [Cambia un requisito ya entregado](reviewing-changes.md)
- [Qué comprueba el gate, flag a flag](validating.md)
