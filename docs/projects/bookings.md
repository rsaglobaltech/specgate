# Bookings — appointments for local businesses

<!-- csda:note -->
**A real client brief, built by an agent with Specgate.** The brief came from a real client; the product was built end to end by a coding agent (Claude) driving Specgate, with business decisions delegated to it and written down as assumptions. It is not a customer deployment, and the code repository is private.
<!-- csda:endnote -->

This is agent-driven adoption, not a customer story. It was the first product
to go through `specgate draft --check`, and it ran in five cycles, each one a
short draft followed by a test of the running product.

| | |
|---|---|
| **Brief** | Detailed: a short document with 15 screenshots of other products |
| **Stack** | Next.js + a hexagonal TypeScript core (`packages/core`), web only |
| **Requirements** | 38 of 38 |
| **Tests** | 212 test cases in the repository (118 after the first cycle) |
| **Specgate** | 0.16.0 → 0.17.4 |

## The brief

A booking system for local businesses such as hair salons and beauty
parlours. Each business gets a small public page, several calendars with
slots per hour, coupons (public and private), and online booking settings.
After an appointment, the customer is asked for feedback, and good ratings
lead to the business's Google Maps page. The brief also asked for push
reminders and a widget for the business's own website. Part of the text was
copied from another product, and the integration section was empty.

## How Specgate was used

The brief went into `docs/brief.md` unchanged, with a front matter naming the
actors and their surfaces, and a description of what each screenshot shows.

<!-- csda:steps -->
### Draft the first module as a change

```bash
specgate change new draft-reservas --capability reservas --reserve <n>
specgate draft --check draft-reservas
```

18 requirements and 34 scenarios, with an API and a screen scenario for each
thing a person does. The first check returned 75 findings.

### Write the assumptions, answer the question

13 assumptions in `assumptions.md` (blocked hours, status codes, a minimum
width, no online payment, booking without an account). One question in
`questions.md` — cancellation — was the only one that blocked anything.

### Archive, adopt, build

```bash
specgate change archive draft-reservas
specgate init
specgate harness init
specgate harness run                # one requirement, one PR to develop
```

### Repeat per module

Four more cycles, each a draft, a check, an archive and a harness run: the
owner's panel, coupons, feedback after the visit, and the public page.
<!-- csda:endsteps -->

The first harness run built 18 of 18 requirements, 17 on the first attempt.
The agent took 99–378 seconds per requirement (median 210). Every later cycle
built all its requirements, all on the first attempt except where a Specgate
defect cost one (#56, #65).

## What was built

| Module | Requirements | Notes |
|---|---|---|
| Business, calendars, services | 6 | A business, its calendars, services with duration and price |
| Bookings | 7 | Book without an account, cancel with a link, the owner's agenda |
| Settings | 5 | Online booking rules |
| Panel | 2 | A menu on every owner screen, the public link (cycle 2) |
| Coupons | 5 | Public and private, applied when booking, visible in the agenda |
| Feedback | 5 | One survey by email, rating 1–5, 4–5 sent to the Google Maps link |
| Public page | 7 | Details, photos, map, public reviews, city directory, subdomain |
| Adoption baseline | 1 | REQ-001 |

Requirement REQ-145 (the agenda) and REQ-220/221 (details and photos) were
MODIFIED after a smoke test. The product reached `v0.3.0`.

## What only running the product found

Each cycle ended with the product running in production mode and a person —
or headless Chrome — using it end to end. The first walk-through worked: an
owner set up a business and a slot, a customer booked at 360 px wide and
cancelled with the link. The gaps were elsewhere:

- **The agenda showed only today.** The scenario said "sees today's
  bookings", and the API accepted any day. Fixed by MODIFIED REQ-145.
- **No menu, and no way to find the public page address.** Fixed by REQ-200
  and REQ-201. In the next cycle the agent added "Coupons" to the menu
  unasked, reading REQ-200 as a standing rule.
- **The survey job was open to anyone** until a secret was set. Now always
  protected.
- **`develop` did not build for production.** An `eslint-disable` for a rule
  that was not loaded passed typecheck and tests (#62).
- **The owner had no screen for their details or photos**, and the public
  page did not show the photos. "Show them on the public page" was in the
  requirement text with no scenario to prove it, so it was not built. What
  has no scenario does not exist.

Some gaps stay as written, because the specification says so: a 30-minute
service is offered only on the hour (assumption A3, hourly slots).

## What Specgate got wrong, and what changed

The defect log has 22 entries from this pilot, plus #60, which three pilots
hit.

| Finding | Fixed in |
|---|---|
| #42 — D4 flagged "responsive … from 360 px" as unmeasured | 0.17.1 |
| #43 — D6 reported a repeated value twice | 0.17.1 |
| #44 — `init` named a test command that `check` then said was missing | 0.17.1 |
| #45 — D7 could not see an answered question | 0.17.1 |
| #46 — archiving a green draft wrote no feature files | 0.17.1 |
| #47 — Spanish scenarios became invalid Gherkin | 0.17.1 |
| #48 — `status` listed archived requirements without titles | 0.17.1 |
| #49 — a green draft failed the harness on two-word scenario titles | 0.17.1 |
| #50 — the harness retried three times on failures the agent cannot fix | 0.17.1 |
| #51 — D3 asked a screen-only menu for an API scenario | 0.17.2 |
| #52 — D6 flagged values already reviewed in an earlier draft | 0.17.2 |
| #53 — a MODIFIED requirement kept its old feature file | 0.17.2 |
| #54 — "Ready to close" with two scenarios untested | 0.17.2 |
| #55 — a draft reused scenario ids from another module | 0.17.3 |
| #56 — the harness prompt said `done`, and write-scope punished it | 0.17.3 |
| #60 — `init` proposed three requirements on a fresh skeleton | 0.17.4 |
| #61 — D3 accepted a customer's screen as the owner's | 0.17.4 |
| #62 — the gate did not include the production build | 0.17.4 |
| #63 — the harness read a missing test as a fault in the specification | 0.17.4 |
| #64 — two MODIFIED requirements blocked each other's gate | 0.17.4 |
| #65 — `done` reordered the trace, and write-scope rejected it | 0.17.5 |
| #57, #58 — a draft could be archived with findings still open | 0.17.10 |

Two frictions were never logged as defects: `plan` orders by capability name,
not by dependency, so the build order was given by hand; and D6 has no way to
declare a convention (status codes, labels) once.

## Still open

- **The rest of the brief.** Push reminders 24 hours before, and the
  integration section (a widget for the business's website). Not drafted.
- **No question waits for an answer.** The one that blocked something,
  cancellation, was answered during the review of the first draft.

[← Rebar Crew](rebar-crew.md) · [Credit shop →](credit-shop.md)
