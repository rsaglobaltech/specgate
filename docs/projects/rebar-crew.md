# Rebar Crew — a field app for a rebar crew

<!-- specgate:note -->
**A real client brief, built by an agent with Specgate.** The brief came from a real client; the product was built end to end by a coding agent (Claude) driving Specgate, with business decisions delegated to it and written down as assumptions. It is not a customer deployment, and the code repository is private.
<!-- specgate:endnote -->

This is agent-driven adoption, not a customer story. It was the first pilot,
run before `specgate draft` existed, and most of what Specgate is today was
fixed because of it.

| | |
|---|---|
| **Brief** | Detailed field-operations brief, specified by hand as six domain packs |
| **Stack** | Expo + Next.js monorepo · hexagonal TypeScript core (`packages/core`) |
| **Requirements** | 47 of 47 (99 of 99 scenario rows in the matrix) |
| **Tests** | 599 (domain 400, API 146, screens 53) in 141 files |
| **Specgate** | 0.14.2 → 0.14.6 |

## The brief

A construction company that places reinforcing steel wanted one app for its
crews in the field. Clocking in and out inside a geofence, one file per job
(photos, safety analyses, forklift inspections, tailgate meetings), the
foreman's log, a daily report finished in minutes, and training in two
languages. It also asked for an assistant that explains English email in
Spanish and drafts a reply that a person always sends.

## How Specgate was used

The brief was turned into six domain packs by hand: 46 requirements, each
tagged functional, non-functional or business rule. The product installed
them like dependencies, pinned to a tag, and the agent built them one
requirement per pull request.

<!-- specgate:steps -->
### Install the packs on a fresh skeleton

```bash
specgate specops add --pack-repo <packs repo> --pack-version <tag> \
  --pack time-attendance/backend            # and the five others
```

### Let the harness build each requirement

```bash
specgate harness run                        # one requirement, one PR to develop
```

### Gate every pull request in CI

```bash
specgate check
specgate validate --against-lock            # the packs have not drifted
```

### Add the missing layer, then build again

Packs v0.2.0 added 52 API and screen scenarios. `specops sync` brought them
in, 30 delivered requirements reopened, and the harness ran again.
<!-- specgate:endsteps -->

The harness made 76 requirement runs; 74 passed on the first attempt. The
other two failed because of Specgate, not the code (#35 and #37 below). The
history is 82 merged pull requests, one per requirement.

## What was built

| Module | Requirements | Notes |
|---|---|---|
| Time and attendance | 13 | Geofenced clock in and out, offline, audit trail |
| Job files | 9 | Photos, safety analyses, inspections, meetings, breaks |
| Foreman's log | 5 | Photos, audio notes, timestamps |
| Daily reports | 5 | Prefilled from the day |
| AI communication | 5 | Explain email, draft replies; behind a simulated adapter |
| Learning | 9 | Bilingual training, calculators, plan reader |
| Adoption baseline | 1 | REQ-001, the existing skeleton |

At the end: 67 use cases, 41 API routes and 14 Expo screens.

## What only running the product found

After the first round, every requirement was done and the product could not
be used. The core had 59 use cases and there were no new API routes or
screens. The scenarios asked only for domain behaviour, and the agent built
exactly that.

The gate was right: the specification was met. The specification was what was
missing. Packs v0.2.0 added the API and screen scenarios, and the second round
built the routes and screens.

This is the lesson every later pilot repeats: done means the specification is
met, not that the product works. It is also where `specgate draft --check`
comes from — its D3 rule asks for an API and a screen scenario for each
actor.

## What Specgate got wrong, and what changed

The defect log has 32 entries from this pilot.

| Finding | Fixed in |
|---|---|
| #1–#5 — pack lint, the YAML reader, the vague-step rule, a matrix with two scenarios per requirement, existing tags | 0.14.1 |
| #7–#12 — installing a pack sent the matrix back to manual upkeep; harness prompt, double runs, no `setup_cmd`, private packs in CI | 0.14.2 |
| #13–#19 — minor adoption and documentation friction | 0.14.1 / 0.14.2 |
| #22–#24 — catalogs kept only the last pack; `sync` false conflicts and lost `depends_on` | 0.14.3 |
| #26–#29 — `plan` with multi-file artifacts and duplicate rows; requirements without a scenario passed `pack lint`; the baseline planned forever | 0.14.3 |
| #32 — "99/99 done" with 52 new scenarios untested: each scenario inherited its requirement's tests | 0.14.4 |
| #33 — `plan --json` cut at 65,536 bytes in a pipe | 0.14.4 (`plan`), 0.16.0 (every command) |
| #34 — `validate --against-lock` compared only the first scenario | 0.14.5 |
| #35 — green requirement, push rejected as stale | 0.14.6 |
| #37 — a regenerated matrix treated as a forbidden edit | 0.14.6 |
| #30 — `sync` with no changes rewrote a timestamp in the lock | 0.17.0 |
| #21 — `depends_on` between different packs | **open** |

Running the D4 rule against this project before it shipped found one more
(#41, fixed in 0.16.0).

## Still open

- **#21**: a requirement in one pack cannot depend on one in another.
- **The AI provider** behind the email assistant and the plan reader is a
  simulated adapter. The real provider was not integrated.
- **No external reading yet.** One product, specified and built by the author
  of the tool.

No requirement waits for an answer. The packs were written by hand before the
`draft` checklist and its `questions.md` existed.

[Bookings →](bookings.md)
