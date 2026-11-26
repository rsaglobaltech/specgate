<!-- translation-of: 7f94b77efa0f -->
# Un código existente, con el trabajo en Jira

Esta página es para un equipo con un código que tiene años y trabajo que llega
como tickets de Jira. Al final, Specgate se ejecuta en tu repositorio sin
ningún cambio en tu código, Jira está conectado, y tu primer ticket ha pasado
por el gate hasta un pull request con merge.

Lo que necesitas primero:

- Node.js 22 o posterior en las máquinas de los desarrolladores y en CI.
- El repositorio, con un comando de tests que ya funcione (`mvn -B test`,
  `npm test`, `./gradlew test`…).
- Jira Cloud, configurado como se describe en
  [A partir de un ticket de Jira](from-a-ticket.md#configuracion-inicial). `specgate alm pr`
  abre pull requests en GitHub; en Bitbucket o GitLab, mira
  [Otro host de Git](#otro-host-de-git).

## No especifiques el pasado

No escribes una especificación del código que ya tienes. La especificación
crece ticket a ticket: cada ticket añade los requisitos del comportamiento que
cambia, y el código que nadie toca queda sin especificar. Es el enfoque
strangler. Al cabo de unos meses, las partes del sistema que más cambian son
las que están especificadas, que es donde una especificación compensa.

Un **requisito** (`REQ-007`) es una frase que el sistema debe cumplir; un
**escenario** (`SCN-007a`) es un ejemplo concreto Given/When/Then de él. Mira
[Conceptos](concepts.md#vocabulario) para los demás términos de esta página.

## 1. Adopta Specgate en el sitio

Si el repositorio ya tiene un `package.json`, añade Specgate como dependencia
de desarrollo, para que todos los desarrolladores y CI usen la misma versión:

```bash
npm install --save-dev @rsaglobaltech/specgate
npx specgate init --dry-run
npx specgate init
```

En un repositorio sin él, como un proyecto puro de Maven o Gradle, no añadas un
`package.json` solo para Specgate. Ejecútalo con `npx` y una versión fijada, y
usa la misma versión en CI:

```bash
npx @rsaglobaltech/specgate@1.6.0 init --dry-run
npx @rsaglobaltech/specgate@1.6.0 init
```

Los comandos de abajo escriben `npx specgate`; en un repositorio sin
`package.json`, léelo como `npx @rsaglobaltech/specgate@1.6.0`.

En un repositorio que ya tiene un `pom.xml`, `build.gradle`, `package.json` o
similar, `specgate init` adopta el proyecto en el sitio; es lo mismo que
`specgate adopt`. Escribe `spec.md`, la matriz de trazabilidad y algunos
ficheros de apoyo, nunca sobrescribe un fichero que existe, y nunca toca tu
código fuente. `--dry-run` muestra lo que escribiría.

Al adoptar también lista las áreas que lee de la estructura de carpetas en
`docs/specs/adoption.md`: un mapa desde el que especificar, no requisitos, así
que el gate no les pide nada. `specgate adopt --no-capabilities` omite esa lista.

Después dile al gate cómo ejecutar tus tests, y añádelo a CI:

```bash
npx specgate config set test_cmd "mvn -B test"
npx specgate ci init
git add -A && git commit -m "chore: adopt Specgate"
```

Tus tests existentes siguen ejecutándose dentro del gate, exactamente como
antes. No necesitan nombrar un requisito: solo un requisito más allá de Draft
necesita un test que lo nombre. Haz del job de CI un check obligatorio en tu
rama base, como se describe en
[El primer PR de tu equipo](first-pr.md#haz-del-gate-un-check-obligatorio).

## 2. Conecta Jira

Sigue [la configuración inicial](from-a-ticket.md#configuracion-inicial): un
token de Jira de solo lectura, un token de GitHub para los pull requests,
`alm.config.yaml`, la app GitHub for Jira, el workflow, las reglas de
automatización y la protección de ramas. Asocia cada epic en el que trabajes a
una capacidad bajo `epics:`. Una **capacidad** es un área de la especificación;
en un código antiguo, nómbrala por el módulo o el área de negocio que cubre el
epic (`billing`, `customer-accounts`).

## 3. El primer ticket, de principio a fin

Elige una historia pequeña. Después sigue
[el ciclo diario](from-a-ticket.md#el-ciclo-diario-por-ticket): comprueba el
ticket, abre su change, haz que el agente lo redacte, revisa, construye,
archiva, abre el pull request, haz merge. La primera vez lleva más tiempo
porque cada paso es nuevo; desde el segundo ticket es el ritmo normal del equipo.

## Bugs en comportamiento que nadie especificó

La mayoría de los bugs de un código antiguo están en comportamiento que nunca
se puso por escrito. No busques un requisito al que culpar. Trata la
corrección como un requisito nuevo:

1. Abre el change del bug: `specgate propose --from-ticket KAN-42`. Un Bug
   recibe una rama `bugfix/KAN-42-…`.
2. Escribe el requisito como el comportamiento correcto, con un **escenario de
   regresión**: Given las condiciones del informe, When el usuario hace lo que
   dice el informe, Then el resultado correcto. Una persona lo aprueba en una
   terminal: `specgate change approve <change-id>`.
3. Escribe primero su test y mira cómo falla: reproduce el bug. Corrige el
   código hasta que pase, y después `specgate apply REQ-…`.

A partir de entonces, ese comportamiento está especificado y protegido por el gate.

## Tests de caracterización antes de cambios arriesgados

Antes de cambiar un área con pocos tests, registra lo que hace hoy. Abre un
change cuyos requisitos describan el comportamiento actual, y escribe tests que
los nombren. Estos tests pasan contra el código tal como está, así que
`specgate apply` los acepta enseguida: un change cuyos tests ya pasan es
válido, y aquí es justo lo que se busca.

Después el change propio del ticket modifica esos requisitos. La diferencia en
la especificación y en los tests muestra a quien revisa exactamente lo que
cambió el ticket, y nada más cambia en silencio. Mira
[Cambia un requisito ya entregado](reviewing-changes.md).

## Qué no importar

- **Los tickets cerrados.** Describen trabajo ya hecho, y el código es su
  registro. Specgate lee un ticket abierto cada vez, cuando empieza el trabajo
  en él.
- **Todo el backlog de golpe.** Un ticket entra en la especificación cuando el
  equipo lo empieza, no antes. No ejecutes `specgate alm sync` ni
  `specgate alm pull` encima de este flujo: ese es el otro modo de Jira, y
  escribe en Jira (mira [Dos formas de conectar Jira](alm.md)).

## Reglas de arquitectura solo para el código nuevo

`specgate check` puede ejecutar tu check de arquitectura (ArchUnit,
dependency-cruiser…) antes de tus tests: configúralo con
`specgate config set arch_cmd "<command>"`. En un código antiguo, limita las
reglas a los módulos o paquetes nuevos, para que el gate exija al código nuevo
tu arquitectura objetivo sin fallar por capas anteriores a ella. Amplía el
alcance a medida que se reescriben los módulos antiguos.

## Proyectos Maven

`test_cmd` puede ser cualquier comando, así que usa los perfiles de Maven que
ya tienes.

**La suite completa** es lo que ejecutan `specgate check`, `specgate apply` y CI:

```bash
npx specgate config set test_cmd "mvn -B -P unit-test,integration-test verify"
```

Usa tus propios nombres de perfil; los de aquí (`unit-test`, `integration-test`)
son un ejemplo.

**Un gate rápido por requisito.** Etiqueta cada test de JUnit 5 con su
requisito. La etiqueta es también la mención que enlaza el test al requisito:

```java
@Test
@Tag("REQ-007")
void aPaidInvoiceDownloadsAsPdf() { /* … */ }
```

Después ejecuta solo los tests de ese requisito. El harness (`specgate harness
run`, que construye requisitos con un agente) sustituye `{req}` en su comando
de tests por el requisito que está construyendo (el agente se configura como
siempre, en `harness.config.yaml` o con `--agent`):

```bash
npx specgate harness run --test-cmd "mvn -B -P unit-test test -Dgroups={req} -DfailIfNoTests=true"
```

`-DfailIfNoTests=true` importa. Sin él, un test al que le falta la etiqueta no
se selecciona, Maven ejecuta cero tests e informa de éxito, y el requisito
parece demostrado cuando no se ejecutó nada. Dilo también en las reglas de tu
equipo, debajo del bloque de Specgate en `AGENTS.md`, para que el agente
etiquete cada test que escriba:

```markdown
## Team rules

- Tag every test with the requirement it proves: `@Tag("REQ-007")`.
```

Solo `harness run` sustituye `{req}` (y `{scenario}`, `{feature_file}`).
`specgate check` y `specgate apply` ejecutan `test_cmd` exactamente como está
escrito, así que no pongas `{req}` en `test_cmd`. Para ejecutar a mano los
tests de un requisito, escribe tú el id:

```bash
npx specgate apply REQ-007 --test-cmd "mvn -B -P unit-test test -Dgroups=REQ-007 -DfailIfNoTests=true"
```

CI sigue ejecutando la suite completa de `test_cmd`, así que el gate rápido
nunca la sustituye.

**Un POM padre (super POM)** no necesita nada de Specgate. Specgate ejecuta tu
comando desde la raíz del proyecto, y Maven resuelve el padre como siempre,
desde el repositorio o tu configuración. Un proyecto con Maven wrapper puede
usar `./mvnw` en lugar de `mvn`.

## Otro host de Git

`specgate alm pr` abre pull requests solo en GitHub. En Bitbucket o GitLab,
todo lo demás de esta página funciona igual: la rama del ticket, los
requisitos, el gate, el archivado. Abre tú el pull request, con la clave del
ticket al principio del título (`KAN-13 Register vehicle entry`), y pega los
requisitos y el resultado de `specgate check` en su descripción. Las
integraciones de Jira propias de Bitbucket y GitLab enlazan la rama, los
commits y el pull request al ticket a partir de la clave, así que las reglas
de Jira Automation mueven el ticket igual que con GitHub. Para el job de CI,
`specgate ci init --provider jenkins` (o `gitlab`) escribe el gate.

Conserva la línea `base:` del bloque `pr:` aunque no uses `alm pr`. Con
gitflow, donde el trabajo empieza en `develop` y la rama por defecto del
repositorio es `main`, es desde donde miden la rama del ticket, el check de la
clave del ticket y el check de ids:

```yaml
pr:
  base: develop # the branch pull requests target
```

## Siguiente

- [A partir de un ticket de Jira](from-a-ticket.md)
- [El primer PR de tu equipo](first-pr.md)
