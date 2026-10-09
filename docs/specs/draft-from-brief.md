# Drafting from a brief — specification

Status: **Phase 1 implemented (`draft --check`, D1–D8); D1–D5 in `status`/`plan` and phases 2–4 pending.** Decided in
[ADR-0029](adr/0029-a-brief-becomes-a-draft-change-not-a-spec.md).
Implemented in the phases at the end; phase 1 is an evaluation, not a release.

---

## 1. What it is for

A team starts from a brief: a page that names the product, its users, its
modules and its constraints. `specgate draft` turns one module of that brief
into a **proposed change** — requirements, use cases, scenarios, the
assumptions it made and the questions it could not answer — for a person to
review, correct and archive.

It does not decide what the product is. It removes the blank page and the
omissions a checklist catches.

```bash
specgate draft --from docs/brief.md --module attendance
# → docs/specs/changes/draft-attendance/   (a change, not applied)
specgate change show draft-attendance      # review the delta
# edit, answer questions.md, confirm assumptions.md
specgate change archive draft-attendance   # only now does it become spec
```

## 2. The brief

Any Markdown. Specgate reads it as text; no structure is required. An optional
front matter makes the checklist sharper:

```markdown
---
product: Golden State Reinforcing field app
surfaces: [api, mobile]          # D3: which scenarios each human use case owes
actors:
  - { name: Worker,     surfaces: [mobile] }
  - { name: Foreman,    surfaces: [mobile] }
  - { name: Office,     surfaces: [api] }
modules: [attendance, job-files, foreman-log, daily-reports, communication, learning]
---

# Golden State Reinforcing — field app
…the brief as the client wrote it…
```

Without front matter, `surfaces` defaults to the project's detected ones (an
`apps/web/app/api` tree is `api`, an Expo app is `mobile`), and actors are
whatever the agent finds — listed in the draft for the reviewer to confirm.

## 3. What a draft contains

```
docs/specs/changes/draft-<module>/
  change.yaml          # schema: draft · brief digest · module · REQ range reserved
  proposal.md          # what the module is for, in the brief's words, with citations
  specs/<capability>/spec.md   # ADDED requirements (delta format, ADR-0016)
  use-cases/UC-NNN.md  # when the project's profile has use cases (ADR-0027)
  features/*.feature   # one file per scenario, tagged @REQ-NNN @SCN-NNN
  assumptions.md       # every value or fact not found in the brief
  questions.md         # every question the brief does not answer
  draft-report.json    # the checklist result (§4)
```

Every requirement carries `kind` and, in its prose, a citation of the brief
passage it comes from (`> Brief: "…"`). A requirement with no passage to cite
is an assumption and is listed as one.

### `assumptions.md`

```markdown
| # | Assumption | Used in | Why |
|---|---|---|---|
| A1 | Default geofence radius 100 m | REQ-109, SCN-113 | Industry default; the brief does not say |
```

### `questions.md`

```markdown
| # | Question | Blocks | Options seen |
|---|---|---|---|
| Q1 | Is the meal-break threshold the Labor Code §512 default or the union agreement's? | REQ-206 | §512: before the 5th hour · CBA: varies |
```

A requirement listed under **Blocks** is written with status
`Needs Clarification`. The harness refuses it until the question is answered
and the status changed — the readiness rule that exists today.

## 4. The checklist

Deterministic rules over the draft's files. In a draft, a failing rule fails
`specgate draft` (the agent gets the findings and another attempt, like the
harness gate). On a hand-written project, D1–D5 are a report in `status` and
`plan`, never a gate (ADR-0023).

| Code | Rule | How it is decided |
|---|---|---|
| `D1_no_scenario` | Every requirement has a scenario | a feature file tagged `@REQ-NNN` |
| `D2_no_kind` | Every requirement has a kind | `kind=` in its `csda:trace` |
| `D3_surface_missing` | Every use case a person drives has a scenario per surface its actor uses | `api`: a step matching `(GET\|POST\|PUT\|PATCH\|DELETE) /`; a screen: a step naming a control (`taps`, `opens`, `sees`, `toca`, `abre`) |
| `D4_unmeasured_nfr` | A non-functional requirement states a number with a unit | a number followed by a unit (`ms`, `s`, `m`, `%`, `MB`, `req/s`…) in its text or its scenario |
| `D5_unsourced_rule` | A business rule that mentions a law, code, standard or contract names its source | a mention (`Code §`, `ACI`, `OSHA`, `GDPR`, `CBA`, `contract`…) and no link or `Source:` line |
| `D6_unlisted_value` | A value in a scenario is in the brief or in `assumptions.md` | every number and every quoted string in a scenario's steps is found in the brief text, or in an assumption row that names that scenario |
| `D7_floating_question` | A question names what it blocks | every row of `questions.md` has `Blocks`, and each of those requirements is `Needs Clarification` |
| `D8_too_large` | The draft is reviewable | at most `draft.max_requirements` requirements (default 25) |

D6 is the rule that makes a draft honest. It is mechanical on purpose: it does
not judge whether "100 m" is right, only that nobody can mistake it for
something the client said.

## 5. The agent

`specgate draft` builds a prompt — the brief, the module, the project's
profile and stack, the checklist with its codes, and the file layout above —
and runs the project's agent profile with it, confined to the change directory
exactly as `change author` is. Then it runs the checklist. On failures it
feeds the findings back, up to `--max-attempts` (default 3).

```bash
specgate draft --from <brief.md> --module <name> \
  [--as-pack <dir>]         # a pack fragment instead of a change (specops projects)
  [--agent "<cmd>"]          # override the profile, as `harness run --agent`
  [--prompt-only]            # write the prompt + checklist to a file and stop
  [--check <change-id>]      # run the checklist on a draft written elsewhere
  [--max-attempts <n>]
```

`--prompt-only` and `--check` together are the path for teams with no agent on
the command line: paste the prompt into any assistant, put its answer in the
change directory, run `--check`.

## 6. Review and archive

Nothing new: `change show`, `change validate`, `change archive`. Two rules are
added to `change archive` for a change whose schema is `draft`:

- it refuses while any row of `questions.md` is unanswered (an answer is a
  `Answer:` line under the row, written by a person);
- it refuses while any assumption is not marked `confirmed` or `replaced`.

The brief's digest is recorded in `change.yaml`. A later `draft` of the same
module against a changed brief says which requirements cite passages that
changed.

## 7. Evaluation before release

The Golden State pilot left a reference: the brief, and the reviewed packs
v0.2.0 built from it (46 requirements, 31 use cases, 98 scenarios).

**Protocol.** Run the prototype on the brief, one draft per module, with no
access to the reference. For each module, a reviewer — not the author of the
prototype — matches draft requirements to reference requirements and records:

| Measure | Meaning |
|---|---|
| Recall | reference requirements the draft contains, or asks about in `questions.md` |
| Precision | draft requirements that are in the reference, or that the reviewer would add |
| Surface coverage | reference API and screen scenarios the draft has an equivalent for |
| Honesty | values in draft scenarios that are neither in the brief nor in `assumptions.md` (must be 0: D6) |
| Review time | minutes to bring the draft to archivable |

**Bar to ship.** Recall ≥ 70 %, honesty violations = 0, and review time
below the time the reference took to write. Below the bar, the findings decide
what changes; the command does not ship on hope.

## 8. Phases

| Phase | Delivers | Ships as |
|---|---|---|
| 1 | Checklist rules D1–D8 as a library + `draft --check` | release; D1–D5 also reported by `status`/`plan` |
| 2 | `draft --prompt-only` and the prompt contract | release |
| 3 | Prototype `draft` with the agent profile; the evaluation in §7 on the Golden State brief | evaluation report in `mejoras/` |
| 4 | `draft` as a command, `--as-pack`, archive rules for `draft` changes | release, only if phase 3 met the bar |
