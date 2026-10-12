# Proven on real products

<!-- specgate:note -->
**A real client brief, built by an agent with Specgate.** The brief came from a real client; the product was built end to end by a coding agent (Claude) driving Specgate, with business decisions delegated to it and written down as assumptions. It is not a customer deployment, and the code repository is private.
<!-- specgate:endnote -->

These six pilots are agent-driven adoption, not a customer story. Each one
started from a brief a real client wrote — vague, detailed, heavy on
architecture, or regulated — and ended as a working product with its
specification, tests and CI. The numbers come from each product's generated
traceability matrix and its test suite. What these pilots are not: a team
choosing Specgate and using it on their own. That reading is still to come.

Every page lists what Specgate got wrong during the pilot and the release
that fixed it. Most of the tool's rules exist because a pilot needed them.

<!-- specgate:cards cols=2 -->
- [Rebar Crew](rebar-crew.md) — A field app for a rebar crew: 47 of 47 requirements and 599 tests, after a first round that was done and unusable.
- [Bookings](bookings.md) — Appointments for local businesses: 38 of 38 requirements in five cycles, each closed by using the product.
- [Credit shop](credit-shop.md) — A five-line brief became 24 requirements; every test green, and nobody could buy until the smoke test.
- [FinCore](fincore.md) — Core banking on Spring Boot: 59 of 60, with GDPR against AML retention left to the client.
- [EventTech](eventtech.md) — Event operations on Quarkus: 38 of 38, the event rebuilt at any time from its facts.
- [HealthTech](healthtech.md) — Clinical cases on Quarkus: 23 of 24; drug interactions wait for an answer instead of a guess.
<!-- specgate:endcards -->

## Side by side

| Project | Brief | Stack | Requirements | Tests | Waiting | Specgate defects found |
|---|---|---|---|---|---|---|
| [Rebar Crew](rebar-crew.md) | Detailed, hand-written as domain packs | Expo + Next.js, hexagonal TS core | 47 of 47 | 599 | 0 | 32 (one open: #21) |
| [Bookings](bookings.md) | Detailed, with screenshots | Next.js + hexagonal TS core | 38 of 38 | 212 | 0 | 22, plus #60 |
| [Credit shop](credit-shop.md) | Vague | Next.js + hexagonal TS core | 24 of 24 | 272 | 0 | 2, plus #60 |
| [FinCore](fincore.md) | Architecture-heavy | Spring Boot 3.3 · Java 21 · PostgreSQL | 59 of 60 | 112 | 1 (REQ-055) | 7, plus #79 |
| [EventTech](eventtech.md) | Architecture-heavy | Quarkus 3.40 · Java 21 · PostgreSQL | 38 of 38 | 71 | 0 | 2 |
| [HealthTech](healthtech.md) | Regulated | Quarkus 3.40 · Java 21 · PostgreSQL | 23 of 24 | 35 | 1 (REQ-020) | 1 |

Requirements include REQ-001, the adoption baseline. Java test counts are the
suite's run totals; Bookings and Credit shop are test cases counted in the
source; Rebar Crew is its suite's total at the end of the pilot. #60 —
`init` proposing requirements on a fresh skeleton — was hit by three pilots.

## What all six found

The gate verifies what the specification says. Running the product finds
what it does not say. In every pilot, using the running product turned up
something the green gate could not see: a product with no screens, an API
with no button, an action on an id nobody could list, a build that failed in
production, an application that did not start. Each one became a short follow-up
change — and several became rules in `specgate draft --check`. The path from
a brief to a specification is in [From a client brief to a spec](../from-a-brief.md).
