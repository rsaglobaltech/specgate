<!-- specgate:allow-placeholders -->
# Colisiones en `traceability.md` con el harness en paralelo

> **Creado:** 2026-08-21
> **Estado al escribirlo:** v0.6.0, rama `feat/escalado-plano-control`
> **Origen:** preocupación del usuario — «los agentes pueden chocar por el
> fichero `traceability.md`». Es cierto, está medido abajo, y la causa **no** es
> la que parece.
> **Relación:** complementa `mejoras/escalado-multiagente-conectores.md` §2.2
> (paralelismo) y la nota de `E1-03`, que ya encontró una cara de este problema
> dentro del propio harness. Este documento cubre la otra: la de quien mergea.

---

## 0. Resumen en una tabla

| Opción | Veredicto | Coste | Cambia el formato |
|---|---|---|---|
| **A · Driver de merge por filas** (`.gitattributes` + `merge=csda-matrix`) | **Hecha** *(2026-08-21)* | Bajo | No |
| **B · No escribir el estado en la rama** (`done` después del merge) | **Complementaria** — resuelve por construcción, pero pierde una propiedad | Muy bajo | No |
| **C · Registro append-only + `merge=union`, matriz derivada** | Correcta pero desproporcionada hoy | Alto | Sí, radical |
| **D · Un fichero por requisito** | No | Muy alto | Sí, radical |
| **E · `merge=union` sobre la matriz tal cual** | **Peligrosa — no hacer** | Nulo | No |
| **F · Separar filas con líneas en blanco** | No | Bajo | Rompe Markdown |

**La frase que lo resume:** el choque **no es de concurrencia, es de formato**.
Dos ramas que tocan filas *distintas* chocan solo porque esas filas son
*líneas contiguas*, y el merge a tres bandas de git necesita al menos una línea
sin cambios entre dos hunks para separarlos. Con eso claro, la solución barata
existe y no obliga a rediseñar nada.

---

## 1. Lo medido

Todo lo de esta sección se ejecutó el 2026-08-21 contra un proyecto real de tres
requisitos independientes, con `harness run --concurrency 3`. No es análisis
estático: §12.11 del plan de cierre dice que eso no cuenta, y tiene razón.

### 1.1 El choque existe y es reproducible

Tres ramas verdes, `harness/REQ-001..003`. Al mergearlas a `main` una detrás de
otra, como haría una persona:

```
merge harness/REQ-001: clean
merge harness/REQ-002: CONFLICT (content): Merge conflict in docs/specs/traceability.md
merge harness/REQ-003: clean
```

El conflicto no es que dos ramas hayan editado la misma fila. Cada rama editó
**su propia** fila:

```
<<<<<<< HEAD
| REQ-001 | … | Implemented |
| REQ-002 | … | Draft       |
=======
| REQ-001 | … | Draft       |
| REQ-002 | … | Implemented |
>>>>>>> harness/REQ-002
```

### 1.2 La causa es la adyacencia, no la concurrencia

Control directo, con cinco filas y dos ramas que cambian una fila cada una:

| Filas modificadas | Resultado |
|---|---|
| 1 y 2 (**contiguas**) | **CONFLICT** |
| 1 y 5 (tres líneas de por medio) | **clean** |

Misma concurrencia, mismo número de escritores, mismo fichero. Lo único que
cambia es la distancia entre las líneas. **El problema es el formato.**

### 1.3 No hay arreglo por configuración

Los cuatro algoritmos de diff de git, sobre el caso contiguo:

| `diff.algorithm` | Resultado |
|---|---|
| `myers` (por defecto) | CONFLICT |
| `patience` | CONFLICT |
| `histogram` | CONFLICT |
| `minimal` | CONFLICT |

Ninguno ayuda. No existe la opción gratis.

### 1.4 `traceability.md` es el **único** punto de escritura compartida

Diff de una rama del harness contra su propia base:

```
.specops/harness-prompts/REQ-002-…-attempt-1-agent.md   ← nombre único por REQ
docs/specs/traceability.md                              ← el choque
src-1787287889585.txt                                   ← trabajo del agente
```

El archivo de prompts lleva REQ y marca de tiempo en el nombre, así que no
colisiona nunca. Los ficheros de código son colisiones **legítimas**: si dos
agentes editan el mismo módulo, eso es información, no ruido. Queda uno solo por
resolver, y es generado.

---

## 2. Opción A — driver de merge por filas *(recomendada)*

### Qué es

Un `.gitattributes` que marca el fichero, y un driver que mergea la matriz
**por filas** en vez de por líneas:

```gitattributes
docs/specs/traceability.md merge=csda-matrix
```

La clave de cada fila es `Requirement` + `Scenario ID`. Para cada fila:

- si solo un lado la cambió respecto de la base → gana ese lado;
- si ambos la cambiaron igual → esa;
- si ambos la cambiaron **distinto** → conflicto de verdad, con marcadores.

**La clave no puede incluir `Status`.** Lo aprendí rompiéndolo: el primer
prototipo usaba las dos primeras celdas de una tabla de prueba de dos columnas,
donde la segunda *era* el estado. Resultado: una fila con el estado cambiado
parecía una fila distinta, el merge salía «limpio» y **se perdía en silencio la
edición de la otra rama**. Con la matriz real de diez columnas el problema
desaparece, pero conviene que quede escrito: la clave son las columnas que nunca
cambian.

### Medido, con un prototipo funcionando

Sobre la matriz real de diez columnas, tres ramas, cada una marcando su
requisito:

| | git normal | driver por filas |
|---|---|---|
| merge de la 2ª rama | **CONFLICT** | **limpio** |
| merge de la 3ª rama | — | **limpio** |
| resultado final | — | los tres `Implemented`, correctos |

Y la propiedad que hace que no sea un truco: **dos ramas que cambian la misma
fila a valores distintos siguen dando conflicto**, con sus marcadores. Probado:
`REQ-002 → Implemented` contra `REQ-002 → Verified` conflictúa, como debe.

### La arruga práctica, dicha entera

`.gitattributes` se commitea, pero `merge.csda-matrix.driver` es **configuración
local de git**. Cada clon y cada job de CI tiene que registrarla. Medido qué pasa
si falta:

```
with .gitattributes but NO merge.<name>.driver:
  CONFLICT (content): Merge conflict in t.md
```

Es decir: **degrada al comportamiento de hoy, no a un merge silenciosamente
incorrecto.** El modo de fallo es seguro… **pero solo si no falta a medias.**
Git tiene tres estados y el de en medio es una trampa (medido en §11.1):

| `merge.csda-matrix.*` | Qué hace git |
|---|---|
| ni `name` ni `driver` | merge interno de siempre — el conflicto de hoy. **Seguro** |
| `name` sí, `driver` no | `fatal: custom merge driver csda-matrix lacks command line` — **el fichero no se puede mergear en absoluto** |
| ambos | corre el driver |

Un clon recién hecho está en el primero, que es el caso real y es seguro. El
segundo no lo alcanza nadie por accidente si el registro se hace en el orden
correcto — y por eso el orden es parte del diseño, no un detalle.

Aun así hay que resolverlo:

- `csda init` registra el driver en el repo que genera;
- un comando explícito (`csda harness setup-merge` o similar) para proyectos ya
  existentes y para CI;
- `csda doctor` **avisa** cuando `.gitattributes` pide el driver y git no lo
  tiene configurado — que es exactamente la clase de deriva que `doctor` ya
  existe para nombrar.

### Por qué encaja aquí y no es código nuevo de verdad

La decisión que toma el driver —base, nuestro, suyo, ¿quién gana?— ya está
escrita en este repositorio y probada rama a rama:
`packages/core/src/domain/Reconciliation.ts`, la que usa `specops sync`. Es el
mismo problema con otra granularidad: allí el unidad es un fichero, aquí una
fila. El driver debería llamarla, no reimplementarla.

Y hay un segundo beneficio: `resolveGeneratedConflicts()` en el harness —el
parche de `E1-03` que resuelve el choque de la base multi-dependencia quedándose
con la versión de la base— probablemente sobra con el driver puesto. Habría que
comprobarlo antes de quitarlo.

---

## 3. Opción B — no escribir el estado en la rama *(complementaria)*

### La observación incómoda

El harness llama a `csda done` **dentro del worktree**, después de que la puerta
pase. Pero `E1-03` ya dejó escrito lo que eso significa: *«su estado de matriz no
lo consulta nadie»*. La puerta corre **antes**. Nada en la rama depende de que la
fila diga `Implemented`.

O sea: el harness escribe en el único fichero compartido para dejar constancia de
algo que nadie lee ahí.

### Qué sería

Los workers no tocan `traceability.md`. Las ramas dejan de tener nada que
chocar — **cero conflictos por construcción, no por acierto del merge**. El
estado se marca una sola vez, en un solo sitio, después del merge: por una
persona (`csda done REQ-007`) o por un barrido que el propio informe de la
ejecución ya puede enumerar.

### Lo que se pierde, y por qué no la propongo sola

La rama deja de ser autocontenida. Hoy `harness/REQ-007` es «el requisito
entregado»: código, test y fila marcada. Si la fila se marca después, una rama
mergeada deja la matriz sin actualizar hasta que alguien pase, y
`validate --strict-tdd` sobre `main` protestará con razón. Se cambia un conflicto
ruidoso por un paso olvidable, y los pasos olvidables son peores: el conflicto se
ve, el olvido no.

Sigue siendo interesante **combinada con A**: A arregla el merge, B reduce la
superficie. Pero B sola traslada el problema en vez de resolverlo.

---

## 4. Opción C — registro append-only, matriz derivada

La propuesta clásica: el estado deja de ser una celda editable y pasa a ser un
registro de eventos; la matriz se **deriva**.

**Medido, porque la intuición aquí falla.** Mucha gente da por hecho que un
append-only mergea limpio. No:

| Escenario | Resultado |
|---|---|
| dos ramas añaden una línea al final | **CONFLICT** |
| lo mismo, con `merge=union` | **limpio y correcto** |

Un append-only **necesita `merge=union`** para cumplir su promesa. Y aquí sí es
correcto usarlo, porque cada línea es un evento distinto: quedarse con ambos
lados es exactamente lo que se quiere. Es justo lo contrario del caso de la tabla
(§6).

**Por qué no ahora.** La matriz de diez columnas no es un detalle interno: la
leen `done`, `plan`, `status`, `validate`, `alm sync`, el harness y los packs.
`done.ts` y `alm/core.ts` leen el Status como **penúltima celda** — el mismo
hecho que en `E1-01` descartó añadir una columna. Convertirla en artefacto
derivado es un cambio de formato mayor con un coste enorme, para resolver un
problema que A resuelve sin tocar el formato.

Merece quedar anotado como el destino correcto **si algún día** la matriz se
vuelve derivada por otras razones. No es la razón para hacerlo.

---

## 5. Opción D — un fichero por requisito

`docs/specs/status/REQ-001.md`, o la fila entera en su propio fichero. Cero
ficheros compartidos, cero conflictos.

Y cero tabla. La matriz de una sola pantalla es una de las cosas que hacen esta
herramienta legible para un humano y revisable en un PR. Cambiar eso para
resolver un conflicto de merge es pagar el precio equivocado. **No.**

---

## 6. Opción E — `merge=union` sobre la matriz *(no hacer)*

Es la primera idea que aparece al buscar «git merge conflict markdown table», y
es **activamente peligrosa**. Medido, sobre el caso contiguo:

```
  merged 'clean' — resultado:
| REQ-001 | Implemented |
| REQ-002 | Draft       |
| REQ-001 | Draft       |     ← duplicada, y contradictoria
| REQ-002 | Implemented |     ← duplicada, y contradictoria
```

El merge «funciona» y la matriz queda corrupta: cada requisito dos veces, con
estados que se contradicen. Cambia un conflicto visible por datos malos.

**Atenuante, comprobado:** la puerta lo caza. `csda validate` sobre esa matriz
falla con `duplicate_scenario_id` y su `fix`. Así que no es silencioso del
todo — pero el error aparece lejos de la causa, y «la puerta lo caza» no es
excusa para escribir datos malos a propósito.

Union es correcto para un log (§4) y erróneo para una tabla de estado. La
diferencia es si una línea es un **evento** o un **hecho actual**.

---

## 7. Opción F — separar las filas con líneas en blanco

Si el problema es la adyacencia, ¿y si las filas no son adyacentes? Una línea en
blanco entre filas rompe la tabla en Markdown: deja de renderizarse como tabla en
GitHub y en cualquier visor. Además es frágil —cualquier formateador la
quita— y no ayuda a dos ramas que sí toquen filas vecinas de verdad. **No.**

---

## 8. Recomendación y orden

1. **A, completa.** Driver de merge por filas, apoyado en `Reconciliation`, con
   `.gitattributes` generado por `init`, un comando de registro para proyectos
   existentes y CI, y un aviso en `doctor` cuando el driver falta. El modo de
   fallo (sin configurar → conflicto de hoy) hace que se pueda desplegar por
   fases sin romper a nadie.
2. **Comprobar si `resolveGeneratedConflicts()` sobra** una vez A está puesto.
   Un parche que ya no hace falta es deuda.
3. **B queda anotada, no hecha.** Su valor real aparece si algún día se decide
   que la rama no deba llevar el estado; hoy la propiedad «la rama es el
   requisito entregado» vale más que el conflicto que ahorra.
4. **C se guarda** como el destino correcto si la matriz se vuelve derivada por
   otro motivo.

### Lo que hay que medir antes de dar A por buena

- El driver contra un merge de **cinco o más** ramas a la vez, no tres.
- Qué hace con una fila **añadida** por una rama y no por la otra (el prototipo
  las anexa; hace falta decidir el orden y probarlo).
- `git rebase` y `git cherry-pick`, no solo `merge`: los drivers se aplican
  también ahí, y el harness recomienda revisar ramas, que mucha gente rebasa.
- Un `pull --rebase` en CI con el driver sin registrar, para confirmar que el
  fallo sigue siendo seguro.

---

## 9. Lo que este documento **no** propone

- **Un lock o un semáforo entre workers.** No hay condición de carrera: cada
  worker escribe en su propio worktree. Serializar no arreglaría nada porque
  nada compite en el tiempo — el choque ocurre después, al integrar.
- **Que el harness mergee.** Sigue sin mergear a la rama que revisa un humano, y
  esa promesa no se toca.
- **Bajar `--concurrency` por defecto.** Ya es 1; el riesgo del paralelismo es el
  cuello de botella del revisor (R2), no este conflicto.
- **Reordenar la matriz para separar los requisitos activos.** Es la opción F con
  otro nombre: depende de una propiedad accidental del fichero.

---

## 10. Preguntas abiertas

| # | Pregunta | Quién decide |
|---|---|---|
| T1 | ¿El driver vive en `packages/core` (dominio, junto a `Reconciliation`) o es un script de `scripts/`? Git lo invoca como proceso, así que necesita un ejecutable; el dominio debería llevar la decisión y el script solo la E/S | Decisión de arquitectura |
| T2 | ¿`init` registra el driver en la config de git del proyecto sin preguntar? Escribe configuración local de git, que es tocar algo que no es nuestro | Decisión de producto |
| T3 | ¿`doctor` avisa o falla cuando el driver no está registrado? Avisar deja pasar el conflicto; fallar castiga a quien solo quiere leer el proyecto | Decisión de producto |
| T4 | Filas **añadidas** en paralelo (`csda req add` en dos ramas): ¿qué orden tiene la matriz resultante? Hoy el prototipo anexa al final | Decisión de modelo |

---

## 11. Implementación de A *(2026-08-21)*

Hecha. `packages/core/src/domain/TraceabilityMerge.ts` (dominio, puro),
`scripts/merge-traceability.ts` (el proceso que git invoca), registro en
`csda harness init` y aviso en `csda doctor`.

**La decisión por fila no se reimplementó:** llama a `reconcile`, la misma de
`specops sync`. Encajó sin forzar nada porque es literalmente la misma pregunta
—base, nuestro, suyo— una granularidad más abajo. La única pieza propia es una
`MergeFn` que siempre declara conflicto: una fila es un hecho único, un estado
no se mezcla a medias.

**Respuestas a las preguntas abiertas**, tomadas al implementar:

| # | Decisión |
|---|---|
| T1 | Dominio en `packages/core`, ejecutable fino en `scripts/`. Git necesita un proceso; el proceso solo hace E/S |
| T2 | `harness init` registra el driver. Es donde se prepara un proyecto para el harness, y el driver solo importa cuando vuelven ramas en paralelo |
| T3 | `doctor` **avisa**, no falla. Sin el driver git usa su merge de siempre: el proyecto queda sin ayuda, no roto |
| T4 | Las filas que solo tiene el otro lado se **anexan al final de la tabla**, no intercaladas. La matriz no tiene un orden total que el driver pueda respetar, e inventar uno reordenaría un fichero que nadie pidió reordenar |

**Un fallo propio que conviene anotar, porque no se ve leyendo.** Puse las
constantes del driver *después* del `if (require.main === module)` del final del
fichero. Un `const` declarado más abajo está en zona muerta temporal cuando el
despacho corre al cargar el módulo, así que `.gitattributes` salió con la línea
literal `undefined` y el `git config` no se escribió. Lo cazó ejecutarlo, no
`tsc`: los tipos estaban bien.

**Verificado ejecutando, en tres niveles:** las diez pruebas de dominio; una
prueba end-to-end que hace `git merge` de verdad; y el flujo completo desde el
tarball empaquetado — `harness init`, tres ramas, tres merges limpios, los tres
requisitos `Implemented`, y `doctor` diciendo `✅ merge driver`.

**Los dos guardas están mutados.** Sin la línea en `.gitattributes`, falla. Con
el driver apuntando a un script inexistente, falla. Las dos mitades cargan peso.

**Pendiente, y consciente:** falta comprobar el driver contra `rebase` y
`cherry-pick` —git también los usa ahí— y con cinco o más ramas a la vez. Y hay
que mirar si `resolveGeneratedConflicts()` del harness ya sobra.

### 11.1 Lo que salió al verificar lo que quedaba pendiente

Los tres pendientes de §11 están cerrados, y uno destapó un defecto **mío**.

**Rebase, cherry-pick y cinco ramas: los tres limpios.** Git aplica el driver en
`rebase` y `cherry-pick` igual que en `merge`, así que no hacía falta nada
extra — pero eso había que comprobarlo, no suponerlo. Cinco ramas mergeadas en
secuencia: cinco limpias, cinco filas `Implemented` de seis.

**El defecto: `.gitattributes` sin driver puede dejar el repo peor que antes.**
Al probar el caso multi-dependencia con el driver «sin registrar» salió
`REQ-003 blocked — could not assemble its base`. Sin `.gitattributes` el mismo
proyecto pasaba. O sea: lo había roto yo.

La causa no era la que parecía. Git no ignora un driver declarado y ausente: si
`merge.<name>.name` existe **sin** `driver`, aborta con `fatal: … lacks command
line` y el fichero deja de poder mergearse — peor que el conflicto que esto
viene a quitar. Mi primera comprobación de «fallback seguro» fue floja: quité
solo `.driver` y dejé `.name`, es decir, medí el estado 2 creyendo medir el 1.

Dos arreglos:

- `installMergeDriver` escribe `driver` **primero** y `name` solo si aquello
  funcionó; si falla, **borra** cualquier `name` que hubiera. El estado 2 deja
  de ser alcanzable por el camino normal.
- `doctor` distingue los tres estados: sin registrar → aviso; registrado →
  correcto; **a medias → error**, porque ahí los merges son imposibles.

**Y la respuesta al tercer pendiente: `resolveGeneratedConflicts()` NO sobra.**
Con el driver puesto no llega a dispararse, pero un clon que no ha corrido
`harness init` está en el estado 1 — y ahí es lo único que hace que un requisito
con dos dependencias no se quede bloqueado. Verificado ejecutando en ambos
estados: con driver pasa, sin driver también. Es la red, y se queda.
