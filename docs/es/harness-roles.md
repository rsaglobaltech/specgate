<!-- translation-of: 8a4507056709 -->
# Carriles, roles y límites

Lo que puede hacer el agente del harness, y quién decide: divide el trabajo en carriles para
que ninguna sesión califique sus propios tests, limita lo que puede costar un requisito, mantén
al agente lejos de los archivos que definen su contrato y espera a que las personas que
ocupan cada rol aprueben.

**Necesitas:** un proyecto donde `specgate harness run` ya funcione
([El harness](harness.md), [Configurar el agente](agent-setup.md)).

## Un tester y un implementador

Un agente que escribe a la vez el código y los tests que lo juzgan puede hacer que los
tests coincidan con lo que haya escrito. `lanes:` divide cada intento en dos
sesiones, en este orden:

```yaml
# harness.config.yaml
lanes: [tester, implementer]
```

1. El **tester** escribe los tests que fallan que piden los escenarios del requisito,
   y nada de código de producción.
2. El **implementador** escribe el código que los hace pasar, y no cambia ningún
   test.

Cada rol se queda en su carril. Después del tester, cualquier archivo que escribió que no sea
un test se restaura; después del implementador, cualquier test que cambió se restaura. Cada
uno se informa como `lane_crossed`, nombrando el rol y el archivo. Los manifiestos de build
(`package.json`, `pom.xml`, `build.gradle`) quedan para cualquiera de los dos. Un
test es un archivo que la matriz derivada cuenta como tal: un nombre como `a.test.ts`,
`test_a.py`, `a_test.go` o `ATest.java`, o un archivo bajo `test/`, `tests/`,
`src/test/` o `e2e/`.

Cada sesión recibe `SPECGATE_LANE` (`tester` o `implementer`) en su
entorno, así que un solo comando de agente sirve para ambos. El registro de la ejecución nombra ambos
carriles en cada intento. `lanes:` se combina con `attempt_profiles`, y el
perfil del intento ejecuta ambos carriles. También se combina con `review_profile`,
cuyo revisor sigue ejecutándose primero en un reintento. El único valor aceptado es
`[tester, implementer]`. La 0.35 llamaba a esta clave `roles:`; la 1.0 rechaza la grafía
antigua y `specgate migrate 1.0` la renombra, porque `roles:` ahora nombra
personas (más abajo).

## Un presupuesto por requisito

```yaml
# harness.config.yaml
max_cost_usd: 5
```

El harness suma el `cost` que cada sesión informa en su línea final de uso,
que `specgate harness events` escribe para Claude Code. Cuando el total de un requisito
alcanza el límite, no empieza ninguna sesión más para él, sea el
implementador después del tester o un reintento. Si el límite se alcanza entre el
tester y el implementador, el implementador no empieza y el requisito
falla con `budget_exceeded`, lo que gastó y el límite, sin pasar por el gate.
Si lo alcanza la última sesión de un intento, el gate sigue juzgando ese
intento; después no empieza ningún reintento. Un agente que no informa de coste cuenta como gratuito, y
la ejecución avisa con `cost_unknown` una vez por requisito. `--budget-seconds` y
`--max-requirements` limitan la ejecución entera; esto limita un requisito.

La ejecución entera, y los tokens, también tienen techo (REQ-585):

```yaml
max_run_cost_usd: 20      # no requirement starts once the run's sessions reported $20
max_tokens: 2000000       # one requirement's input, output and cache tokens
require_known_cost: true  # a session that reports no cost fails (cost_unknown)
timeouts: { agent: 1800, setup: 600, tests: 300, review: 600 }   # seconds; else --timeout
```

Un agente que no puede ejecutarse ahora (sin cuota) cede el paso al siguiente perfil de
`attempt_profiles` (REQ-586).

## Lo que el agente no puede tocar

El agente trabaja contra un contrato, y editar el contrato haría que un gate en verde
no significara nada. Por defecto no puede cambiar `spec.md`, `AGENTS.md`,
`AI_RULES.md`, `features/**/*.feature`, `docs/specs/**`, `.specops.lock` ni
`harness.config.yaml`. Tampoco los archivos que dirigen a un agente:
`CLAUDE.md`, `.claude/**`, `.cursor/**`, `.github/**` y `.mcp.json`. Un
intento que lo hace falla con `agent_touched_protected_path`, y al siguiente
intento se le muestran los archivos, con el diff de los que editó. Un archivo nuevo bajo
las rutas del contrato está permitido —un archivo feature, un archivo bajo `docs/specs/`—
porque un requisito puede necesitarlo; editar o borrar uno existente no lo está.
Tampoco se permite un archivo de instrucciones nuevo: un `CLAUDE.md` o un hook que crea el
agente dirige la siguiente sesión tanto como uno editado.
`protected_paths:` sustituye la lista, y `allow_paths:` nombra excepciones.

**Su entorno.** El agente hereda las variables de la shell, credenciales
incluidas; cada ejecución nombra las que parecen secretos. `agent_env:` lista
lo que recibe en su lugar —esas, más `PATH`, las carpetas home y temporal, el locale
y las `SPECGATE_*` propias del harness (REQ-587):

```yaml
agent_env: [ANTHROPIC_API_KEY]
```

**En un contenedor.** `sandbox:` ejecuta el agente, su revisor y su adversario
en una imagen que contiene la CLI del agente, como tú, viendo el worktree, el prompt
y la carpeta de eventos en sus propias rutas y nada más, sin red
salvo con `network: default` (REQ-588). `dependency_cache: true` apunta la caché de descargas
de cada gestor de paquetes a `.harness/cache/`, así que un segundo worktree
instala desde disco (REQ-589):

```yaml
sandbox: { image: ghcr.io/acme/claude-agent:1, network: none, engine: docker }
dependency_cache: true
```

## Aprobaciones y paquetes de rol

Un requisito de un change 1.0 se construye una vez aprobado el change, cada
capa por su responsable ([revisar changes](reviewing-changes.md#a-person-approves-the-draft));
hasta entonces el harness lo omite con `harness_not_approved`.

Lo que un rol pide al trabajo va en `harness/<role>.md`, escrito una vez
(ADR-0045):

```markdown
---
role: security
owner: sec@acme.eu
version: 2
applies-to:
  capability: [payments]
---
Never log a card number. Validate every amount on the server.
```

Se aplica cuando todas las dimensiones que lista (`kind`, `capability`, `tag`)
coinciden con el requisito. El prompt lo recibe bajo "Role constraints", el
check de revisión da una línea de consejo por paquete, y la vista en directo, el
registro de la ejecución y `harness report` nombran cada paquete como `role@version`.

## Siguiente

- [El harness](harness.md): un turno en secuencia, worktrees y cadenas
- [Configurar el agente](agent-setup.md): perfiles, escaleras y revisores
