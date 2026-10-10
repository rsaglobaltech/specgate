# Getting started

Two ways in, depending on whether the code already exists. Both take
under an hour and neither requires reading anything else first.

---

## Adopt SDD on an existing repository

**Goal:** the brownfield path (L1) — install specs, rules and the traceability
matrix on a codebase that already exists, without touching a line of code.

```bash
cd your-existing-repo
npx @rsaglobaltech/specgate@latest init    # adopts the repo: writes specs, touches no code
npx @rsaglobaltech/specgate@latest check   # the gate — passes right away
```

It passes and says *"this checked the specification, not the code"* until it
knows how to run your tests. Tell it once:

```bash
npx specgate config set test_cmd "npm test"   # or ./mvnw -B verify, go test ./..., pytest
```

It writes `test_cmd:` to `harness.config.yaml`, where `check` and `done` read it.

`init` sees the code (a `pom.xml`, `build.gradle`, `package.json`, `go.mod`,
`pyproject.toml`, `Cargo.toml` or `.csproj`) and adopts the repository in place.
It proposes the capabilities your layout already implies and names the evidence
for each — the modules your build declares, or the level at which your code
divides. (`specgate onboard` shows the same proposals without writing anything.)

```
3. Capabilities this codebase already implies
   · Booking       domain/src/main/java/com/acme/booking   (28 files)
   · Business      domain/src/main/java/com/acme/business   (20 files)
   · Wallet        domain/src/main/java/com/acme/wallet       (6 files)
```

`adopt` then seeds one **proposed** requirement per capability, so `spec.md`
starts as a handful of statements to argue with instead of a blank page. Each
one says it is a guess and names where it came from; each gets a `Draft` row
with a `TBD` test, so nothing claims to be specified or verified.

What `adopt` writes (and only if the file does not already exist):

| File | Purpose |
| --- | --- |
| `spec.md` | REQ-001 "existing behaviour is preserved", plus one proposed requirement per capability. |
| `AGENTS.md` | The agent contract — commands, the loop, what never to do, your stack's rules. The file Codex, Cursor, Copilot and most agents read. |
| `features/adoption/baseline.feature` | Baseline Gherkin scenario pinning the adoption invariant. |
| `docs/specs/traceability.md` | The traceability matrix — **generated** from `spec.md`, the scenario tags and the files that mention each requirement. Nobody edits it ([why](writing-specs.md#a-matrix-nobody-edits)); `--keep-matrix` keeps one by hand. |
| `docs/specs/adr/README.md` | ADR index for future decisions. |

Override anything the detection got wrong with `--var`, and skip the proposals
entirely with `--no-capabilities` — on `init` too, which is what you want on a
scaffold you have just generated (its folders name no behaviour yet):

```bash
npx @rsaglobaltech/specgate@latest adopt \
  --var DOMAIN="health information exchange" \
  --var TEST_CMD="./mvnw -B verify"
```

## Your first requirement — five commands

```bash
specgate status                                  # what is left, and the next command
specgate new "Totals are rounded to the cent"    # spec section + tagged scenario + row
# 1. rewrite the <placeholders> in the scenario it wrote
# 2. write a test that mentions REQ-002 — that mention is the link
specgate done REQ-002                            # the gate for this requirement, then closes it
specgate check                                   # the whole gate, before the pull request
```

That is the whole daily loop. Nothing edits the matrix and nothing runs
`req link`: a test or a source file that names `REQ-002` is linked to it.

### A repository with more than one module

`adopt` reads `pom.xml`, `build.gradle`, `package.json`, `go.mod`,
`pyproject.toml`, `setup.py`, `Cargo.toml` and `*.csproj`. When it cannot
identify the stack it says so rather than guessing, and `--var STACK=…`
`--var TEST_CMD=…` fill it in.

If your build declares modules — Maven or Gradle sub-projects, npm or pnpm
workspaces, Cargo members, Go modules, gems, `.csproj` files — adopt each one
and let `validate` aggregate:

```bash
npx @rsaglobaltech/specgate@latest adopt --monorepo
npx @rsaglobaltech/specgate@latest validate .   # one line per module
```

That writes `specops.config.yaml` listing every module it adopted. The
repository root stays out of it: in monorepo mode `validate` checks the
children.

Then retro-fill real requirements one at a time (recipe 2) and lock the gate
in CI (recipes 4–5). Until you do, `validate` passes but says so — an adoption
whose only scenario is the baseline certifies the skeleton, not the code.

---

---

## Generate your first project

**Goal:** scaffold a new repo with `spec.md`, `AGENTS.md`, `docs/specs/`, an empty `features/` directory, and a traceability matrix.

```bash
# 1. Describe the project — these seven keys are the minimum
cat > /tmp/acme-energy-hub.config <<'CONFIG'
PROJECT_NAME="Acme Energy Hub"
PROJECT_SLUG="acme-energy-hub"
PROJECT_TYPE="backend"   # backend | frontend
DOMAIN="community energy"
STACK="Quarkus 3.x, Java 21, PostgreSQL, Maven"
API_STYLE="REST with DTO boundaries"
TESTING="JUnit 5, Cucumber"
CONFIG

# 2. Scaffold
npx @rsaglobaltech/specgate@latest init \
  --config /tmp/acme-energy-hub.config \
  --out /tmp

# 3. Verify
ls /tmp/acme-energy-hub
cd /tmp/acme-energy-hub && npx @rsaglobaltech/specgate@latest check
```

Useful flags:

| Flag | Use |
| --- | --- |
| `--dry-run` | Print every file that would be written; don't touch disk. |
| `--force` | Overwrite a pre-existing target directory. |
| `--no-git` | Skip `git init` (defaults to initialising). |
| `--multi-stack <a,b,c>` | Scaffold one sibling project per stack under a single root, sharing one spec. See below. |

### One specification, several stacks

When the same product is being built in more than one stack — a migration, a
bake-off, the same API in two languages — the requirements are the same
sentences and the scenarios describe the same behaviour. Only the code differs.

```bash
npx @rsaglobaltech/specgate@latest init --yes \
  --multi-stack spring,quarkus,micronaut \
  --out /tmp
```

That writes one root holding the shared spec, and one project per stack:

```
my-spec-driven-app/
├── spec.md                  the requirements — one copy
├── features/                the scenarios — behaviour is the same everywhere
├── docs/specs/adr/          decisions about the product, not one toolchain
├── specops.config.yaml      projects: ./spring, ./quarkus, ./micronaut
├── spring/
│   ├── spec.md → ../spec.md         shared, not copied
│   ├── AGENTS.md                  its own — one rulebook per toolchain
│   └── docs/specs/traceability.md   its own — see below
├── quarkus/
└── micronaut/
```

`validate`, `plan`, `status` and `report` already fan out over `projects:`, so
one command covers every stack:

```bash
npx @rsaglobaltech/specgate@latest validate .   # 3/3 project(s) passed
```

**Why the matrix is not shared.** A requirement is the same sentence whether
Spring or Quarkus implements it. But the traceability matrix maps a requirement
to *the file that implements it* and *the file that proves it*, and those are
different files in every stack. Sharing the matrix would mean claiming a Quarkus
test proves the Spring implementation.

**On Windows.** Symlinks need Developer Mode or an elevated shell. Without them
the shared paths are copied instead, and `init` says so. The guarantee moves
into the gate rather than disappearing: `validate` fails when a copy no longer
matches the root, so three stacks cannot quietly drift into describing three
different products.

---

---

## Replace the scaffold with real requirements

**Goal:** turn the template `spec.md` into project-specific content.

1. Open `spec.md`. Replace every placeholder paragraph; keep the `## REQ-NNN — title` heading convention, because the matrix is generated from it.
2. Add each new requirement with `specgate new "<title>"`: it writes the section and a tagged scenario. Do not edit `docs/specs/traceability.md` — it is regenerated from `spec.md`, the scenario tags and the tests that mention each requirement.
3. A `Draft` requirement owes nothing yet and is skipped; once it leaves `Draft` it owes a scenario and a test that mentions it — `check` says how many rows it skipped, so a pass never hides its own scope.

> Tip: keep `AGENTS.md` open in your editor. It is what every coding agent reads on every prompt — changes there propagate to Claude/Cursor/Aider without re-prompting.

---

---

## Then: the daily loop

Scaffolding is day one. From day two the loop is five commands, and none of them
asks you to edit the matrix by hand.

```bash
specgate status                      # what is left, and the next command to run
specgate new "Operators can export a monthly report"
# write src/ReportTest.java and mention REQ-007 in it — that is the link
specgate done REQ-007 --test-cmd "npm test"   # the gate AND the suite;
                                             # refuses to write if either fails
```

`specgate status` is the one to start the day with — it names the single next
command, so you never have to remember which of the others applies.

If the gate reports an orphan `.feature` — one no requirement claims — tag its
scenario `@REQ-NNN @SCN-NNN`, or create the requirement with `specgate new`.
`specgate fix --dry-run` lists what it can repair on its own; on a generated
matrix, that is mostly telling you which tag is missing.

---

## Next

- [Your team's first pull request — author and reviewer](first-pr.md)
- [Every command, grouped by when you need it](commands.md)
- [Write your first scenario](writing-specs.md)
- [Put the gate in CI](validating.md)
- [The whole loop, end to end](tutorial.md)
