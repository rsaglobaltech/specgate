<!-- translation-of: ca7461eee516 -->
<!-- specgate:allow-placeholders — the article quotes the {{VAR}} template syntax. -->
<!--
  FOR PUBLICATION ON MEDIUM.

  Medium does not render Mermaid. Two options per diagram:
    The two `<!-- specgate:diagram … -->` markers are replaced with inline SVG when
    the site is built (see docs/diagrams/). For Medium, screenshot them
    from the published page, or link to the section on the docs site.

  Suggested tags: ai-agents, spec-driven-development, software-testing,
  developer-tools, domain-driven-design
-->

# El gate que aprobó trabajo que nunca comprobó

## Pasamos meses construyendo un pipeline para que un agente de IA escribiera código a partir de nuestras especificaciones. La primera vez que lo ejecutamos, funcionó. Ese resultó ser el problema.

Quiero contarte los diez minutos que cambiaron cómo pienso sobre la
programación con agentes, y los quince commits que salieron de ellos.

Pero antes necesitas saber qué habíamos construido, porque toda la historia gira
en torno a una decisión de diseño que tomamos mal.

---

## La apuesta

Todo el mundo ha notado lo mismo este año: un agente puede escribir mil líneas
antes de que termines de leer el ticket. El recurso escaso dejó de ser teclear y
pasó a ser **decir con precisión lo que quieres**.

La respuesta obvia es "escribe mejores especificaciones". Eso no es un plan. Este
es el porqué, en un ejemplo.

Un requisito de tu repositorio dice que el sistema rechaza los tokens caducados.
Dejó de hacerlo en marzo. Nadie se dio cuenta, porque nada lo vigilaba: el
documento no tiene referentes, así que no hay nada contra lo que comprobarlo.

Durante años eso era llevadero. Un desarrollador que lo leyera fruncía el ceño,
preguntaba a alguien y sabía la verdad en noventa segundos. Los documentos eran
pistas, y se nos da bien desconfiar de las pistas.

**Un agente no frunce el ceño.** Lee el requisito desfasado como la verdad,
construye tres funcionalidades encima y escribe tests que afirman el
comportamiento equivocado de forma convincente. No has automatizado la
ingeniería. Has automatizado la propagación de documentación desfasada, a
velocidad de máquina, con un mensaje de commit plausible adjunto.

Así que nuestra apuesta fue: una especificación tiene que dejar de ser un
documento y convertirse en un **modelo**, uno donde cada afirmación tenga algo
contra lo que comprobarse.

En concreto, tres prácticas en las que la mayoría ya creemos, conectadas de modo
que la integración continua pueda verificarlas enlace a enlace.

De **Domain-Driven Design**, el vocabulario: bounded contexts, agregados,
comandos y consultas, eventos de dominio, casos de uso con actores. No como
prosa, sino como registros con identificadores que se referencian entre sí. De
**BDD**, un escenario Gherkin por requisito, que es la mitad ejecutable. De
**TDD**, la regla de que un requisito no puede decir que está construido sin
nombrar el test que lo demuestra.

La unión es una matriz de trazabilidad de diez columnas, una fila por requisito:

<!-- specgate:diagram traceability-chain -->

Leída de izquierda a derecha, una fila es una frase: *este requisito se
demuestra con este escenario, en este archivo feature, realizado por este caso
de uso, que despacha este comando contra este agregado, emitiendo este evento,
implementado aquí, demostrado por este test, actualmente en este estado.*

Rompe un enlace y el build falla. Esa es la idea. **Una especificación no puede
volverse falsa en silencio, porque en el momento en que lo hace, CI se pone en
rojo.**

Las herramientas a su alrededor crecieron durante meses. Un linter que resuelve
las referencias: un evento emitido por un agregado que nadie declaró es un fallo
de build, igual que un símbolo no definido. Packs de dominio, para que los
requisitos de `auth` se instalen y se fijen a una versión como una librería en
lugar de copiarse y pegarse en once servicios. Un comando de gate,
`validate --strict-tdd`. Y por último un harness: apúntalo a un requisito, crea
un git worktree, le da un prompt a tu agente, ejecuta el gate y hace commit en
verde.

Neutral respecto al proveedor por construcción —el agente es cualquier comando
de shell que contenga un marcador `{prompt_file}`— y nunca hace merge. Deja una
rama para una persona.

Entonces lo ejecutamos.

---

## Ejecución uno: funcionó, y ese era el problema

Lo apuntamos a un proyecto real: un visor de especificaciones, quince
requisitos, todos procedentes de un pack de dominio. Claude como agente. Primer
requisito: cargar un `pack.yaml` desde disco y mostrar su contenido.

<!-- specgate:diagram harness-loop -->

El primer intento agotó el tiempo. El segundo pasó.

Abrí la rama esperando decepcionarme y no fue así. Dieciocho archivos,
repartidos según las fronteras hexagonales que exigían las reglas: lógica de
dominio sin imports del framework, un puerto, un adaptador, el componente React
en el borde. Definiciones de pasos escritas. Su escenario pasaba. No había
tocado los archivos feature ni las especificaciones, que era la única frontera
que habría invalidado todo el ejercicio.

Durante un momento, estuve encantado.

Luego comprobé si el gate había verificado de verdad algo de eso.

No lo había hecho.

Dos decisiones corrientes se habían combinado en un agujero. El gate ejecutaba
el build y los tests unitarios del proyecto, y ejecutaba
`validate --strict-tdd`. Pero strict-TDD solo exige un test cuando un requisito
pasa de `Draft`, y el requisito seguía en `Draft` en ese momento, porque el
harness lo marca como terminado *después* del gate. Mientras tanto, el comando
de test era una cadena fija sin forma de decir "ejecuta el escenario del
requisito que estás comprobando ahora".

Así que el bucle podía tomar un requisito, ver a un agente producir cualquier
cosa y marcarlo **Implemented sin haber ejecutado nunca su escenario**.

El trabajo era bueno porque el agente era bueno. Nada lo había comprobado. Y eso
es estrictamente peor que un fallo, porque habría informado de éxito con la
misma seguridad sobre basura, que es justo el fallo que la herramienta entera
existe para evitar, reproducido dentro de la herramienta.

Me quedé un rato con eso.

---

## Ejecución dos: el gate rechazó trabajo correcto

Con la corrección hecha —el comando del gate ahora sustituye `{feature_file}`,
así que ejecuta el escenario bajo prueba y solo ese— pasé al segundo requisito:
mostrar un error claro cuando un archivo de pack está mal formado.

Falló los dos intentos.

El código del agente era correcto. Ejecuté su escenario a mano y pasó. El gate
había ejecutado la suite **entera** en lugar de un escenario, y trece escenarios
sin implementar fallaron con él.

La causa era una sola clave de configuración. Cucumber te deja fijar `paths` en
su archivo de configuración, y un `paths` de configuración anula en silencio la
ruta que pasas por la línea de comandos. Lo había corregido en `main`; la
ejecución estaba apilada sobre una rama creada antes de la corrección, y una
rama lleva su propia configuración.

Ese es el comportamiento correcto de git y una trampa cara. Pero lo que me costó
tiempo de verdad fue otra cosa:

**Diagnosticarlo exigió una segunda ejecución completa del agente.** Una
ejecución fallida borraba el worktree y no hacía commit de nada, así que la rama
volvía idéntica byte a byte a su base. El informe decía
`Gate failed at: test command` y se paraba. Quince minutos de tiempo de agente
para recuperar información que la primera ejecución ya había tenido y había
tirado.

Dos defectos más, entonces. Un gate que falla tiene que decir **qué comando
ejecutó**: un gate que hace lo incorrecto en silencio falla exactamente igual
que un fallo real. Y un intento fallido tiene que **quedar en un commit**, no
borrarse, para que haya algo que leer.

---

## Ejecución tres: la cuenta se quedó sin dinero

Para la tercera ejecución las correcciones estaban dentro. Volvió a fallar, por
una razón que no había planeado probar:

```
❌ REQ-002  fail (2 attempts)  → harness/REQ-002
     Agent exited 1.
     │ You've hit your monthly spend limit · raise it at claude.ai/settings/usage
     └ full output: --format json · reproduce: --keep-worktrees
     ↳ the attempt is committed on harness/REQ-002 — review it
```

Fue la mejor prueba posible.

Antes de las correcciones eso habría impreso `Agent exited 1`, y 861 líneas de
trabajo perfectamente bueno habrían ido a la papelera con el worktree. En su
lugar, la causa está en pantalla y el trabajo está en una rama.

---

## El recuento

Tres ejecuciones. Diez defectos, todos en nuestra maquinaria y no en el agente.

El gate que aprobaba sin verificar. El gate que rechazaba trabajo correcto y no
sabía decir por qué. Un harness que **bloqueaba su propia segunda ejecución**,
porque archivaba prompts en el directorio del proyecto y luego se negaba a
arrancar con el árbol sucio. Un test que se había *debilitado* en silencio para
acomodar eso, filtrando el directorio culpable de su propia comprobación de
árbol limpio para poder pasar: así es como el desastre había seguido invisible.
Un informe que guardaba la salida completa del fallo e imprimía solo su primera
línea. Un timeout por defecto que las dos ejecuciones desmintieron.

Ninguno se veía leyendo el código. Lo sé, porque había leído el código. Varios
los había escrito yo mismo, con tests, en las semanas anteriores.

---

## Lo que creo ahora de verdad

**Ejecutarlo una vez vale más que un mes de diseño.** No es un tópico sobre
testing; es concreto. No eran casos límite. Eran dos decisiones corrientes que
se encontraban en medio, y el único instrumento que lo detecta es la ejecución.

**Lo que se escribe sobre la estrategia en este tema termina un paso antes de
tiempo.** Hay mucho, y es bueno: el argumento de que las especificaciones se
convierten en la interfaz entre personas y agentes está hecho y estoy de
acuerdo. Pero termina en la arquitectura. Nadie escribe lo que pasa el martes
cuando ejecutas la cosa, y el martes es donde está la información.

**"Al final los agentes escriben todo el código y las personas revisan
especificaciones" va en la dirección correcta y todavía no está ganado.** Si
quitas a la persona de la autoría, el gate se convierte en lo único que hay
entre la salida de un agente y tu rama principal. Descubrimos al ejecutarlo que
el nuestro aprobaba trabajo que no había verificado. Así que la secuencia es la
inversa de como se suele vender:

> No te ganas el derecho a quitar la autoría humana adoptando
> especificaciones. Te lo ganas demostrando que tu gate distingue el buen
> trabajo del malo, y la única forma de demostrarlo es ejecutarlo, una y otra
> vez, y contar cuántas veces se equivoca en cada dirección.

Ahora medimos exactamente eso. Es la métrica que importaba, y la que no
teníamos el día en que nos habría salvado.

**La calidad de los escenarios dejó de ser una preferencia de estilo.** Todos los
equipos acumulan cosas así:

```gherkin
Scenario: Test login
  Given the system is ready
  When something happens
  Then it works
```

Antes era un mal olor. Con un agente leyéndolo, es un defecto: una persona
pregunta a un compañero qué significa "it works", y un agente elige una
interpretación, la implementa con seguridad y pone el escenario en verde. Así
que los títulos genéricos, la falta de `When`, la falta de `Then` y los pasos
vagos son ahora reglas de lint que rompen el build con `--strict`.

---

## Si quieres trastear con ello

Tiene licencia MIT y está en npm. El planteamiento honesto: un proyecto propio
de dogfooding y un piloto, nadie fuera de nuestros repositorios lo ha usado en
serio, y todo lo de arriba es lo que medimos sobre nuestro propio trabajo.

```bash
npx @rsaglobaltech/specgate@latest onboard   # reads your repo, proposes capabilities, writes nothing
npx @rsaglobaltech/specgate@latest init      # adopts it: writes the spec skeleton, touches no source
npx @rsaglobaltech/specgate@latest check     # the gate: validate --strict, then your tests
```

<!-- specgate:note -->
**Desde que se escribió esto.** La herramienta pasó a llamarse Specgate (antes era
`create-spec-driven-app`), y el gate se convirtió en un solo comando, `specgate check`:
`validate --strict` —que incluye la regla strict-TDD de la que trata este
artículo— seguido de tu propia suite de tests. Desde entonces se ha ejecutado en
[seis productos construidos a partir de briefs de clientes](../projects/index.md),
cada uno con su lista de lo que se rompió. El artículo se conserva tal como se
argumentó.
<!-- specgate:endnote -->

Empieza por el gate, no por el agente. Un check de pull request que falla cuando
un requisito pierde su test vale más que cualquier cantidad de orquestación
encima de especificaciones en las que todavía nadie confía. La mayoría de los
equipos deberían quedarse ahí una temporada.

Y sea cual sea la herramienta que estés evaluando, incluida esta, la pregunta
que yo haría no es qué aspecto tiene el formato de la especificación.

**Es: ¿alguien ha ejecutado el bucle, y qué se rompió?**

Si la respuesta es nada, no lo han ejecutado.
