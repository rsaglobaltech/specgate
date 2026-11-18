<!-- translation-of: d3473f7a9cb1 -->
# El gate en tu máquina

Ejecuta el gate antes de hacer push y un pull request en rojo será raro. Al
final de esta página `specgate check` ejecuta tus tests, sabes cómo ejecutar
solo lo que toca un change, y un hook de git lo ejecuta por ti.

## Dile cuáles son tus tests

`init` y `adopt` guardan el comando de tests que encuentran (`npm test`,
`mvn test`, `gradle test`…) como `test_cmd:` en `harness.config.yaml`.
Defínelo o cámbialo, y también tu check de arquitectura si tienes uno:

```bash
specgate config set test_cmd "npm test"
specgate config set arch_cmd "npx depcruise src"
```

`--test-cmd` lo reemplaza para una sola ejecución:

```bash
specgate check --test-cmd "npm run test:unit"
```

## Ejecútalo

```bash
specgate check
```

Imprime una línea por etapa y, cuando falla, el hallazgo con su corrección.
El check de arquitectura y los tests se ejecutan en paralelo;
`specgate config set gate_parallel false` los ejecuta uno tras otro.

Compara los ids de requisito con la rama en la que harás merge, como hace CI:

```bash
specgate check --base origin/main
```

Sin `--base`, usa `SPECGATE_BASE`, luego `pr.base` en `alm.config.yaml`, y
luego la rama por defecto de origin. Dos ramas que añaden cada una un
`REQ-012` con un título distinto fallan aquí, antes del merge, con el
siguiente id libre en ambos lados.

## Solo lo que toca el change

En un proyecto grande la suite completa es lenta. `--affected` ejecuta los
tests que el change puede romper y omite los que pasaron sobre el mismo
código:

```bash
specgate check --affected
```

Qué selecciona, y cuándo lo ejecuta todo de todos modos: [Un gate más rápido](../fast-gate.md).
CI siempre ejecuta la suite completa.

## Lee el último resultado

Cada ejecución se guarda en la carpeta git del repositorio. Léela sin ejecutar
nada:

```bash
specgate check --last
```

```text
  ◆ specgate · check --last   shop

  ▲  The last gate failed.
     2026-11-18T12:30:32.026Z · bdd95406e212 on main with uncommitted changes

  ids                       skipped
  changes                   skipped
  validate                  failed
  architecture              skipped
  tests                     not run
```

`--json` da cada etapa con su comando, resultado, tiempo y hallazgos: lo que
lee un editor o un script.

## Antes de cada commit

Un hook detiene un requisito sin escenario o sin test antes de que el commit
salga de tu máquina. El hook de git puro, y el mismo con husky, están en
[Automatización](../automation.md#run-the-gate-in-a-pre-commit-hook). Ejecutan
`validate . --strict`, que omite tus tests: déjalo así si tus tests son
lentos, y deja que CI los ejecute. Cualquiera puede saltarse un hook con
`git commit --no-verify`, así que CI también ejecuta el gate.

## Sin Node

La imagen Docker ejecuta el mismo gate sin nada instalado salvo Docker:

```bash
docker run --rm -v "$PWD:/workspace" \
  ghcr.io/rsaglobaltech/specgate:1.3.0 validate . --strict
```

Los plugins de Maven y Gradle lo enlazan a `mvn verify`:
[Ejecuta el gate sin Node](../automation.md#run-the-gate-without-node).

## Siguiente

- [En CI](ci.md)
