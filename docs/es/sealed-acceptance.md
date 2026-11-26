<!-- translation-of: e5f40473030f -->
# Tests de aceptación sellados

El agente que implementa un requisito no debería escribir también el test que
lo juzga: un test equivocado lo sigue, o lo escribe, la misma mano.
Los tests de aceptación sellados separan los papeles. Los escribe otra persona,
una persona los aprueba, y a partir de entonces el agente no puede cambiarlos:
el gate los ejecuta con tu propio comando de tests.

<!-- specgate:diagram sealed-acceptance -->

Specgate no lee ningún test. Solo controla quién puede cambiarlo, así que esto
funciona en cualquier lenguaje con el que tu proyecto haga tests: JUnit,
pytest, Playwright, pasos de Cucumber.

## 1. Escríbelos: no el agente que implementa

Escribe los tests de aceptación a partir de la especificación y el diseño del
change, nunca a partir del código: una persona, u otro agente que solo ve
`spec.md`, `features/` y `docs/specs/`. Nombra el requisito y el escenario en
el título de cada test (`REQ-014 SCN-014 — peak rate above the threshold`).

Lista cada fichero en `docs/specs/changes/<change-id>/acceptance-tests.md`, una
línea por fichero, con los escenarios del change que demuestra:

```markdown
- test/acceptance/pricing.spec.ts — SCN-014, SCN-015
- src/test/java/PricingIT.java — SCN-014
```

Esto no es `acceptance.md`: ese fichero es la lista de firma de negocio que
escribe `specgate acceptance <change-id>`.

## 2. Apruébalos y séllalos: una persona, en una terminal

Primero se aprueba el propio change (`specgate change approve <change-id>`).
Después una persona lee los tests frente a los escenarios y los sella:

```bash
specgate change approve <change-id> --layer acceptance
```

Una vez sellados, los ejecuta una vez con `acceptance_cmd` (paso 3) y muestra por qué fallan. Antes de que exista el código deben fallar por el código; un test que falla porque carga un fichero desde una ruta errónea no pasará nunca: corrígelo y séllalo de nuevo.

Se niega, sin registrar nada, cuando falta un fichero listado, cuando una línea
no nombra ningún escenario del change, o cuando el change no está aprobado.
Ejecutado sin terminal —por la herramienta de un agente— se niega con
`approve_needs_person`.

Cada fichero queda registrado en el `approvals.json` del change por su sha256.

## 3. Dile al gate cómo ejecutarlos

```bash
specgate config set acceptance_cmd "npx playwright test {files}"
```

`{files}` representa las rutas selladas. Otros ejemplos: `pytest {files}`,
`mvn -q verify -Dit.test=PricingIT`. Specgate no instala nada.

## Qué hacen el gate y el guard

`specgate check` (y por tanto `apply`) tiene una etapa `acceptance`:

| Hallazgo | Cuándo | Qué hacer |
| --- | --- | --- |
| `acceptance_not_sealed` | un fichero sellado cambió o ya no está | restáuralo (`git checkout -- <file>`), o haz que una persona apruebe la nueva versión |
| `acceptance_red` | `acceptance_cmd` termina con un código distinto de cero | corrige el código: el test es el contrato |
| `acceptance_no_command` | hay tests sellados y no hay `acceptance_cmd` | fíjalo (paso 3) |

La regla es `acceptance` en `.specgate/gate.yaml`: un error en `strict` y
`standard`, un aviso en `minimal` ([política del gate](gate/policy.md)).

Donde se ejecutan los hooks de Specgate ([los guards](agents.md)), una
escritura, una edición, un parche o un comando de shell que cambia un test
sellado se rechaza con `acceptance_sealed`; un test sellado que nombra un
requisito cuenta como el test escrito primero. Donde no se ejecuta ningún hook,
el [juez externo](harness.md) ve el cambio y hace fallar la ejecución.

## Después de archivar el change

El sello se mantiene. Un test sellado de un change archivado se sigue
comprobando y protegiendo. Para cambiar uno, abre un change que lo liste en su
propio `acceptance-tests.md`, y haz que una persona lo apruebe: el sello nuevo
sustituye al antiguo.

Ese change necesita un delta real. `propose` lo escribe como plantilla, y
`change approve` rechaza la plantilla (`approve_blocked`: el requisito no tiene
`kind=`, sus pasos son `<placeholders>`); un change que no está aprobado no
puede sellar (`acceptance_change_not_approved`). El delta reescribe el requisito
que demuestra el test bajo `## MODIFIED Requirements`, con el escenario que
nombra el test, y `acceptance-tests.md` nombra ese escenario:

```bash
specgate propose reseal-pricing --capability pricing
# specs/pricing/spec.md: ## MODIFIED Requirements, then REQ-014 whole,
#   with "#### Scenario: SCN-014 — …" and <!-- specgate:trace kind=functional -->
# acceptance-tests.md:   - test/acceptance/pricing.spec.ts — SCN-014
specgate change approve reseal-pricing                      # a person
specgate change approve reseal-pricing --layer acceptance   # the new seal
```

Después vuelve a hacer `apply` del requisito y archiva el change, como con
cualquier requisito `MODIFIED`.

## Siguiente

- [Cambia un requisito ya entregado](reviewing-changes.md) — la revisión completa, de propose a archive
- [La política del gate](gate/policy.md) — la regla `acceptance` y las demás
- [Qué significa un fallo](gate/failures.md) — cada código, con su corrección
