# ADR-0038 — Brief cards: a brief shaped like what it becomes

## Status

Accepted — 2026-10-20 (change `brief-cards`, archived)

## Context

A brief is the stakeholder layer of a specification (ISO/IEC/IEEE 29148):
what people need, before what the system shall do. Specgate drafted from any
markdown and checked the draft against the brief's words, which works, but
left three gaps:

- **No scope per module.** `modules: [courses, lessons]` were bare names; the
  agent drafting "only courses" decided alone which sentences were about
  courses.
- **Checks nobody was told about.** D6 matched values in scenarios against
  the brief literally — and the template's own HTML comments counted as the
  brief. D7 needed questions the brief had but never asked for in a usable
  form.
- **Bad briefs accepted.** Wrong shapes were reported as missing fields, a
  scalar `surfaces:` passed, and a template still full of comments was "ready".

Böckeler's review of Kiro, spec-kit and Tessl adds two constraints: one
workflow for every size is a sledgehammer, and reviewing markdown must not
cost more than reviewing code.

## Decision

1. **Module sections in Example Mapping's shape.** `## Module: <name>` with
   `Rules`, `Examples` ("the one where…") and `Questions`. A rule becomes a
   requirement, an example a scenario, a question a `questions.md` row.
2. **Brief rules, like the draft rules.** B1 shape, B2 empty, B3 sections and
   modules agree, B4 every module has rules and examples — errors; B5 vague
   words, B6 unmeasured promises, B7 technology, B8 size, B9 unnamed actors,
   B10 non-goals, B11 condition first (EARS) — warnings.
   `propose --from-brief --check` runs them; a draft is not opened over an
   error.
3. **`non_goals` in the front matter**, because B10 checks it; a glossary is a
   section, because nothing checks it.
4. **The module's section is the draft's input.** `DRAFTING.md` quotes it and
   lists its values; D6 no longer reads HTML comments.
5. **Say when no brief is needed.** One behaviour, or a feature with a few
   rules: `propose <change-id>` and write the delta.

## Consequences

- A brief written in cards produces drafts whose values pass D6 by
  construction, and a reviewer reads the draft against cards they wrote.
- Briefs without sections keep working; the check says how to sharpen them.
- EARS is taught and warned, not enforced, until it is measured.

## Alternatives considered

- **User stories with acceptance criteria** (Kiro, spec-kit). Familiar, but a
  story is a fourth shape between brief and requirement; cards map directly.
- **Front matter for everything** (modules with rules as YAML). Machine-
  friendly, hostile to the person writing it.
