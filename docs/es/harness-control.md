<!-- translation-of: a231cf55bc2d -->
# Controla el harness desde una herramienta

Un editor o un panel —las vistas Build y Live de specgate-studio— inicia
`specgate harness run` y lo sigue sin leer prosa: el JSON de la ejecución,
su stream, el comando de parada y la API. Esta página es ese contrato. Para lo
que hace el harness, consulta [El harness](harness.md).

## Para después del requisito en curso

```bash
specgate harness stop --after-current
```

La ejecución termina el requisito en el que está y no empieza ninguno más. El resto
se informa como no intentado, y `--format json` dice por qué bajo `stopped`
(`by`: `request`). No se mata nada: la ejecución lee la petición entre
requisitos, igual en todas las plataformas. Si no hay ninguna ejecución trabajando en el
proyecto, no se pide nada y la respuesta lo dice (`harness_not_running`).

`specgate harness stop --now` termina la ejecución en el acto, con todos los comandos
que inició; la respuesta dice `stop.now: true`, y el requisito en curso
conserva su worktree para `specgate harness run --resume` (REQ-583).

## Mira antes del siguiente intento

`specgate harness run --pause-between-attempts` espera tras un intento fallido:
`.harness/events/paused.json` dice dónde. `specgate harness continue` empieza el
siguiente intento; `specgate harness continue --stop` termina el requisito sin
él (REQ-591).

## Construye con archivos sin commit

El harness rechaza un working tree que no está limpio. Con `--allow-dirty` se
ejecuta igualmente: cada rama se crea desde el último commit, y tus archivos sin commit y
sin versionar se quedan como están, aquí, fuera de la ejecución. El JSON los lista
bajo `dirty.leftOut`. No con `--chain`, que hace merge en esta copia de trabajo.

## Recíbelo como stream JSON

```bash
specgate harness run --format jsonl
```

Stdout lleva un objeto JSON por línea y nada más; la prosa de progreso va
a stderr. La primera línea es `run-start`, la última es siempre `run-end`, también la de
una ejecución rechazada. Cada línea tiene `type` y `t` (segundos epoch), y `req` y
`attempt` cuando trata de un requisito:

| `type`                                 | Cuándo                                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `run-start`                            | Antes del primer requisito: `queue`, `base`, `concurrency`, `maxAttempts`, `dirty`.                 |
| `attempt`                              | Un intento empieza (`state`: `start`) o termina (`end`, con `result` y la `stage` en la que falló). |
| `prompt`                               | El prompt que recibió un paso de agente: `role`, `chars`, `lines`.                                  |
| `agent-start`, `agent-end`             | Alrededor de cada paso de agente; `agent-end` tiene `exit`, `timedOut` y `ms`.                      |
| `output`                               | Lo que escribe el agente, según lo escribe: `stream` (`stdout`, `stderr`) y `text`, 4000 caracteres como máximo por línea. |
| `gate-start`, `gate`                   | Cada etapa del gate, y su `result`, `ms` y los recuentos de tests.                                  |
| `step`, `message`, `agent`, `usage`    | Lo que informa el adaptador del agente: llamadas a herramientas, sus palabras, su modelo, tokens y coste (`final`). |
| `question`                             | El agente preguntó: `text`, e `id`, `change` y `file` una vez está en el proyecto.                  |
| `merge`                                | `--chain` hizo merge de la rama del requisito.                                                      |
| `result`                               | El resultado de un requisito, como en `--format json`. Uno posterior para el mismo `req` lo sustituye. |
| `run-end`                              | Al final: `report`, el documento que imprime `--format json`, o `null` y `status` cuando la ejecución se rechazó. |

Los tipos son `HarnessStreamEvent` y `HarnessRunReport` en
`@rsaglobaltech/specgate/api`. Los archivos de eventos guardan lo que siempre guardaron;
`output`, `agent-start`, `agent-end`, `result` y las líneas propias de la ejecución solo están en
el stream. Con `--concurrency` mayor que 1, las líneas de cada worker llegan
enteras al stream.

## Una pregunta mientras se ejecuta

Cuando el agente ejecuta `specgate ask`, el harness escribe la pregunta en el
proyecto y hace commit de inmediato, y le sigue un evento `question` con su id.
El requisito termina como `question`, con el `waitingForAnswer` de su resultado nombrando la
pregunta y el comando que la responde. La ejecución no espera la
respuesta: una respuesta es una suposición que revisar antes de que la especificación la diga, y
el gate debe juzgar el escenario que la dice. Una vez revisada, ejecuta de nuevo el
requisito con `specgate harness run --req <REQ>`.

## Siguiente

- [El harness](harness.md)
- [Lo que ha costado el harness](harness-report.md): las estimaciones de `plan --json`
- [Automatización](automation.md): la API, `@rsaglobaltech/specgate/api`
