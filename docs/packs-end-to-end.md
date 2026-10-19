# Domain packs, end to end

One pass through a pack's whole life on a project: install it, see what it
gave you, upgrade it to a newer version, and take it off again. It uses the
public demo pack
[`parking-management-specops`](https://github.com/rsaglobaltech/parking-management-specops),
which has two tags, `v0.1.0` and `v0.2.0`. Every command below was run
against that repository with Specgate 0.18.0.

For what a pack is and which ones exist, read [Domain packs](domain-packs.md).
If you are starting from your own plan rather than a pack, start with
[Getting started](getting-started.md) instead.

## 1. Scaffold a project for the pack

A pack brings its own requirements, so the project should start without any.
Describe it in a short config file and scaffold it with `--no-sample-req`:

```bash
cat > smart-parking.yaml <<'EOF'
PROJECT_NAME: Smart Parking
PROJECT_SLUG: smart-parking
PROJECT_TYPE: backend
DOMAIN: parking operations
STACK: Quarkus 3.x, Java 21, PostgreSQL
API_STYLE: REST with DTO boundaries
TESTING: JUnit 5, Cucumber
EOF

specgate init --config smart-parking.yaml --no-sample-req
cd smart-parking
```

<!-- specgate:note -->
**Adding a pack to a project `init` adopted.** In a repository that already
has code, `init` adopts it and seeds `REQ-001 — Existing behaviour is
preserved`. A pack whose ids start at `REQ-001` collides with it, and the gate
then reports the adoption baseline as an orphan feature. Pick a pack whose ids
do not overlap — the [proven packs](domain-packs.md) each use their own
range — or scaffold as above.
<!-- specgate:endnote -->

## 2. Install the pack, pinned to a version

```bash
specgate specops add \
  --pack-repo https://github.com/rsaglobaltech/parking-management-specops.git \
  --pack-version v0.1.0 \
  --pack backend \
  --var PROJECT_NAME="Smart Parking" \
  --var PROJECT_SLUG=smart-parking \
  --var DOMAIN="parking operations"
```

```text
  ℹ  Resolving remote pack https://github.com/rsaglobaltech/parking-management-specops.git@v0.1.0…
  ℹ  Wrote …/smart-parking/.specops.lock
  ℹ  Recorded baseline for 13 file(s) under .specops/baseline/backend
  ℹ  Generated 5 scenario file(s).
  ℹ  Domain pack expansion completed.
```

`add` clones the tag once into the pack cache, writes the requirements and
scenarios into the project, and records the source, the version and every
`--var` in `.specops.lock`, so later commands remember them.

## 3. See what it gave you

```bash
specgate status
```

```text
  Requirements  5 total · 0 done · 5 pending

  To do
    REQ-001   Monitor Capacity Threshold                    a test and code
    REQ-002   Register Vehicle Entry                        a test and code
    REQ-003   Calculate Parking Fee                         a test and code
    REQ-004   Detect Overstay                               a test and code
    REQ-005   Send Payment Receipt                          a test and code

  Packs  (.specops.lock)
    backend @ v0.1.0
```

`specgate check` passes: the requirements are Draft, so they owe nothing yet.
From here the daily loop is the usual one — `status`, a test that names the
requirement, `apply`, `check` — described in
[Build the first requirement](start/scratch-3-build.md) and
[Prove it](start/scratch-4-prove.md).

## 4. Preview an upgrade before taking it

`v0.2.0` of this pack requires four variables `v0.1.0` did not: `STACK`,
`API_STYLE`, `TESTING` and `LANG`. Pass them once with `--var`; they are
written back to the lockfile.

```bash
specgate specops diff --pack-version v0.2.0 \
  --var STACK="Quarkus 3.x, Java 21" --var API_STYLE="REST with DTO boundaries" \
  --var TESTING="JUnit 5, Cucumber" --var LANG=en
```

```text
── backend @ v0.2.0 (current: v0.1.0) ──
  + features/waitlist/capacity_waitlist.feature
  ~ AI_RULES.md
  ~ docs/specs/commands.md
  ~ docs/specs/domain-model.md
  ~ docs/specs/events.md
  ~ docs/specs/traceability.md
  ~ docs/specs/use-cases.md

  1 added · 6 modified · 7 unchanged
```

Without the new variables, `diff` and `sync` stop with
`Missing required variable 'STACK'. Provide it using --var STACK=...` — the
pack declares what it needs in `variables.required`. `diff` writes nothing;
`--json` gives the same report to an agent, and `--as-change` turns the bump
into a change folder you can review like any other.

## 5. Take the upgrade

```bash
specgate specops sync --pack-version v0.2.0 \
  --var STACK="Quarkus 3.x, Java 21" --var API_STYLE="REST with DTO boundaries" \
  --var TESTING="JUnit 5, Cucumber" --var LANG=en
```

```text
  ℹ  Syncing backend @ v0.2.0 (was v0.1.0)

── backend @ v0.2.0 ──
  1 added · 6 unchanged · 6 updated
  ℹ  Sync completed for 1 pack(s) with no conflicts.
```

`sync` is a three-way merge against the baseline `add` recorded: a file you
edited keeps your edits, and a real conflict gets markers
(`--abort-on-conflict` leaves it untouched instead). `specgate status` now
shows `6 total` — the new `REQ-006 Join Capacity Waitlist` — and
`backend @ v0.2.0`.

## 6. Take the pack off

The id is the one `.specops.lock` records — here `backend`, not the
`--pack-repo` path:

```bash
specgate specops remove backend --dry-run   # what it would remove
specgate specops remove backend
```

```text
✔  Removed backend from .specops.lock (1 entry).
   Generated files were not deleted. Inspect with `git status` and remove anything unwanted.
```

`remove` forgets the pack; it does not delete the requirements, scenarios and
tests the project now owns. Review them with `git status` and delete by hand
what you no longer want.

## Next

- [Domain packs](domain-packs.md) — the proven packs, the starter examples,
  and how to write your own.
- [Supply chain](supply-chain.md) — the pack cache, pinning, and working
  offline.
