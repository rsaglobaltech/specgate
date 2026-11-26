<!-- translation-of: 6b2615c43196 -->
# Unirte a un proyecto

Otra persona configuró Specgate; tú necesitas el ciclo. ¿Lo configuras tú
mismo? Consulta **[Empezar](start.md)**.

Con el repositorio clonado y sus dependencias instaladas, ejecuta esto desde su
carpeta (`npx specgate` usa la versión que fijó el equipo):

```bash
npx specgate status                 # lo que falta, y el siguiente comando
npx specgate propose <change-id>    # abre un change; escribe su delta
npx specgate change approve <change-id>   # una persona, en su terminal: aprueba el delta
npx specgate apply REQ-007          # cuando un test nombra REQ-007: el gate, luego Implemented
npx specgate archive <change-id>    # todos los requisitos aplicados: haz merge del change
npx specgate check                  # antes del pull request — CI ejecuta lo mismo
```

¿Trabajas a partir de un ticket de Jira? `npx specgate propose --from-ticket KAN-13` — consulta
[Desde un ticket de Jira](../from-a-ticket.md).

## Siguiente

- [Conceptos](concepts.md#vocabulario) — las palabras
- [El primer pull request de tu equipo](../first-pr.md) — qué escribe el autor, qué lee el revisor
