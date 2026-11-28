<!-- translation-of: 3abab2b40529 -->
# Evidencia antes y después

Al final de esta página cada requisito de un change tiene un antes y un
después, y el change tiene una página que los muestra lado a lado: la última
captura de cada test, dónde están los videos y los traces, y el flujo y el
código dibujados como diagramas. Quien revisa empieza por ahí, y abre el código
donde la evidencia muestra riesgo ([ADR-0047](specs/adr/0047-evidence-before-and-after.md)).

**Necesitas:** un proyecto con `bdd: required` y un `bdd_cmd` que ejecute los
escenarios ([Configura el gate](gate/policy.md)). Sin eso igual obtienes los
diagramas, pero no las imágenes: los escenarios nunca se ejecutan.

## Que el runner guarde imágenes

Specgate no maneja un navegador. Guarda lo que tu runner escribe en
`test-results/` mientras ejecuta los escenarios de un requisito — en la raíz, y
en cada workspace que declara tu `package.json` (`apps/web/test-results/`).
Playwright no guarda capturas ni video salvo que su configuración lo diga:

```ts
// playwright.config.ts
export default defineConfig({
  use: { screenshot: "on", video: "on", trace: "on" },
});
```

`specgate doctor` avisa (`doctor_evidence_media`) cuando alguno está apagado.
Un trace guardado solo al fallar (`retain-on-failure`) no guarda nada del
después, que pasa.

## El antes

Con el test ya escrito, y antes del código:

```bash
specgate evidence before REQ-031
```

Ejecuta los escenarios de REQ-031 (`bdd_cmd` con `@REQ-031`) sobre el código
tal como está y guarda la ejecución en `.specgate/evidence/REQ-031/before/`:
`run.json` (el comando, su código de salida), `run.log`, y `artifacts/` con lo
que escribió el runner. Lo esperable es rojo: en una pantalla que ya existe,
las imágenes la muestran como era; en una nueva, dónde se cortó el flujo.
`specgate reproduce run` también guarda ahí la ejecución en rojo de un bug. El
paso `apply` de los agentes les dice que lo tomen.

## El después

`specgate apply REQ-031` guarda el después donde siempre, en
`.specgate/evidence/REQ-031/`, y `evidence.json` nombra el antes. Toda carpeta
`artifacts/` queda fuera de git.

## Los intentos por el camino

Cuando los escenarios de `apply` fallan, la ejecución se guarda como intento:
`.specgate/evidence/REQ-031/attempts/1/`, luego `2`, cada uno con su log y lo
que escribieron el runner y el registro de la IA; `apply_bdd_failed` nombra la
carpeta. El `evidence.json` de la entrega los lista y la página los muestra en
"Failed attempts": por qué falló cada uno y qué decidió la IA en él —un
escenario inestable es lo que más necesita ver quien revisa—. Un
`evidence before` nuevo empieza de cero y los borra.

## La página

```bash
specgate evidence draft-orders
```

Escribe `docs/specs/changes/draft-orders/EVIDENCE.md`. Por requisito:

- Una tabla con una fila por test: su última captura antes y después. Las
  imágenes se copian a `evidence/` junto a la página, para que se vean en el
  pull request; una de más de 300 KB se nombra, no se copia.
- Las rutas de los videos y los traces, en `.specgate/evidence/`.
- **Escenarios**: una fila por escenario que reportó el runner; en cada lado,
  si pasó (✓) o falló (✘), su tiempo y, en un fallo, el paso que falló con su
  `Expected:` y su `Received:`. Se lee de la salida list de Playwright.
- **Llamadas al servicio**: cada llamada que los tests hicieron a `/api/...`, o
  con su contexto de request, leída de cada `trace.zip`: método, ruta y estado
  antes y después, y los cuerpos de las que cambiaron de respuesta. Las
  cabeceras no se muestran, y un valor JSON cuya clave nombra un token, una
  contraseña, un secreto, una cookie o una autorización se escribe `«hidden»`.
- **Decisiones de la IA**: lo que decidieron los modelos de IA del proyecto en
  cada ejecución, cuando el proyecto lo registra (abajo).
- Cada escenario como diagrama de secuencia UML, numerado. Cuando su WHEN
  llama a un endpoint que declara el código (`@PostMapping` de Spring, `@Path`
  de JAX-RS) —o pasa por una pantalla cuyo código web llama a `/api/...` junto
  al id del requisito—, sigue el código: una línea de vida por objeto, cada
  llamada con sus parámetros y tipos, cada respuesta con lo que devuelve, del
  controlador al caso de uso, la implementación del puerto y el cliente que
  llama; un escenario que acaba en error termina en el `throw` que lleva su
  código o su mensaje. Cadenas, fechas, relojes y listas, helpers privados que
  no hablan con nadie y las llamadas repetidas de un builder quedan fuera: son
  cálculo, no conversación. Si no, el actor, el sistema y las llamadas que
  nombran sus pasos. El
  de la base queda plegado debajo, o la página dice que es nuevo o que no cambió.
- El código del requisito como un diagrama de clases UML por lenguaje: sus
  tipos, lo que referencian, las implementaciones de sus interfaces y los tipos
  que los contienen. Java y TypeScript muestran atributos y operaciones con
  tipo y visibilidad, `«interface»`, `«record»`, `«enumeration»` con sus
  literales, asociaciones con multiplicidad, dependencias y herencia; Kotlin,
  C#, JavaScript y Python sus clases y miembros públicos. Los tipos nuevos desde
  la base van en verde, los cambiados en ámbar, y la página nombra qué cambió.
- Lo que falta, con el comando que lo obtiene: sin antes, sin entregar, sin
  capturas.

La base es la que usa `specgate check --affected`; `--base <ref>` nombra otra,
como el commit del requisito anterior. Si esa base es el propio HEAD —el trabajo
se hizo y se commiteó en main—, la página compara con el commit anterior a la
apertura del change. Los diagramas se leen del spec y del
código, no los dibuja un modelo, así que la página sale igual cada vez que se
escribe. Haz commit de ella con el change y enlázala desde el pull request.

## Como página web

```bash
specgate evidence draft-orders --html     # also writes EVIDENCE.html
specgate evidence draft-orders --open     # writes it and opens it in the browser
```

`EVIDENCE.html` es la misma evidencia en una sola página que se abre con
doble clic, sin servidor: las capturas van dentro, antes y después lado a
lado, y luego los escenarios, las llamadas, las decisiones de la IA, cada
secuencia en la base y ahora lado a lado, y las clases. Está en inglés, clara
u oscura según el sistema de quien la lee. Los diagramas los dibuja Mermaid,
cargado desde una versión fijada en un CDN; sin conexión se ve su texto.

Las capturas la hacen pesada: déjala fuera de git y súbela como artefacto del
build para quien revisa. `--open` no abre ningún navegador en CI ni cuando
`SPECGATE_NO_OPEN` está fijada.

## Lo que decidió la IA

Specgate no ve dentro de tu servidor. Cuando ejecuta los escenarios de un
requisito —`evidence before`, `apply`, `reproduce run`— fija
`SPECGATE_AI_LOG` con la ruta absoluta de
`test-results/specgate/ai-decisions.jsonl`, vaciado antes. Escribe ahí una
línea JSON por llamada al modelo y la página las muestra, antes y después:

```json
{"model": "llama3.2", "input": "Haz eso", "output": {"category": "C"}, "ms": 812}
```

Solo cuando la variable está fijada: en producción no se escribe nada. El
servidor que arrancan los tests debe heredarla —el `webServer` de Playwright
lo hace.

## Al archivar

Cuando el gate ejecuta los escenarios (`bdd: required`), `specgate archive`
vuelve a escribir la página antes de mover el change, así que el change
archivado la guarda al día. Un requisito entregado sin antes se nombra
(`archive_no_before`) y el archive sigue. Un equipo que quiere todos los antes
lo fija en `.specgate/gate.yaml`:

```yaml
evidence: required
```

Entonces `archive` rechaza un change con un requisito sin antes; `--force` lo
archiva tal cual.

## Siguiente

- [Un gate rápido](fast-gate.md): ejecuta solo los tests que toca un change
- [Tests de aceptación sellados](sealed-acceptance.md): los tests que ejecuta el antes, sellados antes del código
