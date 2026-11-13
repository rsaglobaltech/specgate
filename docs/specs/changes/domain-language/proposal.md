# Proposal: domain-language

## Intent

AIUP gives business readers a glossary, an entity model as a Mermaid ER
diagram, a use case diagram, and business rules numbered `BR-NNN` inside each
use case, so its coverage audit can say which rule has no test. All of it is
written and audited by an LLM. Specgate has the data for most of it — the
brief's front matter names actors and modules, domain packs carry aggregates —
but shows none of it, and a requirement's rules are prose the gate cannot
count. This change adds them the specgate way: generated from sources, checked
deterministically, never hand-kept.

## Scope

In scope:

- REQ-538: `docs/specs/glossary.md` and the lint `glossary_term_forbidden` for
  a synonym the glossary forbids.
- REQ-539: business rules `BR-NNN` inside a requirement; a delivered
  requirement owes a test that names each of its rules.
- REQ-540: `docs/specs/model.md`, a Mermaid ER diagram generated from the
  packs' aggregates and the model sources, checked stale like the matrix.
- REQ-541: `docs/specs/actors.md`, a Mermaid diagram of actors, capabilities
  and requirements, generated from the brief and the specs.

Out of scope:

- BPMN processes: journeys across requirements belong to `business-review`.
- PlantUML: Mermaid renders on GitHub, GitLab and in the studio without a
  server.

## Approach

The glossary is a Markdown table (term, definition, avoid). The rule ids are
parsed by `change/parser.ts` from a `Rules` list in the requirement's body and
added as a column of the matrix. Both diagrams are rendered by the code that
regenerates the matrix, so `check` keeps them current and `validate` reports
`model_stale` or `actors_stale` when the committed copy differs.
