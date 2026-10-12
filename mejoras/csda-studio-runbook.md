<!-- specgate:allow-placeholders — this file documents the {{VAR}} template syntax. -->
# CsdaStudioApp dogfood — full runbook

> Local-only runbook. **No subir a GitHub.** Recoge cada fase con las
> llamadas exactas a `csda` y comandos auxiliares: las ya ejecutadas
> (Phases 0–4) y las que faltan (Phases 5–10).
>
> Variables de proyecto reutilizadas en todas las fases:
>
> - `PROJECT_NAME="Csda Studio"`
> - `PROJECT_SLUG=csda-studio-app`
> - `DOMAIN="spec-driven authoring"`
> - `STACK="Vite + React 18 + TypeScript 5 + Tailwind"`
> - `API_STYLE="browser-only, no network"`
> - `TESTING="Vitest + Playwright + Cucumber-JS"`
>
> Binario CLI usado en local:
>
> ```bash
> CSDA_BIN="/Users/alejandro/sandbox/learn-ai-architectures/spec-driven-ai-demo/mvp-spec-template/bin/create-spec-driven-app.js"
> alias csda='node "$CSDA_BIN"'
> ```
>
> Equivalente para terceros: `npx create-spec-driven-app@0.1.4 …`.

---

## Phase 0 — Seed brief ✅

**Where:** `create-spec-driven-app` repo, branch `main`.

Producido a mano:

- `mejoras/csda-studio-brief.md` — 15 REQs frozen, stack confirmado,
  scope acotado para `v0.1.0`.
- `mejoras/csda-studio-handoff.md` — tabla de fases y reglas de update
  para que otra IA pueda retomar.
- Memoria persistente:
  `~/.claude/projects/.../memory/csda-studio-dogfood.md`.

Sin tool calls — sólo edición.

---

## Phase 1 — Author the pack ✅

**Where:** repo `csda-studio-specops` (vacío en GitHub).

### Comandos ejecutados

```bash
# 1. Clonar repo vacío
git clone https://github.com/rsaglobaltech/csda-studio-specops.git /tmp/csda-studio-specops
cd /tmp/csda-studio-specops

# 2. Scaffold inicial (genera csdastudioapp/frontend/pack.yaml con TODOs)
csda pack init --out . --name "CsdaStudioApp" --type frontend

# 3. Borrar el pack.yaml scaffolded (lo reescribimos completo)
rm csdastudioapp/frontend/pack.yaml
```

### Ficheros creados a mano

| Fichero                                                            | Contenido                                                                                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `csdastudioapp/frontend/pack.yaml`                                 | schema_version 1.1.0, 15 REQ / 15 UC / 10 CMD / 5 QRY / 4 AGG / 15 EVT / 15 SCN, 3 bounded contexts (Pack Browsing, Pack Insights, Studio Shell)       |
| `csdastudioapp/frontend/templates/AI_RULES.md.tpl`                 | Role + `{{STACK}}` + hex-lite layout + Definition of Done                                                                                              |
| `csdastudioapp/frontend/templates/spec.md.tpl`                     | Premise + lista plain-language de REQ-001..REQ-015                                                                                                     |
| `csdastudioapp/frontend/templates/features/pack-browsing/*.tpl`    | 6 Gherkin templates (load_pack, validate_schema, browse_requirements, entity_detail, filter_by_status, search_entities)                                |
| `csdastudioapp/frontend/templates/features/pack-insights/*.tpl`    | 3 Gherkin templates (render_graph, dangling_references, scenario_lint)                                                                                 |
| `csdastudioapp/frontend/templates/features/studio-shell/*.tpl`     | 6 Gherkin templates (remember_last_path, theme_toggle, empty_state, keyboard_shortcut, static_deployment, health_endpoint)                             |
| `BRIEF.md`                                                         | Copia verbatim de `mejoras/csda-studio-brief.md`                                                                                                       |
| `README.md`                                                        | Cómo consumir el pack + recipe "how you could have authored this pack yourself" (csda pack init → translate brief → templates → lint → tag → iterate) |

---

## Phase 2 — Lint clean ✅

**Where:** `/tmp/csda-studio-specops`.

```bash
csda pack lint --pack-root . --pack csdastudioapp/frontend --strict
csda pack lint --pack-root . --pack csdastudioapp/frontend --graph
```

Primera ejecución reportó:

```text
❌ [ERROR] SCN-012 → "First-time visitor sees a hint": no When step — the scenario exercises no action.
```

Fix: añadir `When the home view finishes rendering` a
`empty_state.feature.tpl`. Segunda ejecución:

```text
ℹ️ [INFO] Pack 'csdastudioapp/frontend' passed all lint checks.
```

`--graph` emite Mermaid sin nodos missing.

---

## Phase 3 — Tag v0.1.0 y push ✅

```bash
cd /tmp/csda-studio-specops
git branch -M main
git add BRIEF.md README.md csdastudioapp/
git commit -m "feat(pack): v0.1.0 — CsdaStudioApp frontend domain pack"
git tag v0.1.0
git push -u origin main
git push origin v0.1.0
```

Resultado: tag `v0.1.0` vivo en
`https://github.com/rsaglobaltech/csda-studio-specops` (commit
`bafd153`).

---

## Phase 4 — `csda init` + `csda specops add` ✅

**Where:** repo `csda-studio-app` (vacío en GitHub).

### Config

`/tmp/csda-studio-app.yaml`:

```yaml
PROJECT_NAME: Csda Studio
PROJECT_SLUG: csda-studio-app
PROJECT_TYPE: frontend
DOMAIN: spec-driven authoring
STACK: Vite + React 18 + TypeScript 5 + Tailwind
API_STYLE: browser-only, no network
TESTING: Vitest + Playwright + Cucumber-JS
LANG: en
MODULES: ""
```

### Comandos ejecutados

```bash
# 1. Clonar repo vacío
git clone https://github.com/rsaglobaltech/csda-studio-app.git /tmp/csda-studio-app

# 2. Scaffold en stage (csda init crea subdirectorio con el slug)
mkdir -p /tmp/scaffold-stage
csda init --config /tmp/csda-studio-app.yaml --out /tmp/scaffold-stage --no-git

# 3. Mover contenido scaffolded al repo clonado preservando .git
cp -R /tmp/scaffold-stage/csda-studio-app/. /tmp/csda-studio-app/

# 4. Aplicar el pack tagged
cd /tmp/csda-studio-app
csda specops add \
  --pack-repo https://github.com/rsaglobaltech/csda-studio-specops.git \
  --pack-version v0.1.0 \
  --pack csdastudioapp/frontend \
  --var PROJECT_NAME="Csda Studio" \
  --var PROJECT_SLUG=csda-studio-app \
  --var DOMAIN="spec-driven authoring" \
  --var STACK="Vite + React 18 + TypeScript 5 + Tailwind" \
  --var API_STYLE="browser-only, no network" \
  --var TESTING="Vitest + Playwright + Cucumber-JS"

# 5. Commit + push
git branch -M main
git add -A
git commit -m "chore: scaffold csda-studio-app + add csdastudioapp/frontend pack v0.1.0"
git push -u origin main
```

### Output verificado

- 15 features bajo `features/{pack-browsing,pack-insights,studio-shell}/`.
- 15 nuevas filas en `docs/specs/traceability.md` (REQ-001..REQ-015,
  todos `Draft`).
- `.specops.lock` pinning commit `bafd153` del pack repo.
- `.specops/baseline/csdastudioapp/frontend/` con snapshot ancestor.
- `AI_RULES.md` con `{{STACK}}` substituido por
  `Vite + React 18 + TypeScript 5 + Tailwind`.

---

## Phase 5 — Phase 1 bootstrap (REQ-015 health green) ⏳ NEXT

**Where:** `/tmp/csda-studio-app` o nuevo clone.

### Objetivo

Producir el scaffold de implementación mínimo que haga **REQ-015
(health) verde end-to-end** y deje listos `dev`, `test` (Vitest),
`test:e2e` (Playwright + Cucumber) y `build`.

### Opción A — vía opencode

```bash
cd /tmp/csda-studio-app

# 1. Adaptar docs/bootstrap-prompt.md del repo create-spec-driven-app:
#    sustituir referencias al stack ejemplo por Vite + React 18 + TS 5 +
#    Tailwind + Vitest + Playwright + Cucumber-JS.
# 2. Pegar el prompt adaptado en opencode con cwd /tmp/csda-studio-app.
# 3. Dejar que el agente produzca los ficheros listados en "Layout
#    objetivo" más abajo.
```

### Opción B — a mano

Crear cada fichero exactamente como sigue.

#### Layout objetivo

```text
csda-studio-app/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.js
├── postcss.config.js
├── playwright.config.ts
├── cucumber.cjs
├── index.html
├── public/
│   └── health.json                          ← {"status":"UP"}
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── domain/health.ts
│   ├── application/get-health.ts
│   ├── adapters/health-fetcher.ts
│   └── ui/HealthBadge.tsx
└── tests/
    ├── unit/health.spec.ts
    └── e2e/health.steps.ts
```

#### `package.json`

```json
{
  "name": "csda-studio-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build && cp public/health.json dist/health.json",
    "preview": "vite preview --port 4173",
    "test": "vitest run",
    "test:e2e": "cucumber-js --config cucumber.cjs"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@cucumber/cucumber": "^10.8.0",
    "@playwright/test": "^1.47.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "happy-dom": "^14.12.3",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "ts-node": "^10.9.2",
    "tsx": "^4.16.2",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "vitest": "^2.0.5"
  }
}
```

#### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "useDefineForClassFields": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

#### `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

#### `vite.config.ts`

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", sourcemap: true },
});
```

#### `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "happy-dom", globals: true, include: ["tests/unit/**/*.spec.ts"] },
});
```

#### `tailwind.config.js`

```js
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

#### `postcss.config.js`

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

#### `playwright.config.ts`

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    command: "npm run preview",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: "http://localhost:4173" },
});
```

#### `cucumber.cjs`

```js
module.exports = {
  default: {
    requireModule: ["tsx/cjs"],
    require: ["tests/e2e/**/*.ts"],
    paths: ["features/studio-shell/health_endpoint.feature"],
    format: ["progress"],
  },
};
```

> Phase 8 extenderá `paths` REQ por REQ. Para REQ-015 sólo el health.

#### `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Csda Studio</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### `public/health.json`

```json
{ "status": "UP" }
```

#### `src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### `src/main.tsx`

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

#### `src/App.tsx`

```tsx
import { HealthBadge } from "./ui/HealthBadge";

export default function App() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Csda Studio</h1>
      <HealthBadge />
    </main>
  );
}
```

#### `src/domain/health.ts`

```ts
export type HealthStatus = "UP" | "DOWN";

export interface HealthReport {
  status: HealthStatus;
}

export function isUp(report: HealthReport): boolean {
  return report.status === "UP";
}
```

#### `src/application/get-health.ts`

```ts
import type { HealthReport } from "../domain/health";

export interface HealthFetcher {
  fetch(): Promise<HealthReport>;
}

export async function getHealth(fetcher: HealthFetcher): Promise<HealthReport> {
  return fetcher.fetch();
}
```

#### `src/adapters/health-fetcher.ts`

```ts
import type { HealthReport } from "../domain/health";
import type { HealthFetcher } from "../application/get-health";

export class HttpHealthFetcher implements HealthFetcher {
  constructor(private readonly url: string = "/health.json") {}

  async fetch(): Promise<HealthReport> {
    const res = await window.fetch(this.url);
    if (!res.ok) throw new Error(`health.json HTTP ${res.status}`);
    return (await res.json()) as HealthReport;
  }
}
```

#### `src/ui/HealthBadge.tsx`

```tsx
import { useEffect, useState } from "react";
import { HttpHealthFetcher } from "../adapters/health-fetcher";
import { getHealth } from "../application/get-health";
import type { HealthReport } from "../domain/health";

export function HealthBadge() {
  const [report, setReport] = useState<HealthReport | null>(null);

  useEffect(() => {
    void getHealth(new HttpHealthFetcher()).then(setReport);
  }, []);

  return (
    <p data-testid="health-badge" className="mt-4">
      status: {report?.status ?? "…"}
    </p>
  );
}
```

#### `tests/unit/health.spec.ts`

```ts
import { describe, expect, it } from "vitest";
import { isUp } from "../../src/domain/health";

describe("isUp", () => {
  it("returns true when status is UP", () => {
    expect(isUp({ status: "UP" })).toBe(true);
  });
  it("returns false when status is DOWN", () => {
    expect(isUp({ status: "DOWN" })).toBe(false);
  });
});
```

#### `tests/e2e/health.steps.ts`

```ts
import { Given, When, Then, setDefaultTimeout } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";

setDefaultTimeout(30_000);

let lastResponse: { status: number; body: unknown };

Given("a built copy of the studio is being served", async () => {
  // playwright.config.ts ya levanta `vite preview`. Probamos disponibilidad.
  const probe = await fetch("http://localhost:4173/");
  assert.equal(probe.ok, true, "preview server not reachable");
});

When("a client requests {string}", async (path: string) => {
  const res = await fetch(`http://localhost:4173${path}`);
  lastResponse = { status: res.status, body: await res.json().catch(() => null) };
});

Then("the response status is {int}", (expected: number) => {
  assert.equal(lastResponse.status, expected);
});

Then("the body parses as JSON containing {string}", (pair: string) => {
  const [key, value] = pair.split(":").map((s) => s.trim());
  const body = lastResponse.body as Record<string, unknown>;
  assert.equal(body?.[key], value);
});
```

> El step `{string}` para "status: UP" reutiliza la línea Gherkin literal
> de `features/studio-shell/health_endpoint.feature` rendered por el pack.

#### Comandos de verificación

```bash
cd /tmp/csda-studio-app
npm install
npm run test                            # vitest verde (2 tests)
npm run build                           # genera dist/ y copia health.json
npm run preview &                       # sirve dist en :4173
sleep 2
curl -fsS http://localhost:4173/health.json   # {"status":"UP"}
npm run test:e2e                        # cucumber verde contra dist
kill %1
```

#### Bump traceability REQ-015

Editar `docs/specs/traceability.md`:

```diff
- | REQ-015 | SCN-015 | ... | health_endpoint.steps | Draft |
+ | REQ-015 | SCN-015 | ... | health_endpoint.steps | Implemented |
```

#### Commit

```bash
git add -A
git commit -m "feat: phase 1 bootstrap — scaffold + REQ-015 health green"
git push origin main
```

### Definition of Done de Phase 5

- [ ] `npm run test` pasa con ≥ 1 test.
- [ ] `npm run build` produce `dist/` servible.
- [ ] `dist/health.json` devuelve `{"status":"UP"}` con HTTP 200.
- [ ] `features/studio-shell/health_endpoint.feature` verde vía
      Cucumber + Playwright contra el `dist/` servido.
- [ ] `docs/specs/traceability.md`: fila REQ-015 marca `Implemented`.
- [ ] Sin imports de React desde `src/domain/**` (regla de
      `AI_RULES.md`).

---

## Phase 6 — Commit Phase 1 result ⏳

Cubierto por el último `git commit` + `git push` de Phase 5. Se
separa para que el harness arranque sobre un baseline limpio.

---

## Phase 7 — Harness config con prompt prefix ⏳

**Where:** `/tmp/csda-studio-app`.

### Ficheros a crear

`harness.config.yaml` (en la raíz):

```yaml
version: 1
agent:
  command: "opencode run --prompt-file {prompt_file}"
  # alternativas (descomentar la usada):
  # command: "claude -p < {prompt_file}"
  # command: "aider --message-file {prompt_file} --yes"
  timeout_seconds: 1800

prompt_prefix_file: ./.harness/prompt-prefix.md

# Gates en orden. Si uno falla, harness aborta el REQ y deja audit log.
gates:
  - name: "vitest"
    command: "npm run test --silent"
  - name: "build"
    command: "npm run build --silent"
  - name: "playwright-cucumber"
    command: "npm run test:e2e --silent"

# Worktree aislado por REQ.
worktree:
  base: "main"
  branch_prefix: "harness/"

# Trace de cada ejecución.
audit:
  log_file: .harness/audit.log
  include_rendered_prompt: true
```

`.harness/prompt-prefix.md`:

```markdown
## Role

You are a senior frontend engineer working in {{PROJECT_SLUG}}. You
ship one requirement at a time, you write the failing test first,
and you never invent scope.

## Active Project Boundary

You MAY edit:

- `src/**` (domain, application, adapters, ui)
- `tests/**`
- `features/**` step definitions (the `.feature` files themselves
  are rendered from the pack — do not edit them by hand)
- `public/**`
- `docs/specs/traceability.md` (only to bump the current REQ's
  status row from `Draft` to `Implemented`)

You MUST NOT edit:

- `pack.yaml` (lives in the pack repo, not here)
- `.specops/**` (baseline snapshot, never modify)
- `templates/**` (lives in the pack repo)
- Other REQs' feature files or other REQs' status rows in
  traceability.md

## Execution Policy

1. Read `AI_RULES.md` then the feature file for THIS REQ only.
2. Write or extend the Cucumber step definitions so the scenario
   fails for the right reason. Then make it pass.
3. Keep `src/domain/**` free of React / DOM / network imports.
4. `src/application/**` depends on `src/domain/**` and on port
   interfaces only — never on concrete adapters.
5. After all three gates (`vitest`, `build`,
   `playwright-cucumber`) pass, bump the REQ row in
   `docs/specs/traceability.md` from `Draft` to `Implemented`.
6. Commit with a single message:
   `feat: REQ-NNN <short title>`.
```

### Comandos

```bash
cd /tmp/csda-studio-app
mkdir -p .harness
# escribir los dos ficheros de arriba

git add harness.config.yaml .harness/
git commit -m "feat(harness): config + Role/Boundary/Policy prefix"
git push origin main
```

### Smoke test del config

```bash
csda harness run --req REQ-015 --dry-run --show-prompt
# Debe imprimir el prompt rendered con prefix + AI_RULES + feature
# de REQ-015 sin lanzar el agente.
```

---

## Phase 8 — Harness loop REQ-001..REQ-014 ⏳

REQ-015 ya verde en Phase 5; las 14 restantes se delegan al harness.
**Ejecutar secuencialmente, no en paralelo** (cada REQ depende del
estado de `main` después del anterior — al menos del package.json
y de los step files que pueden compartir helpers).

### Orden recomendado

Sigue el orden topológico del grafo (dependencias mecánicas más que
estrictas):

1. **REQ-001 Load pack from disk** — desbloquea todo: instala
   js-yaml, define `PackDocument` domain, file-picker port.
2. **REQ-002 Schema validation** — encadena con REQ-001 (mismo
   loader path).
3. **REQ-003 Browse requirements** — primera vista.
4. **REQ-004 Entity detail panel** — depende de la lista.
5. **REQ-005 Render reference graph** — instala mermaid, primera
   vista derivada.
6. **REQ-006 Dangling references** — depende del graph builder de
   REQ-005.
7. **REQ-007 Scenario lint** — independiente; añade lint engine.
8. **REQ-008 Filter by status** — extensión de la lista de REQ-003.
9. **REQ-009 Search entities** — index global.
10. **REQ-010 Remember last path** — preferences adapter
    (localStorage).
11. **REQ-011 Theme toggle** — reutiliza preferences.
12. **REQ-012 Empty state** — vista inicial.
13. **REQ-013 Keyboard shortcut** — añade handler global.
14. **REQ-014 Static deployment** — verifica `npm run build` +
    serving end-to-end (probable no-op si Phase 5 lo dejó bien).

### Loop

```bash
cd /tmp/csda-studio-app
git checkout main
git pull origin main

for REQ in REQ-001 REQ-002 REQ-003 REQ-004 REQ-005 REQ-006 REQ-007 \
           REQ-008 REQ-009 REQ-010 REQ-011 REQ-012 REQ-013 REQ-014; do
  echo "=== $REQ ==="
  csda harness run --req "$REQ"
  STATUS=$?
  if [ $STATUS -ne 0 ]; then
    echo "harness aborted on $REQ (exit $STATUS). Inspect .harness/audit.log."
    break
  fi
  # Phase 9 inline: revisar, abrir PR, mergear, volver
  gh pr create --base main --head "harness/$REQ" \
    --title "feat: $REQ" --body "Closes $REQ. Gates ✅."
  gh pr merge "harness/$REQ" --squash --delete-branch
  git checkout main
  git pull origin main
done
```

### Antes de cada REQ — extender cucumber paths

`cucumber.cjs` debe ir creciendo el `paths` array para incluir la
feature de cada REQ que ya quedó verde. Alternativa: usar glob
`features/**/*.feature` desde el principio y dejar que los REQs no
implementados queden marcados pendientes vía `@wip` tag en la
feature template (no soportado hoy — preferible la extensión
manual REQ a REQ).

### Inspección durante el loop

```bash
csda harness run --req REQ-001 --dry-run                # ver acciones planificadas
csda harness run --req REQ-001 --dry-run --show-prompt  # imprimir prompt rendered
csda harness status                                      # estado por REQ
tail -f .harness/audit.log                               # follow audit en vivo
git worktree list                                        # ver worktrees activos
```

### Si un REQ falla los gates

```bash
# 1. Leer la causa
cat .harness/audit.log | tail -100
git -C .git/worktrees/harness-REQ-NNN diff               # diff que el agente intentó

# 2. Opciones:
#    a) Re-run con el mismo prompt (transient failure)
csda harness run --req REQ-NNN --force
#    b) Intervenir a mano en el worktree, terminar el REQ, commit
cd /tmp/csda-studio-app && git checkout harness/REQ-NNN
#       ...editar...
git commit -am "feat: REQ-NNN — manual completion after harness gate miss"
#    c) Si el prompt necesita mejorarse: editar .harness/prompt-prefix.md
#       y re-run con --force.

# 3. Limpiar worktree después de mergear
git worktree remove .git/worktrees/harness-REQ-NNN
```

---

## Phase 9 — Review + merge por REQ ⏳

Embedded en el loop de Phase 8 vía `gh pr create` + `gh pr merge`.
Esta fase se separa formalmente para indicar que el merge es **humano
en la decisión** (revisar el diff antes de mergear) aunque el comando
sea automático.

### Checklist por PR

- [ ] Diff sólo toca los paths permitidos por el Active Project
      Boundary (`src/`, `tests/`, `public/`, step files,
      traceability.md de SOLO ese REQ).
- [ ] Nuevos imports respetan la dirección hexagonal: domain limpio
      de React/DOM, application no importa adapters concretos.
- [ ] No re-renderiza features (esos viven en el pack).
- [ ] Tests añadidos cubren la scenario del REQ, no sólo paths
      felices.
- [ ] Traceability row del REQ pasó a `Implemented`.

### Comandos

```bash
# Listar PRs pendientes de review
gh pr list --base main --label harness

# Ver diff antes de mergear
gh pr diff <PR-N>

# Mergear con squash (mantiene historia limpia)
gh pr merge <PR-N> --squash --delete-branch

# Post-merge: refrescar main local antes del siguiente REQ
git checkout main
git pull origin main
```

### Si hay regresiones cross-REQ

Cuando un REQ posterior rompe un test de un REQ anterior:

```bash
# 1. Identificar
npm run test            # ver qué unit test rompió
npm run test:e2e        # ver qué scenario rompió

# 2. Fix mínimo en main, no en el worktree
git checkout main
# editar arreglo
git commit -m "fix: regression in <feature> after REQ-NNN"
git push origin main

# 3. Si la regresión vino del último REQ mergeado:
#    revertir y re-correr el harness con un prompt ajustado.
git revert <merge-sha>
git push origin main
csda harness run --req REQ-NNN --force
```

---

## Phase 10 — Tag v0.1.0 de la app + deploy ⏳

### Verificación final en main

```bash
cd /tmp/csda-studio-app
git checkout main
git pull origin main
rm -rf node_modules dist
npm install
npm run test
npm run build
npm run preview &
sleep 3
npm run test:e2e
kill %1
```

Todas las features (15) deben pasar end-to-end contra el bundle de
producción.

### Tag

```bash
git tag -a v0.1.0 -m "v0.1.0 — REQ-001..REQ-015 implemented"
git push origin v0.1.0
```

### Deploy estático — opción A: GitHub Pages

Crear `.github/workflows/pages.yml`:

```yaml
name: deploy-pages
on:
  push:
    tags: ["v*"]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: ./dist }
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Deploy estático — opción B: Netlify drop

```bash
npm run build
# arrastrar dist/ a https://app.netlify.com/drop
```

### Deploy estático — opción C: S3

```bash
npm run build
aws s3 sync dist/ "s3://${BUCKET}/" --delete
aws s3 cp "s3://${BUCKET}/health.json" \
  "s3://${BUCKET}/health.json" \
  --content-type application/json --metadata-directive REPLACE
```

### Validación post-deploy

```bash
DEPLOYED_URL="https://<your-deploy>"
curl -fsS "$DEPLOYED_URL/health.json"            # {"status":"UP"}
curl -fsS -o /dev/null -w '%{http_code}\n' \
  "$DEPLOYED_URL/health.json"                    # 200
```

Si responde **200** + `{"status":"UP"}`: la herramienta entregó su
propio companion app via su propio flow → **dogfood cerrado**.

### Update final del handoff

```bash
# En el repo create-spec-driven-app
cd /Users/alejandro/sandbox/learn-ai-architectures/spec-driven-ai-demo/mvp-spec-template
# Editar mejoras/csda-studio-handoff.md:
#   - Phase 10 → ✅
#   - Recent decisions: añadir fila con la URL de deploy + tag v0.1.0
git add mejoras/csda-studio-handoff.md
git commit -m "docs(studio-handoff): phase 10 complete — dogfood closed"
git push origin main
```

---

## Resumen — estado actual

| Fase | Estado  | Resultado / próximo paso                                                                                                                                                                  |
| ---- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | ✅      | Brief + handoff + memoria escritos.                                                                                                                                                       |
| 1    | ✅      | Pack `csdastudioapp/frontend` autorado con 15 REQ / 15 SCN / 4 AGG / etc.                                                                                                                 |
| 2    | ✅      | `pack lint --strict` y `--graph` limpios.                                                                                                                                                 |
| 3    | ✅      | Tag `v0.1.0` empujado a `csda-studio-specops` (commit `bafd153`).                                                                                                                         |
| 4    | ✅      | Scaffold `csda init` + `csda specops add` aplicados a `csda-studio-app`. 15 features renderizados, traceability lleno, `.specops.lock` + baseline commited y push a `main`.               |
| 5    | ⏳ NEXT | Phase 1 bootstrap vía opencode (o a mano). Objetivo: REQ-015 health verde end-to-end.                                                                                                     |
| 6    | ⏳      | Commit de Phase 5 (cubierto en el mismo push).                                                                                                                                            |
| 7    | ⏳      | `harness.config.yaml` + `.harness/prompt-prefix.md`.                                                                                                                                      |
| 8    | ⏳      | `csda harness run --req REQ-001` … `REQ-014` (loop x14).                                                                                                                                  |
| 9    | ⏳      | PR + merge por REQ (`gh pr create` / `gh pr merge --squash`).                                                                                                                             |
| 10   | ⏳      | Tag `v0.1.0` en `csda-studio-app` + deploy estático + smoke test contra `/health.json`.                                                                                                   |

---

## Notas operativas

- **No re-escribir `templates/**` desde la implementación.** Si hay
  que cambiar un feature, se edita el template en
  `csda-studio-specops`, se bumpea tag (`v0.1.1` parche, `v0.2.0`
  aditivo, `v1.0.0` breaking) y luego `csda sync` en la app.
- **`.specops.lock` y `.specops/baseline/` siempre committed.** El
  baseline es el ancestor del 3-way merge que hace `specops sync`
  no destructivo.
- **Update protocol del handoff doc.** Tras cada fase: flip ✅,
  promover la siguiente a NEXT, append fila a "Recent decisions" con
  fecha y commit/tag, commitear como
  `docs(studio-handoff): phase N complete — <summary>`.
- **Variables sin cambiar entre phases.** Si hay que tocar una
  variable (ej. cambiar `STACK`), correr
  `csda sync --var STACK="..."` desde la app — re-renderiza los
  outputs sin perder edits manuales (gracias al baseline).
