<!-- translation-of: 6864de579e23 -->
# Rebar Crew — una app de campo para una cuadrilla de ferralla

<!-- specgate:note -->
**Un brief real de un cliente, construido por un agente con Specgate.** El brief vino de un cliente real; el producto lo construyó de principio a fin un agente de código (Claude) que manejaba Specgate, con las decisiones de negocio delegadas en él y escritas como supuestos. No es un despliegue en un cliente, y el repositorio de código es privado.
<!-- specgate:endnote -->

Esto es adopción guiada por un agente, no la historia de un cliente. Fue el
primer piloto, hecho antes de que existiera `specgate draft`, y la mayor parte
de lo que hoy es Specgate se corrigió gracias a él.

| | |
|---|---|
| **Brief** | Brief detallado de operaciones de campo, especificado a mano como seis packs de dominio |
| **Stack** | Monorepo Expo + Next.js · núcleo TypeScript hexagonal (`packages/core`) |
| **Requisitos** | 47 de 47 (99 de 99 filas de escenario en la matriz) |
| **Tests** | 599 (dominio 400, API 146, pantallas 53) en 141 archivos |
| **Specgate** | 0.14.2 → 0.14.6 |

## El brief

Una constructora que coloca acero de refuerzo quería una sola app para sus
cuadrillas en obra. Fichar la entrada y la salida dentro de una geovalla, un
expediente por obra (fotos, análisis de seguridad, inspecciones de carretilla,
charlas de seguridad), el diario del encargado, un parte diario terminado en
minutos y formación en dos idiomas. También pedía un asistente que explicara en
español los emails en inglés y redactara una respuesta que siempre envía una
persona.

## Cómo se usó Specgate

El brief se convirtió a mano en seis packs de dominio: 46 requisitos, cada uno
etiquetado como funcional, no funcional o regla de negocio. El producto los
instaló como dependencias, fijados a una etiqueta, y el agente los construyó a
razón de un requisito por pull request.

<!-- specgate:steps -->
### Instala los packs sobre un esqueleto recién creado

```bash
specgate specops add --pack-repo <packs repo> --pack-version <tag> \
  --pack time-attendance/backend            # and the five others
```

### Deja que el harness construya cada requisito

```bash
specgate harness run                        # one requirement, one PR to develop
```

### Pasa cada pull request por el gate en CI

```bash
specgate check
specgate validate --against-lock            # the packs have not drifted
```

### Añade la capa que falta y vuelve a construir

Los packs v0.2.0 añadieron 52 escenarios de API y de pantalla. `specops sync`
los trajo, 30 requisitos entregados se reabrieron y el harness volvió a
ejecutarse.
<!-- specgate:endsteps -->

El harness hizo 76 ejecuciones de requisitos; 74 pasaron al primer intento. Las
otras dos fallaron por Specgate, no por el código (#35 y #37, abajo). El
historial son 82 pull requests con merge, uno por requisito.

## Qué se construyó

| Módulo | Requisitos | Notas |
|---|---|---|
| Control horario | 13 | Fichaje con geovalla, sin conexión, registro de auditoría |
| Expedientes de obra | 9 | Fotos, análisis de seguridad, inspecciones, reuniones, descansos |
| Diario del encargado | 5 | Fotos, notas de audio, marcas de tiempo |
| Partes diarios | 5 | Rellenados con lo del día |
| Comunicación con IA | 5 | Explicar emails, redactar respuestas; tras un adaptador simulado |
| Formación | 9 | Formación bilingüe, calculadoras, lector de planos |
| Baseline de adopción | 1 | REQ-001, el esqueleto existente |

Al final: 67 casos de uso, 41 rutas de API y 14 pantallas Expo.

## Lo que solo encontró ejecutar el producto

Tras la primera ronda, todos los requisitos estaban terminados y el producto no
se podía usar. El núcleo tenía 59 casos de uso y no había rutas de API ni
pantallas nuevas. Los escenarios solo pedían comportamiento de dominio, y el
agente construyó exactamente eso.

El gate tenía razón: la especificación se cumplía. Lo que faltaba era la
especificación. Los packs v0.2.0 añadieron los escenarios de API y de pantalla,
y la segunda ronda construyó las rutas y las pantallas.

Esta es la lección que repiten todos los pilotos posteriores: terminado
significa que la especificación se cumple, no que el producto funcione. Es
también de donde viene `specgate draft --check`: su regla D3 pide un escenario
de API y uno de pantalla por cada actor.

## Qué hizo mal Specgate, y qué cambió

El registro de defectos tiene 32 entradas de este piloto.

| Hallazgo | Corregido en |
|---|---|
| #1–#5 — el lint de packs, el lector de YAML, la regla de pasos vagos, una matriz con dos escenarios por requisito, etiquetas existentes | 0.14.1 |
| #7–#12 — instalar un pack devolvía la matriz al mantenimiento manual; prompt del harness, ejecuciones dobles, sin `setup_cmd`, packs privados en CI | 0.14.2 |
| #13–#19 — fricción menor de adopción y documentación | 0.14.1 / 0.14.2 |
| #22–#24 — los catálogos solo guardaban el último pack; `sync` con conflictos falsos y `depends_on` perdido | 0.14.3 |
| #26–#29 — `plan` con artefactos de varios archivos y filas duplicadas; requisitos sin escenario pasaban `pack lint`; la baseline se planificaba siempre | 0.14.3 |
| #32 — "99/99 done" con 52 escenarios nuevos sin test: cada escenario heredaba los tests de su requisito | 0.14.4 |
| #33 — `plan --json` cortado a 65.536 bytes en una tubería | 0.14.4 (`plan`), 0.16.0 (todos los comandos) |
| #34 — `validate --against-lock` solo comparaba el primer escenario | 0.14.5 |
| #35 — requisito en verde, push rechazado por desactualizado | 0.14.6 |
| #37 — una matriz regenerada tratada como una edición prohibida | 0.14.6 |
| #30 — `sync` sin cambios reescribía una marca de tiempo en el lock | 0.17.0 |
| #21 — `depends_on` entre packs distintos | **abierto** |

Ejecutar la regla D4 contra este proyecto antes de publicarla encontró uno más
(#41, corregido en 0.16.0).

## Sigue abierto

- **#21**: un requisito de un pack no puede depender de uno de otro.
- **El proveedor de IA** detrás del asistente de email y del lector de planos
  es un adaptador simulado. El proveedor real no se integró.
- **Todavía sin lectura externa.** Un producto, especificado y construido por
  el autor de la herramienta.

Ningún requisito espera respuesta. Los packs se escribieron a mano antes de que
existieran la lista de comprobación de `draft` y su `questions.md`.

[Bookings →](bookings.md)
