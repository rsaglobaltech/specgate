<!-- translation-of: 00daa6e1f480 -->
# Qué decirle a tu agente

Specgate no piensa por tu agente de código, y tampoco necesita que tu agente
lo estudie. Le da al agente lo que necesita cada paso:
`AGENTS.md` (el contrato), `specgate status` (el siguiente paso),
`DRAFTING.md` (el prompt para un módulo del brief) y `specgate change
instructions <artifact> --json` (el formato exacto de cualquier fichero). Lo que tú le
das al agente es breve: por dónde empezar y lo que nunca debe hacer.

**Necesitas:** un proyecto donde se haya ejecutado `specgate init` o `specgate adopt`, y
los pasos de tu agente instalados con `specgate agents init --tool <codex|opencode|claude>`.

<!-- specgate:diagram agent-levels -->

## Obtén el prompt del proyecto

```bash
specgate status --prompt         # the next step, the brief's modules left to draft
specgate status --prompt draft   # the next module of the brief
specgate status --prompt build   # the next requirements, one at a time
```

Imprime un prompt en inglés, escrito a partir del proyecto tal como está ahora: pégalo
en Codex, OpenCode, Claude Code o cualquier otro agente. `--json` lo da como datos.
Las secciones siguientes son los mismos prompts, para leerlos antes de pegar uno.

## Cómo llama cada agente a los pasos de specgate

| Agente      | Pasos                                                             | Instalado por                                                  |
| ----------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| Codex       | `$specgate-draft`, `$specgate-apply`, `$specgate-check`… (skills) | `specgate agents init --tool codex` → `.agents/skills/`        |
| OpenCode    | `/specgate-draft`, `/specgate-apply`, `/specgate-check`…          | `specgate agents init --tool opencode` → `.opencode/commands/` |
| Claude Code | `/specgate:draft`, `/specgate:apply`, `/specgate:check`…          | `specgate agents init --tool claude` → `.claude/commands/`     |

El harness ejecuta el agente que nombra `agent:` en `harness.config.yaml`. `agents
init --tool codex` pone el de Codex (`codex exec -s workspace-write - <
{prompt_file}`); cámbialo con `specgate config set agent "<command>"`.

## Un proyecto nuevo, a partir de un brief

Escribes `docs/brief.md` —qué es el producto, sus actores y sus módulos
([Escribir el brief](start/write-the-brief.md))— y después le das al agente:

```text
This project uses specgate for spec-driven development. specgate is installed: run it as `specgate`.
Read AGENTS.md first: it is the contract you work under. Do not study specgate's own documentation;
specgate tells you what to do next.

Draft the modules of docs/brief.md, one at a time:
1. Run `specgate propose --from-brief <module>`. It opens the draft and writes DRAFTING.md in it.
2. Follow that DRAFTING.md: it is your prompt.
3. Run `specgate propose --from-brief <module>` again until it says "Ready to review".
4. Stop and say so: a person reviews each draft and answers its questions.
```

Después una persona revisa el borrador, responde `questions.md` y lo aprueba
(`specgate change approve <change> --layer …`, o Changes en el studio).

## Un proyecto existente

Después de `specgate adopt`:

```text
This project uses specgate. Read AGENTS.md first.
Write the first requirement from code that already exists: run `specgate propose <change-id>`,
write one requirement — one sentence of what the system SHALL do and a scenario with a real
example, the numbers an existing test already uses — then name it in that test and run
`specgate check`. Stop for a person to review it.
```

## Cada día

```text
This project uses specgate. Read AGENTS.md first.
Build the next requirement:
1. Run `specgate status` and take the next requirement it names.
2. Write its test first, naming the requirement (REQ-NNN); see it fail.
3. Write the code until `specgate check` passes.
4. Run `specgate apply <REQ>`.
Repeat one requirement at a time. Stop when status names a step for a person.
```

O déjaselo al harness: `specgate harness run` da cada requisito al
agente en su propia rama y conserva solo lo que pasa el gate ([El harness](../harness.md)).

## Lo que el agente nunca hace

Pon esto debajo de cada prompt; `specgate status --prompt` lo hace:

```text
Rules you never break:
- Write the test first, and name the requirement in it: that mention is the link.
- Run `specgate check` before you say anything is done; only what it passes is done.
- Never edit spec.md, features/ or docs/specs/ to make a test pass.
- Never archive a change, approve a layer or answer a question in questions.md yourself: a person does.
- When a value is missing, ask (`specgate ask`) or record an assumption; never invent one.
```

Los [guards](../agents.md#the-guards) imponen las dos primeras, y el «nunca
apruebes» de la cuarta, en Claude Code, OpenCode y Codex, decida lo que decida el agente:
el código espera un test que nombre el requisito, un gate en rojo
impide que la sesión termine y `specgate change approve` se rechaza desde
la sesión. Aprobar necesita a una persona en un terminal.

## Siguiente

- [Agentes](../agents.md): lo que `agents init` escribe para cada herramienta
- [Elegir y conectar tu agente](../agent-setup.md): el comando, los perfiles, las escaleras
- [El harness](../harness.md): ejecuciones desatendidas
