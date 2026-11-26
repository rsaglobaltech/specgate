<!-- translation-of: 726201c32c41 -->
# El método

Specgate es una herramienta, y la herramienta codifica una forma de trabajar.
Esta página es esa forma de trabajar: los principios que hay detrás, las cuatro
fases por las que pasa un producto, las dos formas de entrar, quién hace qué, y
dónde vive cada artefacto. Cada paso nombra el comando que lo hace; nada de lo
que hay aquí es un consejo que la herramienta no haga cumplir o no produzca.

<!-- specgate:note -->
**Anclado en la especificación, no especificación primero.** La especificación
no es un prompt que se escribe una vez y se tira cuando el código existe, y el
código no se regenera a partir de ella. Se queda en el repositorio durante toda
la vida del sistema, junto al código y los tests que la demuestran, y cada
cambio en el sistema la cambia primero a ella.
<!-- specgate:endnote -->

## Seis principios

1. **La especificación vive en el repositorio.** Requisitos numerados con
   escenarios Gherkin, revisados en pull requests como el código, versionados
   con él. → [Conceptos](concepts.md)
2. **Nada está hecho hasta que un test lo demuestra.** Un requisito está
   `Implemented` solo cuando un test lo nombra y el gate pasa; si no,
   `specgate apply` no escribe nada. El mismo gate se ejecuta en local y en CI.
   → [Validar](validating.md)
3. **La ambigüedad se pregunta, nunca se adivina.** Un borrador a partir de un
   brief o de un ticket se ciñe a su texto de origen; cada valor que nadie dio
   se convierte en un supuesto o una pregunta, y el requisito que bloquea
   espera la respuesta. → [A partir del brief de un cliente](from-a-brief.md)
4. **La especificación cambia primero.** El trabajo nuevo, un bug o una mejora
   abren un change; el código sigue al delta, nunca al revés.
   → [Cambia un requisito ya entregado](reviewing-changes.md)
5. **El agente trabaja dentro de las mismas reglas.** Recibe el mismo ciclo, un
   test antes del código, un gate al que no puede convencer, ficheros que no
   puede tocar y decisiones que debe dejar a una persona. → [El harness](harness.md)
6. **Las personas que deciden pueden leerla.** Un change se convierte en una
   página que cualquiera puede abrir; la aceptación la firma una persona; la
   guía se escribe por actor.
   → [Revisa con el negocio](business-review.md)

Una especificación perfecta no es posible ni necesaria. Lo que pide el método
es una especificación que pueda estar **equivocada** —cada requisito lo
bastante concreto para comprobarlo— y un gate que lo diga en el momento en que
lo está.

## Cuatro fases

Las fases se solapan y se repiten: un producto está en las cuatro a la vez, un
change cada vez. Lo que las separa es la pregunta que responden.

| Fase | La pregunta | Lo que sale de ella | Comandos |
| --- | --- | --- | --- |
| **Inicio** | ¿Qué vamos a construir, o qué hay ya? | Un brief, sus actores y módulos; o los módulos existentes y una baseline | `init`, `propose --from-brief --new-brief`, `reverse --modules`, `check --baseline` |
| **Forma** | ¿Qué debe hacer exactamente, y qué hemos decidido? | Requisitos y escenarios en un change, preguntas respondidas, ADRs, el glosario y las reglas de negocio | `propose`, `questions`, `answer`, `change approve`, `adr`, `stack`, `review` |
| **Construcción** | ¿Lo hace? | Tests que nombran cada requisito, código, un gate en verde | `status`, `apply`, `harness run`, `check` |
| **Entrega** | ¿Lo acepta el negocio? | El change archivado en la especificación, notas de versión, una aceptación firmada, una guía por actor | `archive`, `release-notes`, `acceptance --sign`, `guide` |

### Inicio

Para un producto nuevo, el brief del cliente se guarda como `docs/brief.md`:
`specgate propose --from-brief --new-brief` escribe uno para rellenar, y
`specgate propose --from-brief` nombra sus módulos y el siguiente que redactar.
Para un sistema que ya funciona, `specgate init` adopta el repositorio sin
tocar su código, `specgate reverse --modules` lista sus módulos, y
`specgate check --baseline` registra los hallazgos de hoy para que solo fallen
los nuevos.

### Forma

Se abre un change —`specgate propose <id>`, `--from-brief <module>`,
`--from-ticket <KEY>`, o `specgate reverse <module>` para código existente— y
su delta contiene los requisitos que añade o modifica. Las preguntas que solo
puede responder el cliente van al `questions.md` del change (`specgate
questions`, `specgate answer`). Las decisiones que sobreviven al change se
registran como ADRs (`specgate adr new`), y lo que el agente puede decidir solo
se escribe en `docs/specs/decision-rights.md`. Las palabras se fijan en el
glosario, las reglas se numeran `BR-NNN`.

Un change tiene tres capas, cada una propiedad de un rol (ADR-0044):

| Capa | Propietario | Dice |
| --- | --- | --- |
| `discover.md` | product | El porqué, el caso de uso y los criterios de aceptación `AC-1`, `AC-2`… |
| `design.md` | architect | Cómo se cumple cada criterio: módulos, mecanismos, canales, decisiones |
| `tasks.md` | developer | El trabajo, con cada tarea nombrando el requisito que entrega |

Antes de construir, `specgate review <change>` da a las personas que deciden
una página que leer, y cada capa la aprueba alguien con su rol —
`specgate change approve <id> --layer discover|design|tasks`, o Approve en el
studio. Aprobar es un acto de una persona: el comando rechaza una sesión sin
terminal, como lo es la herramienta de un agente. `specgate apply` rechaza un
requisito de un change que ninguna persona aprobó (`change_not_approved`), y el
harness construye un change solo cuando sus capas están aprobadas. La
aprobación sella cada requisito por su hash; editar uno, o una capa, vuelve a
pedir su aprobación.

### Construcción

`specgate status` nombra el siguiente requisito. Primero va un test que lo
nombra; después el código; después `specgate apply`, que ejecuta el gate para
ese requisito y lo marca `Implemented` solo si pasa. El harness hace lo mismo
sin supervisión: un requisito, un worktree, un agente —opcionalmente un tester
y un implementador— y solo se conserva lo que pasa el gate. `specgate check`
ejecuta el gate completo antes de cada pull request y en CI.

### Entrega

Cuando todos los requisitos de un change están entregados, `specgate archive`
lo integra en la especificación, en su rama, para que la especificación y el
código lleguen a revisión en un solo pull request. `specgate release-notes
<from>..<to>` escribe lo que cambió para el negocio, agrupado en bugs y
mejoras. `specgate acceptance <change>` escribe una lista de los criterios de
aceptación y de cada escenario; una persona marca cada elemento y firma con
`--sign`, y los requisitos `Implemented` del change pasan a `Verified`.
`specgate guide` escribe una guía de usuario por actor a partir de lo entregado.

## Iteraciones

Una iteración es un puñado de changes llevados de formados a entregados.
Que sea corta es la idea: el gate mantiene la especificación verdadera en cada
paso, así que nada se guarda para el final —ni una gran especificación por
adelantado, ni un sprint de documentación después—. Cada iteración termina con
las personas que deciden leyendo la página de revisión o el studio, y la
siguiente empieza a partir de sus respuestas.

## Dos formas de entrar

<!-- specgate:cards cols=2 -->
- [Un producto nuevo](from-a-brief.md) — El brief, sus módulos redactados de uno en uno, cada valor inventado convertido en una pregunta, y después construir, archivar y entregar.
- [Un sistema que ya funciona](reverse.md) — Adoptado sin tocar su código, un módulo invertido en requisitos Draft que citan su fuente, el gate activado con una baseline, y a partir de ahí cada cambio pasa por un change.
<!-- specgate:endcards -->

El trabajo que llega como tickets de Jira entra de la misma forma, con
`specgate propose --from-ticket`. → [A partir de un ticket de Jira](from-a-ticket.md)

## Quién hace qué

| Rol | Hace | Con |
| --- | --- | --- |
| Cliente o product owner (rol `product`) | Responde preguntas, escribe y aprueba el Discover, lee la página de revisión, firma la aceptación | `answer`, `change approve --layer discover`, `review`, `acceptance --sign`, el studio |
| Arquitecto (rol `architect`) | Escribe y aprueba el Design, registra decisiones | `change approve --layer design`, `adr`, `stack` |
| Analista | Escribe y revisa requisitos, escenarios, el glosario, las reglas de negocio y los recorridos | `propose`, deltas, `validate` |
| Desarrollador (rol `developer`) | Aprueba las Tasks, escribe primero el test y después el código | `change approve --layer tasks`, `apply`, `check` |
| Revisor | Lee el delta, sus escenarios y sus tests en el pull request | el pull request |
| Agente | Redacta a partir de una fuente, construye un requisito, pregunta cuando no puede decidir | `propose --from-brief`, `reverse`, `harness run`, `ask` |

Una persona suele tener varios roles. Quién tiene `product`, `architect` y
`developer` se escribe bajo `roles:` en `harness.config.yaml`; un rol para el
que no se nombra a nadie queda abierto a cualquiera ([Carriles, roles y
límites](harness-roles.md)). En el studio servido a un equipo, un lector lee,
los cambios de un editor llegan como pull requests, y un admin ejecuta
builds → [El studio para un equipo](studio-team.md).

## Dónde vive cada artefacto

| Artefacto | Dónde | Escrito o generado |
| --- | --- | --- |
| El brief | `docs/brief.md` | Escrito |
| Requisitos | `spec.md`, `docs/specs/capabilities/<capability>/spec.md` | Escritos, mediante changes |
| Escenarios y recorridos | `features/**/*.feature` | Escenarios escritos por archive a partir de los deltas; recorridos a mano |
| Un change abierto | `docs/specs/changes/<id>/` — `discover.md`, `design.md`, `tasks.md`, el delta, `questions.md`, `acceptance.md` | Escrito |
| Aprobaciones de un change | `docs/specs/changes/<id>/approvals.json` | Escritas por `change approve`, por capa y versión |
| Matriz de trazabilidad | `docs/specs/traceability.md` | Generada a partir de lo que nombran los tests, o mantenida a mano |
| Glosario | `docs/specs/glossary.md` | Escrito |
| Modelo de entidades, actores | `docs/specs/model.md`, `docs/specs/actors.md` | Generados |
| Decisiones | `docs/specs/adr/`, `docs/specs/decision-rights.md`, `docs/specs/stack.md` | Escritas; el fichero del stack se genera y después se mantiene |
| Baseline del gate | `docs/specs/gate-baseline.json` | Generada por `check --baseline` |
| Página de revisión | `<change>-review.html` | Generada |
| Guía de usuario | `docs/guide/<actor>.md` | Generada |
| Notas de versión | impresas, o `--out <file>` | Generadas |
| Un workspace de repositorios | `specgate.workspace.yaml` en su propio repositorio; una historia por `docs/stories/<id>/story.md` | Escrito ([Workspace](workspace.md)) |

## La vida de un requisito

`Draft` aún no debe nada; `Approved` y los estados posteriores deben un test
que nombre el requisito; `Implemented` lo pone `apply` cuando el gate pasa;
`Verified`, una aceptación firmada; `Released`, cuando tú lo marcas
(`specgate done <REQ> --status Released`); `Deprecated` vuelve a no deber nada.
Un requisito que espera al cliente está en `Needs Clarification` y nadie puede
cerrarlo hasta que se responda. → [Un estado es una promesa](concepts.md#5-un-estado-es-una-promesa-y-el-gate-la-cobra)

## Siguiente

- [Empieza aquí](start.md) — dos caminos, unos pocos comandos cada uno
- [Conceptos](concepts.md) — las seis ideas detrás de cada comando
- [Referencia de comandos](commands.md) — todos los comandos, agrupados por tarea
