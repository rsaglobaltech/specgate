# Piloto de `specgate verify` con OpenSpec (ADR-0030, fase 1)

Fecha: 2026-10-08. Repositorio del piloto: `golden_openspec_pilot`, un nivel por
encima de este (local). Herramientas: OpenSpec 1.14.1 (`@fission-ai/openspec`),
Claude Code como agente, Specgate de la rama `feat/verify-openspec`.

## Qué se hizo

1. **OpenSpec según su propio libro.** Módulo de asistencia de Golden State
   (fichaje dentro de la geocerca, salida con marca, ajustes aprobados por otra
   persona, ubicaciones simuladas, baja precisión):
   - `/opsx:propose` → 38 escenarios en 2 capacidades anidadas, 14 tareas (174 s);
   - `/opsx:apply` → 14/14 tareas marcadas, 97 tests vitest en verde, typecheck limpio;
   - `openspec archive` → el change pasa a `changes/archive/` y a `openspec/specs/`.
2. **`verify` sobre ese "hecho".** **38 de 38 escenarios sin un test que los
   nombre.** Hay 97 tests en verde, pero nada dice cuál prueba qué.
3. **Adopción (rama `honest`).** Un agente recibe `verify --ids` y nombra cada
   escenario en el test que lo prueba.
4. **Defectos sembrados.** La lista se selló antes de sembrar
   (`scratchpad/pilot-sealed-defects.md`), un defecto por rama desde `honest`.

## Resultados

| Medida | Listón | Resultado |
|---|---|---|
| Falsos positivos en `honest` | 0 | **0** (ni errores ni avisos; 38/38 nombrados, suite verde) |
| Defectos sembrados detectados | 100 % | **5/5** |
| Tiempo de adopción | < 30 min | **2,7 min** (162 s, agente) |

| Defecto sembrado | Esperado | Encontrado |
|---|---|---|
| P1 Requisito nuevo archivado sin test | V1 en su escenario | V1 × 1, el escenario exacto |
| P2 Test que nombra su escenario y falla | V2 con `--run` | V2 |
| P3 Escenario editado tras verificarlo | V3 en ese id | V3, el id exacto |
| P4 Escenario renombrado, test con id viejo | V6 (id viejo) + V1 (nuevo) | V6 + V1, ambos ids exactos |
| P5 Borrado el fichero con los tests de ubicación simulada | V1 en esos ids | V1 × 20, incluidos los dos de ubicación simulada |

## Lo que el piloto destapó

- **Un escenario "hecho" y probado a medias, en el flujo de OpenSpec.** Al
  enlazar escenarios con tests, el test de *Rejection by a non-author* solo
  comprobaba la mitad del THEN (el estado, no el efecto en la línea de tiempo).
  Hubo que escribir uno nuevo. OpenSpec lo había archivado como terminado.
- **Un defecto de Specgate antes de publicar (#38).** OpenSpec 1.14 anida
  capacidades (`specs/time-attendance/clock-punches/spec.md`) y el lector las
  ignoraba en silencio. Corregido con test.
- **OpenSpec trae `/opsx:verify`**, opcional: un agente busca palabras clave
  antes de archivar y su informe es orientativo. No enlaza escenario con test
  ni corre en CI. Es complementario; está explicado en ADR-0030.

## Desviación del protocolo, declarada

La especificación pide sembrar en *una* rama. Se sembró en cinco, una por
defecto, porque P5 (borrar `clock-punches.test.ts`) habría borrado también el
test de P2 y enmascarado su detección. Los defectos son exactamente los de la
lista sellada.

## Límites

- Un solo módulo, 38 escenarios, y el piloto lo diseñó el mismo autor que
  `verify`. Un piloto externo (otro equipo, otro módulo) sigue pendiente antes
  de anunciarlo como caso público.
- La adopción la hizo un agente. Una persona tardaría más; el orden de magnitud
  (minutos, no horas) es lo que se mide.
