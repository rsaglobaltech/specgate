<!-- translation-of: 5b33e69318e1 -->
# Un gate más rápido

El gate cuesta lo que cuesta tu suite de tests, y la suite crece con cada
requisito, mientras que `apply` ejecuta el gate una vez por requisito. Esta
página explica las tres formas en que `specgate check` cuesta menos: ejecutar
solo lo que toca el change, no volver a ejecutar lo que pasó sobre el mismo
código y ejecutar el check de arquitectura junto a los tests.

**Necesitas:** un proyecto en git donde `specgate check` ya pase
([Validar](validating.md)).

<!-- specgate:diagram fast-gate -->

## Ejecuta solo lo que toca el change

`check --affected` ejecuta los tests de lo que cambió desde la rama base
—`--base <ref>`, si no `SPECGATE_BASE`, si no la rama por defecto de origin,
`main`, `master` o `develop`—, contando los archivos sin commit y sin seguimiento:

```bash
specgate config set test_cmd_affected "npx vitest run {files}"
specgate check --affected
```

- Un requisito queda **tocado** cuando una línea cambiada de un spec cae en su
  sección o lo nombra, cuando cambió su archivo feature, o cuando cambió un
  archivo de código o de test que la matriz le enlaza.
- Los tests que se ejecutan son los que la matriz enlaza a los requisitos
  tocados, cada test cambiado y —en JavaScript y TypeScript— los tests cuyos
  imports relativos alcanzan un archivo cambiado.
- Llegan al comando de tests como `{files}`, cada uno entrecomillado para tu
  shell; `{req}` es el requisito, cuando se toca exactamente uno.
  `test_cmd_affected:` es el comando que usan `--affected` y `apply`, así que
  `test_cmd` sigue siendo la suite completa. Un comando sin ninguno de los dos
  placeholders se ejecuta entero, y el hallazgo `affected_needs_files` dice
  cómo añadir `{files}`.
- Cuando `apply` ejecutó la suite completa para un requisito y tardó dos
  minutos o más, la entrega lo dice, con la línea `config set
  test_cmd_affected` construida a partir de tu propio comando.

## Cuándo lo ejecuta todo

Ejecuta en su lugar la **suite completa**, y dice por qué en `selection.reason`,
siempre que no puede saber qué necesita el change:

- cambió `package.json`, un lockfile, `harness.config.yaml`, un `tsconfig`, una
  configuración de build o de runner (`pom.xml`, `build.gradle`, `pyproject.toml`,
  `go.mod`, `jest.config.js`, …) o un archivo que coincide con un glob de `full_on:`;
- un archivo cambiado o borrado no está enlazado a nada: ni requisito, ni test,
  ni import;
- no cambió nada, no se encontró rama base o lo que cambió no tiene test.

## Un test que pasó no se vuelve a ejecutar

Un archivo de test que pasó con `--affected` no se vuelve a ejecutar mientras
no cambien su contenido, los archivos que alcanzan sus imports, el código que la
matriz enlaza a sus requisitos, el comando de tests y los lockfiles; la
respuesta lo lista en `selection.cached`. Un test que no es JavaScript ni
TypeScript, cuyos imports no se pueden seguir todos, o que accede al sistema de
archivos, a un proceso o a la red, se vuelve a ejecutar ante cualquier cambio en
el código del proyecto. El registro se guarda en la carpeta de git, junto al
último resultado del gate. `--no-cache` ejecuta todo lo seleccionado; una
ejecución que falla olvida lo que ejecutó.

## Dónde se sigue ejecutando la suite completa

`check` sin flag ejecuta la suite completa, como antes, y `check --ci` siempre
lo hace —también con `--affected`, que ignora (`affected_ignored_ci`)— y nunca
usa la caché. `apply` rellena `{files}` con los archivos de test del requisito
que entrega.

Un test que llega al código arrancando un proceso o un navegador lo selecciona
la matriz, a través de su requisito, no de sus imports. Nombra el requisito en
él y `--affected` lo encuentra.

## El check de arquitectura junto a los tests

Después de `validate --strict`, que se ejecuta solo porque falla rápido,
`arch_cmd` y los tests se ejecutan a la vez, cada uno con su propia salida;
ambos se reportan antes de que el gate decida. Cuando los dos compilan en la
misma carpeta —dos ejecuciones de Maven sobre `target/`, por ejemplo—,
ejecútalos uno detrás de otro:

```bash
specgate config set gate_parallel false
```

## Qué dice

Toda respuesta de `check --json` tiene `selection`: `mode` (`affected` o `full`),
`reason`, `base`, `changed`, `requirements`, `tests`, `cached` y el `command`
que se ejecutó. Cada entrada de `stages` tiene `ms`, el tiempo que tardó (`null`
cuando no se ejecutó). Solo en una terminal con color termina la línea de una
etapa con su tiempo: no en una tubería, un log ni CI. La línea de Tests nombra el
comando tal como está configurado (`npm test`), no lo que ejecuta por debajo
(`node --test`). `specgate check --last --json` devuelve ambos.
