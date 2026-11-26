<!-- translation-of: 009cd4852eee -->
# Elegir y conectar tu agente

Al final de esta página tienes un comando de agente que el harness y los comandos de
redacción pueden ejecutar, con sus permisos, sus dependencias y un perfil de equipo.

**Necesitas:** un agente de código que puedas ejecutar desde la línea de
comandos (Claude Code, Aider, OpenCode, Codex…), con sesión iniciada con tus
propias credenciales. Specgate no tiene runtime de agente ni SDK: **el agente es
cualquier comando de shell.** Lo que hace el harness alrededor del agente
(worktrees, el gate, cadenas, ejecuciones en paralelo) está en [El harness](harness.md).

## El contrato: `{prompt_file}`

Specgate escribe el prompt en un archivo temporal y pone la ruta de ese archivo
donde aparece `{prompt_file}` en tu comando. Ejecuta el comando y después juzga
el resultado con el gate, no solo con el código de salida del agente.

```bash
specgate harness run --req REQ-001 --agent "claude -p < {prompt_file}"
```

| Comando                                                                 | Sin `{prompt_file}`                                       |
| ----------------------------------------------------------------------- | --------------------------------------------------------- |
| `specgate harness run`                                                  | Rechazado. El harness nunca adivina dónde va el prompt.   |
| `specgate change author`                                                | Rechazado, por la misma razón.                            |
| `specgate propose --from-brief`, `--from-ticket` y `specgate explore`   | El prompt llega por la entrada estándar.                  |

Así que `specgate propose --from-brief billing --agent "claude -p"` funciona tal
cual. En modo print, Claude Code no puede escribir un archivo sin permiso, así
que para los comandos de redacción y el harness Specgate añade
`--permission-mode acceptEdits` justo después de `claude` cuando tu comando no
lleva ningún flag de permisos propio, y lo dice. Es seguro porque Specgate
deshace cada escritura fuera del borrador, y el harness ejecuta el agente en un
worktree desechable. Otros agentes necesitan su propio flag de autoaprobación;
si uno se ejecuta y no escribe nada, el harness detiene ese requisito tras el
primer intento y dice que esa es la causa probable.

Guarda el comando una vez, para `harness run` y para Build del studio:

```bash
specgate config set agent "claude -p < {prompt_file}"
```

## Comandos para herramientas habituales

| Herramienta                                    | Valor de `--agent`                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Claude Code                                    | `claude -p < {prompt_file}` (Specgate añade `--permission-mode acceptEdits`, y `--allowedTools` para el comando de tests y nada más) |
| Claude Code, visto en directo en `specgate studio` | `claude -p --output-format stream-json --verbose < {prompt_file} \| specgate harness events --from claude`                       |
| Aider                                          | `aider --yes --message-file {prompt_file}`                                                                                           |
| OpenCode                                       | `opencode run "$(cat {prompt_file})"`                                                                                                |
| Cursor CLI                                     | `cursor-agent -p "$(cat {prompt_file})"`                                                                                             |
| Cualquier otra                                 | `./my-agent.sh {prompt_file}` (un wrapper, más abajo)                                                                                |

El comando se ejecuta en una shell, así que funcionan tanto `< {prompt_file}`
como `"$(cat {prompt_file})"`. Las herramientas de agente cambian sus flags entre
versiones: consulta la documentación de cada una para los flags no interactivos
exactos, sobre todo para OpenCode y la Cursor CLI, cuyas filas muestran la forma
y no un comando probado. Ejecuta `specgate harness run --dry-run` para ver el
prompt antes de pagar por uno. `specgate config set agent "claude -p < {prompt_file}"`
lo guarda en `harness.config.yaml` como la fila en directo, para que el studio
muestre al agente trabajando.

## Permisos de herramientas

Un agente en modo no interactivo no puede pedir permiso. Sin permisos lee el
prompt, no consigue escribir un archivo y el intento se desperdicia. Dale las
herramientas que necesita:

```bash
specgate harness run --agent "claude -p --allowedTools Read Write Edit Glob Grep 'Bash(npm:*)' < {prompt_file}"
```

Acótalos en lugar de recurrir a `--dangerously-skip-permissions`. El agente
necesita `Bash` para compilar y probar el proyecto, y `Bash(npm:*)` basta para un
proyecto Node (`Bash(npx:*)` también cuando comprueba tipos con `npx tsc`,
`Bash(./mvnw:*)` para Maven, etc.). Con permisos propios, Specgate no añade
ningún flag de permisos: incluye `Write` y `Edit` entre ellos. El harness lo
ejecuta en un worktree de git desechable, lo que limita hasta dónde llega un error.

## Una herramienta cuya invocación no encaja en ninguna

Escribe un wrapper. Son tres líneas, y es la respuesta soportada:

```bash
#!/bin/sh
# my-agent.sh — $1 is the path to the prompt file
exec some-agent --instructions "$(cat "$1")"
```

```bash
specgate harness run --agent "./my-agent.sh {prompt_file}"
```

Lea tu herramienta el prompt de la entrada estándar, de un flag, de una variable
de entorno o de un archivo, un wrapper lo convierte en la forma que espera Specgate.

## Dependencias: el comando de setup

El harness da al agente un worktree de git nuevo, que contiene solo lo que git
sigue: ni `node_modules`, ni `target/`, ni `.venv`. Un agente no debe gastar su
intento instalando dependencias, así que el harness las instala antes, con el
**comando de setup**:

1. `--setup-cmd "<cmd>"` en la línea de comandos, o
2. `setup_cmd:` en `harness.config.yaml`, o
3. por defecto, la instalación que implica tu lockfile (`npm ci`, pnpm o yarn).

```yaml
# harness.config.yaml
setup_cmd: "./mvnw -q dependency:go-offline"
```

`--setup-cmd none` no ejecuta nada. Deja el comando de tests (`test_cmd:`) solo
para tests: instalar ahí repetiría la instalación en cada ejecución del gate.

## Haz commit de los comandos que usa tu equipo

Escribir el comando en cada ejecución es la forma de que acabe distinto en cada
máquina. Pon los comandos de tu equipo en `.harness/profiles.yaml` y nombra uno.
El [studio](studio.md) lista estos perfiles en sus páginas Project y Build, y su
paso de proyecto nuevo escribe `claude-sonnet` y `claude-opus` (o `codex`) por
ti; `harness run --profile <name>` elige uno para una sola ejecución:

```yaml
# .harness/profiles.yaml
profiles_version: 1
profiles:
  local:
    agent: "claude -p --allowedTools Read Write Edit 'Bash(npm:*)' < {prompt_file}"
  ci:
    agent: "aider --yes --message-file {prompt_file}"
```

```yaml
# harness.config.yaml
agent_profile: local
```

**Escribe los perfiles en forma de bloque, como arriba.** Specgate lee un
subconjunto de YAML sin dependencias, y un mapa en línea (`local: { agent: "…" }`)
se lee como una cadena: el perfil no tiene `agent` y la ejecución se detiene con
`no profile 'local' with an agent`.

Un `agent:` explícito en `harness.config.yaml` gana a un perfil: gana lo más concreto.
`specgate change author --agent-profile local` usa los mismos perfiles.

`specgate config set profiles.local.agent "<command>"` escribe un perfil y
conserva las demás líneas del archivo; `specgate config keys` lista sus campos,
entre ellos los precios de [Coste medido](harness-report.md).

## Un agente distinto por requisito

Un perfil que declara `match:` se selecciona solo, así que una ejecución puede
dar a un requisito de infraestructura herramientas distintas que a uno de dominio:

```yaml
profiles:
  infra:
    agent: "claude -p --allowedTools Read Write Edit 'Bash(terraform:*)' < {prompt_file}"
    match: { bounded_context: Platform }
  domain:
    agent: "claude -p --allowedTools Read Write Edit 'Bash(npm:*)' < {prompt_file}"
    match: { bounded_context: "*" }
```

Gana la primera coincidencia, así que el orden en el archivo es la prioridad y un
comodín `"*"` va al final. Sin coincidencia se usa el agente por defecto.

Puedes filtrar por `bounded_context`, `requirement`, `feature` y `category`.
Una **clave desconocida no coincide con nada**, así que una errata como
`bounded_contex:` no puede convertirse en una regla que coincide con todo.
`specgate expand` registra el bounded context de cada requisito, así que los
proyectos con pack de dominio tienen algo con lo que coincidir.

## Un agente distinto por intento

El mismo agente y modelo tres veces es casi volver a tirar los dados. Una
escalera da a cada intento su propio perfil, y puede añadir un revisor
consultivo antes de cada reintento:

```yaml
# harness.config.yaml
attempt_profiles:
  - implementer # attempt 1
  - repairer # attempt 2
  - repairer-strong # attempt 3, and any after it
review_profile: reviewer
```

```yaml
# .harness/profiles.yaml
profiles:
  implementer:
    agent: "claude -p < {prompt_file}"
  repairer:
    agent: "claude -p < {prompt_file}"
  repairer-strong:
    agent: "claude --model opus -p < {prompt_file}"
  reviewer:
    agent: "claude -p < {prompt_file}"
    advisory: true
```

Una escalera más corta que `max_attempts` repite su último peldaño. Sin estas
claves, un solo agente ejecuta todos los intentos.

**El revisor aconseja; nunca aprueba.** Se ejecuta antes de cada reintento
(nunca antes del primer intento), su salida va al siguiente prompt como
hallazgos y todo lo que escribió se descarta. El gate sigue siendo el único
juez. Un perfil nombrado en `review_profile` debe declarar `advisory: true`, o el
harness se niega a arrancar. `.harness/runs/<timestamp>.json` nombra los roles
que ejecutaron cada intento, y la rama guarda un prompt por rol
(`attempt-2-reviewer.md`, `attempt-2-implementer.md`). Un tester y un
implementador como sesiones separadas: [Lanes, roles y límites](harness-roles.md).

## Enséñale al agente qué es "aceptado"

```yaml
# harness.config.yaml
prompt_precedents: 1
```

Un agente empieza cada requisito sin historial, así que nunca ha visto una
implementación aceptada en tu repositorio e inventa un estilo propio. Con este
ajuste el prompt gana una sección: el requisito **Verified** más reciente del
mismo bounded context, con las primeras cuarenta líneas de su test y de su
código. Debe estar Verified (alguien lo comprobó, no solo Implemented), ser del
mismo bounded context y anterior al requisito actual. La sección dice que
muestra _forma_, no comportamiento, y se omite cuando nada cumple. Está
desactivado por defecto porque cuesta espacio en el prompt.

## Deja que algo intente romperlo

```yaml
# harness.config.yaml
adversary_profile: breaker
```

```yaml
# .harness/profiles.yaml
profiles:
  breaker:
    advisory: true
    agent: "claude -p < {prompt_file}"
```

Cuando el gate de un requisito está en verde y el trabajo tiene commit, se pide
al adversario un test extra: una entrada vacía, un límite, un duplicado, un
camino de fallo. Después se vuelven a ejecutar los tests del proyecto con él.
**Una prueba que falla nunca cambia el veredicto**; registra un aviso:

```
⚠️  REQ-007: The gate passed for REQ-007, and an adversarial probe then made the
    project's tests fail. That is either a defect the scenario does not cover,
    or a test asserting something REQ-007 never promised.
```

La prueba se ejecuta una vez por requisito, solo con el gate en verde, y sus
escrituras se descartan. El perfil debe declarar `advisory: true`.

## Lo que cuesta una ejecución

El harness mide tiempo de reloj, porque solo el agente sabe lo que gastó en
tokens. Un perfil puede declarar una estimación por ejecución, que
`specgate harness report` multiplica y etiqueta como _declarado, no medido_:

```yaml
profiles:
  local:
    agent: "claude -p < {prompt_file}"
    cost_per_run_hint: 0.35
```

Pon un límite a una ejecución:

```bash
specgate harness run --budget-seconds 3600 --max-requirements 5
```

Ambos se comprueban antes de cada requisito, nunca en mitad de un intento. Agotarlos
no es un error: la ejecución termina, nombra lo que no empezó y escribe su registro.

## Pruébalo sin gastar nada

```bash
specgate harness prompt REQ-001                                    # the exact prompt
specgate harness run --dry-run                                     # what it would do
specgate harness run --agent "true {prompt_file}" --max-attempts 1 # an agent that does nothing
```

El último ejecuta el ciclo completo con un agente que no escribe nada: la forma más
rápida de saber si tu gate puede ponerse en verde antes de pagar a un agente.

## Siguiente

- [El harness](harness.md)
- [Agentes](agents.md)
