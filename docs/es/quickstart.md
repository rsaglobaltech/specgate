<!-- translation-of: cfb40f228c15 -->
# Unirte a un proyecto

Otra persona configuró Specgate; tú necesitas el ciclo. ¿Lo configuras tú
mismo? Consulta **[Empezar](start.md)**.

Con el repositorio clonado y sus dependencias instaladas, ejecuta esto desde su
carpeta (`npx specgate` usa la versión que fijó el equipo):

```bash
npx specgate status                 # what is left, and the next command
npx specgate propose <change-id>    # open a change; write its delta
npx specgate apply REQ-007          # after a test names REQ-007: the gate, then Implemented
npx specgate archive <change-id>    # every requirement applied: merge the change
npx specgate check                  # before the pull request — CI runs the same
```

¿Trabajas a partir de un ticket de Jira? `npx specgate propose --from-ticket KAN-13` — consulta
[Desde un ticket de Jira](from-a-ticket.md).

## Siguiente

- [Conceptos](concepts.md#vocabulario) — las palabras
- [El primer pull request de tu equipo](first-pr.md) — qué escribe el autor, qué lee el revisor
