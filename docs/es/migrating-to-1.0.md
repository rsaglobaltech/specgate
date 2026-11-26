<!-- translation-of: b3f1ec12cd2a -->
# Migrar a 1.0

Specgate 1.0.0 está publicada: es la versión que instala `npm install`. Esta
página lista cada cambio que rompe un proyecto 0.x
—0.35, la última de ellas, o una anterior—, lo que hace `specgate migrate 1.0`
con cada uno y lo que queda en manos de una persona. Desde 1.0, un cambio que
rompe un proyecto espera a 2.0.

## Pasa a 1.0, o quédate en 0.35

```bash
npm i -D @rsaglobaltech/specgate@1      # 1.0 — what `latest` gives
npm i -D @rsaglobaltech/specgate@0.35   # stay on 0.35
```

Un proyecto mantiene la versión que nombra su `package.json`: nada pasa a 1.0
hasta que la instalas ahí. La imagen Docker es `ghcr.io/rsaglobaltech/specgate:1.0.0`;
fija `:0.35.0` para quedarte.

- **Un proyecto que generó forja** depende de la 0.x con la que se hizo; dentro
  de él, `npx specgate` es esa versión. Ejecuta allí la primera línea de arriba,
  y entonces `npx specgate --version` dice 1.0.0.

## La migración, en un comando

En un proyecto con todo en commit:

```bash
specgate migrate 1.0 --dry-run   # what it would do; changes nothing
specgate migrate 1.0             # does it, and writes docs/specs/migration-1.0.md
git diff                         # review, then commit
```

- Rechaza un árbol con trabajo sin commit (`migrate_dirty_tree`) o una carpeta
  fuera de git (`migrate_not_git`): git es cómo lo deshaces. `--dry-run` se
  ejecuta en cualquier sitio, porque no escribe nada.
- Solo toca changes que siguen abiertos. Un change archivado —trabajo
  entregado— nunca se lee ni se reescribe.
- Se ejecuta una vez: en un proyecto migrado dice que no queda nada y no
  escribe nada, así que el informe de la ejecución que hizo el trabajo queda como estaba.
- `--json` da el mismo informe como datos: cada paso, sus acciones sobre
  archivos y lo que queda para ti.

`specgate status` nombra el comando mientras un change abierto siga escrito
para 0.x, o mientras `harness.config.yaml` llame `roles:` a las lanes como hacía
0.35; añade `migrate` a `status --json` (`changes`, y `config: true` para lo
segundo). Hasta entonces `config list` informa `harness_config_invalid`, porque
1.0 rechaza esa clave.

## Qué se rompe, y qué hace migrate

### Un change tiene tres capas (ADR-0044)

`change new`, `propose`, `propose --from-brief` y `--from-ticket` escriben
`discover.md` (producto: contexto, caso de uso, criterios de aceptación `- AC-1: …`),
`design.md` (arquitectura) y `tasks.md` (desarrollo) con el esquema `layered`,
y ya no escriben `proposal.md`.

| 0.x | 1.0 |
| --- | --- |
| `proposal.md` | `discover.md`, el mismo texto |
| — | `design.md`, redactado a partir del Approach de la propuesta |
| `tasks.md` | `tasks.md`, sin cambios |
| `schema: spec-driven` | `schema: layered` |

**migrate hace:** para cada change abierto cuyo `change.yaml` dice (o asume por
defecto) `spec-driven`, mueve `proposal.md` a `discover.md` palabra por
palabra, redacta `design.md` con cada criterio de aceptación que encuentra
listado para arquitectura, conserva `tasks.md` (un borrador desde un brief sin
él recibe la lista de borrador vacía) y fija `schema: layered`. Todas las demás
líneas de `change.yaml` —el rango reservado, una aprobación, el ticket, el
`kind:` de 0.35— se conservan.

**Tú haces:**

- Revisa cada `design.md` redactado: arquitectura responde allí a cada criterio.
- Ejecuta `specgate change validate <id>`. Una propuesta 0.x a menudo nombra
  tecnología («un endpoint REST», «Postgres») que el Discover debería dejar al
  diseño: las reglas de capas avisan, y `change validate --strict` falla, hasta que se mueve.
- Sin migrar, un change 0.x sigue validando: su `proposal.md` se lee como su
  Discover, y la falta de `design.md` es un aviso `layer_no_design` cuya
  corrección nombra `specgate migrate 1.0`.
- `change new --schema spec-driven` sigue escribiendo la estructura 0.x, para
  un equipo que necesite un change más con ella.

### Una dependencia de otro repositorio (ADR-0043)

Dentro de un repositorio, `depends=<repo>:REQ-NNN` es una dependencia de otro
repositorio del workspace, no una `unknown_dependency`: la juzga el workspace
(`specgate workspace check`).

**migrate hace:** nada; nada en un proyecto 0.x necesita reescribirse.

**Tú haces:** si un proyecto 0.x usaba `:` en una dependencia para otra cosa,
renómbrala. Después, para un producto de varios repositorios, consulta
[Workspace](workspace.md).

### Las sesiones de tester e implementador son `lanes:` (desde 0.35)

0.35 las escribía como `roles: [tester, implementer]` en `harness.config.yaml`.
En 1.0 `roles:` nombra a las personas que aprueban cada capa, así que las
sesiones pasaron a `lanes: [tester, implementer]`, y cada una recibe
`SPECGATE_LANE` en lugar de `SPECGATE_ROLE` (REQ-559).

**migrate hace:** renombra esa única línea a `lanes:`; nada más del archivo
cambia. Su informe lista cada archivo versionado que aún lee `SPECGATE_ROLE`.
**Tú haces:** cambia esos scripts para que lean `SPECGATE_LANE`.

### Lo que añadieron 0.28–0.35, tal como lo lee 1.0

Aquí no hay nada que migrar; lo que cambia es lo que ves:

- `review`, `acceptance` y `release-notes` leen el Discover de un change: su
  Context es el «Why», y sus criterios de aceptación están en la página de
  revisión y en la checklist de aceptación. La propuesta de un change 0.x se lee como antes.
- `reverse` redacta un módulo como un change con capas.
- El studio aprueba un change capa a capa, como quien tenga el rol; en el
  studio de un equipo, como la persona que ha iniciado sesión.

### Versiones de configuración

Por ahora ningún archivo de configuración cambia de versión en 1.0. La
migración comprueba cada uno de los listados en su tabla (hoy, `harness_version`
de `harness.config.yaml`) y la sube cuando lo hace una funcionalidad de 1.0.

## Lo que añade 1.0 sin romper nada

Esto no necesita migración. Se lista para que la actualización esté completa:

- **El workspace**: varios repositorios de un producto, ids cualificados como
  `fleet:REQ-012`, una historia repartida por repositorio ([Workspace](workspace.md)).
- **El backlog sigue las fases**: `alm sync` mueve una incidencia a medida que
  su change se propone, se construye y se archiva; `alm pull` trae los
  comentarios como notas; Linear es un proveedor integrado ([Fases del tablero](alm-phases.md)).
- **Las dos brechas**: `harness report` dice si un fallo fue el spec omitiendo
  una intención o el código omitiendo el spec
  ([Informe del harness](harness-report.md)).

## Los roles y las aprobaciones controlan el harness

**Qué cambió.** Un change con capas solo se construye cuando cada una de sus
capas la aprueba alguien con el rol de esa capa —producto el Discover,
arquitectura el Design, desarrollo las Tasks ([ADR-0045](specs/adr/0045-roles-approvals-and-role-packages.md)).
Una aprobación registra quién firmó qué versión; editar una capa la vuelve a pedir.

**Qué hace migrate.** Nada que pueda decidir por ti: su informe dice que nombres
a las personas bajo `roles:` en `harness.config.yaml` (hasta entonces un rol
está abierto a cualquiera), y que las aprobaciones ahora controlan el harness.

**A mano.** `specgate change approve <id> --layer discover|design|tasks`, o
Changes en el studio. Para mantener el comportamiento de 0.x: `approvals: { required: never }`.

## Un proyecto migrado con una candidata

La migración es una tabla ordenada de pasos (`MIGRATION_1_0` en
`scripts/lib/migrate.ts`); cada candidata que rompió algo —roles y
aprobadores, por ejemplo— añadió allí su paso. Un proyecto migrado con una
`1.0.0-rc.N` anterior vuelve a ejecutar `specgate migrate 1.0` con 1.0.0: solo
los pasos que aún no se le han ejecutado. Dentro de 1.x no se añade nada a esta
lista: un cambio que rompe un proyecto espera a 2.0 ([compatibilidad](compatibility.md)).

## Si algo sale mal

- **Deshazlo:** `git checkout -- . && git clean -fd docs/specs` devuelve el
  árbol al commit desde el que empezó la migración.
- **Un change no se migró:** su `change.yaml` nombra un esquema distinto de
  `spec-driven` (el esquema propio de un pack, por ejemplo). Migrate deja esos
  en paz; mueve sus capas a mano o déjalo como está.
- **El informe no está:** no se migró nada; el proyecto no tenía ningún change
  0.x abierto, ni lanes bajo `roles:`, ni configuración que subir.
