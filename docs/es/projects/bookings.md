<!-- translation-of: 12cd9e5dbbc5 -->
# Bookings — citas para negocios locales

<!-- specgate:note -->
**Un brief real de un cliente, construido por un agente con Specgate.** El brief vino de un cliente real; el producto lo construyó de principio a fin un agente de código (Claude) que manejaba Specgate, con las decisiones de negocio delegadas en él y escritas como supuestos. No es un despliegue en un cliente, y el repositorio de código es privado.
<!-- specgate:endnote -->

Esto es adopción guiada por un agente, no la historia de un cliente. Fue el
primer producto que pasó por `specgate draft --check`, y se hizo en cinco
ciclos, cada uno un borrador corto seguido de una prueba del producto en marcha.

| | |
|---|---|
| **Brief** | Detallado: un documento corto con 15 capturas de pantalla de otros productos |
| **Stack** | Next.js + un núcleo TypeScript hexagonal (`packages/core`), solo web |
| **Requisitos** | 38 de 38 |
| **Tests** | 212 casos de test en el repositorio (118 tras el primer ciclo) |
| **Specgate** | 0.16.0 → 0.17.4 |

## El brief

Un sistema de reservas para negocios locales como peluquerías y centros de
estética. Cada negocio tiene una pequeña página pública, varios calendarios con
franjas por hora, cupones (públicos y privados) y ajustes de reserva online.
Después de una cita, se pide opinión al cliente, y las buenas valoraciones
llevan a la página del negocio en Google Maps. El brief también pedía
recordatorios push y un widget para la web del propio negocio. Parte del texto
estaba copiado de otro producto, y la sección de integraciones estaba vacía.

## Cómo se usó Specgate

<!-- specgate:note -->
Registrado con Specgate 0.16–0.18. Hoy los mismos pasos son: propose → una persona aprueba el change (`specgate change approve`) → construir y aplicar cada requisito → archive.
<!-- specgate:endnote -->

El brief entró en `docs/brief.md` sin cambios, con un front matter que nombraba
a los actores y sus superficies, y una descripción de lo que muestra cada
captura.

<!-- specgate:steps -->
### Redacta el primer módulo como un change

```bash
specgate change new draft-reservas --capability reservas --reserve <n>
specgate draft --check draft-reservas
```

18 requisitos y 34 escenarios, con un escenario de API y uno de pantalla para
cada cosa que hace una persona. El primer check devolvió 75 hallazgos.

### Escribe los supuestos, responde la pregunta

13 supuestos en `assumptions.md` (horas bloqueadas, códigos de estado, un ancho
mínimo, sin pago online, reservar sin cuenta). Una pregunta en
`questions.md` —la cancelación— fue la única que bloqueó algo.

### Archiva, adopta, construye

```bash
specgate change archive draft-reservas
specgate init
specgate harness init
specgate harness run                # one requirement, one PR to develop
```

### Repite por módulo

Cuatro ciclos más, cada uno un borrador, un check, un archive y una ejecución
del harness: el panel del dueño, los cupones, la opinión tras la visita y la
página pública.
<!-- specgate:endsteps -->

La primera ejecución del harness construyó 18 de 18 requisitos, 17 al primer
intento. El agente tardó 99–378 segundos por requisito (mediana 210). Cada
ciclo posterior construyó todos sus requisitos, todos al primer intento salvo
donde un defecto de Specgate costó uno (#56, #65).

## Qué se construyó

| Módulo | Requisitos | Notas |
|---|---|---|
| Negocio, calendarios, servicios | 6 | Un negocio, sus calendarios, servicios con duración y precio |
| Reservas | 7 | Reservar sin cuenta, cancelar con un enlace, la agenda del dueño |
| Ajustes | 5 | Reglas de reserva online |
| Panel | 2 | Un menú en cada pantalla del dueño, el enlace público (ciclo 2) |
| Cupones | 5 | Públicos y privados, aplicados al reservar, visibles en la agenda |
| Opinión | 5 | Una encuesta por email, valoración 1–5, las de 4–5 enviadas al enlace de Google Maps |
| Página pública | 7 | Datos, fotos, mapa, reseñas públicas, directorio por ciudad, subdominio |
| Baseline de adopción | 1 | REQ-001 |

Los requisitos REQ-145 (la agenda) y REQ-220/221 (datos y fotos) se
MODIFICARON tras un smoke test. El producto llegó a `v0.3.0`.

![La agenda del dueño para un calendario: cada reserva con su hora, servicio, cliente y contacto. Datos inventados; la interfaz está en español.](../assets/img/app-bookings-agenda.webp)

![Un cliente reserva una pista de 90 minutos en la página pública del club, desde el móvil, sin cuenta, con un código de descuento.](../assets/img/app-bookings-booking-mobile.webp)

## Lo que solo encontró ejecutar el producto

Cada ciclo terminó con el producto en modo producción y una persona —o Chrome
headless— usándolo de principio a fin. El primer recorrido funcionó: un dueño
configuró un negocio y una franja, un cliente reservó a 360 px de ancho y
canceló con el enlace. Los huecos estaban en otra parte:

- **La agenda solo mostraba hoy.** El escenario decía "ve las reservas de
  hoy", y la API aceptaba cualquier día. Corregido con REQ-145 MODIFICADO.
- **Sin menú, y sin forma de encontrar la dirección de la página pública.**
  Corregido con REQ-200 y REQ-201. En el siguiente ciclo el agente añadió
  "Cupones" al menú sin que se lo pidieran, leyendo REQ-200 como una regla
  permanente.
- **El job de la encuesta estaba abierto a cualquiera** hasta que se fijaba un
  secreto. Ahora siempre está protegido.
- **`develop` no compilaba para producción.** Un `eslint-disable` para una
  regla que no estaba cargada pasaba el typecheck y los tests (#62).
- **El dueño no tenía pantalla para sus datos ni sus fotos**, y la página
  pública no mostraba las fotos. "Muéstralas en la página pública" estaba en el
  texto del requisito sin un escenario que lo demostrara, así que no se
  construyó. Lo que no tiene escenario no existe.

Algunos huecos se quedan como están escritos, porque la especificación lo dice:
un servicio de 30 minutos solo se ofrece a la hora en punto (supuesto A3,
franjas por hora).

## Qué hizo mal Specgate, y qué cambió

El registro de defectos tiene 22 entradas de este piloto, más #60, que
sufrieron tres pilotos.

| Hallazgo | Corregido en |
|---|---|
| #42 — D4 marcaba "responsive … desde 360 px" como no medido | 0.17.1 |
| #43 — D6 informaba dos veces de un valor repetido | 0.17.1 |
| #44 — `init` nombraba un comando de test que luego `check` decía que faltaba | 0.17.1 |
| #45 — D7 no veía una pregunta respondida | 0.17.1 |
| #46 — archivar un borrador en verde no escribía archivos feature | 0.17.1 |
| #47 — los escenarios en español se convertían en Gherkin inválido | 0.17.1 |
| #48 — `status` listaba requisitos archivados sin título | 0.17.1 |
| #49 — un borrador en verde fallaba en el harness por títulos de escenario de dos palabras | 0.17.1 |
| #50 — el harness reintentaba tres veces fallos que el agente no puede corregir | 0.17.1 |
| #51 — D3 pedía un escenario de API para un menú que solo es de pantalla | 0.17.2 |
| #52 — D6 marcaba valores ya revisados en un borrador anterior | 0.17.2 |
| #53 — un requisito MODIFICADO conservaba su archivo feature antiguo | 0.17.2 |
| #54 — "Ready to close" con dos escenarios sin test | 0.17.2 |
| #55 — un borrador reutilizaba ids de escenario de otro módulo | 0.17.3 |
| #56 — el prompt del harness decía `done`, y write-scope lo castigaba | 0.17.3 |
| #60 — `init` proponía tres requisitos sobre un esqueleto recién creado | 0.17.4 |
| #61 — D3 aceptaba la pantalla de un cliente como la del dueño | 0.17.4 |
| #62 — el gate no incluía el build de producción | 0.17.4 |
| #63 — el harness leía un test que faltaba como un fallo de la especificación | 0.17.4 |
| #64 — dos requisitos MODIFICADOS bloqueaban el gate el uno al otro | 0.17.4 |
| #65 — `done` reordenaba la traza, y write-scope la rechazaba | 0.17.5 |
| #57, #58 — se podía archivar un borrador con hallazgos aún abiertos | 0.17.10 |

Dos fricciones nunca se registraron como defectos: `plan` ordena por nombre de
capacidad, no por dependencia, así que el orden de construcción se dio a mano;
y D6 no tiene forma de declarar una convención (códigos de estado, etiquetas)
una sola vez.

## Sigue abierto

- **El resto del brief.** Recordatorios push 24 horas antes, y la sección de
  integraciones (un widget para la web del negocio). Sin redactar.
- **Ninguna pregunta espera respuesta.** La que bloqueaba algo, la
  cancelación, se respondió durante la revisión del primer borrador.

[← Rebar Crew](rebar-crew.md) · [Credit shop →](credit-shop.md)
