# Puertas de calidad y seguridad: qué falta de la propuesta

Estado a **0.27.4** (2026-10-28). Compara la propuesta de siete puertas open
source, "solo lo que introduce el cambio" y la puerta de consistencia
especificación–implementación con lo que Specgate ya hace
([docs/quality.md](../quality.md), ADR-0040, REQ-218..250).

## Resumen

| # | Puerta propuesta | Herramienta | Estado en Specgate | Qué falta |
| --- | --- | --- | --- | --- |
| 1 | Efectividad de los tests | PIT · Stryker | **Hecho, con huecos** | Activarla sin editar el pom; Gradle sin preset; puntuación por requisito |
| 2 | Vulnerabilidades de dependencias | OSV-Scanner | **Hecho, con huecos** | Umbral de severidad; atribuir al diff; escaneo periódico |
| 3 | Contenedores e IaC | Trivy | **No existe** | Preset para Dockerfile, compose, IaC e imagen |
| 4 | Cumplimiento de arquitectura | ArchUnit | **Parcial** | SARIF o congelado de ArchUnit; reglas generadas desde la especificación |
| 5 | Seguridad en ejecución | OWASP ZAP | **No existe** | Check `ci` que levante la app y lance el baseline scan |
| 6 | Cadena de suministro (SBOM) | Syft + OSV | **Parcial** | SBOM para Node y Gradle; diff de componentes; política de licencias |
| 7 | Confianza en dependencias | OpenSSF Scorecard | **No existe** | Puntuación de dependencias nuevas, sin token si es posible |
| — | Solo el delta | — | **Hecho** | Distinguir "dependencia cambiada" de "aviso nuevo"; excepciones con caducidad |
| — | Motor de políticas | — | **Parcial** | Severidad, excepciones justificadas, explicación por regla |
| — | Especificación ↔ implementación | — | **Base hecha** | Restricciones de la spec ejecutables; efectividad por requisito |

## 1. Efectividad de los tests — PIT / Stryker

**Ya existe**
- Checks `mutation` en el nivel `strict` (REQ-224, REQ-225): PIT para Maven,
  Stryker para Node. Se ejecutan solo sobre lo que cambió
  (`{changed_classes}`, `{changed_src}`, también por carpeta de app: REQ-235).
- La puntuación se mide sobre las líneas cambiadas, contra `mutation_score`
  (REQ-223), y se ve en el informe del harness y en el studio (REQ-228/229).

**Falta**
- **Activarla sin tocar el build.** PIT con JUnit 5 necesita
  `pitest-junit5-plugin` declarado en el `pom.xml`; si no está, el preset deja
  el check comentado. Stryker igual con `@stryker-mutator/core`. Hace falta un
  `specgate quality init --enable mutation` que añada esas dependencias, o
  que forja las genere ya (era la idea F4 de forja: plugins de calidad en los
  proyectos generados).
- **Gradle:** no hay preset de mutación (`gradle-pitest-plugin`).
- **Por requisito:** hoy la puntuación es del cambio entero. La propuesta pide
  efectividad de los tests **de cada requisito**: cruzar los mutantes que
  sobreviven con los tests que nombran `REQ-…` y decir "REQ-012: 3 mutantes
  vivos en `Pricing.java:41`".
- **Bloquear por "test débil" explícito:** hoy bloquea el umbral de la
  puntuación. Falta la regla "un test nuevo que no mata ningún mutante de las
  líneas que cubre".

## 2. Vulnerabilidades de dependencias — OSV-Scanner

**Ya existe**
- Check `dependencies` con osv-scanner 2.2.4 en Docker, sin cuenta: lockfile
  de npm, pnpm, yarn y Gradle; para Maven, sobre el SBOM CycloneDX que genera
  el propio Maven (REQ-237, `needs: sbom`, REQ-240).
- Baseline de hallazgos por fingerprint: la deuda heredada no bloquea
  (REQ-222).

**Falta**
- **Umbral de severidad.** La propuesta bloquea "alta o crítica". Hoy
  bloquea cualquier hallazgo nuevo, sea cual sea su severidad. Hace falta
  `min_severity: high` por check, leyendo `security-severity` o el `level` del
  SARIF.
- **Atribución al diff.** Un aviso publicado hoy sobre una dependencia que no
  cambió aparece como hallazgo nuevo y bloquea un PR que no la tocó (la
  limitación que señala la propuesta). Hace falta comparar los manifests o
  lockfiles con la base: si la dependencia no cambió, el hallazgo se informa
  sin bloquear el PR.
- **Escaneo periódico del repositorio completo.** Existe `when: ci`, pero no
  hay modo programado (`specgate quality run --scheduled`, con su job de CI
  nocturno) que abra un aviso para lo heredado que empeoró.

## 3. Contenedores e IaC — Trivy

**No existe.** Los proyectos de forja traen `Dockerfile`, `docker-compose.yml`
y un realm de Keycloak, y nada los revisa.

**Falta**
- Preset `trivy config .` (Dockerfile, compose, Kubernetes, Terraform) con
  salida SARIF, en Docker (`aquasec/trivy`), juzgado contra la baseline como
  los demás.
- `trivy image` sobre la imagen que construye el proyecto, en `when: ci` (hace
  falta construirla antes).
- Escaneo de secretos de Trivy en artefactos: hoy los secretos los cubre
  gitleaks, y solo en el código (y ya ignora lo que git ignora, REQ-241).

## 4. Cumplimiento de arquitectura — ArchUnit

**Ya existe**
- `arch_cmd`: el check de arquitectura del equipo corre en el gate
  (ADR-0028); forja genera `ArchitectureTest` con ArchUnit para Java.
- `arch_sarif` (REQ-231): si la herramienta escribe SARIF, solo bloquean las
  violaciones nuevas.

**Falta**
- **ArchUnit no escribe SARIF.** Con ArchUnit, el modo "solo lo nuevo" no
  funciona hoy. Dos caminos: un conversor JUnit XML → SARIF para las reglas
  que fallan, o usar el `FreezingArchRule` de ArchUnit, que es una baseline
  nativa, y que forja lo genere así.
- **Reglas desde la especificación.** La propuesta convierte "las reglas
  arquitectónicas de la especificación" en tests. Hoy la arquitectura vive en
  el código (ArchUnit) y en `architecture: hexagonal` del AGENTS.md, pero la
  especificación no tiene un lugar para "el dominio no depende de
  infraestructura" ni para "el módulo pricing no llama a tracking". Haría
  falta una sección de restricciones arquitectónicas en `spec.md` y que
  `specgate` (o forja) generara las reglas ArchUnit o dependency-cruiser desde
  ella.
- **JavaScript/TypeScript:** no hay preset con dependency-cruiser y SARIF.

## 5. Seguridad en ejecución — OWASP ZAP

**No existe.**

**Falta**
- Un check `when: ci` que levante la aplicación (por ejemplo `docker compose
  up` en los proyectos de forja), espere a que responda y ejecute
  `zap-baseline.py` en Docker (`ghcr.io/zaproxy/zaproxy`) con salida SARIF o
  JSON convertible.
- Aquí la baseline es por alerta y URL, no por línea de código: hace falta un
  fingerprint propio. Atribuir al diff es poco fiable, así que lo razonable
  es bloquear solo alertas nuevas de riesgo alto y reportar el resto.
- Con autenticación (Keycloak en forja), un contexto de ZAP con usuario de
  prueba.

## 6. Cadena de suministro — Syft + OSV-Scanner

**Ya existe**
- SBOM CycloneDX generado por Maven para el análisis de dependencias
  (REQ-237).

**Falta**
- **SBOM para todos los stacks:** Syft en Docker (`anchore/syft`) daría un
  SBOM uniforme para Node, Gradle e imágenes, en lugar del plugin de Maven
  solo para Maven.
- **Diff de componentes:** comparar el SBOM de la base con el del cambio y
  listar los componentes añadidos o actualizados. Es también lo que necesita
  la atribución del punto 2.
- **Política:** licencias no permitidas, componentes sin versión fijada,
  orígenes no oficiales. Hoy no existe ninguna regla sobre el SBOM.
- **Guardar el SBOM** como artefacto de la release o del run del harness.

## 7. Confianza en dependencias — OpenSSF Scorecard

**No existe.**

**Falta**
- Para cada dependencia **nueva** del diff (sale del punto 6), consultar su
  puntuación de Scorecard. La API de deps.dev la publica sin token, lo que
  respeta "sin cuentas" (ADR-0040). El CLI de Scorecard necesita token de
  GitHub.
- Política: avisar (no bloquear) por debajo de un umbral, y bloquear solo
  repositorios archivados o sin mantener, si el equipo lo decide.

## Solo el delta (ya es el principio de Specgate)

**Ya existe**
- Baseline por fingerprint que sobrevive a mover código (REQ-222/223).
- `scope: diff`: solo cuentan hallazgos en archivos del cambio.
- Cobertura y mutación medidas sobre las líneas cambiadas (REQ-223/224).
- Hallazgos en archivos ignorados fuera (REQ-241).

**Falta**
- **Dependencias:** la atribución del punto 2.
- **Excepciones con justificación y caducidad:** hoy `quality baseline
  --accept` acepta toda la deuda de un check. No se puede aceptar un hallazgo
  concreto, con motivo, autor y fecha de caducidad, que vuelva a bloquear
  cuando caduque.
- **"Empeoró":** la propuesta dice "excepciones para riesgos heredados que no
  hayan empeorado". Hoy no se detecta que un hallazgo de la baseline subió de
  severidad.

## Motor de políticas

**Ya existe**
- Normalización: todo check con SARIF se juzga igual; cobertura y mutación
  desde JaCoCo, LCOV, Cobertura, PIT y Stryker.
- Umbrales por nivel (`diff_coverage`, `mutation_score`), `gate` (bloquea o
  avisa), `when` (attempt, end, ci).
- Explicación: archivo:línea, regla y mensaje de cada hallazgo nuevo, y el
  final de la salida en `--json` (REQ-239).

**Falta**
- Severidad mínima por check (punto 2).
- Excepciones individuales con caducidad (sección anterior).
- Una explicación agregada por PR: "este cambio introdujo 2 CVE altas en
  `jackson-databind` (actualizada en el pom), 1 mutante vivo en REQ-012 y 1
  violación de capas", en vez de check por check. Encaja en el informe del
  harness y en `alm pr`.

## Especificación ↔ implementación

Es lo que ya diferencia a Specgate:
- Cada requisito tiene escenario (D1) y un test que lo nombra (TDD-1/2).
- `apply` rechaza un requisito sin test o con la suite roja.
- El harness no deja editar la especificación (`spec_edited`).
- `builtin:review` y `builtin:adversary` leen el cambio contra el requisito
  (REQ-227).

**Falta para la puerta que propones**
1. **Restricciones explícitas ejecutables.** Un requisito no funcional
   (D4: "responde en menos de 3 s") o una regla ("un camión tiene como mucho
   un conductor") hoy solo se prueba si alguien escribe el test. No hay una
   comprobación de que la restricción tenga evidencia del tipo que pide (un
   test de rendimiento para un tiempo, un test de propiedad para un
   invariante).
2. **Efectividad por requisito** (punto 1): que los tests que nombran
   `REQ-012` maten los mutantes del código que REQ-012 tocó.
3. **Contradicción demostrable.** Detectar que la implementación contradice
   una restricción escrita (un endpoint que devuelve datos que la spec
   prohíbe, un valor distinto del de la regla) solo lo hace hoy, como aviso,
   el agente revisor. Para bloquear hace falta evidencia determinista:
   ejecutar los escenarios Gherkin (ya existe `cucumber` en Node) y casar sus
   valores con los de la regla.
4. **Reglas de arquitectura en la spec** (punto 4).

## Orden recomendado

| Prioridad | Trabajo | Por qué primero |
| --- | --- | --- |
| P0 | Severidad mínima y atribución de dependencias al diff | Sin esto, un aviso nuevo de una dependencia vieja bloquea PRs ajenos |
| P0 | Mutación activable sin editar el build (Maven y Node) y en los proyectos de forja | Ya está medida sobre el diff; falta que se pueda encender |
| P1 | ArchUnit "solo lo nuevo" (FreezingArchRule o SARIF) y dependency-cruiser para Node | Ya existen `arch_cmd` y `arch_sarif`; falta el puente |
| P1 | SBOM con Syft para todos los stacks, diff de componentes y política | Base de los puntos 2 y 7 |
| P1 | Trivy para Dockerfile, compose e IaC | forja genera esos ficheros y nada los revisa |
| P2 | Excepciones con caducidad y "empeoró" | Gobierno de la deuda |
| P2 | ZAP baseline en CI | Necesita levantar la app |
| P2 | Scorecard vía deps.dev para dependencias nuevas | Aviso, no bloqueo |
| P3 | Restricciones de la spec ejecutables y efectividad por requisito | La parte más propia de Specgate, sobre todo lo anterior |

Cada fila sería un change de Specgate (`specgate change new …`) con sus
requisitos, como el quality gate (REQ-218..234).
