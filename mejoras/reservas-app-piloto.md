# Piloto real: reservas_app (ficha de un cliente → producto)

Segundo producto construido con Specgate desde una ficha real, y el primero
que pasa por `draft --check` (2026-10-09). Código en
`rsaglobaltech/reservas_app` (privado), un nivel por encima de este repo
(`../reservas-app`).

**Objetivo del usuario:** tener proyectos reales donde se ha usado la
herramienta. Todas las decisiones de negocio las tomó Claude por delegación
explícita ("hazlo todo tú") y quedan escritas como supuestos confirmados.

## La ficha

Un Google Doc del cliente ("INTRODUCCIÓN"): reservas para comercios locales
(peluquerías, estética), con mini-web en subdominio, varios calendarios con
puestos por hora, feedback tras la cita con publicación en Google Maps,
cupones públicos y privados, configuración de la reserva online, recordatorio
push y un widget para la web del comercio. Texto corto, partes en inglés
copiadas de otro producto, 15 capturas (OpenTable y MioSalon) y la sección
INTEGRACIÓN sin texto.

Guardada tal cual en `docs/brief.md`, con front matter (actores y superficies)
y una descripción de las capturas.

## Flujo seguido (el documentado, con la versión publicada)

1. Esqueleto con `forja` (Next.js + `packages/core` hexagonal, solo web).
2. Ficha → `docs/brief.md`.
3. Borrador `draft-reservas` escrito como lo haría un asistente (la fase 2 de
   `draft`, `--prompt-only`, aún no existe): 18 requisitos, 34 escenarios,
   API y pantalla para cada caso de uso de una persona.
4. `draft --check` hasta verde → revisión (Q1 respondida, supuestos
   confirmados) → `change archive`.
5. `specgate init` (0.16.0) adoptó el esqueleto; `harness init`; plataforma de
   tests web (vitest + jsdom + Testing Library) con tests de referencia.
6. `harness run` por requisito, en orden de dependencia, un PR por requisito a
   `develop`.

## Resultados del borrador

| Paso | Resultado |
|---|---|
| Primer `draft --check` | 75 hallazgos: 74 D6 + 1 D4. D3 = 0 (todas las superficies cubiertas) |
| D6 legítimos | 42 textos (nombres de la captura que la descripción omitía, etiquetas de botón inventadas), 13 horas de ejemplo, 3 números límite |
| D6 ruido | 16 códigos HTTP (un supuesto por requisito) y 9 duplicados (#43) |
| D4 | falso positivo: "responsive" (#42) |
| Tras supuestos A6–A13 | verde salvo D4; reescrito sin "responsive" → verde |
| Revisión | D7 no reconoce una pregunta respondida (#45) |
| Archivo | 0 features materializadas (#46); con `feature=` a mano, 18 ficheros pero Gherkin inválido en español (#47) |

Lo que el checklist sí hizo bien: obligó a escribir 13 supuestos que de otro
modo serían valores que "dijo el cliente" sin haberlo dicho (horas de bloqueo,
códigos, ancho mínimo, que no hay pago online, que el cliente reserva sin
cuenta), y a separar la única pregunta que bloqueaba algo (cancelación).

## Fricciones (no defectos)

- `init` sobre un esqueleto recién generado lo trata como código existente y
  siembra tres requisitos por carpetas (core, web, shared) que hay que borrar.
- `plan`/`status` ordenan por capacidad alfabética, no por dependencia: el
  harness hubiera empezado por calendarios antes de que existiera el comercio.
  Se le dio el orden a mano.
- D6 no tiene forma de declarar una convención una vez (códigos HTTP, textos de
  interfaz): la fila del supuesto tiene que nombrar cada requisito.

## Harness (0.16.0, agente `claude -p`, 2026-10-09)

| Medida | Valor |
|---|---|
| Requisitos | 18/18 integrados en `develop` (PR #1–#3, #5–#19) |
| Al primer intento en su ejecución final | 17/18 (REQ-122 en el 2.º) |
| Fallos fuera del código | REQ-101 y REQ-113: títulos de escenario "genéricos" (#49) · REQ-147: límite de sesión del agente; el harness reintentó 3 veces en 22 s (#50) |
| Agente por requisito | 99–378 s (mediana 210 s) |
| Tiempo total | 09:15–11:27, incluida la espera de 20 min por el límite |
| Resultado | 12 rutas API, 14 páginas, 46 ficheros de test (118 tests: web 70, core 48); gate verde con `typecheck` y tests |

Después: `specgate update` a 0.17.0 (`AI_RULES.md` movido literal bajo el
bloque de `AGENTS.md`, 58 líneas; gate verde), REQ-001 cerrado con `done`,
`develop` promovido a `main` y etiquetado `v0.1.0`.

## Prueba de humo (servidor de producción, Chrome headless)

Recorrido completo como propietario y como cliente, sin tocar código:

1. Registro → panel. Alta del comercio "Pelu1" → calendario "Peluquería" →
   servicio "Corte de pelo", 30 min, 20 € → 2 puestos el sábado de 10:00 a 13:00
   (se guarda al salir del campo y persiste al recargar).
2. Cliente anónimo en `/c/pelu1` a **360 px** (sin desplazamiento horizontal):
   ve el servicio con su precio, elige el sábado, se le ofrecen 10:00, 11:00 y
   12:00, reserva → "Reserva confirmada … Tu código es …" y enlace "Ver o
   cancelar tu reserva".
3. Con el enlace, cancela → "Reserva cancelada. La hora ha quedado libre."

**Funciona.** A diferencia de golden_app en su primera ronda (#31), el producto
se puede usar: cada caso de uso de una persona tenía escenario de API y de
pantalla desde el borrador (D3).

**Huecos de uso** — no son defectos de Specgate: el agente hizo exactamente lo
que pedía el escenario, y el escenario pedía poco:

- La agenda del propietario solo muestra **hoy** (SCN-149 dice "ve las
  reservas de hoy"); la API sí acepta otro día. El propietario no ve la reserva
  de mañana en pantalla.
- El panel no enlaza a "Calendarios" (se llega desde "Mi comercio").
- Para un servicio de 30 min solo se ofrecen horas en punto (supuesto A3:
  franjas de una hora). Coherente con la spec; probablemente no con el cliente.
- El propietario no ve en ninguna pantalla la dirección de su página pública.

Lección para `draft`: el checklist garantiza que hay escenario por superficie,
no que el escenario de pantalla describa una pantalla útil. Un escenario de
pantalla debería nombrar cómo se llega a ella y qué datos varía la persona
(el día, en la agenda).

## Tareas

- [x] Ficha leída y guardada en `docs/brief.md` (2026-10-09).
- [x] Borrador `draft-reservas`: 18 REQs, 34 escenarios, `draft --check` verde.
- [x] Revisión y archivo; defectos #42–#48 en `specgate-defectos.md`.
- [x] Adopción con 0.16.0, plataforma de tests web, harness y CI.
- [x] Harness sobre los 18 requisitos: 18/18, gate verde.
- [x] `specgate update` a 0.17.0 en el repo real: migración limpia, gate verde.
- [x] Prueba de humo del flujo completo (propietario → cliente → cancelación).
- [ ] Segundo borrador: los huecos de uso de arriba como requisitos (agenda por día, enlace público, navegación).
- [ ] Borradores siguientes: escaparate, cupones, feedback, notificaciones, integración.
- [x] Arreglar #42–#50 (rama `fix/reservas-defects`, 0.17.1).
