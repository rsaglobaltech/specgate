# Evaluación real: Golden State Reinforcing (golden_app)

Producto real construido con Specgate desde cero (2026-10-07): seis domain
packs en `rsaglobaltech/specops_golden_app`, código en
`rsaglobaltech/golden_app` (scaffold `forja`, monorepo Expo + Next.js +
`packages/core` hexagonal). Ambos repos viven un nivel por encima de este.

Flujo: develop + un PR por requisito, todo implementado con `harness run`.

## Hallazgos y estado

Los defectos de Specgate, con causa y versión que los arregla, están en
[`specgate-defectos.md`](specgate-defectos.md).

| # | Hallazgo | Estado |
|---|---|---|
| 1–19 | Adopción, lint, YamlLite, matriz derivada, prompt del harness | [x] 0.14.1 / 0.14.2 |
| 20 | Packs sin `depends_on` | [x] packs v0.1.2 |
| 21 | `depends_on` entre packs no soportado | [ ] abierto |
| 22 | Catálogos de dominio: gana el último pack | [x] fix/golden-eval-3 |
| 23 | `sync`: falso conflicto en `traceability.md` derivada | [x] fix/golden-eval-3 |
| 24 | `sync` mueve el lock pero no trae `depends` (trace "kept") | [x] fix/golden-eval-3 |
| 25 | El harness commitea `.specops/harness-prompts/` | diseño: es el registro de auditoría |
| 26 | `plan`: artefacto con varios ficheros | [x] fix/golden-eval-3 |
| 27 | `plan`: filas duplicadas con varios escenarios | [x] fix/golden-eval-3 |
| 28 | 16/46 requisitos sin escenario y `pack lint` callado | [x] nota en lint + packs v0.1.3 |
| 29 | La línea base de `adopt` se planifica para siempre | [x] fix/golden-eval-3 |
| 30 | `sync` sin cambios reescribe `expanded_at` en el lock (diff ruidoso) | [ ] abierto |
| 32 | Un escenario añadido a un requisito entregado hereda sus tests: 99/99 "done" con 52 sin probar | [x] fix/scenario-links |
| 33 | `plan --json` cortado a 65.536 bytes en pipe (`process.exit` antes de vaciar stdout); 28 comandos más hacen lo mismo | [x] plan · [ ] resto |
| 34 | `validate --against-lock` compara solo el primer escenario de cada requisito: con varios, falsa deriva | [x] fix/drift-multi-scenario |
| 35 | Harness en verde pero push rechazado ("stale info") en la 2.ª ronda | [x] fix/harness-stale-lease |
| 37 | Harness rechaza una matriz derivada regenerada como "edición prohibida" (REQ-302) | [x] fix/harness-derived-matrix |
| 31 | 48/48 "done" y el producto no se puede usar: 59 casos de uso en `core`, cero rutas API ni pantallas nuevas. Los escenarios solo piden dominio, y el agente hace lo mínimo que los pasa | [x] packs v0.2.0 (52 escenarios de API y pantalla) + plataforma de tests (golden_app #51) |

## Tareas

- [x] Lote 3 de correcciones (#22–#29) con tests en `tests/unit/golden-eval.test.ts`.
- [x] Packs v0.1.3: un escenario por requisito.
- [x] Release 0.14.3 (2026-10-08; E2E del registro 31/31).
- [x] golden_app: packs v0.1.3 en develop (PR #7).
- [x] Harness sobre los 43 requisitos restantes (2026-10-08): 43/43 al primer intento, PR #8–#50, agente 111–324 s (mediana 199 s), 3 h 28 min en total. 374 tests, gate verde.
- [x] CI de tests en golden_app (PR #6).
- [ ] Puerto/stub del proveedor de IA (REQ-5xx, plan reader REQ-608).
- [ ] Packs curados: 21 requisitos sin escenario en los 11 packs (lo que ahora
      enseña `pack lint` como nota). Escribirlos y, entonces, subir la nota a aviso.
- [ ] #21: `depends_on` entre packs.
- [x] Harness sobre los 30 requisitos reabiertos por v0.2.0 (2026-10-08): 30/30, PR #53–#82; 28 al primer paso, REQ-501 tras #35 y REQ-302 tras #37 (0.14.6). Resultado: 99/99, 41 rutas API, 14 pantallas, 67 casos de uso, 599 tests (core 400, web 146, mobile 53), gate verde.
- [x] Idea del usuario: ADR-0029 y spec `docs/specs/draft-from-brief.md` (2026-10-08).
- [x] ADR-0030 y spec `docs/specs/verify-foreign-specs.md`: verificar specs de Spec Kit, OpenSpec y Kiro (2026-10-08). **Va antes que `draft`** (decisión del usuario).
- [ ] `verify` fase 1: lector OpenSpec + V1–V7 + `verify.lock` + Action; piloto con defectos sembrados.
- [ ] `specgate draft` fase 1: checklist D1–D8 + `draft --check`.
- [ ] `specgate draft` fase 3: prototipo y evaluación contra la ficha de golden_app (guardar la ficha original como fixture).
- [ ] Informe final de evaluación.
