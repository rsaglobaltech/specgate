<!-- translation-of: b50870519c6b -->
# Pregunta a tu agente, mira el plan y aplícalo

`specgate agent ask` entrega a tu agente una petición sobre la especificación y
responde con un **plan**: los archivos que cambiaría, cada uno con su porqué y su diff,
los checks de specgate que ejecutar después, lo que leyó y los tokens que usó.
No se escribe nada en tu proyecto hasta que aplicas el plan. Esto es lo que
ejecuta el panel de agente de specgate-studio; desde un terminal funciona igual.

**Necesitas:** un proyecto en git y un agente configurado —`agent:` en
`harness.config.yaml`, que escribe `specgate agents init --tool claude`, o
`--agent "<command>"` en la línea de comandos.

## Pregunta

```bash
specgate agent ask "allow cancelling up to 24 h before shipping @REQ-031"
```

```text
  [ PLAN · nothing written yet ]

    M spec.md  — States the cancellation window.
    + features/orders/cancel.feature  — The scenario for it.

  Then: specgate validate
  Read: spec.md, features/orders/REQ-031.feature
  Tokens: 1200 in · 340 out · $0.0123

  ➜  specgate agent apply 20261112-085017-4bc1
     or: specgate agent discard 20261112-085017-4bc1
```

- El agente trabaja sobre una **copia temporal** del proyecto —sus archivos
  versionados y sin versionar, no los ignorados— en una carpeta temporal. No
  puede llegar a tu working tree.
- `@REQ-031` da al agente la sección del requisito, de `spec.md`, del spec de una
  capacidad o del delta de un change abierto, y su archivo feature. `@path`
  nombra un archivo para que lo lea primero. `--req <REQ>` y `--file <path>` hacen lo
  mismo. Una mención que no nombra nada da el aviso `mention_unresolved`.
- El agente recibe la petición por la entrada estándar, o como `{prompt_file}` cuando su
  comando lo nombra. Puede dejar `.specgate-ask.json` en la raíz de la copia con un
  motivo por archivo (`why`), los checks que ejecutar (`then`) y lo que leyó
  (`read`); el prompt le dice cómo.
- Los tokens vienen del propio informe del agente: `claude -p --output-format json`
  los da, con el coste. Un agente que no informa de ninguno los deja en null.
- `--agent "<cmd>"` o `--profile <name>` elige el agente; si no, el de
  `harness.config.yaml` (`agent:` o `agent_profile:`). `--timeout
  <seconds>` lo limita, 900 por defecto.

### Solo la especificación

Un plan cambia `spec.md`, `docs/specs/**` y `features/**`, nada más.
Un cambio que el agente hizo en cualquier otro archivo queda fuera del plan y se informa
como el aviso `edit_refused`. No hay `--mode code`: el código se construye con el test
primero a través de `specgate harness run`, detrás del gate, y un plan no
sustituye eso. `--mode` con cualquier valor que no sea `spec` se rechaza
(`agent_mode_unknown`).

## Aplica o descarta

```bash
specgate agent apply 20261112-085017-4bc1
specgate agent discard 20261112-085017-4bc1
specgate agent plans
```

`apply` comprueba primero que cada archivo del plan sigue como estaba cuando el
agente empezó. Si tú o cualquier otra cosa cambió uno desde entonces, no escribe nada y
rechaza con `plan_stale`, nombrando el archivo: descarta el plan y vuelve a preguntar.
Si no, escribe el contenido planeado byte a byte —finales de línea incluidos—
y ejecuta los checks `then` del plan, respondiendo con la salida y los hallazgos de cada uno.
Nunca hace stage, commit ni push: revisa con `git diff` y después haz commit.

Después de un plan solo se ejecutan checks de specgate: `validate`, `status`, `matrix`,
`questions`, `check`, `draft --check` y `change validate` / `change show`.
Cualquier otra cosa que pida el agente —`rm -rf src`— se informa como `then_refused`
cuando se crea el plan, y nunca se ejecuta.

## Dónde se guardan los planes

En la carpeta git del repositorio, bajo `specgate/plans/<id>/`: `plan.json` con
la petición, los archivos y sus diffs, el commit base y el SHA-256 de cada
archivo tal como lo encontró el agente (null para un archivo que no existía), y el
contenido que recibiría cada archivo. Nada aparece en `git status`. Un plan aplicado o
descartado se elimina. `agent plans` marca un plan como `stale` cuando uno de sus
archivos cambió desde entonces.

## Cuando dice que no

| Código               | Por qué                                                   | Solución                                  |
| -------------------- | --------------------------------------------------------- | ----------------------------------------- |
| `agent_not_set`      | Ni `--agent`, ni `--profile`, ni `agent:` en la config.   | `specgate agents init --tool claude`      |
| `agent_failed`       | El agente salió con error o superó `--timeout`.           | El mensaje termina con su error estándar. |
| `agent_needs_git`    | El proyecto no está en un repositorio git.                | `git init` y después commit.              |
| `plan_empty`         | El agente no cambió nada: una respuesta, no un error.     | Pregunta con más detalle, o menciona un REQ. |
| `plan_stale`         | Un archivo del plan cambió desde que empezó el agente.    | `specgate agent discard <id>`, pregunta otra vez. |
| `plan_not_found`     | Ningún plan abierto tiene ese id.                         | `specgate agent plans`                    |

## Desde una herramienta

Todos los comandos aceptan `--json`. Desde Node, la API responde con los mismos documentos:

```ts
import { agentAsk, agentApply, agentDiscard, agentPlans } from "@rsaglobaltech/specgate/api";

const { plan } = await agentAsk(dir, "allow cancelling up to 24 h before shipping @REQ-031");
for (const f of plan.files) console.log(f.change, f.path, f.why);
if (plan.id) await agentApply(dir, plan.id);
```

- `agent ask --json`: `{ plan: { id, request, mode, created, files: [{ path, change, why, diff }], then, read, usage: { input, output, cost? } }, status }`; `id` es null para un plan vacío.
- `agent apply --json`: `{ applied: { id, written: [{ path, change }], then: [{ command, exit, findings }] }, status }`.
- `agent discard --json`: `{ discarded: { id }, status }`.
- `agent plans --json`: `{ plans: [{ id, request, created, files: [{ path, change }], stale }], status }`.

Un rechazo falla con su `code` y su `fix`, como en [Automatización](automation.md).
