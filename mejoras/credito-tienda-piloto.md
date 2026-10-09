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

## Harness

(en curso — 22 requisitos; REQ-008 y REQ-016 deben ser rechazados por no estar listos)

## Tareas

- [x] Esqueleto, brief, adopción (0.17.2 → 0.17.3), plataforma de tests, CI.
- [x] Tres borradores con `draft --check` en verde, archivados.
- [ ] Harness sobre 22 requisitos.
- [ ] Prueba de humo: comprar, financiar, comisión.
- [ ] Responder Q1 (envío) y Q1 (financiadora) y construir REQ-008 y REQ-016.
