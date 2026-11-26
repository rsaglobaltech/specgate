<!-- translation-of: faa25011af65 -->
<!-- specgate:allow-placeholders -->

# El harness

El **harness** entrega requisitos de forma desatendida: da cada requisito
pendiente a un agente de código, ejecuta el gate sobre el resultado y se detiene cuando el
gate dice que no. Al final de esta página sabrás ejecutarlo sobre un requisito, encadenar
varios en una rama, ejecutarlos en paralelo y leer un fallo.

**Necesitas:** un proyecto donde se haya ejecutado `specgate init`, git, un comando de tests
(`specgate config set test_cmd "npm test"`) y un agente de código que puedas ejecutar desde
la línea de comandos. Qué agente, y cómo llamarlo, está en [Elegir y conectar tu agente](agent-setup.md).

<!-- specgate:diagram lifecycle -->
<!-- specgate:diagram trust-boundary -->

## Un turno, en secuencia

<!-- specgate:diagram harness-loop -->

1. Cada requisito pendiente (o el que nombra `--req`) recibe un git
   worktree nuevo en una rama llamada `harness/REQ-NNN`.
2. El harness instala ahí las dependencias del proyecto y después da al agente
   un prompt construido a partir del requisito y su escenario Gherkin.
3. Se ejecuta el gate. Primero el juez externo: cualquier cambio en los controles que el
   harness leyó antes de que empezara el agente (guard, política del gate, aprobaciones,
   evidencias, tests sellados) hace fallar el intento. Después `validate --strict`, con
   aprobaciones, tests sellados y alcance de diseño tal como se aprobaron; la especificación
   intacta; tu check de arquitectura y tus tests; los escenarios cuando
   `bdd: required`; el registro de pasos; los principios con un check `run=`; tus
   [checks de calidad](quality.md).
4. **Verde:** `specgate apply` marca el requisito como Implemented y el trabajo
   se hace commit en su rama como `feat(REQ-NNN): …`.
5. **Rojo:** los fallos pasan al siguiente intento, hasta `max_attempts`
   (3 por defecto). Tras el último, el trabajo se hace commit como
   `chore(REQ-NNN): attempt FAILED the gate` y el requisito conserva su estado.

Un requisito que espera una respuesta (Needs Clarification) se rechaza.
Sin `--chain` no se hace merge de nada: cada requisito en verde espera en su propia
rama a que lo revisen.

## Configúralo

```bash
specgate harness init
```

Esto escribe `harness.config.yaml` y `.harness/prompt-prefix.md`, detecta el
comando de tests a partir de tus archivos de build y deja `agent:` sin definir: qué agente se ejecuta
y con qué credenciales es decisión tuya. Después nombra el agente y ejecuta un
requisito:

```bash
specgate harness run --req REQ-001 \
  --agent "claude -p --allowedTools Read Write Edit Glob Grep 'Bash(npm:*)' < {prompt_file}"
```

El harness escribe el prompt en un archivo temporal y pone su ruta donde
está `{prompt_file}`. Un comando sin el placeholder se rechaza. Los permisos de
herramientas, los comandos para otros agentes y los perfiles de equipo están en
[Elegir y conectar tu agente](agent-setup.md).

Con varios agentes en `.harness/profiles.yaml`, `--profile <name>` elige uno
para esta ejecución (`propose --from-brief` también lo acepta), y la página Build del
[studio](studio.md) ofrece la misma elección.

Para ver qué pasaría sin pagar por un agente:

```bash
specgate harness prompt REQ-001      # the exact prompt, printed
specgate harness run --dry-run       # what it would do, in order
```

**El orden.** Con un brief que lista sus módulos, los requisitos se toman
módulo a módulo en el orden del brief —lista primero lo que necesita el resto— y,
dentro de un módulo, en el orden en que los lista su spec; `status` y `apply` los toman
igual y dicen qué módulo va después. Sin brief, el orden de la
matriz. Un requisito cuyo `specgate:trace` dice `depends=` sigue
esperando a los que nombra.

## El worktree

Cada requisito se ejecuta en su propio git worktree, así que el agente nunca toca tu
copia de trabajo. Un worktree nuevo contiene solo lo que git versiona: ni `node_modules`,
ni `target/`, ni `.venv`. Antes de que empiece el agente, el harness ejecuta el comando
de setup: `setup_cmd:` en `harness.config.yaml`, `--setup-cmd`, o la instalación
que implica tu lockfile (`npm ci`, pnpm, yarn). `--setup-cmd none` no ejecuta nada.
Consulta [Dependencias](agent-setup.md#dependencies-the-setup-command).

El agente recibe `SPECGATE_REQ` y `SPECGATE_ATTEMPT` en su entorno.
Los worktrees se eliminan tras cada requisito; `--keep-worktrees` los conserva.

## Una cadena de requisitos, con merge según pasan

```bash
specgate harness run --chain --req REQ-002 --req REQ-003
```

Con `--chain`, los requisitos se ejecutan de uno en uno, en orden, cada uno creado desde el
merge anterior. Uno en verde se fusiona en la rama en la que estás (un commit de
merge; sus prompts se quedan en su rama `harness/`), y **el gate se ejecuta de nuevo
sobre el merge**. Un resultado en rojo se deshace y la cadena se detiene.

Con niveles de confianza declarados, `--chain` solo se ejecuta en una rama tuya
(`git switch -c feature/<module>`); el merge de esa rama lo haces tú.

### En la rama de un ticket

Para trabajo que viene de un ticket de Jira, ejecuta la cadena en la rama del ticket:

```bash
git switch feature/KAN-13-register-vehicle-entry
specgate harness run --chain
```

`specgate propose --from-ticket KAN-13` creó esa rama y el change.
Cada requisito del change se fusiona en la rama del ticket según
pasa, y cada commit y commit de merge empieza con la clave del ticket
(`KAN-13 REQ-007: …`), así que Jira los muestra en el ticket. Después archiva el
change y abre el pull request con `specgate alm pr <change-id>`. Consulta
[Desde un ticket de Jira](from-a-ticket.md).

### Míralo trabajar

Ejecuta `specgate studio` y abre `/live`: intentos, fases, archivos, tests y
pasos según ocurren, leídos de `.harness/events/` (ignorado por git). Claude
Code también informa de sus pasos cuando escribe `stream-json` y su salida pasa
por `specgate harness events --from claude`:

```yaml
# harness.config.yaml
agent: "claude -p --output-format stream-json --verbose < {prompt_file} | specgate harness events --from claude"
```

### Contrólalo desde otra herramienta

Una herramienta que inicia el harness —un editor, specgate-studio— lo lee como JSON:
`--format jsonl` emite un evento por línea, `specgate harness stop
--after-current` termina una ejecución entre requisitos, `--allow-dirty` construye con
archivos sin commit, y una pregunta que hace el agente recibe su id mientras la ejecución
sigue. Consulta [Controla el harness desde una herramienta](harness-control.md).

## Ramas en paralelo y la matriz de trazabilidad

Cada rama del harness cambia su propia fila en `docs/specs/traceability.md`.

**Una matriz generada** (la opción por defecto) nunca bloquea un merge: está declarada
`merge=union` en `.gitattributes`, git conserva las filas de ambos lados y
`specgate check` regenera el archivo
([ADR-0036](specs/adr/0036-a-gate-a-team-can-trust.md)).

**Una matriz mantenida a mano** necesita un merge driver que fusione por filas, porque git
fusiona por líneas y dos filas vecinas entran en conflicto aunque pertenezcan a
requisitos distintos. `specgate harness init` registra ese driver y
escribe `.gitattributes`:

```bash
specgate harness init --project-dir .
git add .gitattributes && git commit -m "merge the matrix by row"
```

El driver es configuración local de git, así que cada clon y cada job de CI necesita
`specgate harness init --merge-drivers` una vez: registra los drivers y
no escribe ningún otro archivo. Hasta entonces git recurre a su merge normal,
y `specgate doctor` informa del hueco.

Sigue habiendo **conflicto** cuando dos ramas ponen la misma fila con valores distintos.
Conserva exactamente una de las dos líneas y borra las tres líneas de marcadores; **nunca
conserves ambas**, porque una fila de requisito duplicada es corrupción. Después ejecuta
`specgate validate .`, que comprueba los estados y que ningún id de escenario
se repita.

## Ramas en paralelo y specs de capacidades

Dos ramas a menudo archivan en el mismo spec de capacidad. `specgate harness
init` registra un merge driver para esos archivos que fusiona **requisito a
requisito**: los ids distintos se unen y ordenan, y un requisito cambiado
solo en un lado toma ese lado. Solo hay conflicto cuando ambos reescribieron el mismo
requisito (`change_overlap` avisó antes): escríbelo como debe quedar,
borra los marcadores y ejecuta `specgate check`.

**Sin un `node_modules` local** (Maven, por ejemplo), los drivers ejecutan el specgate de
esta máquina. Si esa copia desaparece, git recurre a merges por línea y
`specgate doctor` avisa; ejecuta `specgate harness init --merge-drivers` otra vez.

## Ejecuta más de un requisito a la vez

```bash
specgate harness run --concurrency 4
```

**Solo se ejecutan juntos los requisitos que no dependen entre sí.** El
harness lee las claves `depends=` del comentario `specgate:trace` de cada requisito
y recorre la cola por niveles: todo lo de un nivel es
independiente y sale a la vez; el siguiente nivel espera.

**Un fallo bloquea lo que depende de él; no lo hace fallar.** No se paga al agente
por un trabajo que no puede salir bien:

```
  ❌ REQ-001  fail (1 attempt)     → harness/REQ-001
  ⛔ REQ-002  blocked (0 attempts) → harness/REQ-002
       Not attempted: REQ-001 did not pass.

  0 passed · 1 failed · 0 skipped · 1 blocked
```

Un requisito en un ciclo de dependencias se informa igual y nunca se intenta; `specgate validate` explica el ciclo.

**La base se deriva.** Un requisito se crea desde la rama del
requisito del que depende, porque ahí es donde existe su código durante una ejecución.
El harness avisa cuando esa base va por detrás de tu rama principal:

```
⚠️  REQ-002: base harness/REQ-001 is 3 commit(s) behind main.
    A fix that landed on main is not in this worktree —
    a gate failure may not be about REQ-002.
```

**Un requisito con varias dependencias las recibe fusionadas** antes en una rama
desechable `harness/base/REQ-NNN`:

- Los conflictos en `docs/specs/traceability.md` conservan la versión de la base. Las ramas
  hermanas siempre entran en conflicto ahí, porque cada una marca su propio requisito como
  Implemented con `specgate apply`, editando la misma tabla. La rama real
  `harness/REQ-NNN` conserva su propia fila.
- Un conflicto en un archivo de código bloquea el requisito y nombra el archivo: dos
  dependencias cambiaron el mismo código de formas incompatibles.

**El valor por defecto es 1.** Por encima de 1, cada requisito se ejecuta en un proceso worker, un
camino más reciente que el serie. Y cuatro ramas en verde son cuatro revisiones.
`concurrency: 4` en `harness.config.yaml` lo fija para el proyecto.

## Ejecuciones desatendidas en CI

Para un job nocturno que deja ramas para revisar:

| Opción                   | Qué hace                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `--resume`               | Continúa una ejecución interrumpida —Ctrl-C, un job cancelado— desde el intento en que se detuvo. |
| `--budget-seconds <n>`   | Se detiene limpiamente antes de empezar un requisito cuando se agota el tiempo.          |
| `--max-requirements <n>` | Intenta como máximo n requisitos.                                                        |
| `--skip-not-ready`       | Omite requisitos en los que un agente no puede tener éxito (sin feature, dependencias pendientes). |
| `--skip-baseline`        | Se ejecuta aunque la base ya falle `validate --strict`.                                  |
| `--push`                 | Hace push de cada rama `harness/REQ-NNN` en verde.                                       |
| `--pr-cmd "<cmd>"`       | Se ejecuta tras cada push, con los placeholders `{branch}` y `{req}`.                    |
| `--verbose`              | Muestra la salida del gate mientras se ejecuta.                                          |

**Detener una ejecución.** Ctrl-C, una señal o un job de CI cancelado terminan el agente y
todos los comandos que inició la ejecución, también cuando se mata la propia ejecución sin más; el
worktree del requisito se queda, y `--resume` continúa desde él. La ejecución sale con 130.

## Cuando una ejecución falla

**Antes de que se ejecute ningún agente**, el harness valida la base. El gate juzga el
proyecto entero, así que un requisito fuera de la ejecución que ha pasado de Draft sin test
(TDD-1, TDD-2), como uno marcado Approved antes de su test, haría fallar cada
intento hiciera lo que hiciera el agente, y el agente no puede cambiar su estado. La
ejecución se detiene ahí y los lista: escribe sus tests o devuélvelos a Draft,
o pasa `--skip-baseline` para ejecutar igualmente. Lo que falla en los requisitos que se
ejecutan les toca corregirlo a ellos, y no la detiene.

**Cuando la sesión tocó los controles**, el intento falla antes de que se ejecute nada
más (`controls_changed_by_session`): el agente aprobó, cambió el
guard, revisó pasos o editó la política del gate, las evidencias o los tests
sellados. Eso le corresponde a una persona. Restaura los controles y mira qué se le
pidió hacer al agente.

El informe imprime el final de la salida del gate y el comando que falló.
Algunos fallos terminan la ejecución tras un intento, porque reintentar no ayuda:
consulta [Solución de problemas](troubleshooting.md#when-another-attempt-cannot-help).

El intento fallido se **hace commit en su rama** como `chore(REQ-NNN): attempt
FAILED the gate`, para que puedas leer lo que hizo el agente. El estado del requisito no
cambia, porque `specgate apply` nunca se ejecutó.

```bash
specgate harness run --req REQ-002 --format json      # the whole gate output
specgate harness run --req REQ-002 --keep-worktrees   # reproduce it in place
```

**Un requisito que se apoya en otro** se ejecuta con `--chain`, o con
`--base-branch harness/REQ-001`. Esa rama base también aporta la configuración
del proyecto, así que una corrección con commit en `main` llega a la ejecución solo cuando la base
la tiene. Comprueba el comando del gate que imprime el informe.

Para ver lo que ha costado el harness con el tiempo (tasa de primer intento, tiempo por
requisito entregado), consulta [Lo que ha costado el harness](harness-report.md).

## Agentes por módulo, comprobados primero; un enjambre en sandboxes

Un módulo puede tener su propio agente (`match: { module: … }`); `harness run` comprueba que cada agente responde antes de empezar (`specgate harness doctor`); con `sandbox: { engine: sbx }` cada módulo trabaja en su propio sandbox, que se elimina al archivar. [En detalle](specs/harness.md#every-agent-checked-before-it-is-used).

## Siguiente

- [Elegir y conectar tu agente](agent-setup.md)
- [Carriles, roles y límites](harness-roles.md)
- [Lo que ha costado el harness](harness-report.md)
