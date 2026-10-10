# Piloto real: EventTech (Quarkus, event sourcing, tiempo real)

Quinto producto construido con Specgate desde una ficha de cliente
(2026-10-10), el segundo en Java y el primero en **Quarkus** (Jakarta EE).
Código en `rsaglobaltech/eventtech` (privado), un nivel por encima de este repo
(`../eventtech`), con bitácora paso a paso en `docs/bitacora/`.

## La ficha

Operaciones de eventos corporativos: sesiones paralelas, speakers, registro,
catering por restricciones, transporte, hoteles, badges, ocupación en tiempo
real, informes. Con mucha arquitectura (EventStoreDB, CQRS, Debezium); como en
FinCore, se ignoró la infraestructura pero se cumplió lo que promete:
reconstruir el evento a cualquier hora, tiempo real e informes.

## Resultado

| Módulo | Requisitos | Notas |
|---|---|---|
| Eventos | 11 | event sourcing sobre Postgres (tabla de hechos JSONB, solo inserción) |
| Registro | 8 + REQ-008 MODIFIED | cupo y plazas decididos en un solo agregado; concurrencia probada |
| Logística | 8 | "CateringAjustado" = pedido actual − enviado, sin guardar nada |
| Acceso | 6 | badges HMAC; WebSocket con eventos CDI `AFTER_SUCCESS` |
| Informes | 4 + REQ-047 MODIFIED (`informes-2`) | todo reconstruido de los hechos |

38/38, 71 tests, CI en verde.

## Specgate

- **Quarkus funcionó sin adaptar:** detección de Quarkus y `./mvnw`, CI con
  Java 21; Dev Services en GitHub Actions.
- **D12 (0.17.9) en su estreno:** un hueco real en el primer borrador (el
  organizador no podía ver las sesiones de un evento en borrador). Después,
  cada borrador declaró de dónde salen sus ids desde el principio. Límites:
  #80 (listas anidadas) y #81 (supuestos de cambios archivados).
- **Dos MODIFIED** en piloto (REQ-008, REQ-047): `.feature` regenerado y
  requisito de vuelta a Draft hasta que su escenario nuevo pasa.

## Lo que solo encontró la app arrancada

Errores sin cuerpo (fecha mal escrita), mover una sesión a una sala más
pequeña, plazas libres invisibles, entradas sin reserva invisibles y no-shows
de sesiones por llegar. Todos cerrados con requisitos (dos MODIFIED, uno
ADDED) o, el primero, con un test.

## Patrones que funcionaron

- Las promesas de arquitectura de la ficha como **requisitos funcionales**
  ("la agenda a cualquier fecha", "¿a qué hora se llenó la sala?").
- Un agregado por evento cuando las reglas cruzan módulos (cupo, capacidad,
  logística): un bloqueo, un estado.
- Avisos en tiempo real solo tras confirmar la transacción.
