<!-- translation-of: f8c2d23b7514 -->
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
  use: { screenshot: "on", video: "on" },
});
```

`specgate doctor` avisa (`doctor_evidence_media`) cuando están apagados.

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

## La página

```bash
specgate evidence draft-orders
```

Escribe `docs/specs/changes/draft-orders/EVIDENCE.md`. Por requisito:

- Una tabla con una fila por test: su última captura antes y después. Las
  imágenes se copian a `evidence/` junto a la página, para que se vean en el
  pull request; una de más de 300 KB se nombra, no se copia.
- Las rutas de los videos y los traces, en `.specgate/evidence/`.
- Cada escenario como diagrama de secuencia UML, numerado. Cuando su WHEN
  llama a un endpoint que declara el código (`@PostMapping` de Spring, `@Path`
  de JAX-RS) —o pasa por una pantalla cuyo código web llama a `/api/...` junto
  al id del requisito—, sigue el código: una línea de vida por objeto, cada
  llamada con sus parámetros y tipos, cada respuesta con lo que devuelve, del
  controlador al caso de uso, la implementación del puerto y el cliente que
  llama. Si no, el actor, el sistema y las llamadas que nombran sus pasos. El
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

La base es la que usa `specgate check --affected`. Los diagramas se leen del
spec y del código, no los dibuja un modelo, así que la página sale igual cada
vez que se escribe. Haz commit de ella con el change y enlázala desde el pull
request; `archive` la lleva con el change.

## Siguiente

- [Un gate rápido](fast-gate.md): ejecuta solo los tests que toca un change
- [Tests de aceptación sellados](sealed-acceptance.md): los tests que ejecuta el antes, sellados antes del código
