<!-- translation-of: 6867be424128 -->
# Guías prácticas

Guías con forma de tarea, cada una independiente. Copiar y pegar debería funcionar de principio a fin.

<!-- specgate:note -->
**Node.js ≥ 22**, `git` y una shell. Ejecuta los comandos desde dentro del
proyecto: suben desde el directorio actual buscando `spec.md`, `.specops.lock` o
`specops.config.yaml`. Para apuntar a otro directorio, la mayoría aceptan
`--project-dir <path>`; `check` y `validate` lo aceptan como argumento
(`specgate check ../other-project`). El `--help` de cada comando dice cuál.
<!-- specgate:endnote -->

## Por tarea

| Quiero… | Guía |
| --- | --- |
| Empezar, en un proyecto nuevo o en un repositorio existente | [Primeros pasos](getting-started.md) |
| Unirme a un proyecto que ya usa Specgate | [Unirte a un proyecto](quickstart.md) |
| Aprender el bucle diario: `propose`, `apply`, `status`, `archive` | [Cada día: el bucle diario](start/scratch-5-every-day.md#3-el-bucle-diario) |
| Convertir el brief de un cliente en requisitos | [Escribe el brief](start/write-the-brief.md), y después [Del brief de un cliente](from-a-brief.md) |
| Trabajar desde un ticket de Jira | [Desde un ticket de Jira](from-a-ticket.md) |
| Adoptar un código existente cuyo trabajo llega como tickets de Jira | [Un código existente, con Jira](existing-project-with-jira.md) |
| Probar el bucle entero sobre una copia de mi repositorio | `specgate onboard --tour`: [Referencia de comandos](commands.md#starting-a-project) |
| Adoptar un repositorio que ya está en producción, con un ejemplo completo | [Adopción brownfield, ejemplo completo](case-studies/case-1.md) |
| Redactar requisitos a partir de código que ya funciona, y activar el gate sin un build en rojo | [Especifica un sistema que ya funciona](reverse.md) |
| Escribir requisitos, escenarios y filas de la matriz | [Escribir specs](writing-specs.md) |
| Hacer que el gate se ejecute en local y en CI | [Validar](validating.md) |
| Abrir un change, entregarlo, archivarlo, o cambiar un spec que ya se publicó | [Cambia un requisito ya publicado](reviewing-changes.md) |
| Compartir conocimiento del dominio entre repositorios | [Packs de dominio](domain-packs.md) |
| Conectarlo con editores, agentes, hooks y CI | [Automatización](automation.md) |
| Manejarlo desde Claude, Cursor o Copilot | [Agentes](agents.md) |
| Entregar requisitos a un agente, y verlo trabajar en `/live` | [El harness](harness.md) |
| Dividir el harness en un tester y un implementador, o limitar su coste | [Carriles, roles y límites](harness-roles.md) |
| Instalar el bucle como Agent Skills | [Agentes](agents.md#wire-it-in) |
| Registrar decisiones de arquitectura, lo que puede decidir el agente y el stack | [Decisiones](decisions.md) |
| Mantener un glosario, reglas de negocio numeradas y diagramas del dominio | [Lenguaje del dominio](domain-language.md) |
| Enseñar un change a personas que no leen el repositorio | [Revisa con el negocio](business-review.md) |
| Servir el studio a un equipo, con roles y ediciones como pull requests | [El studio para un equipo](studio-team.md) |
| Escribir notas de versión, una checklist de aceptación y guías de usuario | [La entrega](transition.md) |
| Reflejar los requisitos en Jira, Azure Boards o GitHub Issues | [Jira, Azure Boards, GitHub](alm.md) |
| Averiguar por qué algo no se comporta como debe | [Resolución de problemas](troubleshooting.md) |
| Consultar un comando | [Referencia de comandos](commands.md) |

## Lecturas más largas

<!-- specgate:cards cols=3 -->
- [Primeros pasos](getting-started.md) — El recorrido completo más corto: dos caminos de cinco páginas breves, toda la salida real.
- [Packs de dominio, de principio a fin](packs-end-to-end.md) — Instala un pack, actualízalo, quítalo.
- [Tutorial](tutorial.md) — La versión larga sobre un pack, con el razonamiento de cada paso.
<!-- specgate:endcards -->

El tutorial es un único archivo a propósito: es una narración, no un conjunto de tareas.

## Siguiente

- [Primeros pasos](getting-started.md): instala, elige tu camino, los cuatro verbos
- [Referencia de comandos](commands.md): cada comando y cada flag
