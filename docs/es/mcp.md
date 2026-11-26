<!-- translation-of: ef728124c0a6 -->
# El servidor MCP

Al final de esta página, un cliente MCP (Claude Desktop, Cursor, Claude Code,
Antigravity) puede ejecutar el mismo ciclo que tiene la terminal: qué está
abierto, abrir un change, el gate y entregar un requisito. MCP, el Model Context
Protocol, es como estos clientes llaman a herramientas externas.

**Necesitas:** un proyecto donde se haya ejecutado `specgate init`, y Node.js 22
o posterior en la máquina que ejecuta el cliente. El servidor viene dentro del
paquete de Specgate; no hay nada más que instalar.

<!-- specgate:diagram mcp-tools -->

## Instálalo

```bash
specgate mcp install --client claude     # Claude Desktop
specgate mcp install --client cursor     # Cursor (~/.cursor/mcp.json)
specgate mcp install --client opencode   # OpenCode: the project's opencode.json
specgate mcp install --client codex      # Codex: runs `codex mcp add`, your own Codex configuration
```

Añade una entrada `spec-driven` a la configuración del cliente y deja el resto
del archivo intacto. Reinicia el cliente y aparecen las herramientas.

A mano, la entrada es:

```json
{
  "mcpServers": {
    "spec-driven": {
      "command": "npx",
      "args": ["-y", "@rsaglobaltech/specgate@latest", "mcp", "serve"]
    }
  }
}
```

| Cliente | Archivo de configuración |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | `~/.cursor/mcp.json` |
| Claude Code | el `.mcp.json` del plugin de Specgate — ver [Instala el plugin de Claude Code](automation.md#instala-el-plugin-de-claude-code) |
| Antigravity | `.agents/mcp_config.json` — lo escribe `specgate agents init --tool antigravity` |
| OpenCode | el `opencode.json` del proyecto |
| Codex | tu propia configuración de Codex, mediante `codex mcp add` |

`specgate mcp serve` es lo que arranca cada una de esas configuraciones: el
servidor, por stdio, llamando a la CLI que lo sirve. Nunca lo ejecutas tú.

## Las herramientas

Cada comando es una herramienta llamada `specgate_<command>` —`specgate_status`,
`specgate_ci_init`, `specgate_change_new`, …—. Una herramienta cuyo comando
recibe un argumento posicional lo declara en su esquema de entrada: `title` para
`specgate_new`, `requirement` para `mark_requirement_done` y `req_*`, `id` para
`specgate_change_*`. Los comandos que se manejan con flags (`specops add`,
`pack init`, …) es mejor ejecutarlos desde una terminal. Las que un agente usa a
diario:

| Herramienta | Hace | Argumentos |
|---|---|---|
| `specgate_status` | Qué está abierto, y el siguiente comando que ejecutar. | `projectDir` |
| `specgate_new` | Un requisito con su escenario etiquetado. | `projectDir`, `title` |
| `specgate_check` | El gate, y después los tests cuando hay un comando de tests configurado. | `projectDir` |
| `specgate_verify` | Para un proyecto OpenSpec: cada escenario que reclama un change archivado debe nombrarlo un test (ADR-0030). Acepta un directorio con `openspec/` y sin `spec.md`. | `projectDir` |
| `mark_requirement_done` | Ejecuta el gate para el requisito y después lo marca Implemented. | `projectDir`, `requirement` |
| `plan` | La cola pendiente, con lo que aún necesita cada requisito. | `projectDir` |
| `validate_project` | `validate --strict`, interpretado. | `projectDir` |
| `read_spec` | `spec.md`, y la lista de cada `docs/specs/*.md`. | `projectDir` |
| `list_requirements` | Cada `REQ-NNN` con su título, archivo y línea. | `projectDir` |

Las herramientas que configuran el proyecto solo toman lo que declara su
esquema; cualquier otra cosa que envíe el cliente se descarta:

| Herramienta | Hace | Argumentos |
|---|---|---|
| `specgate_config_get` | El valor de un ajuste, y el archivo donde vive. | `projectDir`, `key` |
| `specgate_config_set` | Fija un ajuste (`test_cmd`, `arch_cmd`, …). `agent_guard off` se rechaza sin terminal (`guard_needs_person`). | `projectDir`, `key`, `value` |
| `specgate_config_list` · `specgate_config_keys` | Cada ajuste, y cada clave que existe. | `projectDir` |
| `specgate_agents_init` | Instala los comandos `/specgate:*` y las reglas para cada agente que conoce; no hay argumento para elegir uno: para una sola herramienta, ejecuta `specgate agents init --tool <name>` en una terminal. | `projectDir` |

Siete nombres cortos (`read_spec`, `list_requirements`, `update_traceability`,
`lint_pack`, `validate_project`, `plan` y `mark_requirement_done`) son
anteriores a los nombres `specgate_*` generados y siguen funcionando.

Los cuatro comandos de la terminal aún no tienen herramientas con su propio
nombre. Por MCP, el mismo ciclo es:

| Terminal | Herramienta MCP |
|---|---|
| `specgate propose <id>` | `specgate_change_new`, con `id` |
| `specgate apply <REQ>` | `mark_requirement_done`, con `requirement` |
| `specgate status` | `specgate_status` |
| `specgate archive <id>` | `specgate_change_archive`, con `id` |

`specgate_change_archive` se niega, como la terminal, mientras un requisito que
el change añade o modifica no esté Implemented.

Cada herramienta responde con el documento JSON del comando: un payload más
`status`, una lista de diagnósticos con un `code` estable y un `fix`. Decide
según `code`, nunca según el mensaje. → [El contrato del agente](specs/agent-contract.md)

## El guard: un agente no puede reescribir su propio examen

Las herramientas que escriben la especificación —`specgate_new`,
`mark_requirement_done`, `specgate_req_*`, `specgate_fix`, `specgate_expand`,
`specgate_specops_*`, `specgate_init`, `specgate_update`, `specgate_harness_run`—
**se niegan si no hay un change abierto**:

```text
specgate_new writes files the specification contract protects, and no change
is open. …
```

Abre antes un change: `specgate propose <id>` en una terminal, o la herramienta
`specgate_change_new`. Un agente que no consigue que un escenario pase podría,
si no, relajar el escenario, y el gate lo aprobaría. Un change es la forma de
editar un spec a propósito, y deja un rastro que revisa una persona.

Cuando el equipo quiere que el agente lleve el ciclo diario directamente,
permítelo en el repositorio, donde la decisión se revisa como cualquier otra,
en `.specgate/config.json`:

```json
{ "mcpAllowContractEdits": true }
```

Las herramientas `specgate_change_*` nunca tienen guard: son la forma de abrir
un change.

## Una sesión

Con el servidor configurado, pide en palabras normales:

> Add a requirement for downloading invoices as PDF, implement it, and close
> it when the gate is green.

1. El cliente llama a `specgate_change_new` (id: *add-invoice-pdf*). El change
   está abierto, con un delta que escribir e ids REQ reservados.
2. Escribe el requisito y su escenario en el delta del change. Después se
   detiene: una persona lee el delta y aprueba el change, en una terminal
   (`specgate change approve add-invoice-pdf`) o en Review del studio.
3. Escribe un test que menciona el nuevo `REQ-NNN`, y el código.
4. Llama a `mark_requirement_done` con ese id. Envuelve `specgate apply`: el
   gate se ejecuta primero. Si nadie aprobó el change (`change_not_approved`),
   el escenario aún tiene pasos de plantilla o ningún test menciona el
   requisito, la llamada vuelve con el motivo (exactamente lo que diría la
   terminal) y no se escribe nada.
5. Cuando el requisito está Implemented, llama a `specgate_change_archive`
   (id: *add-invoice-pdf*) y el change se fusiona en los specs.

No hay ninguna herramienta que apruebe un change, a propósito: aprobar es un
acto de una persona. Un cliente que llama a `mark_requirement_done` sobre un
change sin aprobar recibe un rechazo hasta que una persona lo aprueba en una
terminal.

Revisas la rama y abres el pull request como siempre.

## Cuando no funciona

| Síntoma | Causa | Corrección |
|---|---|---|
| No aparece ninguna herramienta | No se reinició el cliente, o `npx` no está en su `PATH` | Reinicia; en apps gráficas de macOS, apunta `command` a la ruta absoluta de `npx` |
| Todas las herramientas que escriben se niegan | El guard, funcionando | Abre un change, o fija `mcpAllowContractEdits` |
| `specgate_check` dice *tests not configured* | No hay comando de tests | `specgate config set test_cmd "npm test"` |
| Una configuración antigua ejecuta `@specgate/mcp-server` | Ese paquete nunca se publicó | Vuelve a ejecutar `specgate mcp install` o `specgate agents init` |

## Siguiente

- [Agentes](agents.md): comandos slash y archivos de instrucciones para tus herramientas de agente
- [El harness](harness.md): el mismo ciclo, sin supervisión
