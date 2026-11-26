<!-- translation-of: fd5726d13b24 -->
# Domain packs, de principio a fin

Un recorrido por toda la vida de un pack en un proyecto: instalarlo, ver lo
que te dio, actualizarlo a una versión más nueva y volver a quitarlo. Usa el
pack de demostración público
[`parking-management-specops`](https://github.com/rsaglobaltech/parking-management-specops),
que tiene dos tags, `v0.1.0` y `v0.2.0`. Cada comando de abajo se ejecutó
contra ese repositorio con Specgate 1.5.0.

Para saber qué es un pack y cuáles existen, lee [Domain packs](domain-packs.md).
Si partes de tu propio plan en lugar de un pack, empieza por
[Primeros pasos](getting-started.md).

<!-- specgate:diagram pack-upgrade -->

## 1. Crea el esqueleto de un proyecto para el pack

Un pack trae sus propios requisitos, así que el proyecto debería empezar sin
ninguno. Descríbelo en un archivo de configuración corto y crea el esqueleto con `--no-sample-req`:

```bash
cat > smart-parking.yaml <<'EOF'
PROJECT_NAME: Smart Parking
PROJECT_SLUG: smart-parking
PROJECT_TYPE: backend
DOMAIN: parking operations
STACK: Quarkus 3.x, Java 21, PostgreSQL
API_STYLE: REST with DTO boundaries
TESTING: JUnit 5, Cucumber
EOF

specgate init --config smart-parking.yaml --no-sample-req
cd smart-parking
```

<!-- specgate:note -->
**Añadir un pack a un proyecto que adoptó `init`.** En un repositorio que ya
tiene código, `init` lo adopta y siembra `REQ-001 — Existing behaviour is
preserved`. Un pack cuyos ids empiezan en `REQ-001` choca con él, y el gate
entonces informa de la baseline de adopción como un feature huérfano. Elige un
pack cuyos ids no se solapen —los [packs probados](domain-packs.md) usan cada
uno su propio rango— o crea el esqueleto como arriba.
<!-- specgate:endnote -->

## 2. Instala el pack, fijado a una versión

```bash
specgate specops add \
  --pack-repo https://github.com/rsaglobaltech/parking-management-specops.git \
  --pack-version v0.1.0 \
  --pack backend \
  --var PROJECT_NAME="Smart Parking" \
  --var PROJECT_SLUG=smart-parking \
  --var DOMAIN="parking operations"
```

```text
  ℹ  Resolving remote pack https://github.com/rsaglobaltech/parking-management-specops.git@v0.1.0…
  ℹ  Wrote …/smart-parking/.specops.lock
  ℹ  Recorded baseline for 13 file(s) under .specops/baseline/backend
  ℹ  Generated 5 scenario file(s).
  ℹ  Domain pack expansion completed.
```

`add` clona el tag una vez en la caché de packs, escribe los requisitos y
escenarios en el proyecto, y registra la fuente, la versión y cada `--var` en
`.specops.lock`, para que los comandos posteriores los recuerden.

## 3. Mira lo que te dio

```bash
specgate status
```

```text
  ◆ specgate · status   smart-parking

  Requirements  ░░░░░░░░░░░░░░░░░░░░  0 of 5 done

  To do ──────────────────────────────────────────────────
    ○ REQ-001  Monitor Capacity Threshold  a test and code
    ○ REQ-002  Register Vehicle Entry      a test and code
    ○ REQ-003  Calculate Parking Fee       a test and code
    ○ REQ-004  Detect Overstay             a test and code
    ○ REQ-005  Send Payment Receipt        a test and code

  Packs ──────────────────────────────────────────────────
    backend  @ v0.1.0
```

`specgate check` pasa: los requisitos están en Draft, así que aún no deben
nada. Desde aquí el bucle diario es el habitual —`status`, un test que nombra
el requisito, `apply`, `check`—, descrito en
[Construye el primer requisito](start/scratch-3-build.md) y
[Demuéstralo](start/scratch-4-prove.md).

## 4. Previsualiza una actualización antes de aplicarla

`v0.2.0` de este pack exige cuatro variables que `v0.1.0` no exigía: `STACK`,
`API_STYLE`, `TESTING` y `LANG`. Pásalas una vez con `--var`; se escriben de
vuelta en el lockfile.

```bash
specgate specops diff --pack-version v0.2.0 \
  --var STACK="Quarkus 3.x, Java 21" --var API_STYLE="REST with DTO boundaries" \
  --var TESTING="JUnit 5, Cucumber" --var LANG=en
```

```text
── backend @ v0.2.0 (current: v0.1.0) ──
  + features/waitlist/capacity_waitlist.feature
  ~ AI_RULES.md
  ~ docs/specs/commands.md
  ~ docs/specs/domain-model.md
  ~ docs/specs/events.md
  ~ docs/specs/traceability.md
  ~ docs/specs/use-cases.md

  1 added · 6 modified · 7 unchanged
```

Sin las variables nuevas, `diff` y `sync` se detienen con
`Missing required variable 'STACK'. Provide it using --var STACK=...`: el pack
declara lo que necesita en `variables.required`. `diff` no escribe nada;
`--json` da el mismo informe a un agente, y `--as-change` convierte la subida
en una carpeta de change que puedes revisar como cualquier otra.

## 5. Aplica la actualización

```bash
specgate specops sync --pack-version v0.2.0 \
  --var STACK="Quarkus 3.x, Java 21" --var API_STYLE="REST with DTO boundaries" \
  --var TESTING="JUnit 5, Cucumber" --var LANG=en
```

```text
  ℹ  Syncing backend @ v0.2.0 (was v0.1.0)

── backend @ v0.2.0 ──
  1 added · 6 unchanged · 6 updated
  ℹ  Sync completed for 1 pack(s) with no conflicts.
```

`sync` es un merge a tres bandas contra la baseline que registró `add`: un
archivo que editaste conserva tus cambios, y un conflicto real recibe
marcadores (`--abort-on-conflict` lo deja intacto en su lugar); en ambos casos
`sync` sale con un código distinto de cero y nombra los archivos en conflicto.
`v0.2.0` añade REQ-006 —su archivo feature, su caso de uso y su fila de la
matriz— y deja REQ-001 a REQ-005 como estaban, así que un estado que `apply`
escribió en la fila de REQ-002 se queda. `specgate status` muestra ahora
`0 of 6 done` —el nuevo `REQ-006 Join Capacity Waitlist`— y `backend @ v0.2.0`.

Un id que ya usas es uno de esos conflictos. Si hubieras añadido un requisito
propio como REQ-006 antes de la actualización, ambas versiones escriben una
fila REQ-006 en `docs/specs/traceability.md`: `sync` informa
`docs/specs/traceability.md — CONFLICT (markers written)` y se detiene.
Conservar ambas filas hace que `check` falle con
`Duplicate Requirement ID in traceability.md: REQ-006`. Da al tuyo un id
libre, renómbralo en su spec, sus tests y sus features, y ejecuta `specgate check`.

## 6. Quita el pack

El id es el que registra `.specops.lock` —aquí `backend`, no la ruta de
`--pack-repo`—:

```bash
specgate specops remove backend --dry-run   # what it would remove
specgate specops remove backend
```

```text
✔  Removed backend from .specops.lock (1 entry).
   Generated files were not deleted. Inspect with `git status` and remove anything unwanted.
```

`remove` olvida el pack; no borra los requisitos, escenarios y tests que ahora
son del proyecto. Revísalos con `git status` y borra a mano lo que ya no quieras.

## Siguiente

- [Domain packs](domain-packs.md) — los packs probados, los ejemplos de
  partida y cómo escribir los tuyos.
- [Cadena de suministro](supply-chain.md) — la caché de packs, el fijado y el
  trabajo sin conexión.
