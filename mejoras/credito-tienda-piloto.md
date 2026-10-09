# Piloto real: credito-tienda (ficha vaga → MVP)

Tercer producto construido con Specgate desde una ficha de cliente
(2026-10-09). Código en `rsaglobaltech/credito_tienda` (privado), un nivel por
encima de este repo (`../credito-tienda`). Decisiones de negocio delegadas en
Claude ("hazlo todo tú").

## La ficha

Cinco líneas: "crédito, ventas en línea y una red de ventas", "catálogo de
productos y carrito", "seguimiento de comisiones y rendimiento", "escalable,
segura y fácil de usar". Sin un solo valor, regla o pantalla. Es el caso
opuesto a reservas_app: aquí el borrador lo inventa casi todo, y el checklist
tiene que hacerlo visible.

## MVP acotado

Tres borradores, uno por módulo (D8 limita a 25 por borrador):

| Borrador | Requisitos | Escenarios | Hallazgos D6 → supuestos | Preguntas abiertas |
|---|---|---|---|---|
| `draft-tienda` | 9 | 19 | 50 → 6 | Q1 gastos de envío → REQ-008 `Needs Clarification` |
| `draft-credito` | 7 | 14 | 36 (50 antes de archivar tienda) → 5 | Q1 quién financia → REQ-016 `Needs Clarification` |
| `draft-red` | 6 | 13 | 23 → 5 | — (multinivel fuera de alcance, como supuesto) |

- **D5 con una ley real.** REQ-012 (información previa al crédito) cita la Ley
  16/2011, art. 10, con su enlace al BOE. Sin la línea `Source:` y con la ley
  mencionada en el texto, D5 la marca. Funciona en español ("Ley").
- **Cálculos comprobados.** 1200 € a 12 meses con TIN del 12 % → cuota 106,62 €,
  TAE 12,68 % (sistema francés).
- **Valores entre borradores.** Los valores del borrador de tienda ("pendiente
  de pago", "Mis pedidos") dejaron de marcarse en el de crédito al archivar el
  de tienda (#52 funcionando).

## Defectos encontrados

- **#59** — `validate --strict` en rojo por los dos `Needs Clarification`: la
  herramienta castigaba al borrador que pregunta en vez de inventar. Arreglado
  en 0.17.3.
- **Fricción repetida:** `init` siembra tres requisitos por carpetas (core, web,
  shared) en un esqueleto recién generado; hubo que borrarlos otra vez.
- **Ruido menor:** D6 saca el "500" de una ruta (`/taladro-500-w`) como valor.

## Harness (0.17.3)

| Medida | Valor |
|---|---|
| Requisitos | 20/20 construibles integrados (PR #1, #3–#21) |
| Al primer intento | 15/20 |
| Reintentos | REQ-011, REQ-017, REQ-018: write-scope por el `done` que reordena la traza (#65); en dos casos el agente intentó después marcar la fila a mano en la matriz, y write-scope lo paró. REQ-023: el gate (con build) falló una vez |
| Bloqueados | REQ-008 y REQ-016 rechazados en 1 s: "status is Needs Clarification — … an agent asked to settle a disagreement will settle it by guessing". Ninguna llamada al agente |

**Respuestas.** Las dos preguntas se respondieron como cambio (`respuestas`,
REQ-008 y REQ-016 MODIFIED con los valores decididos: envío 4,95 € por debajo
de 50 €; la tienda financia y el contrato se acepta en línea). Archivar
regeneró los dos `.feature` (#53 funcionando). Harness: REQ-016 al primer
intento; REQ-008 pasó en el segundo, después de que el primero se colgara
53 minutos con un límite de 20 (#66).

## Prueba de humo

El administrador da de alta productos y vendedores; los precios con coma
("49,90") no se escriben en un `input type=number` de un navegador en inglés.
Pero **no se pudo comprar**:

- la tienda no tiene "Añadir al carrito": REQ-005 solo tenía escenario de API
  para añadir (el de pantalla era cambiar la cantidad);
- ninguna pantalla tiene menú: el panel del administrador dice "Hola" y nada más.

Es el mismo patrón que las fotos de reservas_app (REQ-221): una acción con
escenario de API y sin escenario de pantalla no se construye en pantalla. D3
no lo ve porque el requisito sí tiene *un* escenario de pantalla.

**Regla candidata (D11):** para un actor que usa API y pantalla, cada escenario
de API que cambia algo (`POST`/`PUT`/`PATCH`/`DELETE`) debería tener uno de
pantalla que haga lo mismo. Dos casos reales; sin implementar todavía (casar
escenarios de API y de pantalla no es mecánico).

Arreglo en el producto: `tienda-2` (REQ-005 MODIFIED: añadir desde la tienda y
quitar; REQ-027: menú por rol).

## Tareas

- [x] Esqueleto, brief, adopción (0.17.2 → 0.17.3), plataforma de tests, CI.
- [x] Tres borradores con `draft --check` en verde, archivados.
- [x] Harness: 20/20 + REQ-008 y REQ-016 tras responder las preguntas.
- [ ] Prueba de humo: comprar, financiar, comisión.
- [x] Responder las dos preguntas y construir REQ-008 y REQ-016.
- [ ] `tienda-2` y repetir la prueba de humo de compra.
