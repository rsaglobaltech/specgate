<!-- specgate:allow-placeholders — this file documents the {{VAR}} template syntax. -->
# 🎨 CsdaStudioApp — product brief

> **Status:** seed brief, _not_ a pack. This document is the input you hand
> to the pack author (you + opencode/Claude) so they can produce
> `pack.yaml` + `templates/AI_RULES.md.tpl` + `templates/spec.md.tpl` +
> `templates/features/**/*.feature.tpl` inside the empty
> [`csda-studio-specops`](https://github.com/rsaglobaltech/csda-studio-specops)
> repo. From there a normal consumer flow takes over: `csda init` →
> `csda specops add` → bootstrap prompt → `csda harness run` per REQ.
>
> Treat every requirement below as the **source of truth for behaviour**.
> The pack author may renumber, rename, split or merge — the _intent_ is
> non-negotiable, the IDs are.

---

## 1. The dogfood premise

We use `create-spec-driven-app` to build the studio that itself helps
people use `create-spec-driven-app`. If the tool cannot deliver its own
companion app via its own flow, the flow is not real.

Two repos:

```text
csda-studio-specops/      ◄── the PACK we are about to author from this brief.
                              Stack-agnostic, versioned, reusable.

csda-studio-app/          ◄── the IMPLEMENTATION project (separate repo).
                              Vite + React + TypeScript, deployed as a static
                              SPA. The harness drives it REQ by REQ.
```

The product itself is **CsdaStudioApp** — the static SPA that lets pack
authors open a `pack.yaml`, see the reference graph, browse entities and
read lint output without leaving the browser.

---

## 2. Constraints (these go into `AI_RULES.md.tpl`)

- **`project_type: frontend`** — there is no backend service. All
  computation runs in the browser.
- **Stack:** Vite + React 18 + TypeScript 5 + Tailwind CSS. Pure SPA,
  builds to a folder of static assets, deployable to GitHub Pages /
  Netlify / S3.
- **Testing:** Vitest for unit tests, Playwright for end-to-end browser
  scenarios, Cucumber-JS for the Gherkin layer that drives Playwright.
- **Architecture:** Hexagonal-lite — `src/domain` (pure types + pure
  functions), `src/application` (use cases), `src/adapters` (file I/O,
  YAML parser, Mermaid renderer wrappers), `src/ui` (React components).
  Domain logic never imports from React.
- **YAML parsing:** browser-side via `js-yaml`. Same parser everyone
  uses. No homegrown parser.
- **Graph rendering:** `mermaid` loaded on demand. No CDN — bundle it.
- **No network calls by default.** The studio is local-first; loading a
  pack from a URL is a stretch feature behind a flag.
- **Vendor-neutral and stack-neutral pack:** even though _this_
  implementation is React, the pack's `spec.md.tpl` and feature
  templates must not mention React/Vite/Tailwind. Stack lives only in
  `AI_RULES.md.tpl` via `{{STACK}}`.

---

## 3. Requirements (MVP — every REQ ships)

> Each requirement carries one Gherkin scenario the pack author should
> render under `templates/features/.../REQ-NNN.feature.tpl`. Test artifact
> = the Playwright/Cucumber step-definition file. Technical artifact =
> the React component + the domain function backing it.

### REQ-001 — Open a `pack.yaml` from disk

**Goal:** the user picks a file from their machine and the studio loads it.

```gherkin
Feature: Open a pack from disk
  Scenario: Loading a valid pack.yaml from a file picker
    Given the studio is open with no pack loaded
    When I pick the file "fixtures/parking-management/backend/pack.yaml"
    Then the header shows "parking-management/backend"
    And the requirements panel lists at least one entry
```

Technical artifact: `src/adapters/pack-loader.ts` + `src/ui/PackPicker.tsx`.
Test artifact: `tests/e2e/open-pack.steps.ts`.

### REQ-002 — Parse and validate against the pack schema

**Goal:** invalid YAML or schema violations are surfaced, not swallowed.

```gherkin
Feature: Schema validation on load
  Scenario: A malformed pack file shows a clear error
    Given the studio is open with no pack loaded
    When I pick the file "fixtures/broken-no-id.yaml"
    Then I see the error "Required field 'id' missing on requirements[0]"
    And no entities are listed
```

Technical artifact: `src/domain/pack-schema.ts` (zod or ajv against the
canonical JSON schema) + error banner component.

### REQ-003 — Browse requirements

**Goal:** a list view with id, title and priority.

```gherkin
Feature: Browse requirements
  Scenario: Listing every requirement after loading a pack
    Given I have loaded a pack with 5 requirements
    When I open the Requirements view
    Then I see 5 rows, each showing the requirement id, title and priority
```

### REQ-004 — Detail panel for any entity

**Goal:** clicking a requirement / use case / command / aggregate / event
opens a read-only detail panel.

```gherkin
Feature: Entity detail panel
  Scenario: Inspecting a use case
    Given I have loaded a pack
    When I click the use case "UC-001"
    Then I see its name, actor, requirement reference, command, aggregate and emitted events
```

### REQ-005 — Render the reference graph

**Goal:** show the `REQ → UC → CMD/QUERY/AGG → EVT` spine as Mermaid.

```gherkin
Feature: Reference graph
  Scenario: Rendering the spine of the loaded pack
    Given I have loaded the parking-management pack
    When I open the Graph view
    Then I see a node for each REQ, UC, CMD, AGG and EVT in the pack
    And an arrow from "REQ-001" to "UC-001"
    And an arrow from "UC-001" to "EVT-001"
```

Reuse the rendering logic shipped in `pack-graph.ts` of the VS Code
extension; port the pure parts to `src/domain/graph.ts`.

### REQ-006 — Highlight dangling references in the graph

**Goal:** a reference to a non-existent id is drawn red and listed
separately.

```gherkin
Feature: Dangling reference highlighting
  Scenario: A use case points at a missing event
    Given I have loaded a pack where "UC-002" emits "EVT-999"
    When I open the Graph view
    Then the node "EVT-999" is shown as missing
    And the diagnostics panel lists "UC-002 references unknown event: EVT-999"
```

### REQ-007 — Run scenario-quality lint and surface findings

**Goal:** for every scenario in the pack, run the rules from
`pack lint --strict` and show them grouped per scenario.

```gherkin
Feature: Scenario-quality findings
  Scenario: A scenario with no Then step is flagged
    Given I have loaded a pack that contains a scenario without a Then step
    When I open the Lint view
    Then the scenario is flagged with "no Then step — the scenario asserts nothing"
```

### REQ-008 — Filter requirements by status

**Goal:** quick filter to focus on `Draft`, `Implemented`, `Released`, etc.

```gherkin
Feature: Filter requirements
  Scenario: Showing only Draft requirements
    Given I have loaded a pack
    When I select the "Draft" status filter
    Then only requirements whose status is "Draft" are visible
```

### REQ-009 — Search across all entities

**Goal:** a single search field across requirements, use cases, commands,
aggregates and events.

```gherkin
Feature: Search
  Scenario: Searching by id substring
    Given I have loaded a pack with many entities
    When I type "EVT-00" in the search field
    Then the results panel lists every event whose id starts with "EVT-00"
```

### REQ-010 — Persist the last-opened path

**Goal:** reopening the studio remembers the last loaded pack path (file
name only, not contents).

```gherkin
Feature: Remember the last pack
  Scenario: The studio re-opens with the last pack hint
    Given I previously loaded "fixtures/parking-management/backend/pack.yaml"
    When I close and re-open the studio in the same browser
    Then the home screen offers to re-open that path
```

### REQ-011 — Dark / light theme toggle

```gherkin
Feature: Theme toggle
  Scenario: Toggling to dark mode
    Given the studio is in light mode
    When I click the theme toggle
    Then the page background is dark
    And the theme choice persists across reloads
```

### REQ-012 — Empty-state and onboarding hint

```gherkin
Feature: Empty state
  Scenario: First-time visitor sees a hint
    Given I open the studio with no previous pack
    Then I see a hint inviting me to load a pack.yaml
    And a link to the example fixture pack
```

### REQ-013 — Keyboard shortcut to open the file picker

```gherkin
Feature: Keyboard shortcut
  Scenario: Cmd+O opens the file picker
    Given the studio is open
    When I press "Cmd+O" (or "Ctrl+O")
    Then the OS file picker appears
```

### REQ-014 — Static deployment readiness

```gherkin
Feature: Static deployment
  Scenario: The production build serves entirely from static files
    Given the project has been built with "npm run build"
    When the contents of "dist/" are served by any static file server
    Then the studio loads and the example fixture can be opened end-to-end
```

### REQ-015 — Health endpoint for the static deployment (sanity)

> Borrowed from the parking pack — same shape so the harness can prove
> it works on day one. Implemented as a trivial JSON file shipped under
> `dist/health.json` so a smoke test can poll it from any host.

```gherkin
Feature: Health
  Scenario: The deployment exposes a health JSON
    Given a built copy of the studio is being served
    When a client requests "/health.json"
    Then the response status is 200
    And the body parses as JSON containing "status: UP"
```

---

## 4. Stretch (post-MVP, intentionally NOT in v0.1.0)

Anything below should land as later REQs (or a v0.2.0 pack bump). Do
**not** implement them in Phase 1.

- Editing entities through forms with validation.
- Saving back to disk via the File System Access API.
- Adding new entries with id auto-numbering (`REQ-NNN`, etc.).
- An "Infer from feature" wizard that wraps `csda pack infer` (would
  shell out client-side — only possible in an Electron build).
- Side-by-side diff between two pack versions.
- Loading a pack from a git URL (would need a tiny proxy or a CORS-friendly
  pack registry).

---

## 5. How the pack author should turn this into a pack

1. **One requirement per `REQ-` heading above** → one `requirements[]`
   entry in `pack.yaml`, plus one `use_cases[]`, one or more
   `commands[]` / `events[]` as the scenario demands, and one
   `scenarios[]` entry pointing at the rendered feature template.
2. **The Gherkin block under each REQ** → one `*.feature.tpl` under
   `templates/features/<area>/REQ-NNN.feature.tpl`. Keep the Gherkin
   stack-neutral (no React / Playwright vocabulary in the steps).
3. **`AI_RULES.md.tpl`** declares the stack via `{{STACK}}`,
   `{{API_STYLE}}`, `{{TESTING}}`, the hexagonal-lite layout, and the
   "no React inside src/domain" rule.
4. **`spec.md.tpl`** is the prose summary of section 1 ("the dogfood
   premise") and section 3 (each REQ-NNN's intent in plain language).
5. Run **`csda pack lint --pack-root . --pack frontend --strict`** before
   tagging `v0.1.0`. `--graph` should render cleanly with no missing
   nodes.

Once the pack is tagged, the consumer flow takes over in `csda-studio-app/`:

```bash
csda init --config ./csda-studio-app.yaml --out .
cd csda-studio-app
csda specops add \
  --pack-repo https://github.com/rsaglobaltech/csda-studio-specops.git \
  --pack-version v0.1.0 \
  --pack frontend \
  --var PROJECT_NAME="Csda Studio" \
  --var PROJECT_SLUG=csda-studio \
  --var DOMAIN="spec-driven authoring"

# Phase 1 — paste docs/bootstrap-prompt.md from create-spec-driven-app
# into opencode; bootstrap Vite + React + Vitest + Playwright + Cucumber
# + the hex skeleton + REQ-015 (health) end-to-end.

# Phase 2..N — let the harness drive the rest:
csda harness run --req REQ-001
csda harness run --req REQ-002
# ...
```

This is the experiment: if the harness can ship REQ-001..REQ-014 against
this brief, the tool is real. Anything that fails is the next bug to fix.
