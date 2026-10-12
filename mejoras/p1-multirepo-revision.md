<!-- specgate:allow-placeholders -->
# P1 (multi-repositorio), revisado con el puerto ALM ya hecho

> **Creado:** 2026-08-21 · **Tarea:** `E2-05` de
> `mejoras/escalado-multiagente-conectores.md`
> **Encargo:** revisar P1 ahora que el puerto ALM da un identificador supra-repo
> declarado en vez del apaño actual.
> **Veredicto:** el puerto **no** desbloquea P1, y la razón es que el apaño
> nunca fue el problema. Pero medirlo destapó que **una parte de P1 ya funciona**
> y que la siguiente pieza barata no es multi-repo, es una inconsistencia.

---

## 0. Resumen

| Pregunta | Respuesta medida |
|---|---|
| ¿El puerto ALM desbloquea P1? | **No.** Da un identificador *declarado*, pero P1 necesita ids de requisito supra-repo, correlación de estados y matriz federada. El identificador era la parte fácil |
| ¿Qué parte de P1 ya funciona? | **La validación federada.** `projects:` acepta rutas relativas y no comprueba que apunten dentro del repo: `validate` ya recorre repos hermanos, medido |
| ¿Qué falta de verdad? | Que `plan`, `status` y `report` hagan lo mismo — hoy **solo `validate` lee `projects:`** — y, por debajo, que un `REQ-001` signifique algo fuera de su repo |
| ¿Sigue siendo v2? | **Sí**, pero es más pequeño de lo que §12.12 supone |

---

## 1. Lo que ya funciona, y no estaba anotado

`specops.config.yaml` admite `projects:`, y `csda validate` se despliega sobre
la lista. Lo que §12.12 no dice es que **esas rutas son relativas y nadie
comprueba que sean del mismo repositorio**. Medido con dos repos hermanos:

```
root/specops.config.yaml → projects: [../service-a, ../service-b]

🗂️ Monorepo: validating 2 project(s) from specops.config.yaml
── ../service-a ──   ✅ Validation passed
── ../service-b ──   ✅ Validation passed
✅ 2/2 project(s) passed
```

`service-a` y `service-b` son repositorios git independientes. **La puerta ya
cruza repos.** No es una función que haya que construir: es una que ya existe y
que nadie ha nombrado, probablemente porque se diseñó pensando en monorepos.

Eso cambia el tamaño de P1: la parte que de verdad importa —que CI pueda decir
la verdad sobre N repos— **está hecha**.

---

## 2. Lo que no funciona, medido

### 2.1 Solo `validate` lee `projects:`

```
plan     requisitos vistos: 1     ← solo el proyecto raíz
status   requisitos vistos: 0
report   (no produce JSON aquí)
```

Un solo fichero de todo el árbol menciona `cfg.projects`:
`ValidateSpecsCommand.ts`. Quien configura `projects:` y ve a `validate`
recorrer sus tres repos espera razonablemente que `status` le diga en qué punto
están los tres. No lo hace, y nada se lo advierte.

**Esto es una inconsistencia, no un cambio de modelo.** Es la pieza más barata
que queda y no necesita ningún identificador nuevo.

### 2.2 Un `REQ-001` no significa nada fuera de su repo

Dos repos declarando ambos `REQ-001` validan limpio. Nadie lo nota, y **hacen
bien**: hoy la unidad es el proyecto, así que cada uno tiene su propio espacio
de nombres y `REQ-001` en `service-a` y en `service-b` son requisitos distintos
que casualmente comparten nombre.

Conviene decirlo claro porque es tentador «arreglarlo»: **no es un defecto bajo
el modelo actual.** Se convierte en uno el día que exista una vista federada, y
ese día es el cambio de modelo que P1 describe.

### 2.3 La correlación existe en disco y nadie la lee

Los dos repos pueden apuntar al mismo issue, y lo hacen sin protestar:

```
service-a  {"REQ-001":{"issue":"ACME-42","url":null}}
service-b  {"REQ-001":{"issue":"ACME-42","url":null}}
```

`csda alm status` en cualquiera de ellos enseña `REQ-001 [open] → ACME-42` y no
sabe que el otro existe. **El identificador supra-repo ya está ahí; lo que falta
es alguien que lo lea de los dos lados.**

---

## 3. Qué cambia el puerto ALM, y qué no

§3.1 del plan de escalado decía que el puerto convertiría el apaño en «una
capacidad declarada» y que era «el único camino barato hacia P1 antes de v2».
Revisado con el puerto hecho: **la primera mitad es cierta, la segunda no.**

| | Antes de E0-02 | Ahora |
|---|---|---|
| Identificador supra-repo | El issue, por casualidad | El issue, por contrato: `IssueRef` en un puerto versionado |
| Enumerar el tablero | No existía | `listIssues`, añadido en E2-03 |
| Correlacionar repos | No | **Sigue sin haber** |
| Matriz federada | No | **Sigue sin haber** |

Lo que el puerto compró de verdad fue **E2-03** (`alm pull`) y **E2-04**
(proveedores de comunidad). Para P1 compró el trozo que ya era barato.

**Por qué no basta:** el issue identifica *trabajo*, no *requisitos*. Dos repos
apuntando a `ACME-42` dicen «ambos contribuimos a este ticket», no «ambos
implementamos el mismo requisito». P1 necesita lo segundo, y un tablero no lo
tiene: es justo lo que ADR-0021 impide que el tablero defina.

Ahí está la contradicción que hay que nombrar, porque quien lea §3.1 va a
tropezar con ella: **construir P1 sobre el issue del ALM sería hacer del tablero
la fuente de verdad del modelo de requisitos**, que es exactamente lo que
ADR-0021 prohíbe. El apaño es aceptable *como apaño* — un identificador de
conveniencia entre repos — y deja de serlo en cuanto se le pide definir qué es
un requisito.

---

## 4. Recomendación

### 4.1 Ahora: cerrar la inconsistencia, no abrir P1

Una entrada nueva, `E2-06`: **`plan`, `status` y `report` honran `projects:`
como ya hace `validate`.**

- No es un cambio de modelo: cada proyecto sigue respondiendo por sí mismo y el
  comando agrega los resultados, exactamente como `validate` hace hoy.
- Cierra una expectativa que la configuración ya crea.
- Entrega la mayor parte del valor práctico de «multi-repo» —ver el estado de N
  repos de una vez— sin tocar el modelo de requisitos.
- Coste comparable al fan-out que ya existe, y con el mismo patrón a copiar.

### 4.2 Documentar que `projects:` cruza repos

Hoy el mensaje dice «🗂️ Monorepo», que es exactamente lo que hace pensar que no
sirve para repos separados. Es una línea de documentación y un cambio de
palabra, y evita que alguien construya lo que ya tiene.

### 4.3 P1 completo: sigue en v2, y con una condición

El día que se aborde, la decisión de modelo que hay que tomar **antes** de
escribir código es de dónde sale el identificador supra-repo. Tres opciones, y
la tercera es la que encaja con lo que este repositorio ya cree:

| Opción | Qué implica |
|---|---|
| El issue del ALM | Barato, y **rompe ADR-0021**: el tablero pasaría a definir requisitos |
| Un id global nuevo (`ORG-REQ-001`) | Rotura de formato en la matriz — el mismo hecho que en `E1-01` descartó una columna 11 |
| **Un requisito federado que declara a quién implementa** | `<!-- specgate:trace implements=acme/billing#REQ-014 -->`. El comentario `csda:trace` ya es el punto de extensión, ya acepta claves arbitrarias, y ya lo usa `depends=` para el grafo. **El requisito declara, la matriz refleja** — la regla que este repositorio aplica en todo lo demás |

La tercera no necesita formato nuevo ni identificador nuevo: necesita decidir
que un requisito puede apuntar a otro de otro repositorio, y que la vista
federada se **deriva** de esas declaraciones. Merece su propio ADR antes de una
sola línea.

---

## 5. Lo que se rechaza

- **Construir P1 sobre el issue del ALM.** Es el camino barato y el que rompe
  ADR-0021. El apaño sirve como conveniencia; no como modelo.
- **Prohibir ids de requisito repetidos entre proyectos.** Hoy es correcto: cada
  proyecto es su propio espacio de nombres. Reportarlo como deriva sería inventar
  un defecto.
- **Una matriz federada escrita a disco.** Sería un cuarto sitio donde vive el
  estado. Si algún día existe, se deriva y se regenera — la misma conclusión a la
  que llegó `mejoras/sustituir-traceability-md.md`.
- **Renombrar `projects:` a algo multi-repo.** Rompería las configuraciones que
  ya existen para arreglar una palabra. Se arregla el mensaje y la documentación.

---

## 6. Cómo queda P1 tras la revisión

§12.12 dice: *«No es una función: implica un identificador por encima del repo,
correlación de estados y una matriz federada. Es cambio de modelo.»*

Con lo medido, se puede escribir con más precisión:

| Pieza | Estado real |
|---|---|
| Recorrer N repositorios | **Hecho** — `projects:`, y ya cruza repos |
| Validación federada | **Hecha** — `validate` agrega y falla si alguno falla |
| Lectura federada (`plan`/`status`/`report`) | **Pendiente y barato** → `E2-06` |
| Identificador supra-repo | Existe como apaño (issue). Como modelo, **pendiente y caro** |
| Correlación de estados | **Pendiente**, depende del anterior |
| Matriz federada | **Pendiente**, y debería ser derivada, no escrita |

Sigue siendo v2. Pero de seis piezas, dos están hechas, una es barata, y solo
tres son el cambio de modelo — que es bastante menos de lo que «orquestación
multi-repositorio» sugiere.
