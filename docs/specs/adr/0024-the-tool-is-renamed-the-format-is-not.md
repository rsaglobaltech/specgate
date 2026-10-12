# ADR-0024 — The tool is renamed to Specgate; the on-disk format is not

## Status

Accepted — 2026-08-26. The on-disk format decision is superseded by
[ADR-0032](0032-one-name-everywhere.md) (2026-10-12): the format is renamed too.

## Context

The product shipped under five different names at once:

| Where | Name |
|---|---|
| GitHub repository | `specgate` |
| npm package | `create-spec-driven-app` |
| Binary | `csda` |
| Docker image | `ghcr.io/rsaglobaltech/csda` |
| Sibling package scope | `@spec-driven/*` (never published) |

Two of those are actively misleading. `create-spec-driven-app` reads as a
scaffolder in the `create-react-app` mould, and the product stopped being a
scaffolder several minors ago — it has a change lifecycle, an enforcing gate, an
agent harness, versioned domain packs and ALM sync. `csda` is what people
actually type (measured: 529 uses across `docs/` and `README.md`, against 95 for
the long name) and it is an unpronounceable acronym.

The differentiator against the closest comparable tool is not that this one has
specs. It is that **the gate enforces them**. The README tagline already says so:
*"specs as executable contracts — requirements, scenarios and traceability that
CI enforces."*

## Decision

**The tool is named Specgate.** npm package `specgate`, binary `specgate`,
Docker image `specgate`, scope `@specgate/*`.

**The on-disk format keeps the `csda:` prefix, unchanged and indefinitely.**

That second half is the part worth writing down, because it looks like an
oversight and is not.

`csda:` is not branding in these positions — it is a parsed file format that
lives inside **user repositories**, not ours:

- `<!-- csda:trace REQ-002 depends=REQ-001 -->` in every adopted
  `traceability.md` and capability `spec.md` (103 occurrences in this repository
  alone), read by `RE_TRACE_LINE` in `TraceabilityFormat.ts:108`
- `// csda:value session_timeout=15m` in user **source code** (ADR-0023)
- `<!-- csda:allow-placeholders -->` in spec and template files

Renaming those would be a silent breaking change to every repository that has
adopted the tool — their specs would stop parsing, and the failure would surface
as "requirement not found" rather than as "your marker prefix changed". A rename
of *our* package is not a licence to rewrite *their* files.

**The alternative was considered and rejected for now:** read both `csda:` and
`specgate:`, write `specgate:`. That is a real migration feature — a dual-read
parser, a `specgate migrate` command, and tests pinning both directions — not a
find-and-replace. It can be built later if the mismatch ever bothers anyone. It
has never bothered anyone yet, because nobody outside this repository has
adopted the tool (`GATE-G3`, #100).

**Backwards compatibility for the CLI:** `csda` stays as an alias binary, and
`create-spec-driven-app` stays as a deprecated npm package pointing at
`specgate`. Neither is removed in the 0.x line. An `npx` invocation that used to
work must keep working — the same rule `docs/release-process.md` already applies
to raising the Node floor.

## Consequences

- **The name says what the tool does in one word**, and the acronym disappears
  from the surface a newcomer meets first.
- **A cosmetic mismatch is now permanent and deliberate**: a tool called
  Specgate writing markers that say `csda:`. This ADR is the answer to anyone who
  finds that and assumes it was missed.
- **Existing repositories keep working with no action.** Nothing on disk changes
  meaning.
- **The timing is the cheapest it will ever be.** `GATE-G3` is still open and no
  outside team has adopted the tool, so the migration cost is documentation and
  packaging rather than other people's repositories. Every week of real adoption
  makes this more expensive; that is the argument for doing it now rather than
  after 1.0.

## Alternatives considered

**Keep `create-spec-driven-app`.** Rejected: it describes a product that no
longer exists, and it is the first thing an evaluator reads.

**Promote `csda` to the real name.** Rejected: it is already the de facto name
and that is precisely the problem — it cannot be pronounced, and it explains
nothing to someone who has not read the README.

**Rename the format markers too, in the same change.** Rejected above. The
correct version of this is a dual-read migration, not a rename.

**`reqgate`** was the cleanest on availability (npm free, GitHub org free, one
homonymous repository). Rejected because "req" narrows the product to
requirements when it already governs scenarios, packs, artefacts and agent runs.

**`tracewright`** was available and distinctive. Rejected because it names
traceability — a capability — rather than enforcement, which is the thing the
comparable tools do not have.

## Addendum — 2026-09-01: the unscoped name was not available after all

`specgate` cannot be published to the public npm registry. The 0.8.0 release
attempted it and got:

```
npm error 403 Forbidden - PUT https://registry.npmjs.org/specgate
           - You may not perform that action with these credentials.
```

Not a permissions problem — the token is a classic automation token with no
package restriction, and it publishes `create-spec-driven-app` fine. npm
compares a new package name against existing ones **with punctuation removed**,
and [`spec-gate`](https://www.npmjs.com/package/spec-gate) — published
2026-03-03, "AI spec validation for Claude Code" — normalises to exactly
`specgate`. The registry refuses the name to everyone while that package exists,
and reports it as a credentials error.

**This ADR's availability check was wrong, and the way it was wrong is worth
recording.** It read `npm view specgate` → 404 as "the name is free". A 404 says
*not published*; it does not say *creatable*. The two differ for every name
within one punctuation mark of something that already exists. Any future name
check has to attempt a publish — `npm publish --dry-run` does not contact the
registry and would not have caught it either.

**Decision: the npm package is `@rsaglobaltech/specgate`.** Scoped names are
exempt from the similarity rule, so the scope is what makes the name reachable
at all. It is the same coordinate the package already has on GitHub Packages and
the same name as the GitHub organisation, so the tool now answers to one
spelling in both registries instead of two.

Nothing else moves: the tool is still Specgate, the binary is still `specgate`,
the repository and the Docker image are unchanged, and `csda` and
`create-spec-driven-app` remain alias binaries.

The cost is one line of friction on the way in — `npx @rsaglobaltech/specgate`
rather than `npx specgate` — and it is paid on the front door, which is the
worst place to pay anything. It was accepted because the alternative is a third
rename of a product that has now been renamed twice.

`create-spec-driven-app` is still the deprecation target and now points at
`@rsaglobaltech/specgate`.
