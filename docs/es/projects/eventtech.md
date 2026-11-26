<!-- translation-of: 9df68cddc95d -->
# EventTech — operaciones de eventos corporativos sobre Quarkus

<!-- specgate:note -->
**Un brief real de un cliente, construido por un agente con Specgate.** El brief vino de un cliente real; el producto lo construyó de principio a fin un agente de código (Claude) que manejaba Specgate, con las decisiones de negocio delegadas en él y escritas como supuestos. No es un despliegue en un cliente, y el repositorio de código es privado.
<!-- specgate:endnote -->

Esto es adopción guiada por un agente, no la historia de un cliente. Fue el
primer piloto sobre Quarkus, y el primero que usó la regla D12 el mismo día en
que salió.

| | |
|---|---|
| **Brief** | Cargado de arquitectura: event sourcing, CQRS, change data capture |
| **Stack** | Quarkus 3.40 · Java 21 · Maven · PostgreSQL (Dev Services) · WebSocket · ArchUnit |
| **Requisitos** | 38 de 38 |
| **Tests** | 71 |
| **Specgate** | 0.17.9 |

## El brief

Operaciones para eventos corporativos: sesiones en paralelo, ponentes,
inscripción, catering por restricción alimentaria, transporte, hoteles,
acreditaciones, ocupación de salas en directo e informes. Como FinCore, venía
con mucha arquitectura: EventStoreDB, CQRS, Debezium.

La infraestructura se dejó a un lado, pero lo que promete se conservó como
requisitos funcionales: reconstruir el evento tal como era en cualquier momento
("la agenda en cualquier fecha", "¿cuándo se llenó la sala?"), actualizaciones
en directo e informes.

## Cómo se usó Specgate

<!-- specgate:note -->
Registrado con Specgate 0.16–0.18. Hoy los mismos pasos son: propose → una persona aprueba el change (`specgate change approve`) → construir y aplicar cada requisito → archive.
<!-- specgate:endnote -->

<!-- specgate:steps -->
### Adopta una vez

```bash
specgate init --no-capabilities
specgate config set test_cmd "./mvnw -q -B verify"
specgate ci init --provider github       # setup-java 21, Maven cache, specgate check
```

### Un borrador por módulo

```bash
specgate change new draft-eventos --capability eventos --reserve <n>
specgate draft --check draft-eventos
```

D12 encontró un hueco real en el primer borrador: el organizador no podía ver
las sesiones de un evento todavía en borrador. A partir de ahí, cada borrador
dijo desde el principio de dónde sale cada id.

### Archiva, prueba, cierra

```bash
specgate change archive draft-eventos
specgate done REQ-047
specgate check
```
<!-- specgate:endsteps -->

Cinco borradores, uno por módulo, y un change de seguimiento (`informes-2`).
`@QuarkusTest` arranca la aplicación entera, así que la lección de FinCore
—una app que no arranca mientras todos los tests están en verde— venía de
serie: hubo un test de arranque desde el primer commit.

## Qué se construyó

| Módulo | Requisitos | Notas |
|---|---|---|
| Eventos | 11 | Event sourcing sobre Postgres: una tabla de hechos JSONB solo de inserción; la agenda en cualquier fecha |
| Inscripción | 8 + REQ-008 MODIFICADO | Aforo y plazas decididos en un solo agregado; concurrencia probada; lista de espera |
| Logística | 8 | Ajustes de catering calculados como pedido actual menos enviado, sin guardar nada |
| Acceso | 6 | Acreditaciones HMAC; ocupación en directo por WebSocket, enviada solo tras el commit |
| Informes | 4 + REQ-047 MODIFICADO | Todo reconstruido a partir de los hechos |
| Baseline de adopción | 1 | REQ-001 |

Se MODIFICARON dos requisitos. Archivar regeneró cada archivo feature y
devolvió el requisito a Draft hasta que su nuevo escenario pasó.


![El informe de cobertura de la especificación de EventTech: 100 % implementado, 38 de 38 requisitos terminados, cada uno con su feature, su test y su código.](../assets/img/report-eventtech.webp)

*`specgate report` de este proyecto, generado a partir de su matriz al final del piloto.*

## Lo que solo encontró ejecutar el producto

| Hueco | Cómo se cerró |
|---|---|
| Una fecha mal escrita devolvía 400 sin cuerpo | Un test y un mapeo de errores para el parser JSON |
| Una sesión se podía mover a una sala más pequeña | REQ-008 MODIFICADO |
| Nadie podía ver las plazas libres de una sesión | REQ-041 añadido |
| Las entradas sin reserva eran invisibles; las ausencias contaban para sesiones aún por llegar | REQ-047 MODIFICADO (`informes-2`) |

La regla de los tres pilotos anteriores se mantiene: el gate verifica lo que
dice la especificación; usar la aplicación encuentra lo que no dice.

## Qué hizo mal Specgate, y qué cambió

| Hallazgo | Corregido en |
|---|---|
| #80 — D12 marcaba acciones cuyo id obtiene el actor mediante una lista **anidada** (`GET /api/eventos/{id}/sesiones` para `POST /api/sesiones/{id}/…`); tres borradores tuvieron que declararlo como supuesto | 0.17.10 |
| #81 — un requisito MODIFICADO volvía a pasar por D12 sin ver el supuesto de su borrador archivado | 0.17.10 |

Quarkus no necesitó adaptación: Specgate lo detectó junto con `./mvnw`, el CI
generado instaló Java 21 y Dev Services funcionó en GitHub Actions.

## Sigue abierto

- **Ninguna pregunta espera respuesta.** Los 38 requisitos están implementados.
- **La infraestructura del brief** —EventStoreDB, change data capture hacia
  herramientas de marketing y CRM, videoconferencia, pagos, lectores NFC
  reales— queda fuera del alcance. Cada una tiene un puerto preparado.

[← FinCore](fincore.md) · [HealthTech →](healthtech.md)
