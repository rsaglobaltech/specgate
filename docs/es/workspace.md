<!-- translation-of: c3ed23ab939b -->
# Un workspace de repositorios

Un producto hecho de varios repositorios —un servicio de flota, un servicio de
seguimiento, una app web, un repositorio de contratos compartidos— recibe un único sitio
que los conoce a todos: un **repositorio workspace** que contiene `specgate.workspace.yaml`.
Cada repositorio conserva su propia especificación y su propio gate; el workspace responde
a lo que ninguno de ellos puede responder solo:

- dónde está el producto entero,
- un único gate sobre todos los repositorios,
- un requisito de un repositorio que espera al de otro,
- una historia de negocio dividida en un change en cada repositorio que toca.

El modelo es el [ADR-0043](specs/adr/0043-the-workspace.md).

## Ids entre repositorios

Dentro de un repositorio un requisito conserva su id: `REQ-012`. En el workspace
cada repositorio tiene un `REQ-012`, así que un requisito se nombra con su repositorio:
`tracking:REQ-012`. Escribe la forma cualificada siempre que un repositorio hable del
requisito de otro: en la prosa de un spec, en una historia del workspace, en `depends=`.

## Configurarlo

Pon el repositorio workspace junto a sus miembros:

```
truck-flote-workspace/     ← the workspace
truck-flote-fleet/
truck-flote-tracking/
truck-flote-web/
truck-flote-contracts/
```

```bash
cd truck-flote-workspace
specgate workspace init --name truck-flote
```

Sin `--repo`, `init` nombra cada carpeta hermana que contiene un proyecto de
Specgate, sin el prefijo que comparten: `truck-flote-fleet` es `fleet`, y se conserva
su ruta (REQ-348). Un nombre que termina en `contracts` recibe el rol `contracts`, uno
que termina en `web` el rol `web`, y el resto `service`. Si no, nómbralos tú:

```bash
specgate workspace init --name truck-flote \
  --repo fleet=../truck-flote-fleet \
  --repo tracking=../truck-flote-tracking \
  --repo web=../truck-flote-web:web \
  --repo contracts=../truck-flote-contracts:contracts
```

El fichero que escribe:

```yaml
workspace_version: 1
name: truck-flote
repos:
  - name: tracking
    path: ../truck-flote-tracking
    url: https://github.com/acme/truck-flote-tracking.git
    role: service
    capabilities: [tracking, telemetry]
```

| Clave | Qué es |
| --- | --- |
| `name` | Con qué se cualifican los ids: `tracking` en `tracking:REQ-012`. Letras minúsculas, dígitos y guiones |
| `path` | La carpeta del repositorio, relativa al workspace |
| `url` | De dónde clonarlo cuando no está (opcional) |
| `role` | `service`, `web`, `library` o `contracts` |
| `capabilities` | Sus `docs/specs/capabilities/*`, tal como los encontró `init` |

## Dónde está el producto

```bash
specgate workspace status
```

Cada repositorio: su rol, sus requisitos hechos sobre su total (tal como los cuenta su
propio `specgate status`), su rama y su gate tal como lo dejó el último `workspace
check`: pasado, fallido o sin ejecutar. Después cada historia.

`--json` da el modelo sobre el que se construyen la vista en directo del workspace y otras
herramientas; su forma está en el ADR-0043.

## Un único gate sobre los repositorios

```bash
specgate workspace check
```

Ejecuta `specgate check` en cada repositorio, después lo que solo el workspace puede
juzgar, y sale con un código distinto de cero cuando algo falla:

| Código | Qué falla |
| --- | --- |
| `workspace_repo_gate` | El propio `specgate check` de un repositorio |
| `workspace_repo_missing` | Un repositorio no está en su ruta (`url` dice de dónde clonarlo) |
| `workspace_unknown_repo` | Un id cualificado nombra un repositorio que el workspace no tiene |
| `workspace_unknown_requirement` | Un id cualificado nombra un requisito que su repositorio no tiene |
| `workspace_dependency_pending` | Un requisito depende de uno de otro repositorio que no está entregado; un aviso mientras el propio requisito esté en un change abierto, ya que el harness de la historia construye en ese orden (REQ-396) |
| `workspace_story_diverged` | Un aviso: los criterios de un sub-change no son los de la historia (REQ-343) |
| `workspace_api_unresolved` | `api=<repo>:<file>#<operationId>` no nombra ninguna operación de los contratos de ese repositorio; un aviso hasta que se entrega el requisito (REQ-405) |
| `contract_operation_not_found` | Un aviso: un requisito entregado cita una operación HTTP cuya ruta ningún fichero fuente de su repositorio sirve ni llama (REQ-408) |

El resultado se guarda en `.specgate/workspace-check.json` (ignorado por git), que lee
`status`.

## Un requisito que depende de otro repositorio

El servicio de seguimiento muestra al cliente la posición de un envío mediante una
operación que especifica el repositorio de contratos. En el spec de la capacidad de tracking:

```markdown
<!-- specgate:trace actor=Cliente kind=functional depends=contracts:REQ-004 -->
```

El propio `validate` de tracking deja `contracts:REQ-004` al workspace: no es
ni una dependencia desconocida ni parte del orden propio de tracking. `workspace
check` falla hasta que `contracts:REQ-004` está en Implemented, Verified o Released en
contracts:

```
✖  tracking:REQ-005 depends on contracts:REQ-004, which is Draft, not delivered.
   fix: Deliver REQ-004 in contracts first (specgate harness run --req REQ-004 there).
```

## Del brief del cliente a las historias

Guarda el brief del cliente como `brief.md` en el repositorio workspace. `specgate
status` allí dice lo que viene a continuación (REQ-341).

```bash
specgate workspace draft
```

El brief va debajo de un front matter en `docs/brief.md`, conservando su texto. Nombra las
historias de negocio que contiene, cada una con los repositorios que toca (REQ-339), o
deja que un agente las proponga, con un comentario `# check:` donde no esté seguro:
`specgate workspace draft --agent "claude -p"` escribe solo el front matter, y
vuelve a poner el texto del cliente si se movió (REQ-360).

```yaml
stories:
  - { id: follow-shipment, title: El cliente sigue su envío, repos: [fleet, tracking, web] }
```

```bash
specgate workspace draft                                       # lists them
specgate workspace draft follow-shipment --agent "claude -p"   # REQ-340
```

El agente lee el brief y escribe el `docs/stories/follow-shipment/story.md` de la historia:
su **Intent**, sus **Acceptance criteria** (`AC-1`, `AC-2`…) y, bajo
**Repositories**, los criterios que responde cada repositorio (`- fleet: AC-1, AC-2`,
REQ-361); las pistas del formulario desaparecen en cuanto ha escrito (REQ-364). Lo que solo el cliente
puede decidir va en `questions.md`, una fila cada cosa, con una columna `Answer` (REQ-363).
Cualquier cosa que escriba en otro sitio se deshace. Sin `--agent`, los ficheros esperan con
sus secciones. Revísalos: esta es la historia de negocio que responde cada repositorio.

## Una historia entre repositorios

```bash
specgate workspace propose follow-shipment
```

- Cada repositorio que nombra el brief (o `--repos fleet,tracking,web`) recibe el
  change `follow-shipment`. Su `discover.md` contiene la intención y los criterios de la
  historia, copiados tal como los enuncia la historia, y nombra la historia
  `truck-flote:follow-shipment` (REQ-342).
- Se niega mientras una pregunta de `questions.md` no tenga respuesta, y la nombra;
  `--allow-open-questions` propone igualmente (REQ-363).
- El Discover nombra los demás repositorios de la historia y —cuando la historia reparte
  sus criterios— los que responde este repositorio y los de los demás (REQ-361).
  Cómo dice un requisito lo que necesita de ellos, `depends=fleet:REQ-NNN` y una
  operación `api=` del repositorio de contratos, está en el `design.md` del sub-change:
  el Discover se queda en el negocio (REQ-344, REQ-365).
- `story.json` en el sub-change nombra el workspace, así que `change author` le dice
  al agente que escribe cualquier capa suya las demás partes de la historia (REQ-366).
- Al agente del repositorio de contratos se le pide que escriba el fichero OpenAPI o AsyncAPI
  bajo `contracts/` y cite cada operación como `api=`; a los demás, que lo citen con
  `depends=`. Un `depends=` o `api=` que nombra el design y que ninguna traza lleva es un
  aviso `layer_design_dependency_untraced`: el gate lee las trazas (REQ-380..382).
- Escribe primero la parte de contratos. `change author` rechaza los specs, el design o
  las tasks de una parte que comparte un criterio con el repositorio de contratos mientras la
  parte de contratos no especifique nada (`author_contracts_first`; `--force` la escribe
  igualmente): una parte escrita junto a un contrato vacío diseña una API propia (REQ-395).
- Cita la operación, no solo el requisito que la escribió. Un requisito de servicio o web
  que sirve o llama al contrato lleva ambas cosas en su traza:
  `depends=contracts:REQ-002 api=contracts:contracts/fleet.openapi.yaml#getFleetStatus`
  —el nombre del repositorio delante del fichero, como en un id cualificado—. Su propio
  `validate` deja esa cita a `workspace check`, que la resuelve en el repositorio de
  contratos (REQ-405). El contexto de la historia lista, bajo cada requisito de los
  contratos, la línea `depends=… api=…` exacta que hay que copiar, con el método y la ruta
  de la operación (REQ-415). `change validate` falla con `layer_no_operation_cited`
  para un `depends=` sobre los contratos sin `api=` una vez que ese requisito cita una
  operación (REQ-406), y con `layer_api_unresolved` para un `api=` del repositorio de
  contratos que no nombra ninguna de sus operaciones, listando las que tiene;
  `change approve` rechaza ambos (REQ-415). El prompt del harness cita cada operación
  citada tal como la escribe el contrato, y dice que sirva o llame exactamente a ese
  método y esa ruta (REQ-407).
- Una vez entregado un requisito, `workspace check` y `contract check` avisan con
  `contract_operation_not_found` cuando ningún fichero fuente de su repositorio —dejando
  aparte tests, `contracts/`, `docs/` y `features/`— tiene la ruta de la operación; un
  parámetro puede escribirse `{id}`, `:id`, `[id]`, `<id>` o `${…}`, y cualquier cosa puede
  ir delante de la ruta. Una ruta montada en dos piezas no se ve, por eso es un
  aviso (REQ-408). El harness es más estricto: un intento cuyo requisito cita
  una operación de otro repositorio falla tras un gate en verde mientras ningún fichero fuente
  tenga su ruta, entera o en piezas —un prefijo en la clase, el resto en el
  método—, y al siguiente intento se le dicen el método y la ruta (REQ-418).
- Los criterios son del negocio: `workspace check` avisa cuando los de un repositorio
  difieren de los de la historia (REQ-343), y cuando ningún repositorio responde un
  criterio o lo reclaman dos (REQ-362). Cámbialos en la historia.

Después cada repositorio trabaja su change como siempre: borrador, revisión, harness,
archivo. `workspace status` muestra cada sub-change abierto, archivado o ausente,
y la historia **hecha solo cuando cada repositorio ha archivado su parte**.

## Construir una historia y seguirla

```bash
specgate workspace harness run --story follow-shipment
specgate workspace live          # the studio, serving the workspace's /live
```

- `workspace harness run --story` arranca un `harness run` por cada repositorio que
  contiene una parte abierta de la historia, para los requisitos de esa parte, cada uno en su propio
  proceso, con su salida en `.specgate/workspace-runs/<story>/` (ignorado por git). Un
  repositorio cuya parte depende de un requisito no entregado de otra parte arranca
  en cuanto ese repositorio ha terminado; el resto se ejecuta a la vez (REQ-345). Aun así,
  solo arrancan sus requisitos cuyas dependencias están entregadas: los demás se
  nombran, en espera, y la ejecución sale con 1 (REQ-367). Las
  opciones tras un `--` suelto van al harness de cada repositorio. `--dry-run` imprime
  los comandos con su orden.
- A cada harness se le dicen las demás partes de la historia y sus requisitos, para que su
  agente pueda nombrar lo que espera (REQ-344).
- No arranca **ninguno** cuando la base de un repositorio ya falla el gate en
  requisitos fuera de su parte, como rechazaría cada harness por su cuenta
  (REQ-175): lo dice una vez, nombrando el repositorio, antes de pagar nada.
- `specgate studio` arrancado en el repositorio workspace sirve la vista en directo del
  workspace en `/live`: un panel por repositorio con el requisito en curso,
  el paso del gate en el que está y desde cuándo, y el último paso de su agente; cada historia
  con sus partes abiertas, en construcción, archivadas o ausentes, y nombradas las partes que esperan
  un requisito no entregado de otro repositorio; y lo que ha costado cada repositorio
  y cada historia, en dinero y minutos.
- `/live.json` y `workspace live --json` dan ese modelo como datos
  (REQ-320..324).
- El nombre de cada repositorio abre su propia vista en directo en `/live/repo/<name>/`:
  la cola de trabajo, la consola del agente, cada intento y el paso del gate, la misma
  página que el studio de ese repositorio sirve en `/live`, actualizada mientras su harness
  escribe, con su rol y un enlace de vuelta al workspace. Es de lectura: responde una
  pregunta desde el studio de ese repositorio. Un repositorio que el workspace no
  tiene, o cuya carpeta falta, es un 404 que lo dice (REQ-410..412).
## Los principios de la organización

`docs/specs/principles.md` contiene los principios que sigue un repositorio, con
`principles_version` y `source` en su front matter. En un workspace el origen
es la copia del repositorio workspace (`source: ../ws/principles.md`); compartido como
pack de dominio cuyo `outputs.files` escribe el fichero, es `source: pack:<pack_id>`.
`specgate check` nombra la versión y avisa con `principles_behind` cuando el origen
tiene una más nueva (REQ-330, REQ-332). Un principio puede llevar una comprobación que ejecuta el gate:

```markdown
## P1 — No credentials in code
<!-- specgate:principle forbid="password\s*=\s*\"" in="src/**" -->

## P2 — Dependencies audited
<!-- specgate:principle run="npm audit --omit=dev" level=warn -->
```

Un fallo es `principle_failed`, que hace fallar el gate; `level=warn` lo convierte en
consejo (REQ-331).

Un requisito que comparte un criterio con el repositorio de contratos lo cita: `change validate` avisa con
`layer_no_contract_cited` cuando no lleva ni `depends=contracts:REQ-NNN` ni un `api=` (REQ-386), y
la cita de un fichero de contrato aún no escrito es un aviso hasta que se entrega el requisito (REQ-385).

## Lo que no hace un workspace

- Nunca escribe la especificación de un repositorio. Pregunta a cada repositorio a través de
  la CLI, así que ve lo que ve el propio gate de ese repositorio.
- Un repositorio fuera de un workspace funciona exactamente igual que antes.
- `workspace check` ejecuta los repositorios uno detrás de otro.

## Siguiente

- [El harness](harness.md): entrega los requisitos de cada repositorio.
- [Specgate a escala empresarial](specs/enterprise-sdd-gap.md): lo que añade la línea 1.0
  por encima del workspace.
