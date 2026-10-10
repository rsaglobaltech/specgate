# Piloto real: HealthTech (dominio regulado, Quarkus)

Sexto producto construido con Specgate desde una ficha de cliente
(2026-10-10), el tercero en Java y el primero en un **dominio regulado**
(salud). Código en `rsaglobaltech/healthtech` (privado), un nivel por encima
de este repo (`../healthtech`), con bitácora en `docs/bitacora/`.

## Límites acordados antes de empezar

No se inventan reglas clínicas; todos los datos son ficticios; las cuestiones
legales y sanitarias son preguntas para el cliente. La ficha (EventStoreDB,
Debezium, Elasticsearch, SMART on FHIR) se trató como en FinCore y EventTech:
se cumplen sus promesas sin su infraestructura.

## Resultado

| Módulo | Requisitos |
|---|---|
| Casos (hechos firmados por autor, correcciones sin borrar, estado a una fecha) | 10/10 |
| Estudios (cobertura simulada, laboratorio, resultados por revisar) | 4/4 |
| Prescripción (alergias registradas, suspensión) | 3/4 — **REQ-020 interacciones, `Needs Clarification`** |
| Consulta (similares anonimizados, FHIR R4 de lectura) | 3/3 |
| Privacidad (registro de accesos inmutable, REQ-027 MODIFIED) | 2/2 |

23/24, 35 tests, CI en verde.

## Lo que aportó Specgate en un dominio regulado

- **`Needs Clarification` como barrera.** Las alertas de interacciones
  farmacológicas son lo que un agente podría rellenar con una tabla
  inventada. Quedaron bloqueadas por una pregunta (base de datos con licencia;
  posible producto sanitario). Con 0.17.8, `status` las muestra en "Waiting
  for an answer" y `done` se niega: el bloqueo es visible y no se salta.
- **D5** obligó a citar la fuente de CIE-10 y FHIR R4.
- **D6** obligó a declarar cada dato de ejemplo, y los `assumptions.md` dicen
  "ficticio, sin valor médico".
- **D12** no marcó nada: los supuestos de ids se escribieron desde el
  principio (lección de EventTech).

## Lo que solo encontró la app arrancada

La búsqueda de pacientes (devuelve alergias) y la lista del laboratorio no
dejaban rastro en el registro de accesos: REQ-027 MODIFIED
(`privacidad-2`). Y una pregunta nueva: ¿debe quedar constancia de un aviso
de alergia que hace desistir al médico? No se implementa sin respuesta.

## Idea anotada

#82: D7 da por respondida una pregunta cuya respuesta es "se decidirá más
tarde"; debería tratarla como abierta.
