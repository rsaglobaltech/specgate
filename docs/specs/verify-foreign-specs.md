# Verifying other tools' specs — specification

Status: **Accepted design, not implemented.** Decided in
[ADR-0030](adr/0030-specgate-verifies-specs-it-did-not-write.md).
Each format ships in its own phase, and only after its pilot (§8).

---

## 1. The promise, and its limit

> Write your spec with Spec Kit, OpenSpec or Kiro. Specgate guarantees that
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

### Kiro

```
.kiro/specs/<feature>/requirements.md
.kiro/specs/<feature>/tasks.md
```

```markdown
### Requirement 1
**User Story:** As a client …
#### Acceptance Criteria
1. WHEN a client sends a POST request to `/v1/jobs` with a valid prompt THEN the system SHALL return HTTP 202 …
2. WHEN a client sends a POST request without a prompt THEN the system SHALL return HTTP 400 …
```

```markdown
- [x] 3. Create core API models and validation
  - Implement Pydantic models for job requests, responses, and status
  - _Requirements: 1.2, 1.3, 8.4_
```

| Element | Read as | Id |
|---|---|---|
| `### Requirement N` | requirement | `kiro:<feature>/N` |
| criterion `M.` under it | acceptance criterion | `kiro:<feature>/N.M` |
| `- [x] K. …` with `_Requirements: …_` | claim of done on those criteria | — |
| `- [x]` with no `_Requirements:_` | claim on nothing; reported, never gated | — |

### Spec Kit

```
specs/<NNN-feature>/spec.md
specs/<NNN-feature>/tasks.md
```

```markdown
### User Story 1 - Clock in at the jobsite (Priority: P1)
**Acceptance Scenarios**:
1. **Given** a worker inside the geofence, **When** they clock in, **Then** the punch is accepted
### Functional Requirements
- **FR-001**: System MUST refuse a clock in outside the geofence
### Measurable Outcomes
- **SC-001**: A punch is confirmed in under 2 seconds
```

```markdown
- [X] T012 [P] [US1] Create Punch model in src/models/punch.py
```

| Element | Read as | Id |
|---|---|---|
| `### User Story N` | requirement | `speckit:<feature>/USN` |
| acceptance scenario `M.` | acceptance criterion | `speckit:<feature>/USN.M` |
| `**FR-NNN**` | functional requirement | `speckit:<feature>/FR-NNN` |
| `**SC-NNN**` | measurable outcome | `speckit:<feature>/SC-NNN` |
| `- [X] Tnnn … [USN] …` | claim on story N; **all** tasks of the story ticked = the story is claimed done | — |

FRs and SCs are not referenced by Spec Kit's tasks, so no claim reaches them:
their coverage is reported, not gated, unless the project opts in with
`verify.speckit.gate_requirements: true`.

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
// kiro:api-server/1.2
it("rejects a job without a prompt (kiro:api-server/1.2)", …)
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
| `V4_unknown_reference` | a claim names a criterion that does not exist (`_Requirements: 9.9_`) | gate |
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
specgate verify [--from kiro|spec-kit|openspec] [--project-dir <dir>]
                [--run] [--test-cmd "<cmd>"] [--since <ref>]
                [--record] [--ids] [--json] [--format text|github|sarif]
```

- **GitHub Action** `rsaglobaltech/specgate/actions/verify`: runs `verify --run
  --since <base>` on a pull request, posts annotations on the spec lines whose
  claims fail, and one summary comment.
- **MCP**: `specgate_verify` returns the same JSON, so a Kiro or Spec Kit agent
  sees the failure inside its own loop.
- **JSON** follows the agent contract (`docs/specs/agent-contract.md`).

## 7. Formats move

- Each reader has fixtures: minimal files written to each tool's published
  template, plus excerpts of public repositories pinned to a commit
  (attribution in the fixture header, within each repository's licence).
- A scheduled job fetches each tool's current templates and runs the readers
  over them. A template that no longer parses fails the job: a format change
  becomes a task, not a silent miss.
- A file that does not parse is `V5`, never zero criteria. A reader that
  silently finds nothing would turn every claim green.

## 8. Proving it — the pilot per format

Before a format ships:

1. One Golden State module is specified with that tool and built with that
   tool's own workflow and agent, by its book.
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

| Phase | Delivers | Why this order |
|---|---|---|
| 1 | OpenSpec reader, `verify`, V1–V7, `verify.lock`, the GitHub Action | closest to Specgate's own format (ADR-0016): the idea is tested fastest |
| 2 | Kiro reader | its tasks already reference criteria, so the claim rule is the clearest |
| 3 | Spec Kit reader | largest audience; the story-level claim rule is the least obvious |
| 4 | Guides "Specgate with Kiro / Spec Kit / OpenSpec" and the published pilot results | only formats whose pilot met the bar |

## 10. Sources

- Spec Kit templates: `github/spec-kit`, `templates/spec-template.md` and
  `templates/tasks-template.md` (read 2026-10-08).
- OpenSpec: `Fission-AI/OpenSpec`, its own `openspec/specs/` and
  `openspec/changes/archive/` (read 2026-10-08).
- Kiro: `kiro.dev/docs/specs`, and the public `.kiro/specs/` of
  `trilogy-group/ttv-pipeline` (read 2026-10-08).
