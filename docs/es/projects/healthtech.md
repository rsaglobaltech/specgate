<!-- translation-of: 7b1a979ad06b -->
# HealthTech — historias de casos clínicos sobre Quarkus

<!-- specgate:note -->
**Un brief real de un cliente, construido por un agente con Specgate.** El brief vino de un cliente real; el producto lo construyó de principio a fin un agente de código (Claude) que manejaba Specgate, con las decisiones de negocio delegadas en él y escritas como supuestos. No es un despliegue en un cliente, y el repositorio de código es privado.
<!-- specgate:endnote -->

Esto es adopción guiada por un agente, no la historia de un cliente. Fue el
primer piloto en un dominio regulado, y sus límites se acordaron antes de
escribir código: ninguna regla clínica inventada, solo datos ficticios, y cada
decisión legal o médica en manos del cliente.

| | |
|---|---|
| **Brief** | Regulado (salud), con mucha arquitectura |
| **Stack** | Quarkus 3.40 · Java 21 · Maven · PostgreSQL · ArchUnit |
| **Requisitos** | 23 de 24 — uno espera una respuesta, a propósito |
| **Tests** | 35 |
| **Specgate** | 0.17.9 |

## El brief

Los especialistas y las clínicas privadas llevan historias básicas que no se
conectan con laboratorios, imagen ni aseguradoras. El brief pedía una
plataforma construida en torno al caso clínico en lugar de al paciente:
estudios, resultados de laboratorio, prescripciones, casos similares y los
datos expuestos como FHIR R4. Venía con EventStoreDB, Debezium, Elasticsearch y
SMART on FHIR. Como en FinCore y EventTech, la infraestructura se dejó a un lado
y se conservaron sus promesas: reconstruir un caso, encontrar casos similares,
leer en FHIR R4.

Los actores son el médico, el laboratorio que envía resultados y la persona
responsable de la protección de datos, que revisa quién leyó qué.

## Cómo se usó Specgate

<!-- specgate:note -->
Registrado con Specgate 0.16–0.18. Hoy los mismos pasos son: propose → una persona aprueba el change (`specgate change approve`) → construir y aplicar cada requisito → archive.
<!-- specgate:endnote -->

<!-- specgate:steps -->
### Adopta una vez

```bash
specgate init --no-capabilities          # Java 21, Quarkus, Maven · ./mvnw -B test
specgate config set test_cmd "./mvnw -q -B verify"
specgate done REQ-001
specgate ci init --provider github
```

### Redacta, con los límites del dominio

```bash
specgate change new draft-casos --capability casos --reserve <n>
specgate draft --check draft-casos
```

D5 hizo que cada norma citada nombrara su fuente (CIE-10, FHIR R4). D6 hizo de
cada valor de ejemplo un supuesto, y cada `assumptions.md` dice "ficticio, sin
valor médico". D12 no marcó nada: el origen de los ids se escribió desde el
principio, una lección de EventTech.

### Pon cada decisión clínica y legal en `questions.md`

Interacciones entre fármacos, conservación de historias, uso de datos de otros
pacientes, receta electrónica, si el producto es un producto sanitario. Cada
pregunta nombra el requisito que bloquea.

### Archiva, prueba, cierra

```bash
specgate change archive draft-casos
specgate done REQ-027
specgate check
```
<!-- specgate:endsteps -->

Tres borradores y un change de seguimiento (`privacidad-2`).

## Qué se construyó

| Módulo | Requisitos | Notas |
|---|---|---|
| Casos | 10 de 10 | Hechos firmados por su autor, correcciones que nunca borran, el caso a cualquier fecha |
| Estudios | 4 de 4 | Cobertura de aseguradora simulada, resultados de laboratorio, resultados por revisar |
| Prescripción | 3 de 4 | Alergias registradas, suspensión; **REQ-020 (interacciones) espera** |
| Consulta | 3 de 3 | Casos similares anonimizados, FHIR R4 de solo lectura |
| Privacidad | 2 de 2 | Registro de accesos inmutable; REQ-027 MODIFICADO |
| Baseline de adopción | 1 | REQ-001 |

Las reglas que se construyeron no son conocimiento clínico. Comparan datos
registrados (alergias), usan lo que marca el laboratorio (fuera de rango) o
comprueban un formato (un código CIE-10).


![El informe de cobertura de la especificación de HealthTech: 95,8 % implementado, 23 terminados y REQ-020 todavía en Needs Clarification.](../assets/img/report-healthtech.webp)

*`specgate report` de este proyecto, generado a partir de su matriz al final del piloto.*

## Lo que solo encontró ejecutar el producto

- **Dos lecturas no dejaban rastro.** La búsqueda de pacientes —que devuelve
  alergias— y la lista del laboratorio no aparecían en el registro de accesos.
  Corregido con REQ-027 MODIFICADO (`privacidad-2`).
- **Una pregunta nueva.** ¿Debe la historia mostrar una alerta de alergia que
  hizo cambiar de rumbo al médico? No se construye sin una respuesta.

## Qué hizo mal Specgate, y qué cambió

| Hallazgo | Corregido en |
|---|---|
| #82 — D7 trataba "esto se decidirá con el cliente" como una respuesta, así que el requisito dejaba de esperar aunque nadie hubiera decidido nada | 0.17.10 ("TBD" o "se decidirá" ya no cuentan como respuesta) |

`Needs Clarification` funcionó como barrera. Desde 0.17.8 (la corrección de
#72, encontrado en FinCore), `status` muestra un requisito bloqueado en
"Waiting for an answer" y `done` se niega a cerrarlo.

## Sigue abierto

- **REQ-020: alertas de interacciones entre fármacos.** Es justo lo que un
  agente podría rellenar con una tabla inventada. Espera una pregunta: qué base
  de datos de interacciones, con licencia y mantenida, usar, y quién responde
  de su contenido; un sistema que avisa de interacciones puede contar como
  producto sanitario según el Reglamento (UE) 2017/745. Hasta que el cliente
  responda, REQ-020 no se construye, y el gate lo mantiene visible. Ese es el
  resultado buscado.
- **Registrar una alerta sobre la que actuó el médico**: la pregunta que
  planteó el producto en marcha.
- **Las demás preguntas legales** —conservación, uso de datos de otros
  pacientes, receta electrónica— esperan la reunión con el cliente. Donde el
  piloto necesitó algo, usó un emisor o una aseguradora simulados, escritos
  como una propuesta por validar.

[← EventTech](eventtech.md) · [Todos los proyectos](index.md)
