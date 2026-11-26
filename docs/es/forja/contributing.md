<!-- translation-of: d0a7ec6c2c6c -->
# Contribuir

Esta página es para trabajar en forja en sí. Necesitas Node.js 22 o posterior. Para comprobar lo que
forja genera para Java, también necesitas un JDK 21 y Docker.

## Preparación

```bash
git clone https://github.com/rsaglobaltech/forja.git
cd forja
npm install
npm run build
npm link          # puts your local build on the PATH as `forja`
```

## El día a día

| Comando | Qué hace |
| --- | --- |
| `npm run dev -- <args>` | ejecuta la CLI desde `src/` con tsx, sin necesidad de build |
| `npm test` | la suite de vitest en `tests/` |
| `npm run test:watch` | lo mismo, en modo watch |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint sobre `src` y `tests` |
| `npm run build` | compila en `dist/`, que es lo que ejecuta el binario `forja` |
| `npm run site` | construye la landing de forja (y las redirecciones a esta documentación) en `_site/` |
| `npm run site:publish` | lo mismo en `docs/`, que GitHub Pages sirve desde `main`: haz commit del resultado |

`--dry-run` es la forma más rápida de ver qué hace un cambio:

```bash
npm run dev -- init demo --yes --dry-run
npm run dev -- init demo --yes --backend quarkus --dry-run
```

Los tests cubren las reglas de configuración (`schema.test.ts`), el orden de las recetas
(`planner.test.ts`), la generación de cada combinación Java y del camino Node (`render.test.ts`,
`render-node.test.ts`), la receta end-to-end (`e2e-web.test.ts`), los siguientes pasos
(`postinstall.test.ts`), `forja add` (`add.test.ts`) y `forja doctor` (`doctor.test.ts`).

## Demostrar que un proyecto generado funciona

Los tests unitarios muestran que forja genera los ficheros correctos. `scripts/verify-generated.sh`
muestra que esos ficheros funcionan: genera un proyecto con la CLI compilada, lo instala y lo ejecuta
todo.

```bash
npm run build
scripts/verify-generated.sh node
scripts/verify-generated.sh spring
scripts/verify-generated.sh quarkus
```

Para cada backend ejecuta `forja init` con Playwright y los extras, después `forja add usecase`,
`add entity` y `add port`, `forja doctor`, los tests, la comprobación de tipos y el lint. En Node también
construye la app web para producción, empaqueta la app móvil para iOS, Android y web, y ejecuta
`expo-doctor`. Después ejecuta los tests de Playwright en un navegador real y, por último,
`specgate validate --strict`.

Qué necesita:

- Docker en marcha. Los caminos Java arrancan PostgreSQL y Keycloak con `docker compose up -d --wait`, y
  Testcontainers o Dev Services arrancan su propio PostgreSQL.
- Los puertos 3000, 5432, 8080 y 8180 libres. Ejecuta un backend cada vez.
- Un JDK 21 para los caminos Java.

Un segundo argumento fija el directorio de trabajo; sin él, el script usa un directorio temporal nuevo.

## Cómo funciona una receta

Una receta es una preocupación del proyecto generado. Vive en `src/recipes/<id>.ts`, y sus plantillas
en `templates/<id>/`.

```ts src/recipes/keycloak.ts
import { defineRecipe } from "./types.js";

export default defineRecipe({
  id: "keycloak",
  apply(ctx) {
    ctx.copyFile("keycloak/realm.json.ejs", `infra/keycloak/${ctx.config.name}-realm.json`);
  },
});
```

`apply` recibe un `RecipeContext`. Todo lo que escribe va a un sistema de ficheros en memoria; nada
llega al disco hasta que se han ejecutado todas las recetas y Prettier ha formateado el resultado.

| Método | Qué hace |
| --- | --- |
| `ctx.config` | la configuración validada |
| `ctx.has(flag)` | si `flag` está en `platforms`, `tests` o `extras` |
| `ctx.copyFile(src, dest, data?)` | copia un fichero de plantilla; un fichero `.ejs` se genera con `{ config, ...data }` |
| `ctx.copyDir(src, dest, data?, mapPath?)` | copia una carpeta de plantillas de forma recursiva; los ficheros `.ejs` se generan y pierden el sufijo; `mapPath` renombra rutas |
| `ctx.mergePackageJson(dir, patch)` | fusiona `dependencies`, `devDependencies` y `scripts` en `<dir>/package.json` |
| `ctx.addEnv(key, default, comment?, section?)` | declara una variable para el `.env.example` raíz |
| `ctx.write(path, content)` / `ctx.read(path)` | escribe o lee un fichero en el proyecto generado |
| `ctx.markExecutable(path)` | activa el bit de ejecución al escribir en disco, como para `mvnw` |

Dos detalles importan:

- `mergePackageJson` lanza un error si dos recetas fijan el mismo script con valores distintos. Cada
  receta es dueña de sus scripts.
- `copyFile` sustituye un fichero, `mergePackageJson` fusiona en uno. Una receta que crea un
  `package.json` con `copyFile` tiene que ejecutarse antes que cualquier receta que fusione en él. El
  orden del planner se encarga de eso.

Las recetas Java usan dos helpers de `src/recipes/java.ts`: `copyJava`, que convierte `__pkg__` en la
ruta de una plantilla en la ruta del paquete (`com/acme/shop`), y el objeto `versions` que fija las
versiones de Spring Boot, Quarkus, ArchUnit, Keycloak, PostgreSQL y Specgate.

## Añadir una receta

1. Escribe `src/recipes/<id>.ts` con `defineRecipe`, y sus plantillas en `templates/<id>/`.
2. Regístrala en `src/recipes/registry.ts`.
3. Planifícala en `src/engine/planner.ts`: `planRecipes` para Node, `planJava` para Java. El orden se
   escribe a mano; pon la receta después de aquellas en cuyos ficheros fusiona.
4. Si añade una opción, añade el valor a `src/config/schema.ts`, con una regla entre campos si alguna
   combinación no puede funcionar. El esquema solo acepta lo que implementa una receta, así que un valor
   sin receta nunca llega al planner.
5. Ofrécela en `src/prompts/wizard.ts` y en las opciones de `init` en `src/cli.ts`.
6. Si el usuario tiene que ejecutar algo después, añádelo a `nextSteps` en `src/engine/postinstall.ts`.
7. Añade tests: la regla del esquema, el orden del planner y los ficheros generados.
8. Ejecuta `scripts/verify-generated.sh` en los caminos que toca la receta.

## Versiones

forja no se publica en el registro de npm. Una versión es un tarball del paquete adjunto a una release de
GitHub del repositorio de forja (para la 1.0.0, `rsaglobaltech-forja-1.0.0.tgz`), y los usuarios lo
instalan desde esa URL, como muestra [Primeros pasos](getting-started.md#instalacion). El tarball se
construye en una máquina local una vez que pasan el build, la comprobación de tipos y los tests. No hay
pipeline de publicación. El repositorio contiene un `.github/workflows/ci.yml`, pero no se usa: GitHub
Actions sigue desactivado, y cada comprobación de arriba se ejecuta en local.

Registra cada cambio en `CHANGELOG.md`, y marca la casilla correspondiente en `ROADMAP.md`, en la misma
pull request.

Estas páginas viven en el repositorio de Specgate, bajo `docs/forja/` (ADR-0033): un único sitio de
documentación para las dos herramientas. Edítalas allí.
