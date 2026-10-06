# Getting started

Two ways in, depending on whether the code already exists. Both take
under an hour and neither requires reading anything else first.

---

## Adopt SDD on an existing repository

**Goal:** the brownfield path (L1) — install specs, rules and the traceability
matrix on a codebase that already exists, without touching a line of code.

```bash
cd your-existing-repo

# Read the repository first. Writes nothing.
npx @rsaglobaltech/specgate@latest onboard

# Detects the stack from pom.xml / build.gradle / package.json / go.mod
npx @rsaglobaltech/specgate@latest adopt

# Passes immediately — the generated baseline REQ-001 anchors the matrix
npx @rsaglobaltech/specgate@latest validate .
```

Start with `onboard`. It proposes the capabilities your layout already implies
and names the evidence for each — the modules your build declares, or the level
at which your code divides:

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
| `AI_RULES.md` | Agent/human rulebook with your detected stack and test command. |
| `features/adoption/baseline.feature` | Baseline Gherkin scenario pinning the adoption invariant. |
| `docs/specs/traceability.md` | Rich matrix with the baseline row and a row per proposal. |
| `docs/specs/adr/README.md` | ADR index for future decisions. |

Override anything the detection got wrong with `--var`, and skip the proposals
entirely with `--no-capabilities`:

```bash
npx @rsaglobaltech/specgate@latest adopt \
  --var DOMAIN="health information exchange" \
  --var TEST_CMD="./mvnw -B verify"
```

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

**Goal:** scaffold a new repo with `spec.md`, `AI_RULES.md`, `docs/specs/`, an empty `features/` directory, and a traceability matrix.

```bash
# 1. Start from the shipped example
cp examples/project.config.example /tmp/acme-energy-hub.config

# 2. Edit /tmp/acme-energy-hub.config — minimum keys:
#   PROJECT_NAME, PROJECT_SLUG, PROJECT_TYPE, DOMAIN, STACK, API_STYLE, TESTING

# 3. Scaffold
npx @rsaglobaltech/specgate@latest init \
  --config /tmp/acme-energy-hub.config \
  --out /tmp

# 4. Verify
tree /tmp/acme-energy-hub -L 2
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
│   ├── AI_RULES.md                  its own — one rulebook per toolchain
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

**Goal:** turn the template `spec.md` and `traceability.md` into project-specific content.

1. Open `spec.md`. Replace every placeholder paragraph; keep the `REQ-NNN` heading convention because the validator uses it.
2. Update `docs/specs/traceability.md`. Use the rich 10-column header if you want full DDD coverage; the legacy 4-column form is also accepted.
3. Each `REQ-NNN` you add to `spec.md` must appear in `traceability.md` and (eventually) in a `.feature` file. `validate` flags missing rows; `validate --strict-tdd` flags missing scenarios and tests **on rows that have left `Draft`**. A `Draft` row owes nothing yet and is skipped — `validate` says how many it skipped, so a pass never hides its own scope.

> Tip: keep `AI_RULES.md` open in your editor. It is what every coding agent reads on every prompt — changes there propagate to Claude/Cursor/Aider without re-prompting.

---

---

## Then: the daily loop

Scaffolding is day one. From day two the loop is four commands, and none of them
asks you to edit the ten-column matrix by hand.

```bash
specgate status                      # what is left, and the next command to run
specgate new "Operators can export a monthly report"
# write src/ReportTest.java and mention REQ-007 in it — that is the link
specgate done REQ-007 --strict --test-cmd "npm test"   # validates AND runs the suite;
                                                      # refuses to write if either fails
```

`specgate status` is the one to start the day with — it names the single next
command, so you never have to remember which of the others applies.

If `validate` complains about something mechanical — an orphan `.feature`, a
requirement in `spec.md` with no row — `specgate fix --dry-run` shows what it would
repair, and `specgate fix` applies it.

---

## Next

- [Every command, grouped by when you need it](commands.md)
- [Write your first scenario](writing-specs.md)
- [Put the gate in CI](validating.md)
- [The whole loop, end to end](tutorial.md)
