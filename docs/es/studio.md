<!-- translation-of: 9a02afacd51f -->
# El studio

**Studio** es Specgate como app en tu navegador: desde una carpeta vacía hasta el
informe de lo que se ha construido, sin teclear un comando. Todo lo que hace ejecuta
el mismo comando de specgate que ejecutarías tú, así que la app y el terminal nunca
discrepan. Al final de esta página podrás abrirlo en una carpeta nueva, escribir el
brief, hacer que se redacten los módulos, responder las preguntas, aprobar, construir,
seguir la ejecución en directo y leer el informe.

**Necesitas:** Specgate instalado (`npm i -g @rsaglobaltech/specgate`), git y,
para redactar y construir, un agente que puedas ejecutar desde la línea de comandos (Claude
Code o Codex; consulta [Elegir y conectar tu agente](agent-setup.md)). Docker,
si quieres los [checks de calidad](quality.md).

```bash
cd my-new-project        # an empty folder, or a specgate project
specgate studio          # opens http://127.0.0.1:4173
```

Las capturas salen de una pequeña tienda de demostración: un módulo `orders` con dos
preguntas abiertas, construido por un agente de pruebas.

## Una app, una sección por paso

![La Home del studio: la barra lateral con sus ocho secciones, el siguiente paso que dar —redactar los módulos del brief—, el proyecto en cifras, los siete pasos de la ruta con su estado y el progreso de cada módulo.](assets/img/studio-home.webp)

La barra lateral contiene ocho secciones, cada una en su propia dirección (`/#/questions`,
`/#/live`…), así que Atrás, Adelante, recargar y un enlace abren el mismo sitio.
**Home** dice lo único que hay que hacer a continuación y dónde está el proyecto.

| Sección | Qué haces allí | Qué ejecuta |
| --- | --- | --- |
| Home | Ver el siguiente paso y la ruta, y el ticket que nombra la rama; ejecutar el gate y el doctor | `specgate status`, `check`, `doctor` |
| Brief | Escribir lo que debe hacer la app, o pegar el texto del cliente | `propose --from-brief` (con el agente) |
| Changes | Todos los changes: redactar un módulo, revisar, aprobar, entregar un requisito, validar, archivar; un change nuevo a partir de una idea o un ticket | `propose`, `propose --from-ticket`, `change note`, `change approve`, `apply`, `change validate`, `archive` |
| Questions | Decidir lo que el brief dejó abierto, confirmar que el spec lo dice | `specgate answer`, `answer --reviewed` |
| Build | Elegir quién programa, escoger lo que está listo, empezar | `config set agent`, `harness run --chain` |
| Live | Seguir la ejecución, responder al agente, detenerlo | los eventos del harness, `harness` stop |
| Report | Qué se construyó, cómo se demostró, qué falta; el gate | `specgate report`, `check` |
| Settings | Crear o adoptar el proyecto; sus agentes, preferencias, checks de calidad y ALM | `init`, `adopt`, `config set`, `agents init`, `quality init`, `alm sync` |

Cada acción ejecuta un comando `specgate` de una lista fija, con sus argumentos
comprobados; el studio muestra el comando exacto, su salida según crece y cómo
terminó. Cualquier cosa fuera de esa lista se rechaza, incluso desde la propia
página del studio.

**Simple** no muestra comandos; **Advanced** añade el editor markdown del brief,
los ids y el comando de cada agente. **ES · EN** cambia el idioma, el
sol y la luna el tema (sigue al sistema hasta que eliges), y **‹**
pliega la barra lateral a sus iconos. Todo ello se recuerda en tu navegador.

## Settings · un proyecto desde una carpeta vacía

En una carpeta vacía el studio hace cinco preguntas: el nombre; qué estás
construyendo (un sitio web, un servicio o una app móvil); la tecnología (Node.js y
React, Java y Spring Boot, Python y FastAPI, o la tuya); qué agente
programa —el que se encuentra en esta máquina ya viene elegido—; y el nivel de
calidad. Después crea allí el proyecto, con un brief por rellenar.

Una carpeta que ya contiene código se adopta tal cual, nunca se genera encima:
**See what adopt writes** lista cada fichero que añadiría `specgate adopt`, y después
**Adopt this folder** los escribe: ningún fichero sobrescrito, ningún código tocado.

En un proyecto, Settings
lista los agentes —los perfiles de `.harness/profiles.yaml`, cuál es el
predeterminado y cuál emite tokens y coste, y un comando propio definido en
`harness.config.yaml`— con **Change the assistant**; y los checks de calidad:
cuándo se ejecuta cada uno, si bloquea o aconseja, y si Docker responde.

![Settings en un proyecto: el comando del agente que contiene harness.config.yaml, Change the assistant y cómo añadir un perfil; después Code quality —Docker no responde aquí— con los niveles basic y strict para activar.](assets/img/studio-settings.webp)

Debajo, **las preferencias del proyecto** tal como las guarda `specgate config`: los
tests que ejecuta el gate, la comprobación de arquitectura, el perfil de ayuda, el idioma,
el guard del agente, Gato; cada una se guarda con `config set`, y una clave o un valor
desconocidos se rechazan. **The agents** instala los guards para este proyecto, para Claude Code
u OpenCode (`agents init --tool claude-plugin`), y conecta las herramientas del agente
(`agents init`). Los guards para todos tus proyectos se quedan en un terminal:
`specgate agents install --global`.

![Las preferencias del proyecto: los comandos de tests y de arquitectura, el perfil de ayuda, el idioma, el guard del agente y Gato, cada uno con Save.](assets/img/studio-preferences.webp)

Con un `alm.config.yaml`, una tarjeta **Jira / Azure Boards** muestra el proveedor,
el proyecto y si la variable del token —por ejemplo `JIRA_TOKEN`— está definida en
el entorno desde el que se arrancó el studio. Nunca pide el token, ni lo muestra
ni lo guarda. **See the mapping** (`alm status`), **See what sync would do**
(`alm sync --dry-run`), y después **Sync**.

## Brief

El brief es el origen de todo requisito: lo que no está en él no se construye.
El formulario —el producto en una frase, quién lo usa y dónde, los módulos
con sus **reglas**, **ejemplos** y **preguntas abiertas**— se guarda solo en
`docs/brief.md` mientras escribes, conservando todas las demás líneas del fichero. Un módulo
escrito a mano bajo `## orders` pasa a ser su sección `## Module: orders`, con su
texto dentro. O pega el email o las notas del cliente y deja que el agente
proponga el formulario. Al lado, los checks del brief se ejecutan en cada guardado, y **Next:
draft the modules** espera mientras alguno de ellos sea un error.

![El Brief: una caja para pegar el texto del cliente, el producto, quién lo usa y en qué superficies, los módulos y las reglas del seleccionado; al lado, los checks están todos en orden y Next: draft the modules.](assets/img/studio-brief.webp)

## Changes · cada change, hasta su archivo

Los módulos del brief a la izquierda, cada uno con dónde está: por redactar, en
redacción, borrador por revisar, aprobado, archivado. **Draft** pasa uno al agente
en segundo plano, de uno en uno, con su progreso mientras escribe; **Stop**
lo termina, junto con cada proceso que el agente arrancó.

Un borrador por revisar muestra su ciclo y después **To approve**: todo lo que lo
retiene, cada cosa con la acción que la resuelve —**Answer Q1** para una pregunta abierta,
**The spec says it** para una respuesta que el requisito aún no refleja, el
fichero que abrir para un check que falla—. **Approve the draft** dice lo que aún
falta en lugar de quedarse gris sin motivo. Un change 1.0 también lista
sus capas —Discover, Design, Tasks—, cada una con el rol que la posee, sus
aprobaciones frente al quórum y quién las dio, y **Approve** en cada capa
cuyo rol tienes ([Carriles, roles y límites](harness-roles.md)). Debajo, cada
requisito con sus ejemplos como Given / When / Then, y **Ask for a change**
bajo cada uno.

![Changes: el borrador de orders por revisar, dos preguntas abiertas cada una con Answer, Approve the draft esperando con "2 things missing", y los requisitos del borrador con sus ejemplos.](assets/img/studio-changes.webp)

Todos los changes del proyecto están aquí, no solo los del brief: los demás se
listan bajo **Other changes**, cada uno con cuántos de sus requisitos están
entregados. Un change se abre en sus requisitos y su estado, su
propuesta y sus tareas. **Deliver** ejecuta `specgate apply` sobre un requisito
programado a mano —primero su test, después el gate, después Implemented— o dice por qué
se rechazó (ningún test lo nombra aún, una etapa que falló). **Validate** comprueba
sus deltas. Cuando todos los requisitos están entregados, **See what archive writes**
previsualiza el archivo, y solo entonces **Archive** lo fusiona en el spec.
**+ New change** abre uno a partir de una idea, por su id o —con un ALM
configurado— a partir de la clave de un ticket.

![Un change: sus tres requisitos, cada uno en Draft con Deliver, la propuesta, Validate, y el archivo esperando hasta que se entregue cada requisito.](assets/img/studio-change-panel.webp)

### Un change a partir de un ticket

Con un `alm.config.yaml`, **+ New change** acepta la clave de un ticket: `KAN-13`.
**Review the ticket** ejecuta `specgate propose --from-ticket KAN-13 --check`,
que no escribe nada: si el ticket está listo, cada hallazgo con su corrección,
y la capacidad en la que entra el change. Cuando la épica del ticket no nombra ninguna,
elige una de las capacidades del proyecto; un ticket que no está listo no se puede
abrir: corrígelo en Jira y revísalo de nuevo.

Antes de abrir nada, el studio dice lo que va a hacer: la rama —aquella en la que
estás cuando nombra el ticket, como `feature/KAN-13` o
`feature/parking/KAN-13` de agentkit (entonces `--no-branch`, y no se crea ninguna otra
rama), o la que va a crear— y que hace commit de la carpeta del change
y de nada más, y después hace push de la rama a `origin`. **Don't push
yet** la mantiene en local (`--no-push`). **Open the change** pregunta una vez más; solo
entonces se ejecuta.

Home nombra el ticket y el equipo cuando la rama en la que estás nombra un
ticket, y un change abierto a partir de uno muestra su clave en Changes, enlazada al
ticket cuando `base_url` es el de Jira.

## Questions

Todo lo que espera una decisión: lo que preguntó el brief, lo que un borrador no
pudo resolver, lo que preguntó el agente mientras construía. Elige una de las opciones
que vio Specgate o escribe la tuya; **Enter** la guarda en la fila de la pregunta en
`questions.md`: el studio añade las columnas `Answer` y `Status` cuando la
tabla no las tiene, y conserva los finales de línea del fichero.

![Questions: cada pregunta abierta con el requisito que bloquea, sus opciones y la caja de respuesta.](assets/img/studio-questions.webp)

Una pregunta respondida pasa a **Answered · confirm the spec says it**, una sola vez,
tanto si la respondiste aquí como a mano. Cuando el texto del requisito dice la
respuesta, **The spec says it** la marca como revisada y quita `Needs Clarification`
de los requisitos que retenía.

![Las preguntas respondidas, una fila cada una, con The spec says it.](assets/img/studio-questions-confirm.webp)

## Build

En un proyecto que aún no tiene agente, Build ofrece Claude Code, Codex o un comando
propio, con el que se encuentra en esta máquina ya elegido; **Use this assistant**
lo escribe en `harness.config.yaml`. Después, lo que está listo para construir —aprobado,
sin esperar ninguna respuesta—, cada cosa escogida, con una estimación, y **Build** arranca
el harness en segundo plano. Antes de arrancar, el studio hace commit de la
especificación que escribió (el brief, las aprobaciones, las respuestas) con tu
identidad de git; cualquier otro fichero sin commit detiene el build, nombrado.

![Build sin agente todavía: Claude Code, Codex o tu propio comando, y Use this assistant.](assets/img/studio-build-agent.webp)

![Build con un agente: el requisito listo para construir, escogido, y Build 1 requirement.](assets/img/studio-build.webp)

## Live

La ejecución según ocurre, empujada por el servidor: sin recargar. La cabecera se queda a la
vista con las cifras de la ejecución —pasados, en curso, fallidos, el tiempo, los tokens
y el coste— y **Stop after this requirement** o **Stop now**, que pregunta
primero: lo que el agente ha dejado a medias no se conserva.

- **By module**: una fila por módulo, un cuadrado por requisito —pasado,
  en curso, fallido, preguntando, bloqueado o en cola—, incluidos los que la ejecución aún no ha
  alcanzado. Un cuadrado abre su requisito.
- **El requisito**, en pestañas: **Steps** —el agente y después cada paso del gate por
  su nombre, el que se está ejecutando con cuánto lleva, los que faltan
  por llegar— y el log del agente, que sigue el final hasta que subes;
  **Requirement**; **Tests and files**; **Attempts**; **Agent**: el modelo,
  su contexto frente a su ventana, los tokens y el prompt que recibió.
- **La cola de trabajo**: **Now**, **Needs attention** —la pregunta del agente,
  respondida allí mismo, fallos, requisitos bloqueados—, **Up next** con una
  estimación, **Open questions**, cada una con su formulario de respuesta, y **Finished
  recently**.
- **Traceability**: la matriz tal como está, un desplegable por módulo, cada escenario
  con su feature, sus tests y su estado, filtrado mientras escribes.

![Live: un requisito en ejecución, las cifras de la ejecución, la matriz por módulo, los pasos del requisito y la cola de trabajo.](assets/img/studio-live.webp)

![Live en el tema oscuro, la barra lateral plegada a sus iconos y el log del agente debajo de los pasos.](assets/img/studio-live-dark.webp)

![Traceability: los escenarios de cada módulo con su feature, sus tests y su estado, filtrados mientras escribes.](assets/img/studio-live-trace.webp)

`/live` abre esta sección directamente. En un repositorio workspace se abre en el
workspace: el harness de cada repositorio —qué construye, su cola, qué pasó
y qué falló, cuánto costó— y las partes de cada historia con lo que esperan. El
nombre de un repositorio lleva a su propio Live en `/live/repo/<name>/`, de solo lectura,
con una forma de volver ([Workspace](workspace.md)).

## Report

Lo construido sobre el total, los ejemplos demostrados, si el gate pasa, el coste
y el tiempo del agente y, cuando se ejecutaron los checks de calidad, la cobertura y la
puntuación de mutación del código. Después cada módulo, lo que la app ya hace y el ejemplo que
demuestra cada requisito, lo que falta y por qué, y las decisiones tomadas.
**Download the report** lo guarda como una única página HTML que se abre en cualquier sitio;
**Print / PDF** lo abre para imprimir.

![El Report: las cifras, la tabla por módulo y lo que hace la app.](assets/img/studio-report.webp)

**The gate** —en Report y en Home— ejecuta `specgate check` como lo haría CI: cada
etapa pasada, fallida o sin configurar, y bajo lo que falló, la corrección que
trae. **Doctor** ejecuta `specgate doctor` de la misma forma.

![El gate ejecutado desde el studio: Ids not compared, Specification passed, Architecture not checked, Tests not configured, y el gate pasa.](assets/img/studio-gate.webp)

## Decir lo que hace

- Mientras una sección se lee por primera vez ves su forma, no una página
  en blanco.
- Un botón se queda ocupado mientras se ejecuta su petición y no se puede pulsar dos veces;
  después un aviso dice lo que pasó. Un éxito se va solo; un fallo se queda
  hasta que lo cierras, con **Try again**.
- Una lectura que falla dice por qué dentro de su propia sección, con **Read it again**;
  el resto de la página sigue funcionando.
- Si el servidor del studio deja de responder, la página dice que se está reconectando y
  marca lo que muestra como posiblemente desactualizado; cuando el servidor vuelve a responder
  lo dice y vuelve a leer la sección. Un studio arrancado de nuevo tiene un token de
  escritura nuevo, y la página lo toma.
- Lo que dicen los checks llega en tu idioma, con los mismos ids.

## Teclado y lectores de pantalla

**Skip to the content** es lo primero a lo que llega Tab; el foco siempre es
visible; una sección que abres lleva el foco a su título; una pregunta respondida
mantiene el foco en su fila; cada resultado se anuncia una vez, con su aviso. Las
pestañas del requisito se mueven con las flechas. Con movimiento reducido pedido por el
sistema, nada se mueve.

## Velocidad

El studio lee el estado del proyecto en su propio proceso y lo conserva hasta que
cambia un fichero de la especificación, así que refrescar cuesta milisegundos, también en
Windows.

## Seguridad

Studio responde solo en `127.0.0.1`, y rechaza cualquier otro nombre de host. Cada
acción que escribe es un `POST` con un cuerpo JSON, el token que recibe la página
cuando arranca el studio y un origen loopback; cualquier otro método se rechaza. La
app no carga nada de otro host, y nada de lo que contiene un proyecto o un evento
se lee nunca como HTML.

## Siguiente

- [El studio para un equipo](studio-team.md)
- [Checks de calidad y seguridad](quality.md): lo que activa el nivel de calidad.
- [El harness](harness.md): lo que ejecuta Build, en el terminal.
- [De un brief de cliente a un spec](from-a-brief.md): el brief y los borradores,
  en el terminal.
