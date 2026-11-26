<!-- translation-of: b77d14c1bd0e -->
# Decisiones, derechos de decisión y el stack

Al final de esta página, tus decisiones de arquitectura son registros
numerados que se sustituyen en lugar de reescribirse, el agente sabe qué
decisiones no le corresponde tomar, y el stack queda escrito una sola vez para
el agente, el gate y la siguiente persona.

**Necesitas:** un proyecto Specgate (`specgate init`).

## Registra una decisión

```bash
specgate adr new "Use Postgres for orders"
```

Esto escribe `docs/specs/adr/0001-use-postgres-for-orders.md` con el siguiente
número libre, el estado `Proposed`, la fecha de hoy y tres secciones por
rellenar: Context, Decision y Consequences. Pon el estado en `Accepted` cuando
se acuerde.

## Sustituye una, sin reescribirla

Un ADR registra las razones por las que una decisión era correcta cuando se
tomó. Cuando deja de serlo, escribe uno nuevo:

```bash
specgate adr supersede 0001 "Use SQLite at the edge"
```

El ADR nuevo nombra al que sustituye (`**Supersedes:** ADR-0001`). El antiguo
cambia en una línea, su estado, que pasa a ser `Superseded by 0002`. Todo lo
demás queda como se escribió. Un ADR ya sustituido, o uno sin línea `Status`,
se rechaza antes de escribir nada.

```bash
specgate adr list --json      # every ADR: number, title, status
```

## Derechos de decisión: lo que puede decidir el agente

Algunos cambios son decisiones aunque un requisito los necesite. Di cuáles
puede tomar el agente en `docs/specs/decision-rights.md`:

```markdown
| Decision   | Right | Checked in                             |
| ---------- | ----- | -------------------------------------- |
| dependency | ask   | a dependency added to a build manifest |
| migration  | ask   | a file added to a migration folder     |
| public-api | agent | an operation added to an OpenAPI file  |
```

`agent` deja que decida el agente; `ask` reserva la decisión para una persona.
El harness pone la tabla en el prompt del agente y comprueba el diff de cada
intento:

| Decisión | Qué cuenta como tomarla |
| --- | --- |
| `dependency` | Una entrada nueva en `package.json`, `composer.json`, `pom.xml`, `build.gradle`, `go.mod`, `requirements*.txt`, `pyproject.toml`, `Cargo.toml`, `Gemfile` o un `.csproj`. |
| `migration` | Un fichero nuevo bajo `migrations/`, `migration/`, `db/migrate/`, `alembic/versions/` o `db/changelog/`. |
| `public-api` | Más operaciones (`get`, `post`, …) que antes en un fichero `openapi*` o `swagger*`. |

Un intento que toma una decisión reservada a una persona falla antes del gate:

```
⚠  REQ-014: decision_right_exceeded — dependency in package.json (left-pad)
```

Al siguiente intento se le dice qué deshacer, y que puede preguntar en su lugar
con `specgate ask <REQ> "<what you need, and why>"`. Los derechos se leen del
fichero commiteado, y `docs/specs/**` está protegido, así que un agente no
puede concederse un derecho a sí mismo.

## El fichero del stack

```bash
specgate stack
```

```
  migration    Flyway                 pom.xml: flyway-core
  service      Spring Boot            pom.xml: spring-boot-starter-web
  api          REST (Spring Web)      pom.xml: spring-boot-starter-web
```

Esto escribe `docs/specs/stack.md` con dos tablas. **Layers** lista migración,
persistencia, servicio, API, UI y end-to-end, cada una con su tecnología y la
evidencia de la que se leyó (una dependencia en un manifiesto, o una carpeta).
**Commands** lista build, test, test de lo afectado y end-to-end.

- Cuando `harness.config.yaml` no fija `test_cmd`, `specgate check` y el
  harness ejecutan el comando de test del fichero del stack.
- Un comando que corrijas en el fichero se conserva la próxima vez que se
  ejecute `specgate stack`. Las capas siempre se detectan de nuevo.
- Una segunda ejecución sobre un proyecto sin cambios no cambia nada, así que
  el fichero se puede regenerar en CI y commitear sin riesgo.

## Siguiente

- [El harness](harness.md)
- [Carriles, roles y límites](harness-roles.md)
