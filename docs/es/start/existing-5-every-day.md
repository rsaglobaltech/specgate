<!-- translation-of: 84d29bd71a21 -->
# Proyecto existente · 5 — Cada día

> **La versión corta** de un proyecto existente, en seis comandos: [Empezar](../start.md). Esta página es el mismo paso en detalle, con la salida grabada.

<!-- specgate:goal -->
**Cuando termines:** un bucle diario en el que la especificación crece con el
trabajo que ibas a hacer de todos modos —un change por cada corrección de bug,
historia o módulo— en lugar de como un proyecto aparte.
<!-- specgate:endgoal -->

**Antes de empezar:** las fases [1](existing-1-adopt.md) a
[4](existing-4-ci.md) están hechas: el gate se ejecuta en cada pull request.

| Quién | Hace qué |
| --- | --- |
| **Tú** | Empiezas con `status`; abres un change cada vez que llega trabajo |
| **Tu agente** | Sigue el mismo bucle: `AGENTS.md` le dice cómo |
| **CI** | Exige cada requisito aplicado en cada pull request |

## Empieza el día con `status`

```bash
specgate status
```

<!-- specgate:out-existing-status-daily:begin — generated; edit the source, not this block -->
```text
$ specgate status
  ◆ specgate · status   invoicing

  Requirements  ████████████████████  1 of 1 done

  ·  REQ-001 Preserve existing behaviour: your test suite holds it on every check.
     To close it, name REQ-001 in a test that starts the product.

  Next ───────────────────────────────────────────────────
  ➜  specgate new "<a behaviour you rely on>"
     every requirement written so far is delivered — add the next behaviour you rely on
```
<!-- specgate:out-existing-status-daily:end -->

`specgate` solo hace lo mismo. Cada comando termina con un bloque **Next**: el
único comando que toca ejecutar, solo en su línea para que puedas copiarlo. En
tu terminal, `status` también muestra a **Gato**, el gato que guarda el gate:
crece a medida que se aplican requisitos y enferma cuando `check` está en rojo;
[qué significa](scratch-5-every-day.md#gato-el-gato-que-guarda-el-gate).
`specgate config set pet off` lo guarda.

## De dónde viene el trabajo

El trabajo llega de una de tres maneras. Cada una abre un change, y a partir de
ahí el bucle es el mismo.

| El trabajo llega como… | Abre el change con | Guía |
| --- | --- | --- |
| Una corrección de bug, una funcionalidad pequeña, una regla que tocas | `specgate propose <change-id>` | [Fase 2](existing-2-specify.md) |
| Una historia de Jira con criterios de aceptación | `specgate propose --from-ticket <KEY>` | [Desde un ticket de Jira](../from-a-ticket.md) |
| Un área nueva del producto, descrita en un plan | `specgate propose --from-brief <module>` | [Escribe el brief](write-the-brief.md) |

**Un change que describes tú** es el caso habitual: tú, o tu agente, escribís
su delta.

**Un ticket de Jira** se lee, nunca se escribe. Ejecuta primero la comprobación del ticket:

```bash
specgate propose --from-ticket KAN-13 --check
specgate propose --from-ticket KAN-13
```

`--check` aplica la Definition of Ready del ticket: las reglas T1 a T9, como
"cada criterio de aceptación se puede medir". El segundo comando abre el
change a partir de la historia, con su texto en `ticket.md`, y crea y sube la
rama `feature/KAN-13-<slug>`. [Desde un ticket de Jira](../from-a-ticket.md)
cubre la configuración inicial, que se hace una vez.

**Un brief** —`docs/brief.md`— es para un área grande: se redacta un módulo
cada vez, cada módulo su propio change.

## El bucle

1. **Propose.** Abre el change, desde una de las tres fuentes de arriba, y
   escribe o revisa su delta.
2. **Approve.** Una persona lee el delta y ejecuta
   `specgate change approve <change-id>` en una terminal. Un agente no puede, y
   `apply` rechaza un requisito de un change sin aprobar
   (`change_not_approved`).
3. **Build.** Para cada requisito, escribe primero el test y nombra en él el
   requisito (`REQ-007`), y después el código: a mano, con tu agente, o con
   [el harness](../harness.md).
4. **Apply.** `specgate apply REQ-007` ejecuta el gate y marca el requisito
   como `Implemented`. Haz commit; en el trabajo de un ticket, empieza el
   mensaje del commit con la clave del ticket.
5. **Archive.** Cuando cada requisito del change está aplicado,
   `specgate archive <change-id>` lo fusiona en la especificación, en tu
   rama.
6. **Pull request.** La especificación y el código llegan juntos a revisión,
   y CI ejecuta el gate. Para el change de un ticket, el comando `alm pr` abre
   su única pull request en GitHub; consulta [Desde un ticket de Jira](../from-a-ticket.md).

```
specgate propose  →  change approve  →  test and code  →  specgate apply  →  specgate archive  →  pull request
```

## Tres hábitos que hacen que la adopción dure

1. **Cada corrección de bug recibe un requisito.** Antes de corregirlo, abre un
   change para el comportamiento que se rompió, escribe el escenario que lo
   reproduce y nómbralo en el test. La corrección lo aplica. Tu especificación
   se llena justo donde estaba el riesgo.
2. **Un módulo cada vez.** Cuando un módulo importa —facturación, permisos,
   cualquier cosa regulada—, descríbelo como un change, como en la
   [fase 2](existing-2-specify.md#el-modulo-entero-cuando-estes-listo). Su
   área en `docs/specs/adoption.md` es solo un mapa: la adopción no escribió
   ningún requisito para él que haya que sustituir.
3. **Las funcionalidades nuevas empiezan como requisitos.** Una petición de
   funcionalidad se convierte en un change, en el change de un ticket o en el
   módulo de un brief antes de convertirse en código.

## Deja que el agente saque requisitos de la lista

Cuando un requisito tiene un escenario real, el harness —el runner de Specgate
para trabajo sin supervisión— puede construirlo: un worktree de git por
requisito, tu agente escribiendo el código, tu gate como juez. Es útil para el
backlog de comportamientos pequeños y bien especificados. Consulta [el harness](../harness.md).

## Siguiente

- [Desde un ticket de Jira](../from-a-ticket.md)
- [Escribe buenos requisitos y escenarios](../writing-specs.md)
- [La primera pull request de tu equipo: autor y revisor](../first-pr.md)
- [Todos los comandos](../commands.md)

[← Volver al principio](../getting-started.md)
