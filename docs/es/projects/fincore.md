<!-- translation-of: 36a5a9bf222e -->
# FinCore — banca central sobre Spring Boot

<!-- specgate:note -->
**Un brief real de un cliente, construido por un agente con Specgate.** El brief vino de un cliente real; el producto lo construyó de principio a fin un agente de código (Claude) que manejaba Specgate, con las decisiones de negocio delegadas en él y escritas como supuestos. No es un despliegue en un cliente, y el repositorio de código es privado.
<!-- specgate:endnote -->

Esto es adopción guiada por un agente, no la historia de un cliente. Fue el
primer piloto fuera de Node, y se llevó como un registro paso a paso para poder
aprender de él sobre la herramienta.

| | |
|---|---|
| **Brief** | Cargado de arquitectura: mucho *cómo*, una línea de *qué* por módulo |
| **Stack** | Spring Boot 3.3 · Java 21 · Maven · PostgreSQL (Testcontainers) · Flyway · ArchUnit |
| **Requisitos** | 59 de 60 — uno espera una respuesta legal |
| **Tests** | 112 |
| **Specgate** | 0.17.7 → 0.17.8 |

## El brief

Un banco digital: cuentas, pagos, tarjetas, identidad, fraude, auditoría y
notificaciones. La mayor parte del brief era arquitectura —microservicios DDD,
Kafka, Redis, Keycloak, Kubernetes, CQRS, sagas, 10.000 peticiones por segundo
y un 99,99 % de disponibilidad— con una línea de lo que debía hacer cada módulo.

Un plan técnico no es una especificación. Pasado por `draft --check` tal cual,
habría devuelto casi solo preguntas. Así que la arquitectura se dejó a un lado
a propósito: una aplicación, un paquete hexagonal por módulo, solo API.

## Cómo se usó Specgate

<!-- specgate:note -->
Registrado con Specgate 0.16–0.18. Hoy los mismos pasos son: propose → una persona aprueba el change (`specgate change approve`) → construir y aplicar cada requisito → archive.
<!-- specgate:endnote -->

<!-- specgate:steps -->
### Adopta una vez

```bash
specgate init --no-capabilities
specgate config set test_cmd "mvn -q -B verify"
specgate ci init --provider github
```

### Un borrador por módulo

```bash
specgate change new draft-cuentas --capability cuentas --reserve <n>
specgate draft --check draft-cuentas     # until it passes
```

Valores calculados antes de escribirlos: un IBAN, un dígito de control Luhn,
un número de documento. Un IBAN escrito a mano costó un ciclo en rojo.

### Supuestos y preguntas

Cada valor inventado fue a `assumptions.md`, marcado "por validar". Cada
decisión legal o de negocio que el brief no tomaba fue a `questions.md`, con
una respuesta propuesta. Juntos son el orden del día de la reunión con el
cliente.

### Archiva, escribe el test, cierra

```bash
specgate change archive draft-cuentas
specgate done REQ-002                    # refuses unless a test names it and the suite is green
specgate check                           # before each push; CI runs the same
```
<!-- specgate:endsteps -->

Siete borradores y dos changes de seguimiento (`cuentas-2`, `pagos-2`). Aquí no
hubo harness: cada requisito se implementó, se probó y se cerró con `done`.

## Qué se construyó

| Módulo | Requisitos | Notas |
|---|---|---|
| Cuentas (+ `cuentas-2`) | 11 | IBAN calculado según ISO 13616; libro mayor de partida doble con un trigger de inmutabilidad |
| Pagos (+ `pagos-2`) | 12 | SEPA con reversión automática (la "saga" del brief), concurrencia con `FOR UPDATE`, idempotencia |
| Tarjetas | 7 | Luhn, PAN cifrado con AES-256-GCM, CVV derivado (PCI DSS 3.3–3.5) |
| Identidad | 9 + 1 en espera | MFA por SMS, sesiones; REQ-055 espera una respuesta |
| Fraude | 6 + REQ-038 MODIFICADO | Eventos tras el commit en lugar de Kafka |
| Auditoría | 5 | Registro encadenado por hash con SHA-256; balance de comprobación |
| Notificaciones | 8 | Cola con reintentos; el código de un solo uso nunca se guarda |
| Baseline de adopción | 1 | REQ-001 |

El CI en GitHub ejecuta `specgate check`: la especificación y los tests.


![El informe de cobertura de la especificación de FinCore: 98,3 % implementado, 59 de 60 requisitos terminados, cada uno con su feature, su test y su código.](../assets/img/report-fincore.webp)

*`specgate report` de este proyecto, generado a partir de su matriz al final del piloto.*

## Lo que solo encontró ejecutar el producto

1. **Acciones sobre cosas que nadie podía encontrar.** Un operador podía
   liquidar una transferencia SEPA por id, sin una lista de las pendientes. Un
   cliente podía abrir una cuenta y no tenía forma de volver a ver su IBAN.
   Tercer piloto seguido con este patrón; se convirtió en la regla D12 (#76).
2. **Un requisito más amplio que su escenario.** REQ-031 dice que cada error
   responde `{"error": …}`. Tenía un escenario, y los 404 y 405 propios de
   Spring rompían la regla mientras `done` estaba en verde.
3. **La aplicación no arrancaba, con el gate en verde** (#78). Todos los tests
   sustituían el SMS y el reloj por dobles, así que ninguno arrancaba el
   contexto real; faltaba un bean y nadie lo vio. Ahora la suite ejecuta un
   test de arranque sin dobles.

## Qué hizo mal Specgate, y qué cambió

| Hallazgo | Corregido en |
|---|---|
| #72 — **grave.** `done REQ-055` marcó como Implemented un requisito en `Needs Clarification`, sin test que lo nombrara y sin código | 0.17.8 |
| #73 — `status` listaba un requisito bloqueado como trabajo por empezar | 0.17.8 (un grupo "Waiting for an answer") |
| #74 — D6 no leía rangos de ids (`REQ-004..REQ-010`) en los supuestos: 25 hallazgos | 0.17.8 |
| #76 — una acción sobre un id que el actor no puede obtener | 0.17.9 (D12) |
| #75 — D6 rechazaba valores dados por la norma que cita el requisito | 0.17.10 |
| #77 — cerrar 8 requisitos suponía 8 ejecuciones completas de tests | 0.17.10 (`done` acepta varios ids) |
| #78 — sin test de arranque sin dobles en proyectos Spring | 0.17.10 (`init` lo sugiere; el prompt del harness lo exige) |
| #79 — no se leía una línea de traza bajo el título (encontrado al corregir #72) | no reproducido en 0.17.10; `validate` ahora avisa de una traza que no pertenece a ningún requisito |

Justo antes de este piloto, un ensayo del tutorial y una prueba con Spring Boot
encontraron #67–#71: una obligación de plantilla cerrada por `done`, ninguna
forma de fijar el comando de test sin el harness, el parent de Maven tomado
como nombre del proyecto, **un workflow de CI que nunca ejecutaba los tests**,
y `harness init` negándose tras `config set`. Se corrigieron en 0.17.6 y
0.17.7, y cada corrección se verificó en FinCore.

Lo que funcionó sin cambios en la JVM: la detección de Maven y Gradle, enlazar
tests con `@DisplayName("REQ-002 SCN-002: …")`, `done` negándose en rojo, los
escenarios en español, y un requisito MODIFICADO regenerando su archivo
feature y volviendo a Draft.

## Sigue abierto

- **REQ-055: el derecho de supresión del RGPD frente a la retención de 10 años
  que exige la ley contra el blanqueo de capitales.** Qué datos se borran,
  cuándo y quién lo decide es una cuestión legal para el cliente, no para el
  desarrollador. Hay dos opciones escritas; ninguna está elegida. El requisito
  sigue en `Needs Clarification`, `status` lo lista en "Waiting for an
  answer", y `done` lo rechaza. Ese es el resultado buscado.
- **Cada supuesto marcado "por validar"** espera la reunión con el cliente.
- **La arquitectura del brief** —microservicios, Kafka, Redis, Keycloak,
  Kubernetes, los objetivos de rendimiento y disponibilidad— queda fuera del
  alcance. Los puertos son donde se conectaría.

[← Credit shop](credit-shop.md) · [EventTech →](eventtech.md)
