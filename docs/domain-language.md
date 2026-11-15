# Domain language: glossary, rules and diagrams

At the end of this page your specification uses one word for one thing, each
business rule has a number a test names, and the entity model and the actors
are diagrams a business reader can follow. All of it comes from sources the
project already keeps, and `validate` checks it.

**You need:** a Specgate project (`specgate init`).

## The glossary

`specgate init` and `specgate adopt` write an empty `docs/specs/glossary.md`:

```markdown
| Term     | Definition                         | Avoid              |
| -------- | ---------------------------------- | ------------------ |
| Customer | Who buys and pays for an order.    | client, buyer      |
| Order    | What a customer asked for, priced. | purchase, basket   |
```

`specgate validate` names every word under **Avoid** used anywhere in
`spec.md`, the capability specs, the open changes' deltas and the feature
files, with the line and the term to use instead:

```
▲  spec.md:7 says "client" — the glossary's term is Customer.
   Write Customer instead, or take "client" off its Avoid column in docs/specs/glossary.md.
```

With `--json`, each finding carries the code `glossary_term_forbidden`. It
matches whole words and ignores case, so `clientele` is not `client`. Code
spans, fenced blocks and lines that begin a comment (`<!--`) are skipped; the
inner lines of a multi-line comment and Gherkin `#` comments are still checked.
A plain `validate` warns; `validate --strict` (the gate) fails.

## Business rules, numbered

A requirement's rules are a `Rules:` list whose items start with `BR-NNN`:

```markdown
### REQ-014 — A refund goes back to the card it came from

The system SHALL refund an order to the card that paid for it.

Rules:

- BR-021 A refund never exceeds what the order was paid.
- BR-022 A refund older than 180 days goes to store credit instead.
```

A test links to a rule by naming it, the same way it links to a requirement:

```js
test("REQ-014 BR-022: a refund after 180 days becomes store credit", () => { … });
```

- `validate` fails with `rule_duplicate` when a rule id is used by two
  requirements, or twice in one file. Rule ids are unique across the
  specification, like requirement ids; an open change's delta that restates a
  requirement with its rules is the same requirement, not a second use.
- `validate --strict` fails with `rule_untested` for each rule of a delivered
  requirement (Implemented, Verified or Released) that no test mentions. A test
  that names the requirement is no longer enough to cover a rule it never
  exercises.

## The entity model

`specgate check` writes `docs/specs/model.md` as a Mermaid `erDiagram`, with a
section per entity below it (an attribute table when `model.yaml` gives
attributes). Its sources are:

- `docs/specs/aggregates.md`, the table the domain packs write (the template's
  `CoreAggregate` example row is not an entity), and
- `docs/specs/model.yaml`, when you want attributes and relations:

```yaml
entities:
  - name: Invoice
    attributes:
      - id uuid PK
      - total money
    relations:
      - to: Payment
        kind: one-to-many # one-to-one, many-to-one, many-to-many
        label: settled by
```

With neither source, no file is written.

## The actors

When `docs/brief.md` names its actors, `specgate check` writes
`docs/specs/actors.md`: a Mermaid flowchart from each actor to the capabilities
and requirements whose trace says `actor=<that actor>`, and a table of each
actor's requirements. `validate` warns `actor_unknown` for a requirement whose
actor the brief does not list, so a typo or a forgotten actor shows up before a
diagram leaves it out. Case does not matter: `actor=customer` is the brief's
`Customer`, and is drawn under the brief's spelling.

## Generated, not edited

Both diagrams say at the top that they are generated. `check` rewrites them
from their sources, and `validate` fails with `model_stale` or `actors_stale`
when the file differs from what its sources give, as it does for a generated
traceability matrix. A file left behind after its sources are removed is not
reported; delete it yourself.
To change a diagram, change its source.

## Next

- [Writing specs](writing-specs.md)
- [Validating](validating.md)
