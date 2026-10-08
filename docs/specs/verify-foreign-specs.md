# Verifying OpenSpec specs — specification

Status: **Phase 1 implemented and piloted (without the MCP tool).** Decided in
[ADR-0030](adr/0030-specgate-verifies-specs-it-did-not-write.md).
It ships only after its pilot (§8) — [result](../../mejoras/verify-pilot-openspec.md): 5/5 planted defects found, 0 false positives.

---

## 1. The promise, and its limit

> Write your spec with OpenSpec. Specgate guarantees that
> what it calls done is done.

**Done** means a claim the tool's own files make: a ticked task, an archived
change. **Guarantees** means a CI check that fails while any criterion that
claim covers has no test naming it, or that test does not pass, or the
criterion changed after it was verified.

It does not mean the test asserts the right thing. A test that names a
criterion and passes is evidence the criterion was exercised. The check says
so in its own output.

## 2. What is read

Read-only. Nothing outside `.specgate/` is written.

### OpenSpec

```
openspec/specs/<capability>/spec.md
openspec/changes/<change>/{proposal.md,tasks.md,specs/}
openspec/changes/archive/<date>-<change>/
```

```markdown
### Requirement: Path configuration for supported tools
The `AI_TOOLS` array SHALL include `skillsDir` for tools that support …
#### Scenario: Claude Code paths defined
- **WHEN** looking up the `claude` tool
- **THEN** `skillsDir` SHALL be `.claude`
```

| Element | Read as | Id |
|---|---|---|
| `### Requirement: <name>` | requirement | `openspec:<capability>/<slug(name)>` |
| `#### Scenario: <name>` | acceptance criterion | `openspec:<capability>/<slug(req)>/<slug(scenario)>` |
| an archived change | claim on every requirement its delta ADDED or MODIFIED | — |
| an active change with every task ticked | claim, same scope; reported until archived | — |

Slugs are lowercase alphanumerics and hyphens. A renamed requirement is a new
id; the old one is reported as orphaned in tests that still name it.

## 3. Linking a test

A test proves a criterion by naming its id, anywhere in the file — a test
title, a comment, a tag:

```ts
// openspec:time-attendance/clock-punches/clock-in-requires-being-inside-an-assigned-jobsite-geofence/inside-an-assigned-jobsite
it("Scenario: Inside an assigned jobsite", …)
```

`specgate verify --ids [--feature <name>]` prints every id with its criterion
text, to copy. Specgate's own projects keep `REQ-NNN`/`SCN-NNN`; the rule is
the same.

## 4. The rules

| Code | Fails when | Gate or report |
|---|---|---|
| `V1_unproved_claim` | a claimed criterion has no test naming it | gate |
| `V2_failing_suite` | with `--run`, the test command fails | gate |
| `V3_criterion_changed` | a claimed criterion's text differs from the text recorded when it was last verified | gate |
| `V4_unknown_reference` | an archived change names a requirement the spec no longer has (removed or renamed since) | report |
| `V5_unreadable` | a spec or task file does not parse as its format | gate — never "zero criteria" |
| `V6_orphan_name` | a test names an id that does not exist | report |
| `V7_unclaimed_coverage` | criteria with no claim and no test | report (percentage) |

`V3` needs memory: `.specgate/verify.lock` records, per verified criterion,
the hash of its text and the commit it was verified at. It is written by
`verify --record` (CI on the default branch), committed, and read by every
other run.

## 5. Adoption

`--since <git-ref>` gates only claims made after the ref: a box ticked, or a
change archived, in a commit after it. Older claims are a report. The first
run on an existing project is therefore green or red only for work done from
now on.

## 6. Interfaces

```bash
specgate verify [--from openspec] [--project-dir <dir>]
                [--run] [--test-cmd "<cmd>"] [--since <ref>]
                [--record] [--ids] [--json] [--format text|github|sarif]
```

- **GitHub Action** `rsaglobaltech/specgate/actions/verify`: runs `verify --run
  --since <base>` on a pull request, posts annotations on the spec lines whose
  claims fail, and one summary comment.
- **MCP**: `specgate_verify` returns the same JSON, so the agent working from
  the OpenSpec spec sees the failure inside its own loop.
- **JSON** follows the agent contract (`docs/specs/agent-contract.md`).

## 7. Formats move

- The reader has fixtures written to OpenSpec's published layout, and is run
  against OpenSpec's own repository, whose `openspec/` is the format's widest
  real use (747 scenarios, 108 changes, history back to January 2025).
- A scheduled job installs the latest `@fission-ai/openspec`, runs its own
  `init`/`archive` on a fixture and reads the result. A format that no longer
  parses fails the job: a format change becomes a task, not a silent miss.
- A file that does not parse is `V5`, never zero criteria. A reader that
  silently finds nothing would turn every claim green.

## 8. Proving it — the pilot per format

Before a format ships:

1. One Golden State module is specified with OpenSpec and built with its own
   workflow (`/opsx:propose`, `/opsx:apply`, `openspec archive`), by the book.
2. Defects are planted on a branch, recorded in a sealed list:
   - a ticked task whose criteria have no test;
   - a test that names a criterion and fails;
   - a criterion edited after it was verified;
   - a task that references a criterion that does not exist.
3. `verify` runs on the honest branch and on the planted one.

**Bar to ship:** every planted defect found (100 %), no finding on the honest
branch (0 false positives), and the time to adopt on the honest branch — from
`npx specgate verify` to a green check — under 30 minutes.

## 9. Phases

| Phase | Delivers | State |
|---|---|---|
| 1 | OpenSpec reader, `verify`, V1–V7, `verify.lock`, the GitHub Action, the pilot | done — [pilot](../../mejoras/verify-pilot-openspec.md) |
| 2 | MCP tool `specgate_verify`; the scheduled format re-read | next |
| 3 | An external pilot (another team or module), then the guide "Specgate with OpenSpec" and the published case | before announcing |

Spec Kit and Kiro are out of scope (ADR-0030, alternatives).

## 10. Sources

- OpenSpec: `Fission-AI/OpenSpec`, its own `openspec/specs/` and
  `openspec/changes/archive/` (read 2026-10-08).
