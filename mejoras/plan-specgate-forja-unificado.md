# Plan: una puerta de entrada, dos motores (Specgate + forja)

Decisión: [ADR-0033](../docs/specs/adr/0033-one-front-door-two-engines.md), 2026-10-12.
Specgate es el comando que el usuario aprende; forja sigue siendo un paquete
aparte al que Specgate llama. Objetivo final: el ciclo DevOps completo y el
modelo C4, verificados.

Reglas que siguen vigentes: sin GitHub Actions (verificar en local); PRs a
`develop`; `main` solo recibe `develop` en verde; cada repo con solo
`main` y `develop`. Marcar `[x]` al cerrar cada tarea, en el mismo PR.

## Fase A — Una puerta de entrada

- [x] Specgate: `arch_cmd` en `check`, `done` y el harness (ADR-0028, puntos 1–2):
      no estaba implementado, y la fase A lo necesita
- [ ] `specgate init` en carpeta vacía ofrece "generar el proyecto con forja"
      (`npx @rsaglobaltech/forja@<pin> init`) y adopta el resultado; el
      esqueleto propio se queda para stacks que forja no cubre
- [ ] `specgate add usecase|entity|port` delega en `forja add` si hay
      `forja.config.json`; si no, dice qué falta
- [ ] forja: `forja doctor --arch` (solo la regla de imports del core, código
      de salida) y el proyecto generado fija `arch_cmd` (Node: `forja doctor
      --arch`; Java: el test de ArchUnit)
- [ ] `specgate` a secas y `status` muestran también el siguiente paso de forja
      (p. ej. "añade el caso de uso: specgate add usecase …")
- [ ] Tests con un forja falso; comprobación de release con el forja real en
      una carpeta vacía (node, spring, quarkus)
- [ ] Un solo sitio: la documentación de forja como sección "Start a new
      project" del sitio de Specgate; el sitio de forja apunta allí

## Fase B — Modelo C4

- [ ] forja `init` escribe `docs/architecture/workspace.dsl` (Structurizr DSL):
      nivel 2 completo desde `forja.config.json`, nivel 3 de los módulos
      generados, nivel 1 como esqueleto
- [ ] `forja add` añade el componente al DSL, etiquetado con su `REQ-xxx`
- [ ] `forja doctor` falla si el DSL y el código no coinciden (módulo o caso de
      uso en uno y no en el otro)
- [ ] Specgate: `draft` propone el nivel 1 (personas y sistemas externos) desde
      el brief; lo que el brief no nombra es pregunta, no invento
- [ ] Specgate: `check` valida que cada actor de los REQ existe en el nivel 1
- [ ] Specgate: la matriz y `report` muestran el componente de cada requisito
- [ ] Exportación a Mermaid para verlo en GitHub y en el sitio

## Fase C — Deploy

- [ ] Dockerfile de producción para el camino Node (hoy solo Java)
- [ ] Un recipe de despliegue desde la máquina del usuario, sin Actions
      (destino a decidir con el usuario: VPS con docker compose, Fly.io, Render)

## Fase D — Operate / Monitor → Plan

- [ ] Recipe de observabilidad: logs estructurados y OpenTelemetry
- [ ] `specgate new --from-incident`: un fallo de producción entra como
      requisito con su escenario, y el bucle vuelve a Plan
