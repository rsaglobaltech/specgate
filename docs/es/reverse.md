<!-- translation-of: 51a080939243 -->
# Especifica un sistema que ya funciona

Al final de esta página tu código existente tiene sus primeros requisitos, cada
uno en `Draft` y citando las líneas de las que se leyó, y el gate está activado
en CI sin fallar por los huecos que el proyecto ya tenía.

**Necesitas:** un repositorio adoptado con `specgate init` (o `specgate adopt`),
git y un agente que puedas ejecutar desde la línea de comandos
([Elegir tu agente](agent-setup.md)).

<!-- specgate:diagram adopt-existing -->

## 1. Mira los módulos

```bash
specgate reverse --modules
```

```
  billing                          java     41 file(s)
  orders                           java     63 file(s)
```

Los candidatos son las carpetas con su propio manifiesto de build (`pom.xml`,
`build.gradle`, `package.json`, …) en el primer o segundo nivel del repositorio,
los paquetes de un módulo Go, y las carpetas bajo `src/` o `apps/` que contienen
código; las carpetas con nombre de tests, ejemplos o muestras se omiten. Cada
una se lista por su ruta, con su stack y su número de archivos de código, tests
incluidos. No se ejecuta ningún agente. Con `--json`, la lista es
`reverse.modules`.

Si no se encuentra nada, nombra tú la carpeta: `specgate reverse src/billing`.

## 2. Haz reverse de un módulo

```bash
specgate reverse orders --agent "claude -p < {prompt_file}"
```

Sin `--agent`, se ejecuta el `agent:` de `harness.config.yaml`. El agente recibe
los archivos de código, de test y de schema del módulo, y responde con un
archivo JSON: requisitos, sus escenarios y el `source` del que se leyó cada uno.
Specgate escribe el change `docs/specs/changes/reverse-orders/` a partir de esa
respuesta:

```markdown
### Requirement: REQ-041 — A shipped order cannot be cancelled

The system SHALL refuse to cancel an order whose status is SHIPPED.

#### Scenario: SCN-041a — A shipped order

- GIVEN an order with status SHIPPED
- WHEN its owner cancels it
- THEN the cancellation is refused

<!-- specgate:trace status=Draft actor=Developer kind=functional source=orders/src/main/java/x/Cancel.java:12 -->
```

Lo que se cumple haga lo que haga el agente:

- **Cada requisito está en `Draft`.** El código dice lo que el sistema hace, no
  lo que debería hacer. Una persona saca un requisito de Draft cuando lo ha
  leído frente a su código.
- **Cada requisito cita su código** en `source=`.
- **Un posible defecto es una pregunta, no un requisito.** El comportamiento
  que el agente marca como sospechoso va al `questions.md` del change.
  Escribirlo como requisito convertiría el bug en el contrato.
- **Nada más cambia.** `spec.md` y las especificaciones de las capacidades no se
  tocan, y cualquier escritura que haga el agente fuera de su archivo de
  respuesta se deshace y se nombra.
- **Un change que no valida no se conserva.** Tampoco una respuesta sin
  `source`, sin escenario o que no sea JSON.

Un módulo por ejecución, revisado antes del siguiente: un repositorio entero de
una vez es más de lo que nadie lee.

## 3. Revísalo

Lee cada requisito frente a las líneas que cita su `source=`, responde
`questions.md` y sigue como con cualquier change:
`specgate change validate reverse-orders`, un test que nombre cada requisito,
`specgate apply`, `specgate archive`.

Cuando un archivo citado se borra o se mueve, `specgate validate` avisa con
`source_missing` y lo nombra. No hace fallar el gate: mover código no es romper
un contrato. Lee el requisito frente a donde fue el código y actualiza su
`source=`.

## 4. Activa el gate sin un build en rojo

Un proyecto existente suele tener huecos que el gate encuentra el primer día,
como filas marcadas Implemented sin test. Regístralos una vez:

```bash
specgate check --baseline
git add docs/specs/gate-baseline.json
```

A partir de ahí, `specgate check` y `specgate validate` solo fallan con un
hallazgo que no esté en `docs/specs/gate-baseline.json`. Cada ejecución dice
cuántos dejó pasar (`baselined`) y nombra cada hallazgo de la baseline que ya no
ocurre (`baseline_fixed`), para que puedas volver a ejecutar `check --baseline`
y el archivo encoja.

Un hallazgo se empareja por su código, su archivo y su requisito (u objetivo),
no por su redacción, salvo un hallazgo que no nombra ninguno de los dos, que se
empareja por su mensaje. La baseline guarda los hallazgos de trazabilidad de
`validate --strict` (las reglas TDD y los checks de la matriz). Los demás checks
siguen fallando como antes: cuando uno falla, `check --baseline` lo dice y
registra lo que pudo.

## Un sistema grande: primero un área

`specgate adopt --scope src/billing` adopta el repositorio pero lista solo las
áreas bajo esa ruta en `docs/specs/adoption.md`, y `spec.md` y el escenario de
la baseline nombran el alcance (REQ-337). La adopción lista ocho áreas como
máximo; cuando encuentra más avisa con `adopt_too_big`, nombrando las que dejó
fuera, y sugiere `--scope` (REQ-338).

## Siguiente

- [Escribir especificaciones](writing-specs.md)
- [Validar](validating.md)
