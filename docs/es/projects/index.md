<!-- translation-of: 24964ac12a5f -->
# Probado en productos reales

<!-- specgate:note -->
**Un brief real de un cliente, construido por un agente con Specgate.** El brief vino de un cliente real; el producto lo construyó de principio a fin un agente de código (Claude) que manejaba Specgate, con las decisiones de negocio delegadas en él y escritas como supuestos. No es un despliegue en un cliente, y el repositorio de código es privado.
<!-- specgate:endnote -->

Estos seis pilotos son adopción guiada por un agente, no la historia de un
cliente. Cada uno empezó con un brief que escribió un cliente real —vago,
detallado, cargado de arquitectura o regulado— y terminó como un producto que
funciona, con su especificación, sus tests y su CI. Las cifras salen de la
matriz de trazabilidad generada de cada producto y de su suite de tests. Lo
que estos pilotos no son: un equipo que elige Specgate y lo usa por su cuenta.
Esa lectura aún está por llegar.

Cada página enumera lo que Specgate hizo mal durante el piloto y la versión
que lo corrigió. La mayoría de las reglas de la herramienta existen porque un
piloto las necesitó.

<!-- specgate:cards cols=2 -->
- [Rebar Crew](rebar-crew.md) — Una app de campo para una cuadrilla de ferralla: 47 de 47 requisitos y 599 tests, tras una primera ronda terminada e inservible.
- [Bookings](bookings.md) — Citas para negocios locales: 38 de 38 requisitos en cinco ciclos, cada uno cerrado usando el producto.
- [Credit shop](credit-shop.md) — Un brief de cinco líneas se convirtió en 24 requisitos; todos los tests en verde, y nadie pudo comprar hasta el smoke test.
- [FinCore](fincore.md) — Banca central sobre Spring Boot: 59 de 60, con el RGPD frente a la retención por blanqueo de capitales en manos del cliente.
- [EventTech](eventtech.md) — Operaciones de eventos sobre Quarkus: 38 de 38, el evento reconstruido en cualquier momento a partir de sus hechos.
- [HealthTech](healthtech.md) — Casos clínicos sobre Quarkus: 23 de 24; las interacciones entre fármacos esperan una respuesta en lugar de una suposición.
<!-- specgate:endcards -->

<!-- specgate:diagram pilots-chart -->

## Lado a lado

| Proyecto | Brief | Stack | Requisitos | Tests | En espera | Defectos de Specgate encontrados |
|---|---|---|---|---|---|---|
| [Rebar Crew](rebar-crew.md) | Detallado, escrito a mano como packs de dominio | Expo + Next.js, núcleo TS hexagonal | 47 de 47 | 599 | 0 | 32 (uno abierto: #21) |
| [Bookings](bookings.md) | Detallado, con capturas de pantalla | Next.js + núcleo TS hexagonal | 38 de 38 | 212 | 0 | 22, más #60 |
| [Credit shop](credit-shop.md) | Vago | Next.js + núcleo TS hexagonal | 24 de 24 | 272 | 0 | 2, más #60 |
| [FinCore](fincore.md) | Cargado de arquitectura | Spring Boot 3.3 · Java 21 · PostgreSQL | 59 de 60 | 112 | 1 (REQ-055) | 7, más #79 |
| [EventTech](eventtech.md) | Cargado de arquitectura | Quarkus 3.40 · Java 21 · PostgreSQL | 38 de 38 | 71 | 0 | 2 |
| [HealthTech](healthtech.md) | Regulado | Quarkus 3.40 · Java 21 · PostgreSQL | 23 de 24 | 35 | 1 (REQ-020) | 1 |

Los requisitos incluyen REQ-001, la baseline de adopción. Las cifras de tests
de Java son los totales de ejecución de la suite; las de Bookings y Credit shop
son casos de test contados en el código; la de Rebar Crew es el total de su
suite al final del piloto. #60 —`init` proponiendo requisitos sobre un
esqueleto recién creado— lo sufrieron tres pilotos.

## Lo que encontraron los seis

El gate verifica lo que dice la especificación. Ejecutar el producto encuentra
lo que no dice. En todos los pilotos, usar el producto en marcha sacó a la luz
algo que el gate en verde no podía ver: un producto sin pantallas, una API sin
botón, una acción sobre un id que nadie podía listar, un build que fallaba en
producción, una aplicación que no arrancaba. Cada uno se convirtió en un change
corto de seguimiento, y varios se convirtieron en reglas de `specgate draft --check`.
El camino de un brief a una especificación está en [Del brief de un cliente a
una especificación](../from-a-brief.md).
