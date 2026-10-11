# ADR-0020 — One pack format, with the JSON Schema as its authority

## Status

Accepted — 2026-08-17 · **Amended — 2026-08-23** (see *Amendment*)

## Context

The domain pack format had drifted into three descriptions that disagreed with
each other, and nothing in the build compared them.

| | `schemas/pack.schema.json` | `expand` / `validatePackModel` | the eleven packs in `packs/` |
| --- | --- | --- | --- |
| Outputs | `outputs.files[]` (target + template) | same | `outputs.features[]` |
| Rules | `rules.traceability{…}` | same | `rules:` as a list of `RUL-*` |
| Scenarios | 14 required fields | 5 required fields | inline `given/when/then` |
| `contracts` type | in the enum | rejected outright | `sample-contracts` uses it |

The consequences were not theoretical. **Every curated pack failed to install**,
with the same error — `outputs.files must contain at least one file
definition`. `csda pack init` generated packs in the same unusable shape, so
the authoring command produced something the installing command refused. And
`pack lint` reported all of them as clean, because it validated cross-
references between requirements and use cases but never the structure the
installer actually requires.

It went unnoticed for as long as it did because nothing exercised `packs/`:
not CI, not a test. Ten packs were advertised in the README as the reason to
adopt the tool, and not one of them could be applied to a project.

The parser had a matching gap: `parseYamlLite` did not understand inline flow
sequences (`aggregates: [Invoice, Payment]`), which the packs used 54 times.
Those parsed as the literal string `"[Invoice]"` and then failed cross-
reference checks against an aggregate nobody had declared.

## Decision

**`schemas/pack.schema.json` is the single authority.** The validator, the
installer, `pack init` and every shipped pack conform to it. Where they
previously disagreed, the schema moved only where it was wrong on the merits.

**1. `outputs.files` is the only output shape.** `outputs.features` was never
implemented by anything and is gone. A capability pack renders a capability
document under `docs/specs/capabilities/`; the feature files come from
`scenarios[]`, which is where they were always meant to come from.

**2. `business_rules` is a first-class collection.** The invariants the packs
carried — *"Invoices are immutable once issued"* — are genuine domain content
and had no home in the schema at all. They now have one, validated for id
shape and a title, and cross-referenced to a bounded context. `rules` keeps
its narrow meaning: how the pack renders. Two different ideas had been sharing
one key, and that is what made every pack uninstallable.

**3. A scenario requires what the installer needs, and no more.** Required:
`id`, `requirement_id`, `target`, `template`, `feature`, `scenario`, `status` —
enough to render the feature file and write the traceability row. Optional but
validated when present: `use_case`, `command`, `aggregate`, `events`,
`technical_artifacts`, `test_artifact`, `seed`.

The old 14-field requirement forced every pack to express full CQRS. A
front-end pack had to invent a command it does not have, which is the kind of
rule that teaches people to write fiction to satisfy a validator.
`technical_artifacts` in particular is now optional on purpose: a pack author
describes a domain, not the caller's implementation. Absent, the matrix renders
`TBD`, which is exactly the gap `plan` reads as `NEEDS_IMPLEMENTATION`.

**4. `contracts` is a supported project type.** It was in the schema and in
`pack init`, and rejected by the installer. API-first delivery is a real
enterprise case and the sample pack already existed, so the installer now
accepts it rather than the schema quietly withdrawing the promise.

**5. Inline flow sequences are valid YAML and now parse as such.**

## Consequences

**The eleven curated packs were migrated**, and they install. The migration was
mechanical: inline scenarios became `target` + `template` pairs with the
Gherkin moved into real `.feature.tpl` files, `rules:` became
`business_rules:`, and the `commands:` blocks were *derived* rather than
invented — every command name and its use-case linkage was already written in
`use_cases:` and had simply never been declared.

**`pack lint` now runs the installer's own validation.** "Lint passes" means
"this pack can be installed". A lint that says yes to a pack nobody can install
is worse than no lint, because it is trusted.

**`pack init` produces an installable pack**, including the template files its
`pack.yaml` declares. It previously wrote `pack.yaml` alone, so the pack it
produced failed at the very next step it told you to run.

**A test installs every pack in `packs/` into a scaffolded project.** This is
the guard that would have caught all of it, and it is the reason the format can
now be trusted to stay coherent.

`PACK_SCHEMA_VERSION` moves to **1.3.0**. Older packs still load — only a
version newer than the CLI understands is refused, which is the compatibility
window ADR set out in `docs/release-process.md`.

## Alternatives considered

**Relax the schema to match the code.** Cheapest, and it would have made the
schema stop describing anything worth validating — the domain linkage would go
unchecked precisely when a pack does declare it.

**Tighten the code to the schema's 14 fields.** Maximum consistency of the
domain model, at the price of forcing every pack into CQRS. Rejected for the
same reason phase gates were rejected in ADR-0018: a rule that does not survive
contact with real work gets satisfied with fiction.

**Drop the business rules while migrating.** Faster, and it would have thrown
away written domain knowledge to avoid adding one key to a schema.


## Amendment — 2026-08-23 (E1 / H13)

The decision above stands: the schema is the authority. What was wrong was the
schema, and nothing enforced it against the packs, so the two drifted quietly
apart for six days.

**Measured before amending.** Ten of the eleven curated packs failed
`schemas/pack.schema.json`, while all eleven passed `pack lint --strict`.
`tests/unit/pack-schema.test.ts` existed and looked like the check that would
have caught it — it validates **one fixture pack**. The packs actually shipped
were read by nobody. Same shape as H14: a check that exists, appears to cover
something, and is pointed somewhere else.

**It was not paperwork.** The schema said `context` and `invariants`, the packs
write `bounded_context` and `responsibilities`, and the renderer read the
schema's names. So installing any curated pack produced domain documents with
empty columns:

```
| AGG-001 | Invoice       | - | - |
| EVT-001 | InvoiceIssued | - | - | invoiceId: string, … |
```

The pack declared every one of those values, under its real name. A schema
enforced against nothing had let three vocabularies grow — schema, packs,
renderer — and the user paid for it in worse documents.

**What changed.**

1. **The schema describes the format that exists.** `use_cases` requires
   `id`, `name`, `actor`, `requirement`; `commands` requires `id` and `name`;
   `aggregates` and `events` require `id` and `name`. Everything else is
   optional and validated when present — the treatment this ADR already gave
   `scenarios[]`, applied to the collections it missed.

   This is ADR-0022 reaching the schema. Requiring `aggregate`, `emits` and
   `scenarios` on every use case, or `fields` on every command, is full CQRS as
   the price of entry — *"the kind of rule that teaches people to write fiction
   to satisfy a validator"*, in this ADR's own words about the 14-field
   scenario.

2. **The real vocabulary is described, with the old names kept as aliases.**
   `bounded_context` and `context`; `aggregate` and `producer`.
   `responsibilities` and `invariants` are **different things** and now have
   separate columns: what an aggregate owns is not the rules it must keep, and
   rendering one under the other's heading would be a mislabelled fact rather
   than a missing one.

3. **Both payload spellings are valid.** Ten packs write
   `payload: [fileId: string]`, which reads as a string; `file-storage` writes a
   block sequence of mappings, which reads as objects. Both are in use and both
   are readable, so the schema describes both rather than retiring one by a rule
   nobody was enforcing. *(That inconsistency is worth settling on its own
   merits; this amendment does not settle it by validator.)*

4. **The shipped packs are validated against the schema in the suite.**
   `tests/unit/shipped-packs-schema.test.ts` walks `packs/**`. Without it this
   amendment would be one more statement of authority with nothing behind it.

5. **The rendered documents are checked, not just the install.**
   `curated-packs.test.ts` now asserts that each pack's context and producer
   reach `aggregates.md` and `events.md`. Installing cleanly was never the
   claim worth testing.

`PACK_SCHEMA_VERSION` moves to **1.4.0**: the format accepts more spellings than
it did. No pack changed, and none had to — this amendment relaxes and corrects,
so nothing that validated before stops validating, and the eleven packs keep
declaring `1.3.0`.

**`depends_on` (B1, 2026-08-23).** Optional on `requirements[]`: which
requirements must land before this one, so the harness stacks a dependent's
branch on its predecessor's instead of on the run's base. Validated here rather
than at run time — a dependency naming nothing, or a cycle, is a defect in the
pack, and `runLevels` discovering it mid-run means the pack is installed and an
agent already paid for.

It reaches the project through the matrix, on its own line beneath the table:

```
<!-- csda:trace REQ-002 depends=REQ-001 -->
```

Not inside a cell. The row parser splits on `|` and requires exactly ten cells,
so anything appended to a row makes an eleventh and the row stops parsing — the
annotation would survive one write and vanish on the next `expand`. Beneath the
table it is ignored by the row parser by construction, which is round-trip
safety rather than round-trip carefulness.

**Two defects found on the way, fixed separately** because they stand on their
own: `validatePackModel` cross-referenced `aggregate.context` and was therefore
inert on all eleven packs, and `parseYamlLite` split inline flow sequences on
every comma, so one quoted responsibility parsed as four items.

**Item 3 settled, not just described (2026-08-26, issue #116) — and item 3's
own count was wrong.** The 2026-08-23 amendment said ten packs wrote the
string spelling and `file-storage` was the exception. Walking all eleven for
this fix (`tests/unit/shipped-packs-schema.test.ts` now does this walk
instead of naming one pack) found **five** writing the object spelling —
`file-storage`, `multi-tenant`, `reporting`, `search`, `webhooks` — against
six that already wrote the string form. The 2026-08-23 count was never
re-verified after being written; this one is, by a test that walks every
shipped pack rather than naming an example. All five are migrated; every
curated pack now writes `payload: [fileId: string, …]`. The schema still
describes both spellings — retiring the object form there is a separate,
larger decision (it would reject any community pack that already uses it,
which this migration has no evidence about either way) and stays out of
scope here. `PACK_SCHEMA_VERSION` is unchanged: the schema itself did not
change, only five packs' content did.

**`metadata.tier` and `metadata.provenance` (2026-10-11).** The eleven packs
in `packs/` were described as "curated domain packs" on the landing page and in
the docs. Each is four or five generic Draft requirements; no product was ever
built from one. Seven new packs were derived from the six pilots, where every
requirement was implemented and tested — and a reader could not tell the two
apart. `tier: proven | starter` says which a pack is; `provenance` says what
proved a proven one, and `validatePackModel` refuses `proven` without it. Both
are optional and additive: a pack that says nothing is a starter, and every
pack written before stays valid. `PACK_SCHEMA_VERSION` moves to **1.5.0** in the
same change; the seven proven packs declare `1.5.0`, the eleven starters keep
`1.3.0` and were not touched.

Found while building them (defect #84): the matrix row's status is derived
from the capability's `csda:trace` line, so a pack that set `status: Needs
Clarification` only in `pack.yaml` installed the open question as Draft. The
proven packs write the status into the trace line of their capability
template, and `tests/unit/proven-packs.test.ts` pins that the question is still
open after install.

