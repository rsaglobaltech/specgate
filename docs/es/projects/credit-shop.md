<!-- translation-of: 11f31dba8257 -->
# Credit shop — una tienda online con crédito y una red de ventas

<!-- specgate:note -->
**Un brief real de un cliente, construido por un agente con Specgate.** El brief vino de un cliente real; el producto lo construyó de principio a fin un agente de código (Claude) que manejaba Specgate, con las decisiones de negocio delegadas en él y escritas como supuestos. No es un despliegue en un cliente, y el repositorio de código es privado.
<!-- specgate:endnote -->

Esto es adopción guiada por un agente, no la historia de un cliente. Es lo
contrario de [Bookings](bookings.md): un brief casi vacío, donde el borrador
tuvo que inventar casi todos los valores y la lista de comprobación tuvo que
hacerlo visible.

| | |
|---|---|
| **Brief** | Vago: cinco líneas, sin valores, reglas ni pantallas |
| **Stack** | Next.js + un núcleo TypeScript hexagonal (`packages/core`) |
| **Requisitos** | 24 de 24 |
| **Tests** | 272 casos de test en el repositorio |
| **Specgate** | 0.17.2 → 0.17.5 |

## El brief

Un párrafo: una aplicación que gestiona crédito, ventas online y una red de
vendedores. Un catálogo y un carrito, solicitudes de crédito, comisiones y
rendimiento para los vendedores. Debía ser "escalable, segura y fácil de usar".
Ni un precio, límite, regla o pantalla.

## Cómo se usó Specgate

<!-- specgate:note -->
Registrado con Specgate 0.16–0.18. Hoy los mismos pasos son: propose → una persona aprueba el change (`specgate change approve`) → construir y aplicar cada requisito → archive.
<!-- specgate:endnote -->

<!-- specgate:steps -->
### Un borrador por módulo

```bash
specgate change new draft-tienda --capability tienda --reserve <n>
specgate draft --check draft-tienda      # then draft-credito, draft-red
```

La regla de borrador D8 limita un borrador a 25 requisitos, así que el MVP se
partió en tres: tienda (9 requisitos), crédito (7), red de ventas (6).

### Convierte cada hallazgo en un supuesto o una pregunta

D6 marcó 50, 36 y 23 valores inventados en los tres borradores, cubiertos al
final por 6, 5 y 5 supuestos escritos. Dos preguntas bloquearon un requisito:
quién paga el envío y quién financia el crédito. Esos requisitos entraron como
`Needs Clarification`.

### Archiva y construye

```bash
specgate change archive draft-tienda
specgate harness run
```

### Responde las preguntas como un change

Las respuestas entraron como un change llamado `respuestas`, con REQ-008 y
REQ-016 MODIFICADOS. Luego el harness los construyó.
<!-- specgate:endsteps -->

El harness construyó 20 de 20 requisitos construibles, 15 al primer intento.
Rechazó los dos bloqueados en un segundo, más o menos, sin llamar al agente:
"status is Needs Clarification — an agent asked to settle a disagreement will
settle it by guessing."

## Qué se construyó

| Módulo | Requisitos | Notas |
|---|---|---|
| Tienda | 10 | Catálogo, carrito, pedidos, envío; REQ-027 añade un menú por rol |
| Crédito | 7 | Solicitud, información precontractual, aprobación, contrato online |
| Red de ventas | 6 | Vendedores, enlaces de referido, comisiones, liquidación, rendimiento |
| Baseline de adopción | 1 | REQ-001 |

REQ-012 (información antes del crédito) cita la ley española de crédito al
consumo con su fuente, y D5 comprueba que lo hace. Las cifras se calcularon
antes de escribirlas en los escenarios: 1.200 € a 12 meses al 12 % nominal dan
una cuota mensual de 106,62 €, una TAE del 12,68 % y un total de 1.279,44 €.

Las respuestas decidieron: el envío cuesta 4,95 € por debajo de 50 €, y la
tienda financia el crédito, con el contrato aceptado online. El producto llegó
a `v0.1.0`.

![El catálogo de la tienda, agrupado por categoría, cada artículo con su precio y un botón "Añadir al carrito", el botón que la primera versión no tenía. Datos inventados; la interfaz está en español.](../assets/img/app-credit-shop-catalog.webp)

![La cola de crédito del administrador: cada solicitud con pedido, importe, cuota, ingresos y un veredicto de solvencia, con Aprobar y Rechazar solo en las pendientes.](../assets/img/app-credit-shop-credit-review.webp)

## Lo que solo encontró ejecutar el producto

Con todos los tests en verde, **nadie podía comprar nada.**

- **La tienda no tenía botón "Añadir al carrito".** REQ-005 tenía un
  escenario de API para añadir y un escenario de pantalla para cambiar la
  cantidad. El agente construyó exactamente eso.
- **Ninguna pantalla tenía menú.** El panel del administrador decía "Hola" y
  nada más.
- Los precios con coma decimal no se podían escribir en un campo numérico en un
  navegador en inglés.

Es el mismo patrón que las fotos de Bookings: una acción con un escenario de
API y sin escenario de pantalla no se construye en pantalla. D3 no lo ve,
porque el requisito sí tiene *un* escenario de pantalla.

Un change de seguimiento, `tienda-2`, MODIFICÓ REQ-005 y añadió REQ-027. El
segundo smoke test recorrió todo el viaje sin tocar código: un cliente llega
por el enlace de un vendedor, compra, pide crédito, el administrador lo
aprueba, el cliente firma, el pedido se entrega, la comisión del vendedor se
liquida y la vista de rendimiento lo muestra.

## Qué hizo mal Specgate, y qué cambió

| Hallazgo | Corregido en |
|---|---|
| #59 — `validate --strict` fallaba con los dos requisitos `Needs Clarification`: el gate castigaba al borrador por preguntar en lugar de suponer | 0.17.3 |
| #60 — `init` proponía tres requisitos sobre un esqueleto recién creado (tercera vez entre pilotos) | 0.17.4 |
| #65 — el harness perdió intentos en REQ-011, REQ-017 y REQ-018 porque `done` reordenaba la traza; dos veces el agente intentó entonces editar la matriz a mano, y write-scope lo paró | 0.17.5 |
| #66 — un agente colgado corrió 53 minutos contra un límite de 20 | 0.17.5 |
| #76 — una acción sobre un id que el actor no tiene forma de obtener (visto aquí y antes en Bookings) | 0.17.9 (D12) |

Con 0.17.5, los dos requisitos de `tienda-2` pasaron al primer intento sin
pérdidas por write-scope.

## Sigue abierto

- **Una acción de API sin escenario de pantalla (D11).** Hay una regla
  reservada, no construida: emparejar cada escenario de API con su escenario de
  pantalla no es mecánico, y una regla por recuento dio falsos positivos en los
  borradores de este piloto y en los de Bookings (#83). Ejecutar el producto
  sigue siendo la red de seguridad.
- **Ruido menor.** D6 lee el "500" de una URL de producto como un valor.
- **Ninguna pregunta espera respuesta.** Las dos se respondieron y se
  construyeron.

[← Bookings](bookings.md) · [FinCore →](fincore.md)
