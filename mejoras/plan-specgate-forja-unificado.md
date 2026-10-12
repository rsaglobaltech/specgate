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
- [x] `specgate init` en carpeta vacía ofrece "generar el proyecto con forja"
      (`npx @rsaglobaltech/forja@<pin> init`) y adopta el resultado; el
      esqueleto propio se queda para stacks que forja no cubre — `init --forja`
      y la pregunta interactiva; `SPECGATE_FORJA_CMD` para un forja local
- [x] `specgate add usecase|entity|port` delega en `forja add` si hay
      `forja.config.json`; si no, dice qué falta (`add_needs_forja`)
- [x] forja: el proyecto generado trae `npm run arch` (Node: script sin
      dependencias con la regla del core; Java: solo el test de ArchUnit) y la
      instalación fija `arch_cmd` (forja #10). Sin `forja doctor --arch`: así
      el proyecto no depende de forja en runtime
- [x] `specgate` a secas y `status` muestran también el siguiente paso de forja
      (p. ej. "añade el caso de uso: specgate add usecase …") — en un proyecto
      forja, el siguiente requisito sin código sugiere
      `specgate add usecase <module>/<Name> --req REQ-xxx`
- [x] Tests con un forja falso (unitarios + journey E2E); probado con el forja
      real en una carpeta vacía (node)
- [ ] Publicar: forja 1.0 en npm y Specgate 0.20 (el pin `@1` no resuelve hasta
      entonces; `arch_cmd` necesita 0.20 en los proyectos generados)
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
