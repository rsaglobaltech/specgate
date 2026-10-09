# Informe final — Golden State Reinforcing construido con Specgate

Fecha: 2026-10-09. Repositorios: `golden_app` (código) y `specops_golden_app`
(packs), un nivel por encima de este. Detalle por hallazgo en
[`golden-app-evaluation.md`](golden-app-evaluation.md); defectos de la
herramienta en [`specgate-defectos.md`](specgate-defectos.md).

## Pregunta

¿Sirve Specgate para construir un producto real con SDD, de la ficha del
cliente al código, con agentes haciendo el trabajo de implementación?

## Respuesta corta

**Sí para construir; todavía no para que un equipo lo use sin acompañante.**
El agente construyó lo especificado casi siempre al primer intento y el gate
mantuvo honestos los estados. El cuello de botella fue escribir la
especificación, y la herramienta tuvo 41 defectos en tres días de uso real.
Todos tienen arreglo salvo #21 (dependencias entre packs); los últimos
(#30, #39–#41) salen en la 0.16.x.

## El producto

| | |
|---|---|
| Requisitos | **99/99 hechos**, en 6 packs de dominio (asistencia con geocerca, expedientes de obra, bitácora del capataz, parte diario, asistente de correo IA, formación bilingüe) |
| Escenarios | 99 filas en la matriz generada; 52 de API y pantalla añadidos en la segunda ronda |
| Código | 67 casos de uso, **41 rutas API**, **14 pantallas** Expo, ~20.000 líneas de TypeScript |
| Tests | **599** (dominio 400, API 146, pantallas 53), 141 ficheros; gate verde |
| Historia | 82 PR fusionados, un PR por requisito, en ~23 horas de calendario (2026-10-07 17:37 → 10-08 16:35) |

## Cómo se construyó

1. **Ficha → packs a mano.** 46 requisitos, 31 casos de uso, escenarios con
   valores concretos en `tools/packs_data.py`. Lo más lento y lo más frágil.
2. **Packs → proyecto.** `specops add` de los 6 packs sobre un scaffold `forja`.
3. **Harness, ronda 1** (dominio): 43 requisitos, un PR cada uno.
4. **Hallazgo #31.** "48/48 hecho" y nada que un usuario pudiera tocar: los
   escenarios solo pedían dominio, y el agente hizo exactamente eso.
5. **Packs v0.2.0**: 52 escenarios de API y pantalla; plataforma de tests web y
   móvil.
6. **Harness, ronda 2**: 30 requisitos reabiertos; rutas, pantallas y tests.

## El harness

| Medida | Valor |
|---|---|
| Ejecuciones de requisito | 76 |
| Al primer intento | **74** (97 %) |
| Las otras 2 | fallos de **Specgate**, no del código: push con referencia obsoleta (#35) y matriz regenerada tomada por manipulación (#37) |
| Tiempo de agente (mediana) | 228 s por requisito; ~5 h de agente en total |
| Tiempo por requisito con CI | ~5 min (ronda 1, dominio) · ~7 min (ronda 2, API + pantalla) |

Los tests usan los valores literales de los escenarios. Ningún intento editó
el contrato (spec, features) para pasar.

## Lo que Specgate hizo bien

- **El gate dijo la verdad.** `done` se niega cuando `check` fallaría; el
  harness rechaza que el agente toque el contrato. Cuando un pack añadió
  escenarios a requisitos entregados, Specgate llegó a decir "99/99 hecho" con
  52 sin test (#32) — y una vez corregido, eso es exactamente lo que detecta.
- **La matriz generada** eliminó el mantenimiento a mano: `traceability.md` se
  regeneró en cada PR desde specs, escenarios y tests, sin que nadie la editara.
- **Packs como dependencias** con lock, diff, sync a tres bandas y deriva en CI:
  el producto se especificó en un repo y se construyó en otro.

## Lo que costó

1. **De la ficha a la spec.** 16 de 46 requisitos sin escenario y toda la capa
   de API y pantallas olvidada, y nada lo dijo. De aquí salen ADR-0029
   (`draft`) y su checklist D1–D8, ya publicada como `draft --check`.
2. **"Hecho" es "cumple la spec", no "el producto funciona".** La lección más
   importante, y la que más hay que explicar a un equipo.
3. **Defectos de la herramienta.** 41 en tres días, en su mayoría en las juntas
   entre packs, sync y harness. Cada arreglo lleva su test de regresión; solo
   #21 (dependencias entre packs) sigue abierto.

## Defectos por zona

| Zona | Defectos |
|---|---|
| specops (add, sync, lock, deriva) | #7, #22–#24, #30, #34 |
| Matriz y plan | #4, #8, #26, #27, #29, #32, #33 |
| Harness | #9–#11, #35, #37 |
| Lint de packs y lectores | #1–#3, #5, #28, #38 |
| CLI, MCP, CI, nombres | #6, #12, #36, #39–#41 |

## Qué falta para que un equipo lo adopte solo

1. **El plan de simplificación** (`plan-simplificacion-equipo.md`): el agente
   como interfaz, el proceso proporcional al cambio, documentación de una página.
2. **Una o dos semanas de uso real** por alguien del equipo en un proyecto
   suyo, registrando cada defecto. Listón: una semana sin defectos bloqueantes.
3. **`draft` fase 3**: que el agente escriba el borrador desde la ficha, medido
   contra los packs de golden_app como referencia.

## Límites de este informe

- Un solo producto, especificado y construido por el mismo autor que mantiene
  la herramienta. La lectura externa de estos números sigue pendiente.
- Coste en tokens no medido.
- El asistente de correo y el lector de planos usan un adaptador simulado; el
  proveedor de IA real no se integró.
