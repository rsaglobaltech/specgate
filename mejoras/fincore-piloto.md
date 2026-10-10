# Piloto real: FinCore Digital Banking (primer piloto en Java/Spring)

Cuarto producto construido con Specgate desde una ficha de cliente
(2026-10-10), y el primero fuera de Node: Spring Boot 3.3, Java 21, Maven,
PostgreSQL (Testcontainers), Flyway, ArchUnit. Código en `rsaglobaltech/fincore`
(privado), un nivel por encima de este repo (`../fincore`). Decisiones de
negocio delegadas en Claude. El usuario pidió una **bitácora paso a paso** para
aprender la herramienta: `docs/bitacora/01..17` en el repo del piloto.

## La ficha

Al revés que credito-tienda: mucho *cómo* (microservicios DDD, Kafka, Redis,
Keycloak, K8s, CQRS, sagas, 10.000 RPS, 99,99 %) y una línea de *qué* por
módulo. Se acordó **ignorar la arquitectura**: una aplicación con un paquete
hexagonal por módulo, solo API. Con la ficha original, `draft --check` habría
devuelto casi solo preguntas: un plan técnico no es una especificación.

## Resultado

| Módulo | Requisitos | Notas |
|---|---|---|
| Cuentas (+ `cuentas-2`) | 11 | IBAN calculado (ISO 13616), partida doble con trigger de inmutabilidad |
| Pagos (+ `pagos-2`) | 12 | SEPA con devolución automática (la "saga"), concurrencia con `FOR UPDATE`, idempotencia |
| Tarjetas | 7 | Luhn, PAN en AES-256-GCM, CVV derivado (PCI DSS 3.3–3.5) |
| Identidad | 9 + 1 en espera | MFA por SMS, sesiones; REQ-055 (RGPD frente a Ley 10/2010) en `Needs Clarification` a propósito |
| Fraude | 6 + REQ-038 MODIFIED | eventos tras el commit en lugar de Kafka |
| Auditoría | 5 | registro encadenado con SHA-256; balance de comprobación |
| Notificaciones | 8 | cola con reintentos; el OTP no se guarda |

59/60 implementados, 112 tests, CI de GitHub en verde con `specgate check`.

## Specgate en una pila JVM

- **Funcionó sin adaptar:** detección de Maven/Gradle, enlace por `@DisplayName("REQ-002 SCN-002: …")`,
  `done` rechazando en rojo, escenarios en español, MODIFIED regenerando el
  `.feature` y devolviendo el requisito a Draft.
- **Arreglado durante el piloto:** 0.17.6 (#67 obligación de plantilla, #68
  `config set test_cmd`), 0.17.7 (#69 nombre Maven/Gradle, **#70 el CI no
  ejecutaba los tests**, #71 `harness init` tras `config set`), 0.17.8 (**#72
  `done` cerraba un requisito en espera sin test**, #73 `status`, #74 rangos en
  D6). Las tres versiones se verificaron sobre el propio FinCore.
- **Ideas abiertas:** #75 (valores de la norma citada), #76 (acción sobre un id
  que el actor no puede obtener), #77 (`done` de varios requisitos con una
  ejecución), #78 (test de arranque sin dobles), #79 (traza bajo el título).

## Lo que el gate no vio (y la prueba con la app arrancada sí)

1. **Acciones sobre objetos inalcanzables** (#76): liquidar una SEPA sin lista
   de pendientes; una cuenta abierta sin forma de volver a ver su IBAN. Tercer
   piloto seguido con el mismo patrón.
2. **Un requisito más amplio que su escenario:** REQ-031 ("todo error responde
   `{"error": …}`") con un único escenario; el 405/404 de Spring lo incumplían
   con `done` en verde.
3. **Aplicación rota con el gate verde** (#78): todos los tests usaban dobles,
   ninguno arrancaba el contexto real. Equivalente Java de #62.

## Patrones que funcionaron

- Calcular antes de escribir los valores del escenario (IBAN, Luhn, DNI): un
  IBAN escrito a mano costó un ciclo rojo.
- Perfiles de prueba (`cabeceras`, `real`) para que los tests de identidad no
  usen atajos y el resto sí.
- Un filtro HTTP de auditoría en vez de anotar cada caso de uso.
- Supuestos marcados "a validar" + preguntas con propuesta: la lista para la
  reunión con el cliente.
