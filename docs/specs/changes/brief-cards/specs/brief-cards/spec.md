# Delta — brief-cards

## Purpose

A brief shaped like what it becomes: per module, the rules, the examples that
prove them and the questions still open — checked before any agent drafts
from it, and taught step by step.

## ADDED Requirements

### Requirement: REQ-135 — The front matter's shapes are reported as shapes

The system SHALL, when it checks a brief's front matter, report as `brief_wrong_shape` a field written in a shape Specgate cannot read — `surfaces`, `modules` or `non_goals` not written as a `[...]` list, or an `actors` entry not written as `{ name: …, surfaces: [...] }` — naming the field, the value as written, and the same value in the shape to use, instead of reporting the field as missing.

#### Scenario: SCN-135a — A scalar surface and a bare actor

- GIVEN a brief whose front matter says `surfaces: web` and `actors: [Admin]`
- WHEN the developer runs `specgate propose --from-brief`
- THEN it exits 1 with two `brief_wrong_shape` findings, one whose fix reads "surfaces: [web]" and one whose fix reads "- { name: Admin, surfaces: [web] }"
- AND no finding says "There is no `actors:` list"

<!-- specgate:trace status=Draft feature=features/brief-cards/REQ-135.feature test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->

### Requirement: REQ-136 — The brief is checked before any agent runs

The system SHALL, on `specgate propose --from-brief --check`, check the brief against rules B1 to B11 without writing any file, list each finding with its code, its module when it has one, and its fix, and exit 1 when a finding is an error and 0 otherwise; and SHALL run the same rules before `specgate propose --from-brief <module>` opens a draft, refusing with `brief_not_ready` and opening nothing while an error remains.

#### Scenario: SCN-136a — A brief with an empty module

- GIVEN a Lingo brief whose courses section holds only the comment "<!-- rules go here -->"
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it exits 1, names `B2_empty_module` for courses with its fix, and `git status` shows no change

#### Scenario: SCN-136b — Drafting over an error

- GIVEN the same brief
- WHEN the developer runs `specgate propose --from-brief courses`
- THEN it exits 1 with `brief_not_ready`, and `docs/specs/changes/draft-courses` does not exist

#### Scenario: SCN-136c — Warnings only

- GIVEN a Lingo brief whose only finding is a rule saying "The list of courses loads fast"
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it exits 0, shows `B5_vague` and `B6_unmeasured` for courses, and says "Ready to draft"

<!-- specgate:trace status=Draft feature=features/brief-cards/REQ-136.feature test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->

### Requirement: REQ-137 — Module sections are each module's scope

The system SHALL read every `## Module: <name>` section of a brief, with its `Rules`, `Examples` and `Questions` lists, and SHALL report as errors: `B2_empty_brief` when the body holds no text but headings, HTML comments and `<…>` placeholders; `B2_empty_module` when a module section holds nothing else; `B3_no_section` for a module of `modules:` with no section and `B3_unknown_module` for a section naming no listed module, once the brief has at least one module section; `B4_no_rule` for a module section with no rule; and `B4_no_example` for one with rules and no example. A brief with no module section SHALL get only the note `B3_no_sections` and keep working as before.

#### Scenario: SCN-137a — A missing and an unknown section

- GIVEN a brief with `modules: [courses, lessons]`, a filled courses section, and a section "## Module: billing"
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it reports `B3_no_section` for lessons and `B3_unknown_module` for billing, and exits 1

#### Scenario: SCN-137b — Rules without examples

- GIVEN a courses section with two rules and no example
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it reports `B4_no_example` for courses, and exits 1

#### Scenario: SCN-137c — A pasted email

- GIVEN a brief with a complete front matter and the client's email below it, with no module section
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it exits 0, and its only finding is the note `B3_no_sections`

<!-- specgate:trace status=Draft feature=features/brief-cards/REQ-137.feature test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->

### Requirement: REQ-138 — Warnings make each rule testable

The system SHALL warn, without failing the check, with `B5_vague` for a rule using a word that cannot be tested — such as "fast", "easy", "user-friendly", "secure", "etc." or "TBD", or their Spanish equivalents; `B6_unmeasured` for a rule that promises a quantity and states no number with a unit; `B7_technical` for a rule naming a framework, database or library; `B8_too_big` for a module with more than seven rules or more than three questions; `B9_actor_unnamed` for a declared actor the body never names; `B10_non_goal` for a rule or example naming one of `non_goals`; and `B11_condition_last` for a rule whose condition follows its obligation instead of opening it, as EARS writes "When …, …" and "If …, then …".

#### Scenario: SCN-138a — Three warnings, no error

- GIVEN `non_goals: [payments]` and a courses section with the rules "Joining is refused if the course is full", "Teachers can see payments of a course" and "Courses are stored in PostgreSQL", and an example for each
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it exits 0 and shows `B11_condition_last` for the first rule, `B10_non_goal` for the second and `B7_technical` for the third

<!-- specgate:trace status=Draft feature=features/brief-cards/REQ-138.feature test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->

### Requirement: REQ-139 — The new brief has cards to fill

The system SHALL, on `specgate propose --from-brief --new-brief`, write a brief whose front matter carries the four fields and a commented `non_goals` example, and whose body holds the sections `## Why`, `## Glossary`, one `## Module: <first-module>` with `Rules`, `Examples` and `Questions`, and `## Notes`, each with a one-line hint and an example; and `--check` on it unfilled SHALL report its placeholders, not a missing section.

#### Scenario: SCN-139a — The template, checked as written

- GIVEN a project with no brief
- WHEN the developer runs `specgate propose --from-brief --new-brief` and then `specgate propose --from-brief --check`
- THEN `docs/brief.md` holds "## Module: <first-module>" with "Rules", "Examples" and "Questions", and the check exits 1 with `brief_placeholder` and `B2_empty_module` findings and no `B3_no_section`

<!-- specgate:trace status=Draft feature=features/brief-cards/REQ-139.feature test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->

### Requirement: REQ-140 — The draft starts from its module's cards

The system SHALL, when `specgate propose --from-brief <module>` opens a draft for a module that has a section in the brief, write into `DRAFTING.md` that section as the module's scope, its numbers and double-quoted labels as the values the draft may use, its questions as rows to copy into `questions.md`, and the mapping of a rule to a requirement and an example to a scenario; and D6 SHALL NOT count text inside an HTML comment of the brief as stated by the brief.

#### Scenario: SCN-140a — The courses cards

- GIVEN a brief whose courses section has the rule "A course holds at most 12 students.", the rule 'When a course is full, joining it is refused with "This course is full".' and the question "Can a student be in two courses at once?"
- WHEN the developer runs `specgate propose --from-brief courses`
- THEN `DRAFTING.md` quotes both rules, lists 12 and "This course is full" as values to use, and lists the question for `questions.md`

#### Scenario: SCN-140b — A value only in a comment

- GIVEN a brief whose only "48" is inside "<!-- e.g. 48 hours -->", and a draft scenario stating 48
- WHEN the developer runs `specgate propose --from-brief courses` on the draft
- THEN it reports `D6_unlisted_value` for 48

<!-- specgate:trace status=Draft feature=features/brief-cards/REQ-140.feature test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->

### Requirement: REQ-141 — The agent proposes the cards from pasted notes

The system SHALL, on `specgate propose --from-brief --agent <command>` when the front matter is complete and the brief has no module section, have the agent add one module section per listed module with rules, examples and questions taken from the brief's own text, allow it to write only the brief, and keep the result only when every non-blank line of the original body is still there in its order; otherwise it SHALL put the brief back as it was and fail with `draft_brief_text_lost`.

#### Scenario: SCN-141a — Sections added below the notes

- GIVEN a Lingo brief with a complete front matter and plain notes, and an agent command that appends a courses section and a lessons section
- WHEN the developer runs `specgate propose --from-brief --agent` with that command
- THEN the brief keeps the notes and gains both sections, and the output names `specgate propose --from-brief --check` as next

#### Scenario: SCN-141b — A line of the notes rewritten

- GIVEN the same brief, and an agent command that rewrites the line "A teacher runs small groups of adult students."
- WHEN the developer runs `specgate propose --from-brief --agent` with that command
- THEN it exits 1 with `draft_brief_text_lost`, and the brief is byte for byte as before

<!-- specgate:trace status=Draft feature=features/brief-cards/REQ-141.feature test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->

### Requirement: REQ-142 — The guide says when a brief is needed and how to write one

The system SHALL document, in `specgate propose --help` and at the top of `docs/start/write-the-brief.md`, when no brief is needed — one behaviour, or a feature with a few rules, goes through `propose <change-id>` — and SHALL teach the brief on that page in eight numbered steps with a glossary, using `specgate propose --from-brief` throughout, with an example brief that passes `--check` without an error; and `specgate explore` SHALL call what it prints a project snapshot, not a brief.

#### Scenario: SCN-142a — The page and the help

- GIVEN the documentation and the CLI of this release
- WHEN a test reads `specgate propose --help`, the page and the page's example brief
- THEN the help names "No brief" for one behaviour, the page has steps 1 to 8 and a glossary and no "specgate draft" command, and the example brief passes `--check` with exit 0

<!-- specgate:trace status=Draft feature=features/brief-cards/REQ-142.feature test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->
