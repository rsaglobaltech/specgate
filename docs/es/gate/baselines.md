<!-- translation-of: 451b1ac03ca5 -->
# Adopta el gate sin un build en rojo

Activa el gate en un proyecto que ya tiene historia y puede encontrar cosas el
primer día: un requisito marcado como Implemented que ningún test nombra, un
hallazgo de SpotBugs de hace tres años. Corregirlo todo antes de que el gate
pueda proteger algo significa que el gate nunca llega. Al final de esta
página los hallazgos de hoy quedan registrados como deuda conocida, solo falla
un hallazgo que añade un change, y la deuda solo puede reducirse.

## Dos baselines, para dos tipos de hallazgo

| | Baseline del gate | Baseline de calidad |
| --- | --- | --- |
| Registra | Hallazgos de la matriz de trazabilidad bajo `validate --strict` | Hallazgos de los checks de calidad que escriben SARIF: SpotBugs, PMD, Semgrep, gitleaks, SonarQube… |
| Lo escribe | `specgate check --baseline` | `specgate quality baseline` |
| Archivo | `docs/specs/gate-baseline.json` | `.specgate/quality-baseline.json` |
| Un hallazgo es | Su código, su archivo y su requisito | Una huella que sobrevive a que el código se mueva |
| Volver a tomar una parte | Ejecuta `check --baseline` de nuevo | `quality baseline --accept <check>` |

Haz commit de ambos archivos. El gate los lee en CI exactamente igual que en tu
máquina.

## El baseline del gate

```bash
specgate check --baseline
```

```text
  ◆ specgate · check --baseline   shop

  ✔  1 finding(s) recorded in docs/specs/gate-baseline.json.
     From now on the gate fails only on a finding that is not in it. Commit the file.
```

A partir de ahí `check` y `validate` pasan con los hallazgos registrados y lo
dicen:

```text
     · 1 finding(s) baselined in docs/specs/gate-baseline.json: recorded before, not failing.
```

Un hallazgo corregido se informa, para que el archivo pueda reducirse:

```text
     · REQ-003: the baselined finding strict_tdd_1 no longer occurs.
     Run `specgate check --baseline` to drop it from the baseline.
```

**Lo que no puede contener.** Solo los hallazgos de la matriz son deuda: un
test que falta, un enlace que no apunta a nada. Un escenario roto, o una
obligación en `spec.md` que sigue siendo la frase que escribió Specgate, no es
deuda sino un requisito que no dice nada, y `--baseline` se niega a
registrar por encima:

```text
  ✖  spec.md  REQ-003: its obligation in spec.md is still the sentence Specgate wrote.  [requirement_template_obligation]
     fix: Replace "The system MUST satisfy: …" and the "> Written by Specgate" note under ## REQ-003 with the real obligation — what must hold, when, and how it is observed.
  ✖  docs/specs/gate-baseline.json records 1 finding(s), and validate --strict still fails on what a baseline cannot hold.  [baseline_incomplete]
     fix: Fix what validate reports, then run `specgate check --baseline` again.
```

Corrige eso y luego registra el resto. Una base de código existente completa,
módulo a módulo:
[Especifica un sistema que ya funciona](../reverse.md#4-turn-the-gate-on-without-a-red-build).

## El baseline de calidad

```bash
specgate quality baseline
specgate quality baseline --accept spotbugs     # re-take one check, on purpose
```

Ejecuta cada check que escribe SARIF y registra lo que encuentra cada uno hoy.
A partir de ahí un check falla solo con un hallazgo que no está en el archivo
y, por defecto, solo en los archivos que tocó el change (`scope: diff`). Cómo
se reconoce un hallazgo, y qué cambia `scope: all`: [Solo lo que añade un
change](../quality.md#only-what-a-change-adds).

## Que la deuda siga reduciéndose

- Vuelve a tomar un baseline solo para quitar lo que se corrigió, o en un pull
  request que explique por qué acepta más. El diff del archivo muestra
  exactamente qué hallazgos entraron.
- `baseline_fixed` en la salida del gate es la lista de lo que hay que quitar.
- Un requisito que el equipo está cambiando es el más barato de sacar del
  baseline: su test se está escribiendo de todos modos.

## Siguiente

- [Lee un fallo](failures.md)
