<!-- csda:allow-placeholders — this file documents the {{VAR}} template syntax. -->
# 🚗 End-to-end tutorial — building **Smart Parking**

A friendly, step-by-step walk through **every** command in
`specgate`. We build one real backend project — **Smart
Parking** — on top of the public demo pack
[`rsaglobaltech/parking-management-specops`](https://github.com/rsaglobaltech/parking-management-specops).

You do **not** need to understand the whole tool up front. Each step
explains the _concept_ first, then the command, then what you should see.

> **`specgate`** is the short name for `specgate`. If you have not
> installed it globally, replace every `specgate` in this guide with
> `npx @rsaglobaltech/specgate@latest`.

---

## Before anything else: the two places you will work

This is the single most important idea in the tool, and the one that trips
people up. There are **two separate folders** on your disk, and they are not
the same thing:

```text
┌─────────────────────────────────────┐     ┌─────────────────────────────────────┐
│  THE PACK REPO                      │     │  YOUR IMPLEMENTATION PROJECT        │
│  parking-management-specops/        │     │  smart-parking/                     │
│                                     │     │                                     │
│  • pack.yaml  (the domain model)    │     │  • spec.md                          │
│  • templates/ (Gherkin templates)   │     │  • features/**/*.feature            │
│                                     │ ──▶ │  • docs/specs/traceability.md       │
│  Reusable knowledge, versioned      │     │  • src/, test/  (the code YOU write)│
│  with git tags (v0.1.0, v0.2.0…).   │     │  • .specops.lock  ← the link        │
│  You only open this if you AUTHOR   │     │                                     │
│  packs.                             │     │  Where you spend 95% of your time.  │
└─────────────────────────────────────┘     └─────────────────────────────────────┘
        the SOURCE of specs                       the project that CONSUMES them
```

- The **pack repo** is a library of domain knowledge. Think of it like a
  package on npm — you usually just _consume_ a published version of it,
  you do not edit it.
- Your **implementation project** is the app you are building. It is a
  normal git repo with your real source code. `init` created it; `expand` /
  `specops add` copied rendered specs _into_ it; and `.specops.lock` (a file
  **inside your project**) remembers which pack and version it came from.

**The rule of thumb:** unless a step explicitly says "the pack repo", you
run the command **from inside your implementation project**
(`smart-parking/`). Every step below carries a 📍 badge so you are never in
doubt.

| You run it from…                                      | These commands                                                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 📍 your **implementation project** (`smart-parking/`) | `init`\* · `validate` · `plan` · `done` · `specops add` · `specops diff` · `specops sync` · `specops remove` · `expand` · `harness run` |
| 📦 the **pack repo** (`parking-management-specops/`)  | `pack init` · `pack lint` · `pack lint --graph` · `pack infer` · and "add a requirement as a pack author"                               |

\* `init` is run from the _parent_ directory — it _creates_ the project
folder. After that, you `cd` into it and stay there.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Step 1 — Scaffold the project (`init`)](#2-step-1--scaffold-the-project-init)
3. [Step 2 — Apply the domain pack (`specops add`)](#3-step-2--apply-the-domain-pack-specops-add)
4. [Step 3 — Validate the project (`validate`)](#4-step-3--validate-the-project-validate)
5. [Step 4 — See what is left to build (`plan`)](#5-step-4--see-what-is-left-to-build-plan)
6. [Step 5 — Implement a requirement and close the loop (`done`)](#6-step-5--implement-a-requirement-and-close-the-loop-done)
7. [Step 6 — Add a NEW requirement (as a project consumer)](#7-step-6--add-a-new-requirement-as-a-project-consumer)
8. [Step 7 — Upgrade the pack version (`specops diff` + `specops sync`)](#8-step-7--upgrade-the-pack-version-specops-diff--specops-sync)
9. [Step 8 — Remove a pack (`specops remove`)](#9-step-8--remove-a-pack-specops-remove)
10. [Step 9 — Author your own pack (`pack init` · `lint` · `--graph` · `infer`)](#10-step-9--author-your-own-pack)
11. [Step 10 — Add a NEW requirement (as a pack author)](#11-step-10--add-a-new-requirement-as-a-pack-author)
11½. [Step 10½ — Change a requirement that already shipped (`change`)](#11-step-10--change-a-requirement-that-already-shipped)
12. [Step 11 — Automate delivery with the harness (`harness run`)](#12-step-11--automate-delivery-with-the-harness-harness-run)
13. [Step 12 — Companion tooling (VS Code · MCP · agents)](#13-step-12--companion-tooling)
14. [Command cheat-sheet](#14-command-cheat-sheet)

---

## 1. Prerequisites

- **Node.js ≥ 22** and **git** on your `PATH`.
- Network access the first time you run `specops add` — it clones the pack
  repo into a per-user cache (`~/.cache/specgate/packs/…`). After that it is
  offline.

Optionally install the CLI globally so `specgate` works everywhere:

```bash
npm install -g @rsaglobaltech/specgate@latest
specgate --version          # 0.2.0
specgate --help             # the eight commands of the daily loop
specgate --help --all       # the whole surface
```

---

## 2. Step 1 — Scaffold the project (`init`)

> 📍 **Run from:** the **parent** directory (e.g. `~/sandbox`). `init`
> _creates_ `smart-parking/` for you.

### Concept

`init` does not write any business logic. It creates an **empty-but-valid
spec-driven project**: the folders, the requirements document, and the
traceability matrix — the skeleton everything else fills in. It is the
`git init` of spec-driven development.

You describe the project in a small **config file**. It can be a YAML
mapping (`.yaml` / `.yml`) or the legacy `KEY="value"` format (`.config`);
`init` picks the parser from the file extension. We use YAML here.

### Do it

```bash
mkdir -p ~/sandbox && cd ~/sandbox

cat > smart-parking.yaml <<'EOF'
# Required
PROJECT_NAME: Smart Parking
PROJECT_SLUG: smart-parking
PROJECT_TYPE: backend # backend | frontend | mobile
DOMAIN: parking operations
STACK: Quarkus 3.x, Java 21, PostgreSQL, RESTEasy Reactive, Maven
API_STYLE: REST with DTO boundaries
TESTING: JUnit 5, Testcontainers, Cucumber

# Optional
LANG: en
MODULES: "" # e.g. auth,billing
EOF

specgate init --config ./smart-parking.yaml --out .
cd smart-parking          # ← from here on, you stay inside the project
```

**Flags:** `--force` (overwrite an existing folder), `--dry-run` (print
what it would do, write nothing), `--no-git` (skip `git init`).

### What you should see

```text
smart-parking/
├── spec.md                  # the requirements document — prose
├── AGENTS.md              # stack guardrails for AI agents
├── README.md
├── features/                # Gherkin scenarios will live here
└── docs/specs/
    ├── traceability.md       # the requirement ↔ code matrix — the spine
    └── adr/
```

The scaffold ships with one placeholder requirement, so the project is
already valid. Now we give it a real domain.

---

## 3. Step 2 — Apply the domain pack (`specops add`)

> 📍 **Run from:** inside your project — `smart-parking/`.

### Concept

A **domain pack** is reusable, versioned domain knowledge: requirements,
use cases, commands, aggregates, events, and the Gherkin scenarios that pin
them down. It lives in its own repo (here:
`parking-management-specops`), tagged with versions like `v0.1.0`.

`specops add` is the **npm-install of spec-driven development**. It:

1. clones the pack repo (at the version you pin),
2. **renders the pack's templates into your project** — this is the arrow
   in the diagram at the top: knowledge flows _from_ the pack repo _into_
   `smart-parking/`,
3. writes a **`.specops.lock`** file in your project that remembers the
   repo, version, commit and variables — so you never retype them.

You are not editing the pack. You are pulling a snapshot of it into your
project.

### Do it

```bash
specgate specops add \
  --pack-repo https://github.com/rsaglobaltech/parking-management-specops.git \
  --pack-version v0.1.0 \
  --pack backend \
  --var PROJECT_NAME="Smart Parking" \
  --var PROJECT_SLUG=smart-parking \
  --var DOMAIN="parking operations"
```

### What you should see — all of this lands **inside `smart-parking/`**

- New `.feature` files under `features/` (vehicle entry, capacity
  threshold, billing, overstay, receipts…).
- New rows in `docs/specs/traceability.md` — one per scenario.
- Rich domain docs: `docs/specs/{use-cases,aggregates,commands,events,domain-model}.md`.
- **`.specops.lock`** — the link back to the pack. Records repo, version,
  resolved commit, and your `--var` values.
- **`.specops/baseline/…`** — a verbatim copy of exactly what the pack
  rendered. This is the "known-good ancestor" that makes a later
  `specops sync` able to merge safely instead of clobbering your edits.

> ✅ **Commit `.specops.lock` and `.specops/` to git.** A teammate who
> clones your project needs both for `specops sync` to work.

**Useful flags:** `--dry-run`, `--no-examples` (skip files marked
`seed: true`), `--cache-dir <path>`, `--pack-root <path>` (point at a local
pack folder instead of a git URL — handy offline or for testing).

> **`expand` is the low-level version of this.** `specops add` is the
> friendly wrapper; `expand` does the same rendering with more explicit
> flags and no lockfile bookkeeping. Use `specops add` day to day.

---

## 4. Step 3 — Validate the project (`validate`)

> 📍 **Run from:** inside your project — `smart-parking/`.

### Concept

`validate` is your **safety net**. It checks that the project still hangs
together: required files and folders exist, there is at least one
`.feature`, every feature file is referenced in the traceability matrix,
status values are valid, and the Gherkin parses.

### Do it

```bash
specgate validate .
```

A clean run prints `Validation passed` and a feature count.

### The TDD gate — `--strict-tdd`

Plain `validate` checks structure. `--strict-tdd` adds the rule that **the
matrix may not run ahead of reality**:

```bash
specgate validate . --strict-tdd
```

It additionally fails when:

- a row has a `TBD` test artifact but a status past `Draft` — `[TDD-1]`,
- a row has a status but no Scenario ID — `[TDD-2]`,
- a `REQ-NNN` is mentioned in `spec.md` but has no row in
  `traceability.md` — `[TDD-3]`.

Wire `validate --strict` into CI and a git pre-commit hook. It is the
gate that keeps specs and code honest.

---

## 5. Step 4 — See what is left to build (`plan`)

> 📍 **Run from:** inside your project — `smart-parking/`.

### Concept

After `specops add`, your project has a pile of scenarios but no code yet.
`plan` answers **"what do I do next?"** It reads `traceability.md` and looks
at the filesystem, then tells you, per requirement, what is missing.

### Do it

```bash
specgate plan
```

```text
📋 Plan  (5 requirements, 5 pending)

  ⚠️  Test missing (write the test first)
    REQ-001   SCN-001
      ✓ feature: features/capacity/capacity_threshold.feature
      · test:    capacity_threshold.steps
      · code:    Occupancy monitor
  …
```

Each requirement lands in one bucket: `NEEDS_FEATURE`, `NEEDS_EVERYTHING`,
`NEEDS_TEST`, `NEEDS_IMPLEMENTATION`, `NEEDS_STATUS_UPDATE`, or `DONE`. A
`✓` means the file exists; a `·` means it is still missing.

### Machine-readable mode

```bash
specgate plan --format json
```

Emits a stable JSON structure (`summary`, `next_steps[]`,
`requirements[]`…). This is the **task queue** the harness consumes in
Step 11, and what an AI agent reads to know what to work on.

---

## 6. Step 5 — Implement a requirement and close the loop (`done`)

> 📍 **Run from:** inside your project — `smart-parking/`.

### Concept

Now you write actual code. The loop for every requirement is always the
same four moves:

1. **Read** the `.feature` file `plan` pointed you at — it is the
   executable spec, the source of truth for behaviour.
2. **Write the test first**, so it fails for the right reason (TDD).
3. **Write the production code** until the test passes.
4. **Close the loop** with `done` — this updates the matrix.

### Do it

```bash
# After the test + code for REQ-001 exist:
specgate done REQ-001 --strict --test-cmd "npm test"
```

`done` flips that requirement's `Status` cell in `traceability.md` to
`Implemented`. `--check` runs `validate` first and refuses to write on failure,
so the matrix can never claim something is done while the gates are red.
`--strict` runs the strong gate instead — `--strict-tdd --strict-links
--strict-coverage`. `--status <Status>` targets another terminal state
(`Verified`, `Released`, …).

**Pass `--test-cmd`, or set `test_cmd:` in `harness.config.yaml`.** Without one,
`done` checks the specification and never runs your code — and it says so rather
than reporting a pass. `Implemented` is what other people read off the matrix;
it should not be a claim nothing executed.

Re-run `specgate plan` — `REQ-001` is now under **✅ Done**.

---

## 7. Step 6 — Add a NEW requirement (as a project consumer)

> 📍 **Run from:** inside your project — `smart-parking/`. You do **not**
> touch the pack repo here.

### Concept

The pack covers parking operations in general, but **your** project needs
something extra — say, _"operators can reserve a parking spot in advance."_
You add it **locally, in your project**. It is yours; it is not part of the
pack; and — importantly — it will **survive every future `specops sync`**,
because sync only reconciles files the pack owns.

The workflow is the same `validate`/`plan`/`done` loop you already know,
with two new files in front of it.

### 7.1 Describe it in `spec.md`

Add a section to `spec.md`:

```markdown
## REQ-101 — Reserve a parking spot in advance

An operator can reserve a specific spot for a future time window so a
known vehicle is guaranteed space on arrival.
```

> Use an ID range that will not collide with the pack. The pack uses
> `REQ-001…`; keep your project-local requirements at `REQ-101` and up.

### 7.2 Write the Gherkin scenario first

```bash
mkdir -p features/reservations
cat > features/reservations/reserve_spot.feature <<'EOF'
@REQ-101
Feature: Reserve a parking spot

  Scenario: Reserving an available spot for a future window
    Given spot "A-12" is free between "09:00" and "11:00"
    When an operator reserves spot "A-12" for that window
    Then spot "A-12" is marked "Reserved" for that window
    And a "SpotReserved" event is emitted
EOF
```

### 7.3 Add the traceability row — with `specgate req`, not by hand

The matrix is a ten-column pipe table. Editing it by hand is the single most
common source of broken links in a spec-driven project, and one misplaced `|`
breaks the row silently. `specgate req` writes it for you:

```bash
specgate req add "Reserve a parking spot in advance"
#   ✔  Added REQ-101 (SCN-101, status Draft)

specgate req link REQ-101 \
  --feature features/reservations/reserve_spot.feature \
  --uc UC-101 --cmd ReserveSpotCommand \
  --agg ParkingFacility --evt SpotReserved
```

`req add` picks the next free ID, so it cannot collide with the pack's range,
and `req link` fills the columns you name and leaves the rest alone.

> `AGENTS.md` tells every agent never to edit `traceability.md` directly.
> The same applies to you: `specgate req`, `specgate done` and `specgate change archive`
> are the three things that write it.

### 7.4 Validate, plan, implement, close

```bash
specgate status                      # where the project stands, and what is next
specgate validate . --strict     # confirms REQ-101 is wired in correctly
specgate plan                        # REQ-101 now appears as pending
# …write ReservationServiceTest, then ReservationService.java…
specgate req link REQ-101 --test ReservationServiceTest --code ReservationService.java
specgate done REQ-101 --strict
```

That is the whole consumer loop: **spec → scenario → matrix row → validate
→ plan → implement → done.** To put a requirement into the **pack** so
every project gets it, see Step 10.

> **This is the day-one path.** Once a requirement has shipped, changing it
> goes through the change lifecycle instead — Step 11½ — so the modification
> is reviewable as intent rather than as a diff of the matrix.

---

## 8. Step 7 — Upgrade the pack version (`specops diff` + `specops sync`)

> 📍 **Run from:** inside your project — `smart-parking/`.
>
> ⚠️ **This is the step people get wrong.** `diff` and `sync` run **from
> your implementation project**, _not_ from the pack repo. The pack repo is
> just the source. `diff`/`sync` reconcile **your project** against a newer
> pack version, using the `.specops.lock` that lives inside your project.
> You never `cd` into `parking-management-specops` for this.

### Concept

Time passes. The pack maintainers publish a new git tag — say `v0.2.0` —
with new scenarios and fixes. You decide _when_ to adopt it. Two commands:

- **`specops diff`** — _preview_. Renders the pack at the new version into a
  throwaway temp folder and shows you what would change. Writes nothing.
- **`specops sync`** — _apply_. Re-renders the pack and **three-way merges**
  the result into your project, preserving your local edits.

### 8.1 Preview the change — `specops diff`

```bash
# still inside smart-parking/
specgate specops diff --pack-version v0.2.0
```

```text
── backend @ v0.2.0 (current: v0.1.0) ──
  + features/pricing/dynamic_pricing.feature
  ~ docs/specs/use-cases.md
  ~ docs/specs/traceability.md

  1 added · 2 modified · 9 unchanged
```

`+` is a new file, `~` is a modified one. Nothing is written.
`--format json` (alias `--plan`) emits the same data for tooling.

### 8.2 Apply it — `specops sync`

```bash
specgate specops sync --pack-version v0.2.0
```

`sync` re-renders the pack and, for every file, compares **three versions**:

- **base** — what the pack rendered last time (kept in `.specops/baseline/`),
- **local** — what is in your project now (you may have hand-edited it),
- **incoming** — what the pack renders at the new version.

From that it picks a per-file outcome:

| Outcome     | Meaning                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `added`     | new file from the pack — written                                        |
| `unchanged` | identical already — nothing to do                                       |
| `updated`   | you never touched it → take the pack's new version                      |
| `kept`      | the pack did **not** change it but you did → **your edit is preserved** |
| `merged`    | both changed, different lines → merged cleanly                          |
| `CONFLICT`  | both changed the **same** lines → git-style `<<<<<<<` markers written   |

`sync` **exits non-zero** if any file is left in `CONFLICT`, so CI notices.
Resolve the markers by hand, then re-run.

**Flags:** `--dry-run` (preview, write nothing), `--force` (pack always
wins — discard local edits), `--abort-on-conflict` (leave conflicting files
untouched instead of writing markers), `--pack <id>` (sync just one pack).

### 8.3 After a sync

```bash
specgate validate . --strict
specgate plan                        # new REQs from the pack now show as pending
git add .specops.lock .specops/ docs/ features/
git commit -m "chore: sync parking pack to v0.2.0"
```

> Running `specgate specops sync` **without** `--pack-version` just re-renders
> everything at the versions already pinned in `.specops.lock` — handy
> after a fresh clone, or to regenerate a file someone deleted.

---

## 9. Step 8 — Remove a pack (`specops remove`)

> 📍 **Run from:** inside your project — `smart-parking/`.

```bash
specgate specops remove backend
```

`remove` drops the pack's entry from `.specops.lock`. It deliberately does
**not** delete the generated files — you may have hand-edited tests that
point at them. Review with `git status` and delete what you no longer want
by hand. `--dry-run` shows what would be removed.

---

## 10. Step 9 — Author your own pack

> 📦 **Run from:** the **pack repo** — a folder for _your_ pack (e.g.
> `~/sandbox/domain-packs/…`), **not** your implementation project. This is
> the one place in the tutorial where you leave `smart-parking/`.

### Concept

So far you have _consumed_ a pack. Eventually you will want to package
**your own** domain knowledge so other projects (or your future self) can
`specops add` it. Four commands cover the authoring lifecycle.

### 10.1 Scaffold — `pack init`

```bash
cd ~/sandbox
specgate pack init --out ./domain-packs --name "Reservations Backend" --type backend
# flavours: backend · frontend · contracts
```

Writes `./domain-packs/reservations/backend/pack.yaml` plus a `templates/`
folder.

### 10.2 Lint — `pack lint`

`pack lint` validates a pack beyond its JSON Schema: unique IDs,
cross-reference integrity, and **scenario quality**.

```bash
specgate pack lint --pack-root ./domain-packs --pack reservations/backend
```

The scenario-quality rules flag vague or thin Gherkin — a `Scenario
Outline` with no `Examples`, a scenario missing a `When`/`Then`, fewer than
three steps, a generic title, vague step language (`works`, `correctly`,
`as expected`, `etc`, `TODO`, `...`), or a `pack.yaml` scenario name that
has drifted from its template title.

```bash
# In CI — and before a pack feeds the harness — promote those to errors:
specgate pack lint --pack-root ./domain-packs --pack reservations/backend --strict
```

This matters because the pack's scenarios become the **reward signal** for
the harness (Step 11): weak scenarios let the harness wave through weak
code.

### 10.3 See the reference graph — `pack lint --graph`

The hardest part of authoring a pack is keeping the
`REQ → UC → CMD/QUERY/AGG → EVT` cross-references consistent by hand.
`--graph` draws that spine so you can _see_ it:

```bash
# Mermaid (default) — renders natively in GitHub and VS Code
specgate pack lint --pack-root ./domain-packs --pack reservations/backend --graph

# Graphviz DOT
specgate pack lint --pack-root ./domain-packs --pack reservations/backend --graph --graph-format dot
```

A reference to an ID/name that does not exist becomes a red **missing**
node in the diagram **and** is listed on stderr — and the command exits
non-zero, so `--graph` doubles as a CI link-check.

### 10.4 Invert the flow — `pack infer`

Writing the model first (requirements → use cases → commands → events) and
the scenarios last has a waterfall smell. `pack infer` flips it: write the
`.feature` first, get a proposed `pack.yaml` skeleton back.

```bash
specgate pack infer --from ./drafts/reserve_spot.feature
```

It heuristically maps a `@REQ-NNN` tag → a requirement reference; the
`Feature:` name → the use case name; each `When` step → a command **or a
query**; a quoted PascalCase token in a `Then` step → an event; each
`Scenario:` → a `scenarios[]` entry. Anything it cannot infer is left as an
explicit `TODO:` — a skeleton to review, never a silent guess. Output goes to
stdout (`--format json` for tooling); it never mutates `pack.yaml`.

Five things it does that are worth knowing, because each one used to be a
correction you made by hand:

- **The same operation is proposed once.** A happy path and its failure
  exercise one command; they used to arrive as two entries with two ids.
- **A `When` that reads becomes a query**, with a `QRY-` id — "searches",
  "views", "lists". The pack model already separates queries from commands;
  inference now does too.
- **Names drop the glue.** "10 more vehicles enter the facility" gives
  `MoreVehiclesEnterFacility`, not `MoreVehiclesEnterThe`.
- **Field names are proposed from the Gherkin** — `<placeholders>` in a
  Scenario Outline and `key: value` pairs — each with a `TODO` for its type.
  The names are in the file; the types are not, and a guessed type that looked
  confident is exactly what [ADR-0014](specs/adr/0014-pack-infer-heuristic.md)
  refuses.
- **`--from` repeats, and takes a directory.** A capability is rarely one file,
  and inferring per file proposes a shared command once per file:

  ```bash
  specgate pack infer --from ./drafts/            # every .feature in it
  specgate pack infer --from a.feature --from b.feature
  ```

```bash
# Review the proposal, then merge the parts you want:
specgate pack infer --from ./drafts/reserve_spot.feature >> domain-packs/reservations/backend/pack.yaml
```

---

## 11. Step 10 — Add a NEW requirement (as a pack author)

> 📦 **Run from:** the **pack repo** (e.g. a clone of
> `parking-management-specops`, or your own pack folder). This is the
> _other half_ of "adding a requirement" — Step 6 added one to a single
> project; this adds one to the **pack**, so **every** project that
> `specops sync`s will receive it.

### 11.1 Draft the scenario, then infer the model

```bash
# inside the pack repo
cat > drafts/waitlist.feature <<'EOF'
@REQ-006
Feature: Capacity waitlist

  Scenario: Joining the waitlist when the facility is full
    Given the facility is at full capacity
    When a driver requests entry
    Then the driver is added to the waitlist
    And a "DriverWaitlisted" event is emitted
EOF

specgate pack infer --from drafts/waitlist.feature
```

### 11.2 Merge the inferred skeleton into `pack.yaml`

Add the new `requirement`, `use_case`, `command`, `event` and `scenario`
entries to `pack.yaml`, replacing every `TODO:` with real values and fixing
the IDs so they fit the pack's numbering. Add the feature template under
`templates/features/…` and point the scenario's `template:` / `target:`
fields at it.

### 11.3 Lint — including the graph

```bash
specgate pack lint --pack-root . --pack backend --strict
specgate pack lint --pack-root . --pack backend --graph
```

`--strict` catches a weak new scenario; `--graph` shows the new
`REQ-006 → UC-006 → … → DriverWaitlisted` spine and shouts if you mistyped
a reference.

### 11.4 Version, tag, publish

```bash
# bump metadata.version in pack.yaml (e.g. 0.1.0 → 0.2.0), then:
git commit -am "feat: add capacity waitlist (REQ-006)"
git tag v0.2.0
git push --tags
```

### 11.5 Consumers adopt it — back in their projects

Now anyone with a project that uses this pack picks up `REQ-006` through
the normal Step 7 flow — **from inside their own implementation project**:

```bash
# 📍 inside smart-parking/  (NOT the pack repo)
specgate specops diff --pack-version v0.2.0     # preview: + waitlist feature, ~ matrix
specgate specops sync --pack-version v0.2.0     # three-way merge into the project
specgate plan                                   # REQ-006 now shows as pending
```

That is the full pack-author loop: **draft scenario → `pack infer` → merge
→ `pack lint --strict --graph` → version + tag → consumers `diff` +
`sync`.**

---

## 11¼. Step 10½ — Change a requirement that already shipped

> 📍 **Run from:** inside your project — `smart-parking/`.

### Concept

Step 6 added a requirement on a blank page. This is the other case, and it is
the one you hit for the rest of the project's life: **REQ-101 shipped, and now
it has to change.**

Editing `spec.md` and the matrix directly would work, and it would leave no
record of *why*. A change makes the modification reviewable as intent — a
delta stating only what moves — and archiving it writes the matrix rows for you.

### Open it

```bash
specgate change new reservations-need-a-deposit
#   ✔ Change reservations-need-a-deposit created (lite · REQ ids REQ-102…REQ-104 reserved)

specgate change status
#   ✔ proposal   proposal.md
#   ▶ specs      specs/**/spec.md
#   Next → Write specs/**/spec.md
```

The reserved ID range means two changes in flight never hand out the same
`REQ-NNN`.

### Write the delta

Only what moves. `specgate change instructions specs` prints the template, the
rules the validator enforces and your project's declared stack:

```markdown
# Delta — reservations

## MODIFIED Requirements

### Requirement: REQ-101 — Reserve a parking spot in advance

The system SHALL require a deposit before confirming a reservation, and SHALL
release the spot if the deposit is not paid within 15 minutes.

#### Scenario: SCN-101 — A reservation without a deposit expires

- GIVEN spot "A-12" is reserved but unpaid
- WHEN 15 minutes pass
- THEN the reservation is cancelled and the spot is free again

<!-- csda:trace uc=UC-101 cmd=ReserveSpotCommand agg=ParkingFacility evt=ReservationExpired
     feature=features/reservations/reserve_spot.feature -->
```

`MODIFIED` replaces the whole requirement block; it does not merge scenario by
scenario. Steps are plain `- GIVEN` bullets, and the body needs `SHALL`,
`MUST`, `SHOULD` or `MAY` — the validator rejects both alternatives.

### Review, archive, implement

```bash
specgate change validate                       # runs inside `specgate validate` too
specgate change archive reservations-need-a-deposit --dry-run
specgate change archive reservations-need-a-deposit --yes
```

Archiving is the part that earns the ceremony. It applies the delta to
`docs/specs/capabilities/`, **writes the traceability rows**, copies the
proposed `.feature` files into `features/`, and files the change under
`docs/specs/changes/archive/<date>-<id>/`.

The moment it lands, the requirement is real work again:

```bash
specgate plan                        # the modified REQ is pending once more
specgate validate . --strict     # fails with [TDD-1] once you move it to In Dev
```

> **It composes with packs.** When the pack itself changes, `specgate specops diff
> --as-change` derives exactly this kind of proposal from the version bump — so
> you review an upstream upgrade as intent rather than as a file diff. That is
> Step 7 with one extra flag.

→ [Reviewing changes](reviewing-changes.md) for the full reference.

---

## 11½. Bootstrap before the harness (the only freeform-AI step)

> 📍 **Run from:** inside your project — `smart-parking/`.

### Concept

The harness implements **one REQ at a time** inside an isolated worktree.
That is great for _iterating_, but it does not bootstrap your project:
it assumes the build system is already there, the BDD framework is wired,
and at least one bounded context runs end-to-end. Phase 1 — that first
scaffolding — is the only step where you hand a freeform AI prompt to
opencode/Claude/Cursor.

The complete prompt, ready to paste, lives at
[`docs/bootstrap-prompt.md`](./bootstrap-prompt.md). It tells the agent:

- it is your **Lead Architect**;
- the current directory is the only scope;
- `spec.md`, `AGENTS.md`, `features/**/*.feature` are **read-only**;
- to make `specgate validate . --strict` + the project test command pass
  with the first bounded context end-to-end — then **stop**.

```bash
# 1. Open opencode/Claude/Cursor inside smart-parking/
# 2. Paste docs/bootstrap-prompt.md verbatim, then "go".
# 3. When the agent is done, prove it:
specgate validate . --strict
mvn -B test          # or your stack's test command
specgate plan            # remaining REQs show as pending
git commit -am "phase 1: bootstrap"
```

From this point on the harness takes over — you never paste a prompt
again. The universal directives from `bootstrap-prompt.md` (Role, Active
Project Boundary, Execution Policy) move into `harness.config.yaml` so
they ride along on every REQ.

---

## 12. Step 11 — Automate delivery with the harness (`harness run`)

> 📍 **Run from:** inside your project — `smart-parking/`.

### Concept

Everything in Steps 4–6 — read the scenario, write the test, write the
code, run `done` — is a loop a machine can drive. `harness run` is that
driver. For each pending requirement, in an **isolated `git worktree`** on a
fresh `harness/REQ-NNN` branch, it:

1. builds a self-contained prompt (the Gherkin scenario + `AGENTS.md` +
   the exact artifact paths + any previous failure),
2. shells out to **your** AI agent,
3. gates the result with `validate --strict` + your test command,
4. on green → runs `done` and commits; on red → retries, feeding the
   failure back into the next prompt,
5. prints a pass/fail/attempts report.

It is **vendor-neutral**: the agent is _any shell command_ that contains
the `{prompt_file}` placeholder. The harness never merges a branch — you
review and merge `harness/*` yourself.

### 12.1 Configure it — using **opencode** as the agent, with a project-wide prompt prefix

Start by generating the two files rather than copying them out of this page:

```bash
specgate harness init
```

It writes `harness.config.yaml` and `.harness/prompt-prefix.md`, detects your
gate from the build files it finds (`mvn -B test` here, from `pom.xml`), and
deliberately leaves `agent:` unset — which agent runs this is your choice and
your credentials. Read the prefix it generates and make it sound like your
team; the rest of this section is what a filled-in version looks like.

If you drive your editor with [opencode](https://opencode.ai), point the
harness at it. The harness writes each prompt to a temp file and substitutes
its path for `{prompt_file}`; `opencode run` takes a prompt string, so read
the file in:

```yaml
# harness.config.yaml — at the root of smart-parking/
harness_version: 1
agent: 'opencode run "$(cat {prompt_file})"'
test_cmd: "mvn -q test"
max_attempts: 3

# Project-wide directives prepended to every per-REQ prompt: Role,
# Active Project Boundary, Execution Policy. Use prompt_prefix for a
# one-liner; prompt_prefix_file for the realistic multi-line case.
prompt_prefix_file: ./.harness/prompt-prefix.md
```

```markdown
<!-- .harness/prompt-prefix.md -->

# Role

You are the Lead Technical Architect and Senior Backend Engineer.

# Active Project Boundary

- Current directory is the only scope. Do NOT scan siblings.

# Execution Policy

- Start coding. No planning-only output.
- Hexagonal architecture is non-negotiable (see AGENTS.md).
- Never modify AGENTS.md, spec.md, or features/\*_/_.feature.
```

With a config file you do not have to retype anything. (Any other agent
works the same way — e.g. `claude -p < {prompt_file}` or
`aider --yes --message-file {prompt_file}`.) The `prompt_prefix` /
`prompt_prefix_file` rides along on **every** per-REQ prompt, so your
universal directives are not duplicated and not forgotten.

### 12.2 Dry-run first

```bash
specgate harness run --dry-run
```

`--dry-run` builds and prints the prompt for every pending requirement
**without** invoking the agent or touching git. Read what opencode would
receive before you spend tokens.

### 12.3 Run it

```bash
# the working tree must be clean — the harness refuses a dirty tree
specgate harness run --agent 'opencode run "$(cat {prompt_file})"' --test-cmd "mvn -q test"
```

(If you put the agent and test command in `harness.config.yaml`, plain
`specgate harness run` is enough.)

```text
── harness report ──
  ✅ REQ-002  pass (1 attempt)   → harness/REQ-002
  ✅ REQ-003  pass (2 attempts)  → harness/REQ-003
  ❌ REQ-004  fail (3 attempts)  → harness/REQ-004
       Gate failed at: test command

  2 passed · 1 failed · 0 skipped
  Review and merge the harness/* branches you trust.
```

**Flags:** `--req REQ-NNN` (limit to specific requirements, repeatable —
great for trying one first), `--max-attempts <n>`, `--base-branch <ref>`,
`--timeout <seconds>`, `--keep-worktrees`, `--force` (recreate existing
`harness/*` branches), `--format json`.

The command exits non-zero if any requirement did not pass, so CI can gate
on it. Each result is a branch you can check out, inspect, and merge — or
throw away.

### 12.4 Inspect what the agent will receive (`harness prompt`)

```bash
specgate harness prompt REQ-001
```

Prints the exact prompt the harness _would_ hand the agent for one REQ —
prefix included — without invoking the agent, creating worktrees, or
touching git. Use it to:

- iterate on `AGENTS.md` and `prompt_prefix` and see the effect immediately;
- copy-paste the prompt into a web AI when no CLI agent is available;
- review what the team's bootstrap directives currently say.

Every prompt the harness actually sends during `harness run` is also
mirrored to `.specops/harness-prompts/REQ-NNN-<timestamp>-attempt-N.md`
for after-the-fact review. Commit or gitignore that folder per your
team's preference.

---

## 12½. Multi-stack: one pack, many implementations

The pack/implementation split lets you ship the **same domain spec** in
multiple stacks without duplicating requirements or scenarios. Each
implementation is its own repo:

```text
parking-management-specops@v0.1.0      ◄── one spec, stack-agnostic
        ├──► smart-parking-spring/      (STACK=Spring Boot, JUnit+Cucumber)
        ├──► smart-parking-quarkus/     (STACK=Quarkus,     JUnit+Cucumber)
        └──► smart-parking-micronaut/   (STACK=Micronaut,   JUnit+Cucumber)
```

Each project runs its own `specgate init` with a different `STACK` in the
config, its own `specgate specops add` against the **same** pack repo +
version + domain `--var`s, its own bootstrap-prompt run, and its own
harness loop. `spec.md`, `features/**` and `traceability.md` are
**identical** across stacks (rendered from the same pack); `AGENTS.md`
differs because its `{{STACK}}` substitution does.

Useful for migration POCs, framework comparisons, educational material
("same problem, three stacks"). The architecture explicitly supports it —
see [`docs/specs/architecture.md`](./specs/architecture.md) §5.

---

## 13. Step 12 — Companion tooling

### VS Code extension

The `vscode-spec-driven` extension turns the editor into a pack-authoring
surface: live JSON Schema squigglies on `pack.yaml`, **dangling-reference
diagnostics**, **reference-field autocomplete** (offers the IDs/names that
actually exist), **go-to-definition** on a reference, a **CodeLens** showing
how many use cases and scenarios point at each requirement,
validate-on-save, and the **`Spec-Driven: Show Pack Graph`** command — a
side-panel Mermaid render of the pack graph that refreshes as you edit.

### MCP server

The `mcp-spec-driven` server exposes `plan`, `mark_requirement_done`,
`read_spec`, `lint_pack` and friends as MCP tools, so an MCP-aware client
(Claude Desktop, Cursor, opencode, Aider) can drive the same loop natively.

### Slash commands, for eight tools at once

```bash
specgate agents init                     # or --tool claude,cursor
```

That writes `/specgate:explore`, `/specgate:new`, `/specgate:apply`, `/specgate:check`,
`/specgate:done`, `/specgate:propose`, `/specgate:archive` and `/specgate:onboard`, plus the instruction file each tool reads
— `.cursor/rules/`, `.github/copilot-instructions.md`, `CONVENTIONS.md` and so
on. They are thin on purpose: rather than restating the delta grammar, which
would be stale the moment it moved, they call `specgate change instructions
<artifact> --json` for it.

After a CLI upgrade, `specgate update` three-way merges those files so your edits
survive.

### Keeping an existing repository honest

This tutorial started from `init`, on a blank page. On a repository that
already has code, `specgate init` adopts it: it reads the layout, proposes the
capabilities the code already implies and writes the spec skeleton without
touching a line of source. `specgate doctor` reports what has
drifted, with a fix per finding.

---

## 14. Command cheat-sheet

The 📍 / 📦 column is the thing to remember — **where** you run it.

| Command                                                               | Run from      | What it does                                                             |
| --------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------ |
| `specgate init --config <f.yaml> --out <dir>`                             | 📍 parent dir | Scaffold a new spec-driven project                                       |
| `specgate validate <dir> [--strict]`                                      | 📍 project    | Check structure, traceability, Gherkin; `--strict` is the gate           |
| `specgate plan [--format json]`                                           | 📍 project    | List requirements still needing work                                     |
| `specgate done REQ-NNN [--check\|--strict]`                               | 📍 project    | Mark a requirement done in the matrix                                    |
| `specgate status`                                                         | 📍 project    | Daily dashboard: totals, orphans, pack versions, next command            |
| `specgate req add\|link\|done\|list`                                        | 📍 project    | Manage matrix rows without hand-editing the table                        |
| `specgate fix [--dry-run]`                                                | 📍 project    | Apply the repairs `validate` suggests                                    |
| `specgate change new <id> [--lite\|--full]`                                | 📍 project    | Open a change against specs that already shipped                         |
| `specgate change status \| validate \| show \| list`                        | 📍 project    | What to write next · check the deltas · inspect · enumerate              |
| `specgate change archive <id> [--dry-run\|--yes]`                          | 📍 project    | Merge the delta into the specs + matrix, then file the change away       |
| `specgate specops add --pack-repo … --pack-version … --pack … --var …`    | 📍 project    | Pull a pack in; writes `.specops.lock` + `.specops/` baseline            |
| `specgate specops diff [--pack-version …]`                                | 📍 project    | Preview what a sync would change — writes nothing                        |
| `specgate specops sync [--pack-version …]`                                | 📍 project    | Re-render + three-way merge the pack into the project                    |
| `specgate specops remove <pack-id>`                                       | 📍 project    | Drop a pack from `.specops.lock`                                         |
| `specgate specops diff --as-change`                                       | 📍 project    | Turn an upstream pack bump into a reviewable change proposal             |
| `specgate specops contribute --change <id>`                               | 📍 project    | Send a local change back upstream to the pack (never pushes)             |
| `specgate validate --against-lock`                                        | 📍 project    | Fail CI when the project has drifted from the locked pack version        |
| `specgate expand --pack-repo … --pack-version … --pack …`                 | 📍 project    | Low-level pack render (what `sync` calls)                                |
| `specgate harness run --agent "… {prompt_file}" [--test-cmd …]`           | 📍 project    | Run the plan→agent→verify→done loop per requirement                      |
| `specgate pack init --out … --name … --type backend\|frontend\|contracts` | 📦 pack repo  | Scaffold a pack skeleton                                                 |
| `specgate pack lint --pack-root … --pack … [--strict]`                    | 📦 pack repo  | Lint a pack: schema, cross-refs, scenario quality                        |
| `specgate pack lint … --graph [--graph-format mermaid\|dot]`              | 📦 pack repo  | Render the pack reference graph; CI link-check                           |
| `specgate pack infer --from <feature> [--format json]`                    | 📦 pack repo  | Propose a `pack.yaml` skeleton from a `.feature`                         |

**Three ways to add a requirement, side by side:**

|       | Day one, by hand (Step 6)      | As a change (recipe 12)                       | As a pack author (Step 10)                   |
| ----- | ------------------------------ | --------------------------------------------- | -------------------------------------------- |
| Where | 📍 your implementation project | 📍 your implementation project                | 📦 the pack repo                             |
| 1     | edit `spec.md`                 | `change new <id>`                             | draft a `.feature`, run `pack infer`         |
| 2     | write `features/**.feature`    | write the delta under `specs/<cap>/spec.md`   | merge the inferred skeleton into `pack.yaml` |
| 3     | add a row to `traceability.md` | `change validate`                             | add the feature template under `templates/`  |
| 4     | `validate --strict-tdd`        | `change archive` — writes the row **for you** | `pack lint --strict --graph`                 |
| 5     | `plan` → implement → `done`    | `plan` → implement → `done`                   | bump version, tag, push                      |
| 6     | survives every `specops sync`  | reviewable as intent, archived with a date    | consumers `specops diff` + `specops sync`    |

Use the middle column once the project is live: it is the only one of the three
that leaves an audit trail of *why* a requirement changed, and the only one
where you do not touch the ten-column matrix by hand.

---

You have now exercised every command the tool ships. For deeper reference
see [`docs/how-to.md`](./how-to.md), the
[domain-pack format spec](./specs/domain-pack-format.md), the
[SpecOps workflow](./specs/specops.md) and the
[harness spec](./specs/harness.md).
