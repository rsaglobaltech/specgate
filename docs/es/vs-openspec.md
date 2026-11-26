<!-- translation-of: ff18259e1fab -->
# Specgate u OpenSpec

[OpenSpec](https://github.com/Fission-AI/OpenSpec) popularizó el trabajo guiado
por especificaciones con agentes de código, y merece ser la primera herramienta
que mires. Specgate existe por una razón que OpenSpec deja en tus manos a
propósito: **demostrar que lo que un agente llama terminado está terminado.**

<!-- specgate:note -->
Comprobado contra OpenSpec v1.14.1 (octubre de 2026), su documentación y su
código. Si algo de aquí está desactualizado, abre un issue y lo corregiremos.
<!-- specgate:endnote -->

## La respuesta corta

Las dos herramientas comparten ya los verbos diarios: `propose`, `apply`,
`archive`. La diferencia está en lo que hay detrás de `apply` y `archive`.

- **Elige OpenSpec** si quieres ese bucle ligero de changes con el soporte más
  amplio de agentes, y vas a imponer los tests tú.
- **Elige Specgate** si "terminado" tiene que significar que un test nombra el
  requisito y tu suite pasa, si las especificaciones salen del brief de un
  cliente, o si un agente construye sin supervisión. Su bucle son las mismas
  cuatro palabras —`propose`, `apply`, `status`, `archive`— con el gate dentro de
  `apply` y `archive`
  ([ADR-0035](specs/adr/0035-four-verbs-one-lifecycle.md)).
- **Usa las dos** si tu equipo ya escribe OpenSpec: consérvalo, y deja que
  [`specgate verify`](openspec.md) haga de gate de lo que archiva. Nada que migrar.

## En qué se diferencian

| | Specgate | OpenSpec |
| --- | --- | --- |
| **El bucle diario** | `specgate propose`, `apply`, `status`, `archive`; `init` una vez y `check` en CI. | `/opsx:propose`, `/opsx:apply`, `/opsx:archive`. |
| **Qué significa "terminado"** | `specgate apply` rechaza un requisito que ningún test nombra, y lo marca Implemented solo si el gate —especificación, matriz, tu suite de tests— pasa. | `/opsx:apply` recorre la lista de tareas; marcar una tarea es el registro. |
| **Cuándo se archiva un change** | Cuando su código está terminado: `specgate archive` se niega mientras un requisito que añade o modifica no esté Implemented, y `--force` no se lo salta. | Archive pregunta si continuar cuando hay tareas sin marcar, y `--yes` se salta la pregunta. `/opsx:verify` es una revisión por IA, y su documentación dice que "won't block archive". |
| **Tus tests** | Los ejecuta el gate. Un test que menciona `REQ-007` queda enlazado a él; nada que mantener a mano. | La CLI no los ejecuta ni los enlaza. La documentación sugiere imponerlo "with your own CI or hook". |
| **Un borrador escrito a partir de un brief** | `specgate propose --from-brief <module>` le da a tu agente el brief y los formatos, luego compara el borrador con el brief y se detiene en cifras, límites y tarifas que el brief nunca dijo. | Los prompts piden al agente que no invente la intención y que registre sus supuestos; nada comprueba el resultado. |
| **Trabajar desde tickets de Jira** | `specgate propose --from-ticket <KEY>` comprueba la historia contra una Definition of Ready, abre un change a partir de sus criterios de aceptación en su propia rama, y `specgate alm pr` abre un pull request por ticket. Mira [Desde un ticket de Jira](from-a-ticket.md). | Sin integración con Jira en la CLI; la historia llega a una propuesta a través de tu agente o a mano. |
| **Preguntas abiertas** | Un requisito en *Needs Clarification* no lo puede construir el harness ni entregar `apply` hasta que alguien responda. | Se registran como supuestos en prosa; nada se bloquea por ellas. |
| **Construir sin supervisión** | `specgate harness run`: un requisito por git worktree, el gate tras cada intento, los fallos pasan al siguiente. Solo hace merge con `--chain`, un requisito en verde cada vez. | `/opsx:apply` recorre la lista de tareas en la sesión de tu agente. |
| **Pruebas para el negocio** | `specgate report`: una página por producto: qué está hecho, qué está pendiente, qué no tiene test. | `openspec view`, un panel en el terminal. |
| **Escenarios** | Gherkin, etiquetados `@REQ-NNN @SCN-NNN`, ejecutables por un runner real. | Markdown `#### Scenario:` con viñetas WHEN/THEN. |
| **Código existente** | `init` adopta un repositorio sin tocar el código y propone capacidades a partir de sus archivos de build. | Pensado primero para código existente: las especificaciones crecen change a change. |

## Dónde va por delante OpenSpec

Preferimos que lo oigas de nosotros:

- **Adopción.** Decenas de miles de estrellas, cientos de miles de descargas
  semanales y una comunidad activa. Specgate es joven y pequeño.
- **Soporte de agentes.** Integraciones para más de 30 herramientas de agentes,
  frente a las 10 de Specgate.
- **Peso.** No hacen falta tests, ni un lenguaje concreto, ni CI para empezar.
  Los verbos de Specgate son igual de pocos, pero `apply` pide un test por
  requisito y `archive` los espera todos: esa es la idea, y también es más
  trabajo.
- **Personalización.** Los schemas de workflow de OpenSpec se pueden bifurcar y
  compartir. Los de Specgate también (`specgate schema fork spec-driven <name>`
  copia el grafo de artefactos incluido en el proyecto para editarlo), pero el
  gate dentro de `apply` y `archive` es el mismo sea cual sea el schema.

## Lo que aprendimos construyendo seis productos

Cada diferencia de arriba viene de algo que salió mal en un
[piloto](projects/index.md):

- **Los 47 requisitos terminados, el producto inservible**: sin rutas, sin
  pantallas. La lista de comprobación ahora pide un escenario de API y uno de
  pantalla por actor ([Rebar Crew](projects/rebar-crew.md)).
- **Todos los tests en verde, nadie podía comprar**: el carrito no tenía botón.
  Un escenario que solo ejercita la API se construye como una API
  ([Credit shop](projects/credit-shop.md)).
- **La app no arrancaba con el gate en verde**: ahora la suite ejecuta un test
  de arranque sin dobles ([FinCore](projects/fincore.md)).
- **Una regla de interacción entre fármacos que nadie nos dio** se quedó fuera
  del código porque *Needs Clarification* la bloqueó
  ([HealthTech](projects/healthtech.md)).

Un registro de changes que dice "terminado" no habría detectado ninguno. Un gate
que ejecuta los tests del producto detectó la mayoría, y ejecutar el producto
detectó el resto.

## Pasarse, o no

| Tienes | Haz esto |
| --- | --- |
| OpenSpec, y estás contento con él | Añade [`specgate verify`](openspec.md) a CI. Lee `openspec/` y nunca escribe en él. |
| OpenSpec, y quieres el bucle completo | Empieza un [recorrido de Specgate en un proyecto existente](getting-started.md). Conserva `openspec/` como historial. |
| Ninguno | Empieza por [Empezar](getting-started.md). |

La [comparación completa](comparisons.md) cubre también Spec Kit, las reglas de
Cursor y un README sin más.

## Siguiente

- [Ya usas OpenSpec](openspec.md) — conserva OpenSpec y ponle un gate con `specgate verify`
- [Empezar](getting-started.md) — instala Specgate y elige tu camino
