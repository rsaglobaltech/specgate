# Evaluación real: Golden State Reinforcing (golden_app)

Producto real construido con Specgate desde cero (2026-10-07): seis domain
packs en `rsaglobaltech/specops_golden_app`, código en
`rsaglobaltech/golden_app` (scaffold `forja`, monorepo Expo + Next.js +
`packages/core` hexagonal). Ambos repos viven un nivel por encima de este.

Flujo: develop + un PR por requisito, todo implementado con `harness run`.

## Hallazgos y estado

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

## Tareas

- [x] Lote 3 de correcciones (#22–#29) con tests en `tests/unit/golden-eval.test.ts`.
- [x] Packs v0.1.3: un escenario por requisito.
- [x] Release 0.14.3 (2026-10-08; E2E del registro 31/31).
- [x] golden_app: packs v0.1.3 en develop (PR #7).
- [ ] Harness sobre los 43 requisitos restantes, PR por requisito; métricas por lote.
- [x] CI de tests en golden_app (PR #6).
- [ ] Puerto/stub del proveedor de IA (REQ-5xx, plan reader REQ-608).
- [ ] Packs curados: 21 requisitos sin escenario en los 11 packs (lo que ahora
      enseña `pack lint` como nota). Escribirlos y, entonces, subir la nota a aviso.
- [ ] #21: `depends_on` entre packs.
- [ ] Informe final de evaluación.
