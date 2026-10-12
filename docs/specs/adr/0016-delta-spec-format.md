# ADR-0016 — Delta spec format: ADDED / MODIFIED / REMOVED

## Status

Accepted — 2026-08-15

## Context

ADR-0015 introduced the change folder. It needs a format for "what this change
does to the specification". Two shapes were possible: ship the full new spec
and diff it, or ship only the difference.

Shipping the full spec makes the reviewer do the diffing mentally, and makes
two parallel changes to the same capability conflict on every line even when
they touch unrelated requirements.

## Decision

A delta is plain markdown with three operation sections, plus an optional
`## Purpose` used only when the change creates a brand-new capability:

```markdown
# Delta — pricing

## ADDED Requirements

### Requirement: REQ-014 — Dynamic peak pricing

El sistema SHALL aplicar un recargo del 20 % en hora punta.

#### Scenario: SCN-014a — Recargo en hora punta

- GIVEN una sesión iniciada a las 18:00
- WHEN se calcula la tarifa
- THEN el importe incluye un recargo del 20 %

<!-- specgate:trace uc=UC-007 cmd=CMD-011 agg=AGG-Pricing evt=EVT-PriceApplied
     feature=features/billing/dynamic_pricing.feature -->

## MODIFIED Requirements
## REMOVED Requirements
```

| Section | Meaning | Effect on archive |
| --- | --- | --- |
| `## ADDED Requirements` | new behaviour | appended to the capability spec |
| `## MODIFIED Requirements` | changed behaviour | **replaces the whole block** |
| `## REMOVED Requirements` | retired behaviour | deleted; retiring the last one deletes the spec file, and only when the change declares `retire_capabilities: true` |
| `## Purpose` | what a new capability is for | seeds the Purpose of a spec being created; ignored when the spec exists |

Two extensions over the plain markdown form, both **optional**:

- **`REQ-NNN` / `SCN-NNN` ids** in the heading. Without them, identity falls
  back to a slug of the requirement name, so a pure-markdown delta round-trips.
- **The `specgate:trace` comment**, which carries the DDD coordinates and the
  feature path. It is the bridge to the traceability matrix — the one thing a
  documentation-only tool cannot do.

## Rationale

- **Markdown, not YAML or a custom syntax.** A delta is read by humans in a PR
  far more often than it is written. It also has to be draftable by an agent
  with no schema in context.
- **MODIFIED replaces, it does not merge.** Merging two scenario lists would
  silently keep scenarios the author deliberately deleted. Replacement makes the
  delta the complete statement of the requirement's new form; the old version
  stays recoverable in the archive and in git.
- **The trace comment is a comment.** A delta with no `specgate:trace` is still
  valid; it just archives with `-` in the DDD columns. Trace data must never be
  the price of entry, or brownfield adoption stalls on the first requirement.
- **The id prefix list is closed.** `REQ|SCN|UC|CMD|QRY|AGG|EVT` only. A
  permissive `[A-Z]{2,4}-\w+` reads "TOTP-based two-factor authentication" as an
  id of `TOTP-based`, silently mangling the requirement name. There is a test
  for exactly that.

## Alternatives considered

1. **Ship the full new spec and diff it at archive time.** Rejected — the
   reviewer loses the statement of intent, and parallel changes to one
   capability collide on unrelated lines.
2. **YAML deltas, consistent with `pack.yaml`.** Rejected — requirements and
   scenarios are prose; YAML would force quoting, block scalars and escaping
   onto text meant to be read. The pack format stays YAML because it is a
   *model*; a delta is a *document*.
3. **A `RENAMED Requirements` section.** Parsed but not yet acted on: a rename
   is expressible today as REMOVED + ADDED, and doing it properly means
   deciding whether the traceability row and its implementation history follow
   the old id or the new one. Deferred rather than guessed at.
4. **Requiring an explicit `REQ-NNN` on every requirement.** Rejected — it
   blocks the lightest possible first change on a brownfield repo. Ids are
   reserved automatically by `change new` for those who want them.

## Consequences

### Positive

- A reviewer reads the change, not the context around it.
- Two changes can touch one capability without conflicting, as long as they
  touch different requirements.
- The same AST serves the spec and the delta, so `parse → apply → render →
  parse` is a fixed point. That is a test, not an aspiration.

### Negative / trade-offs

- MODIFIED requires restating the whole requirement, including scenarios that
  did not change. Verbose, but unambiguous — and the alternative loses data.
- Identity by name-slug is fragile: renaming a requirement in a delta that has
  no id reads as REMOVED + ADDED rather than a rename. Mitigated by `change new`
  reserving real ids up front.
- Markdown parsing is inherently forgiving; a malformed heading degrades to
  prose rather than erroring. The validator catches the cases that matter
  (unknown section, requirement with no scenario, dangling MODIFIED/REMOVED).

## References

- `scripts/change/parser.ts` — the shared AST
- `scripts/change/delta.ts` — `validateDelta` and `applyDelta`
- `tests/unit/change-delta.test.ts`
- ADR-0015 — the lifecycle this format serves
