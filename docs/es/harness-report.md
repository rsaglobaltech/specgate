<!-- translation-of: aeb5701288dc -->
# Lo que ha costado el harness

`specgate harness report` te dice si pasar los requisitos por
[el harness](harness.md) está compensando: con qué frecuencia el primer intento del agente
pasa el gate, y cuánto tiempo cuesta cada requisito entregado.

**Necesitas:** al menos un `specgate harness run` en este proyecto. Cada ejecución
se registra en `.harness/runs/<timestamp>.json`, y el informe lee esos
archivos. Nunca ejecuta un agente, git ni nada en la red.

```bash
specgate harness report            # every recorded run
specgate harness report --last 5   # the five most recent runs
specgate harness report --json     # the same summary, for a script
specgate harness report --capability orders   # only the requirements of one capability
```

`--capability <name>` conserva los resultados de los requisitos que esa capacidad
enuncia: los de `docs/specs/capabilities/<name>/spec.md` y los que un change
abierto añade bajo `specs/<name>/`. `--json` la nombra entonces como
`report.capability`. Una capacidad que el proyecto no tiene sale con 2 y
`capability_unknown`, y la corrección lista las que tiene.

Un informe sobre dos ejecuciones tiene este aspecto:

```
  ◆ specgate · harness report   2 run(s)

  ████████████░░░░░░░░  3 of 5 requirements passed

    requirements attempted    5
    passed                    3
    failed                    1
    blocked                   1

    first attempt worked      67%  (2 of 3 passes)
    cost per delivered REQ    9m 40s  wall-clock, failed attempts included

  Where attempts ended ───────────────────────────────────
       3  gate rejected the work [gate]
       3  passed [pass]
       1  agent timed out [agent-timeout]

  Spent every attempt, delivered nothing ─────────────────
    REQ-004      15m 0s  3 attempt(s)

  Runs over time ─────────────────────────────────────────
    ██  2026-10-14 → 2026-10-16

  failures that were real   —  nothing recorded can tell a real failure from a gate that was
                              wrong — mark one: specgate harness report
                              --mark-false-failure REQ-NNN --reason "..."

  Slowest ────────────────────────────────────────────────
    REQ-004      15m 0s  3 attempt(s), fail
    REQ-002       7m 0s  2 attempt(s), pass
    REQ-003       4m 0s  1 attempt(s), pass
    REQ-001       3m 0s  1 attempt(s), pass
```

## Los dos números que importan

- **El primer intento funcionó** dice si los reintentos aportan algo. Una tasa
  baja significa que el agente repite el mismo error; un agente distinto por
  intento puede ayudar ([Un agente distinto por intento](agent-setup.md#a-different-agent-per-attempt)).
- **El coste por requisito entregado** divide todo el tiempo invertido, incluidos
  los intentos que fallaron, entre los requisitos que de verdad pasaron. Eso es lo que
  cuesta entregar.

El coste es primero tiempo de reloj: un agente es cualquier comando de shell, y solo
el agente sabe lo que gastó. Si un perfil declara un `cost_per_run_hint`,
el informe añade un gasto estimado y lo etiqueta como *declarado por el perfil, no
medido*.

## Coste medido

Cuando el stream de un agente informa de sus tokens —Claude Code a través de
`specgate harness events --from claude` lo hace—, la ejecución los registra para cada
paso de agente, con el perfil que lo ejecutó. Un perfil que declara sus precios
por token se valora entonces a partir de esos tokens:

```yaml
profiles:
  fast:
    agent: "claude -p --output-format stream-json --verbose < {prompt_file} | specgate harness events --from claude"
    price_per_input_token: 0.000003
    price_per_output_token: 0.000015
    # optional; both default to the input price
    price_per_cache_read_token: 0.0000003
    price_per_cache_write_token: 0.00000375
```

El informe añade una línea de *gasto medido*, y `--json` da `measuredCost`
(`total`, los pasos medidos como `covered`, los demás como `uncovered`; `null`
cuando no se midió ninguno) y `costByProfile`, una entrada por perfil:

| Campo              | Qué contiene                                                       |
| ------------------ | ------------------------------------------------------------------ |
| `profile`          | El perfil, o `agent` para un comando dado tal cual                 |
| `attempts`         | Los pasos de agente que ejecutó                                    |
| `measuredAttempts` | De esos, aquellos cuyos tokens se registraron                      |
| `tokens`           | `input`, `output`, `cacheRead`, `cacheWrite`; `null` si no hay     |
| `estimated`        | `cost_per_run_hint` × sus pasos; `null` sin hint                   |
| `measured`         | Sus tokens × sus precios; `null` sin tokens o sin precios          |
| `basis`            | `measured`, `estimated`, o `null` cuando no se pudo dar ninguno    |

`--profile` y `agent_profile:` registran el nombre del perfil, así que su hint y sus
precios se aplican a las ejecuciones de su agente.

## ¿Se equivocó el gate?

Un intento rechazado parece igual tanto si el trabajo era malo como si lo era el gate.
Solo una persona puede distinguirlo, así que el informe muestra «failures that were real» como
desconocido hasta que alguien registra un falso fallo:

```bash
specgate harness report --mark-false-failure REQ-004 --reason "the test relied on the local time zone"
```

Las marcas se guardan en `.harness/false-failures.jsonl`.

## Dónde estaba el hueco

Un requisito que necesitó rehacerse cayó en uno de dos huecos:

| Hueco | Qué pasó | Qué reforzar |
| --- | --- | --- |
| **spec → implementación** | La spec era clara y el código se desvió | La validación: el check que lo detectó |
| **intención → spec** | A la spec le faltaba parte del caso de uso | La elicitación: las preguntas del módulo, hechas antes |

El informe sugiere uno para cada requisito a partir de lo que registró. Un
rechazo que el agente corrigió en un intento posterior se lee como spec → implementación,
nombrando la etapa que lo rechazó (`pmd`, `test command`). Un requisito que
cambió después de la revisión se lee como intención → spec: se respondió una pregunta que lo
bloqueaba, una nota de revisión lo nombra, un change lo modifica, o el gate falló en
la propia especificación. Cuando se dan ambos, gana intención → spec.

La palabra de una persona gana a cualquier sugerencia:

```bash
specgate harness report --classify REQ-010 --gap intent-spec --reason "the brief never said a truck can carry two drivers"
```

La sección muestra la proporción de cada hueco sobre los requisitos del registro, por
módulo cuando hay más de uno, y qué reforzar: la etapa que
detectó más huecos spec → implementación, y el módulo con más huecos intención →
spec. Las clasificaciones se guardan en `.harness/gaps.jsonl`; `--json` lleva
la sección como `gaps`, y el informe del studio muestra ambas proporciones.

## Los registros se quedan en tu máquina

`.harness/runs/` contiene su propio `.gitignore`, que ignora todos los archivos de la
carpeta, así que git nunca ve los registros. Hay dos razones. El harness
se niega a empezar en un working tree con cambios sin commit, así que unos registros que git
pudiera ver harían que la segunda ejecución se negara a empezar. Y un archivo que cada ejecución
reescribe sería un conflicto de merge en cada rama.

El comando del agente nunca se registra, porque puede llevar una clave de API.

## La calidad de lo entregado

Cuando se ejecutan [checks de calidad](quality.md), el registro de ejecución de cada requisito que pasa
los conserva —etapa, veredicto, hallazgos, y la cobertura del diff y la puntuación de
mutación de las líneas que cambió—, y el informe añade una sección con las medias
y la frecuencia con la que se ejecutó cada check. `--json` la lleva como `quality`.

## Antes de empezar

`specgate plan --json` estima cada requisito pendiente bajo `estimates`: su
`time` en milisegundos y, cuando un perfil declara `cost_per_run_hint`, su
`cost`. Cada número indica su `basis`, de la más fuerte a la más débil:

| `basis`   | Tomado de                                                               |
| --------- | ----------------------------------------------------------------------- |
| `history` | La media de las ejecuciones registradas de este mismo requisito.        |
| `size`    | Sus pasos de escenario, al tiempo por paso que tardaron los requisitos entregados. |
| `average` | El tiempo por requisito entregado, incluidos los intentos fallidos.     |
| `none`    | Nada registrado respalda un número: es `null`.                          |

`samples` dice en cuántas ejecuciones o requisitos se basa. Como el gasto
de arriba, un coste es un precio declarado, no uno medido.

## En tu herramienta de trazas

Con `OTEL_EXPORTER_OTLP_ENDPOINT` definida (o `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`),
cada ejecución terminada se envía como una traza OpenTelemetry: la ejecución, cada requisito,
cada intento con la etapa en la que falló, y cada sesión de agente, con tokens
y coste. Se leen `OTEL_EXPORTER_OTLP_HEADERS` y `OTEL_SERVICE_NAME`; un
collector que no se puede alcanzar es un aviso, nunca una ejecución fallida (REQ-590).

## Siguiente

- [El harness](harness.md)
- [Elegir y conectar tu agente](agent-setup.md)
