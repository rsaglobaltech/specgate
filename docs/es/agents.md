<!-- translation-of: 083cc1bcdcff -->
# Agentes

Al final de esta página tu agente de código conoce el ciclo de Specgate: tiene
comandos slash para cada paso, un archivo de instrucciones que lee en cada
sesión y las reglas que no debe romper.

**Necesitas:** un proyecto donde se haya ejecutado `specgate init`, y una de las
herramientas de agente de abajo. `specgate agents init` ofrece trece valores de
`--tool`: diez herramientas de agente —Claude Code, Cursor, Copilot, Windsurf,
Aider, Gemini, Cline, Codex, Antigravity y OpenCode— y, si se piden, tres
[guards](#los-guards): `claude-plugin`, `opencode-plugin` y `codex-hooks`. En
OpenCode los comandos son `/specgate-draft`, `/specgate-apply`, etc., escritos
en `.opencode/commands/`; lee `AGENTS.md` por su cuenta. El plugin de Claude
Code se describe en
[Instala el plugin de Claude Code](automation.md#instala-el-plugin-de-claude-code).
Para ejecutar un agente sin supervisión, consulta [El harness](harness.md).

## Conéctalo

`specgate init` ya lo hace para los agentes que usa tu proyecto. Busca
`.claude/` o `CLAUDE.md`, `.cursor/`, `.github/copilot-instructions.md`,
`GEMINI.md`, `.windsurf/`, `.clinerules`, `.aider.conf.yml`, `.agents/` y
`.codex/`, instala los comandos para cada uno que encuentra y nunca sobrescribe
un archivo. `AGENTS.md` por sí solo no apunta a ningún agente concreto.
`--no-agents` se salta este paso. Para cualquier otro agente, o más adelante:

```bash
specgate agents init                          # every tool
specgate agents init --tool claude,cursor     # only these
specgate agents init --dry-run                # list the files, write nothing
```

Esto escribe un comando slash por paso, a partir de una sola definición:

| Comando slash | Qué hace el agente |
| --- | --- |
| `/specgate:explore` | Lee `specgate status`: qué queda y el siguiente comando. |
| `/specgate:propose` | Abre un change y escribe su delta. |
| `/specgate:draft <module>` | Convierte un módulo de `docs/brief.md` en un change borrador. |
| `/specgate:new` | Añade un requisito directamente a `spec.md`. |
| `/specgate:apply` | Entrega un requisito: primero el test, luego el código, luego el gate. |
| `/specgate:check` | Ejecuta el gate. |
| `/specgate:archive` | Cierra un change cuando todos sus requisitos están Implemented. |
| `/specgate:onboard` | Instala Specgate en un repositorio que no lo tiene. |

También escribe el archivo de instrucciones que lee cada herramienta:
`.cursor/rules/specgate.mdc`, `.github/copilot-instructions.md`,
`CONVENTIONS.md`, `GEMINI.md`, `AGENTS.md`, etc.

**Agent Skills.** `specgate agents init --format skills` escribe los mismos
pasos como carpetas de skills (`specgate-apply/SKILL.md`, …) en el formato
abierto Agent Skills: en `.agents/skills/`, que leen Codex y OpenCode, y en la
carpeta de skills de cada herramienta que nombres con `--tool claude|cursor|gemini`
(o, sin `--tool`, de cada herramienta cuya carpeta ya tiene el proyecto). Un
`SKILL.md` que difiere de lo que escribe esta versión —uno que cambiaste, o uno
que escribió un Specgate anterior— se conserva y se reporta como `skill_kept`;
`--force` lo sustituye. El plugin de Claude Code lleva las mismas skills, con un
`plugin.json` de Agent Plugins (esquema 1.0.0) y un `.tessl-plugin/plugin.json`
de Tessl (`rsaglobaltech/specgate`); ambos encuentran las skills en su carpeta
`skills/`.

Los comandos slash ejecutan los mismos comandos que escribes en la terminal. Un
archive que el agente intenta antes de que todos los requisitos estén
Implemented se rechaza, igual que para ti. Los archivos existentes nunca se
sobrescriben sin `--force`.

**¿Actualizas Specgate?** Ejecuta `specgate update` después de actualizar.
Refresca los archivos generados con un merge a tres bandas, así que tus cambios
se quedan y llega el texto nuevo; un conflicto se marca en el archivo y se
reporta, nunca se resuelve por ti. Si un comando slash cambió de nombre,
`update` mueve tu archivo al nuevo nombre con tus cambios. Si existen el archivo
antiguo y el nuevo, no toca ninguno y te dice que conserves uno.

## AGENTS.md es el contrato

`init` y `adopt` escriben `AGENTS.md`
([ADR-0031](specs/adr/0031-agents-md-is-the-agent-contract.md)): qué es el
proyecto, su stack, el ciclo en pocos pasos, lo que nunca hay que hacer y las
reglas de tu stack, en 60 líneas como mucho. Specgate mantiene su parte entre
`<!-- specgate:begin -->` y `<!-- specgate:end -->`; todo lo que está fuera de
ese bloque es tuyo, y ningún comando lo reescribe.

Su sección **From a brief or a Jira ticket** le dice al agente cómo trabajar en
un change borrador:

- `specgate propose --from-brief <module>` o
  `specgate propose --from-ticket <KEY>` abre el borrador y escribe
  `DRAFTING.md`. El agente lo sigue y vuelve a ejecutar el comando hasta que
  dice "Ready to review". Una persona revisa el borrador; el agente nunca lo
  archiva.
- El agente nunca edita el `ticket.md` de un change (la copia del ticket de Jira).
- Cada mensaje de commit empieza con la clave del ticket (`KAN-13 REQ-007: …`),
  y nunca usa comandos Smart Commit de Jira como `#done`, porque escriben en
  Jira.

Consulta [Desde un ticket de Jira](from-a-ticket.md) y [Desde un brief](from-a-brief.md).

**¿Vienes de `AI_RULES.md`?** `specgate update` mueve su texto, sin cambios,
debajo del bloque de Specgate y elimina el archivo (git conserva su historial).
Hasta entonces se leen ambos archivos, así que ninguna regla desaparece del
prompt del agente.

## Por qué los archivos generados son finos

Los archivos generados no copian el formato del delta. Una copia se queda
obsoleta cuando cambia el formato, y un agente que sigue una copia obsoleta
falla de una forma que parece culpa del agente. En su lugar, le preguntan al
motor:

```bash
specgate change instructions specs --json
```

Esto devuelve la plantilla, las reglas que aplica el validador, el stack del
proyecto, el rango de REQ reservado y lo que desbloquea escribir ese archivo. El
harness construye su prompt con la misma llamada, así que los comandos slash, el
harness y el servidor MCP no pueden discrepar. Cada comando generado lo dice:
*si este archivo y el motor discrepan, el motor tiene razón*.

`apply` y `archive` son pasos, no archivos. Devuelven las reglas para llevar a
cabo el paso, sin plantilla:

```bash
specgate change instructions apply --json
specgate change instructions archive --json
```

## El contrato JSON

Los comandos que maneja un agente (`status`, `plan`, `check`, `validate`,
`apply`, `change`, `doctor` y más) aceptan `--json`:

```bash
specgate validate . --json 2>/dev/null | jq .
```

- Un documento JSON en la salida estándar. La prosa va a la salida de error.
- Cada documento lleva `status`: una lista de diagnósticos, cada uno con un
  `code` estable y un `fix`.
- Decide según `code`, nunca según `message`: el mensaje es prosa y puede cambiar.
- Un fallo tiene las mismas claves que un éxito, así que un parser nunca se
  encuentra con otra forma.
- Códigos de salida: `0` éxito, `1` fallo o hallazgo del gate, `2` error de uso.

[El contrato del agente](specs/agent-contract.md) tiene las reglas completas y
cada código de diagnóstico. Se genera a partir del código fuente, y CI falla
cuando se desvía.

## Los guards

Los archivos de instrucciones son palabras que un agente puede pasar por alto.
El plugin de Claude Code (`--tool claude-plugin`), el plugin de OpenCode
(`--tool opencode-plugin`) y los hooks de Codex (`--tool codex-hooks`, que
escribe `.codex/hooks.json`) añaden tres hooks que se ejecutan decida lo que
decida el agente:

- **Inicio de sesión** — se le dice a la sesión que el proyecto es spec-driven,
  el change abierto, los requisitos que aún debe y el siguiente.
- **Cada llamada a herramienta** — el guard juzga todo el árbol de trabajo,
  comandos de shell incluidos: un archivo escrito con `cat >` se detecta en la
  siguiente llamada. Rechaza:
  - escribir un archivo de código mientras no hay un change abierto, o mientras
    ningún test nuevo o cambiado en el árbol de trabajo —o un test de
    aceptación sellado— nombra un requisito del change abierto;
  - los actos de una persona: `specgate change approve`,
    `config set agent_guard off` o `SPECGATE_GUARD=`, `apply --steps-reviewed`,
    `SPECGATE_ASSUME_TTY=`;
  - escribir en los archivos de control: `.specgate/config.json`,
    `.specgate/gate.yaml`, `.specgate/evidence/`, cualquier `approvals.json`, y
    `approved:` en un `change.yaml`;
  - escribir en un test de aceptación sellado (`acceptance_sealed`).

  Un rechazo nombra el paso que dar en su lugar, y nunca cómo desactivar el
  guard:

  ```
  specgate: write the test for REQ-311 first — change `module-map`. A test file
  new or changed in the working tree that names REQ-311 is the link; then
  src/core/map/scan.ts is allowed, then `specgate apply REQ-311`.
  ```

  Los tests no sellados, los specs, los features, la documentación y el
  Markdown no los rechaza la regla de primero el test. Cuando empieza el código,
  el guard registra los archivos de definición de pasos; cambiarlos después
  hace fallar el gate (`steps_changed_after_code`) hasta que una persona ejecuta
  `specgate apply REQ-NNN --steps-reviewed` en una terminal.
- **El gate** — antes de que termine la sesión (Claude Code, Codex) o cuando
  queda inactiva (OpenCode), un gate en rojo devuelve sus hallazgos, una vez
  por prompt.

<!-- specgate:diagram guard-decision -->

Los guards detienen una sesión, no un proceso decidido fuera de ella. El
[harness](harness.md) y `specgate compat run` añaden un juez externo: leen los
controles antes de que arranque el agente y comparan cuando se detiene
(`controls_changed_by_session`). Sin harness ni CI, esa comprobación no existe.

**`--tool claude-plugin` escribe un plugin, no la configuración de un
proyecto.** Ejecutado en un proyecto Specgate, escribe el plugin en
`.claude/specgate-plugin/`, donde el guard nunca lo lee como código sin test;
con otro `--project-dir`, ahí. La carpeta contiene `plugin.json` (y
`.claude-plugin/plugin.json`), `commands/`, `skills/`, `scripts/`,
`hooks/hooks.json` y `.mcp.json`, y sus hooks llaman a
`${CLAUDE_PLUGIN_ROOT}/scripts/…`, una ruta que solo rellena Claude Code para un
plugin instalado. Escribir la carpeta no activa nada: ningún hook se ejecuta
hasta que el plugin se instala en Claude Code —consulta
[Instala el plugin de Claude Code](automation.md#instala-el-plugin-de-claude-code),
o el comando de abajo, que imprime las dos líneas `/plugin` que pegar en Claude
Code (`/plugin marketplace add rsaglobaltech/specgate`, y después
`/plugin install specgate@specgate`).

Instala los guards de Claude Code y OpenCode una sola vez para todos los proyectos:

```bash
specgate agents install --global
```

El plugin de OpenCode va a su carpeta global (`~/.config/opencode`, o
`$XDG_CONFIG_HOME/opencode`); para Claude Code el comando imprime las dos líneas
`/plugin` que lo instalan desde el marketplace de este repositorio. Los hooks de
Codex son por proyecto: `specgate agents init --tool codex-hooks`. Un proyecto
sin `spec.md` no ve nada de ninguno de ellos. Una persona desactiva el guard de
primero el test para un proyecto con `specgate config set agent_guard off`, o
para una sesión con `SPECGATE_GUARD=off`, desde su propia terminal; el guard
rechaza ambos desde dentro de una sesión.

## Antigravity

Antigravity recibe dos archivos: `.agents/rules/specgate.md`, las reglas del
workspace, y `.agents/mcp_config.json`, una conexión al
[servidor MCP](mcp.md), para que el agente lea el árbol de specs actual en lugar
de una instantánea. Ambas rutas siguen la propia documentación de Antigravity.
El archivo de reglas se queda muy por debajo del límite de 12.000 caracteres de
Antigravity, a partir del cual un archivo de reglas se corta sin avisar. El
`GEMINI.md` de Antigravity lo cubre la herramienta `gemini`.

## Siguiente

- [Cambiar un requisito ya entregado](reviewing-changes.md): el ciclo que maneja el agente
- [El servidor MCP](mcp.md): el mismo ciclo como herramientas
