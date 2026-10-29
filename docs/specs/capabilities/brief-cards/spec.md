# Brief Cards

## Purpose

A brief shaped like what it becomes: per module, the rules, the examples that
prove them and the questions still open — checked before any agent drafts
from it, and taught step by step.

## Requirements

### Requirement: REQ-135 — The front matter's shapes are reported as shapes

The system SHALL, when it checks a brief's front matter, report as `brief_wrong_shape` a field written in a shape Specgate cannot read — `surfaces`, `modules` or `non_goals` not written as a `[...]` list, or an `actors` entry not written as `{ name: …, surfaces: [...] }` — naming the field, the value as written, and the same value in the shape to use, instead of reporting the field as missing.

#### Scenario: SCN-135a — A scalar surface and a bare actor

- GIVEN a brief whose front matter says `surfaces: web` and `actors: [Admin]`
- WHEN the developer runs `specgate propose --from-brief`
- THEN it exits 1 with two `brief_wrong_shape` findings, one whose fix reads "surfaces: [web]" and one whose fix reads "- { name: Admin, surfaces: [web] }"
- AND no finding says "There is no `actors:` list"

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-135.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-136 — The brief is checked before any agent runs

The system SHALL, on `specgate propose --from-brief --check`, check the brief against rules B1 to B11 without writing any file, list each finding with its code, its module when it has one, and its fix, and exit 1 when a finding is an error and 0 otherwise; and SHALL run the same rules before `specgate propose --from-brief <module>` opens a draft, refusing with `brief_not_ready` and opening nothing while an error remains.

#### Scenario: SCN-136a — A brief with an empty module

- GIVEN a Lingo brief whose courses section holds only the comment `<!-- rules go here -->`
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

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-136.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-137.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-138 — Warnings make each rule testable

The system SHALL warn, without failing the check, with `B5_vague` for a rule using a word that cannot be tested — such as "fast", "easy", "user-friendly", "secure", "etc." or "TBD", or their Spanish equivalents; `B6_unmeasured` for a rule that promises a quantity and states no number with a unit; `B7_technical` for a rule naming a framework, database or library; `B8_too_big` for a module with more than seven rules or more than three questions; `B9_actor_unnamed` for a declared actor the body never names; `B10_non_goal` for a rule or example naming one of `non_goals`; and `B11_condition_last` for a rule whose condition follows its obligation instead of opening it, as EARS writes "When …, …" and "If …, then …".

#### Scenario: SCN-138a — Three warnings, no error

- GIVEN `non_goals: [payments]` and a courses section with the rules "Joining is refused if the course is full", "Teachers can see payments of a course" and "Courses are stored in PostgreSQL", and an example for each
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it exits 0 and shows `B11_condition_last` for the first rule, `B10_non_goal` for the second and `B7_technical` for the third

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-138.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-139 — The new brief has cards to fill

The system SHALL, on `specgate propose --from-brief --new-brief`, write a brief whose front matter carries the four fields and a commented `non_goals` example, and whose body holds the sections `## Why`, `## Glossary`, one `## Module: <first-module>` with `Rules`, `Examples` and `Questions`, and `## Notes`, each with a one-line hint and an example; and `--check` on it unfilled SHALL report its placeholders, not a missing section.

#### Scenario: SCN-139a — The template, checked as written

- GIVEN a project with no brief
- WHEN the developer runs `specgate propose --from-brief --new-brief` and then `specgate propose --from-brief --check`
- THEN `docs/brief.md` holds `## Module: <first-module>` with "Rules", "Examples" and "Questions", and the check exits 1 with `brief_placeholder` and `B2_empty_module` findings and no `B3_no_section`

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-139.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-140 — The draft starts from its module's cards

The system SHALL, when `specgate propose --from-brief <module>` opens a draft for a module that has a section in the brief, write into `DRAFTING.md` that section as the module's scope, its numbers and double-quoted labels as the values the draft may use, its questions as rows to copy into `questions.md`, and the mapping of a rule to a requirement and an example to a scenario; and D6 SHALL NOT count text inside an HTML comment of the brief as stated by the brief.

#### Scenario: SCN-140a — The courses cards

- GIVEN a brief whose courses section has the rule "A course holds at most 12 students.", the rule 'When a course is full, joining it is refused with "This course is full".' and the question "Can a student be in two courses at once?"
- WHEN the developer runs `specgate propose --from-brief courses`
- THEN `DRAFTING.md` quotes both rules, lists 12 and "This course is full" as values to use, and lists the question for `questions.md`

#### Scenario: SCN-140b — A value only in a comment

- GIVEN a brief whose only "48" is inside `<!-- e.g. 48 hours -->`, and a draft scenario stating 48
- WHEN the developer runs `specgate propose --from-brief courses` on the draft
- THEN it reports `D6_unlisted_value` for 48

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-140.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-141.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-142 — The guide says when a brief is needed and how to write one

The system SHALL document, in `specgate propose --help` and at the top of `docs/start/write-the-brief.md`, when no brief is needed — one behaviour, or a feature with a few rules, goes through `propose <change-id>` — and SHALL teach the brief on that page in eight numbered steps with a glossary, using `specgate propose --from-brief` throughout, with an example brief that passes `--check` without an error; and `specgate explore` SHALL call what it prints a project snapshot, not a brief.

#### Scenario: SCN-142a — The page and the help

- GIVEN the documentation and the CLI of this release
- WHEN a test reads `specgate propose --help`, the page and the page's example brief
- THEN the help names "No brief" for one behaviour, the page has steps 1 to 8 and a glossary and no "specgate draft" command, and the example brief passes `--check` with exit 0

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-142.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-176 — A question that blocks nothing says so

The system SHALL treat an open question of a draft's `questions.md` whose Blocks cell is `none`, `nothing`, `ninguno`, `ninguna`, `nada`, `n/a` or a dash as a warning, `D7_question_blocks_nothing`, that does not keep the draft from Ready to review, and SHALL still refuse an open question whose Blocks cell is empty with `D7_floating_question`, whose fix names `none`.

#### Scenario: SCN-176a — "none" is a warning

- GIVEN a draft whose questions.md has the open question Q4 "Should it export a backup?" with Blocks "none"
- WHEN the draft is checked
- THEN the only D7 finding is the warning D7_question_blocks_nothing naming Q4

#### Scenario: SCN-176b — An empty Blocks cell is still refused

- GIVEN the same question with an empty Blocks cell
- WHEN the draft is checked
- THEN D7_floating_question is an error whose fix names "none"

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-176.feature kind=functional status=Implemented test=tests/unit/draft-checklist.test.ts -->

### Requirement: REQ-244 — The brief checks read Spanish as written

The system SHALL not read "si" after a verb of saying, checking or deciding ("dice si", "comprueba si", "decide si") — nor "if" after "say", "check", "tell", "decide" — as a condition placed last (B11); and SHALL warn under B5 for "lo más … posible", "cerca", "casi", "aceptable", "as close as possible", "nearby", "almost" and "acceptable".

#### Scenario: SCN-244a — "dice si cabe" and "un desvío aceptable"

- GIVEN the rules "El sistema dice en menos de 1 s si cabe la carga." and "Un camión es candidato con un desvío aceptable."
- WHEN the brief is checked
- THEN the first has no B11 warning and the second has a B5 warning naming "aceptable"

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-244.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-245 — The brief's shape: its size and the surfaces the project has

The system SHALL warn when a brief lists more than eight modules, and when an actor uses `mobile` in a project whose `forja.config.json` lists its platforms without `mobile`, naming the actor; elsewhere a mobile app may live in another repository, and nothing is compared.

#### Scenario: SCN-245a — Ten modules and a driver on mobile, in a web project

- GIVEN a front matter with ten modules and `{ name: Conductor, surfaces: [mobile] }`, in a project whose `forja.config.json` has `platforms: ["web"]`
- WHEN the brief is checked
- THEN it warns that ten modules is more than eight, and that Conductor uses mobile with no mobile app in the project

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-245.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-246 — draft explains the front matter it needs

The system SHALL, when `specgate draft` finds the front matter incomplete, say what each of product, surfaces, actors and modules is for, flag an actor left from the template (`Customer`), and name `specgate draft --agent "<cmd>"` as the way to have an agent propose them.

#### Scenario: SCN-246a — forja's template, modules empty

- GIVEN `docs/brief.md` with forja's front matter: actor `Customer` and `modules: []`, and the client's text below
- WHEN `specgate draft` runs
- THEN it explains the four fields, says `Customer` looks like the template's, and names `specgate draft --agent`

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-246.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-247 — D6 reads a value however the assumption writes it

The system SHALL count a scenario's value as listed when a row of `assumptions.md` that names the scenario or its requirement holds its number — also inside a list that writes the unit once ("7100, 11500 and 8000 kg"), or as a number word ("three", "tres", "drei") — and, for a quoted label with a colon ("Dispositivo: TRK-0001"), when it holds the value after the colon.

#### Scenario: SCN-247a — The truck-flote assumptions

- GIVEN scenario values "3 ejes", "7100 kg", "11500 kg" and "Dispositivo: TRK-0001", and rows "Three axles of 7100, 11500 and 8000 kg" for SCN-006 and "Device identifier TRK-0001" for SCN-008
- WHEN the draft is checked
- THEN none of them is a D6 finding, and "4 ejes" still is

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-247.feature kind=functional status=Implemented test=tests/unit/draft-checklist.test.ts -->

### Requirement: REQ-248 — The undo after an agent run keeps what it removes

The system SHALL, before putting back a file the agent run changed outside the draft, keep its content in the repository's git folder, `.git/specgate-undone/<run>/<path>`, and name that folder in the message, so a person's edit made during the run is never lost and the working tree is left exactly as it was.

#### Scenario: SCN-248a — A log edited by hand while the agent drafts

- GIVEN `docs/notes.md` changed while an agent run writes the draft
- WHEN the run ends and the change is undone
- THEN `docs/notes.md` is back as it was before the run, its changed content is in `.git/specgate-undone/<run>/docs/notes.md`, and `git status` shows nothing new

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-248.feature kind=functional status=Implemented test=tests/unit/draft-from-brief.test.ts -->

### Requirement: REQ-251 — A brief at the root is pointed at

The system SHALL, when `docs/brief.md` lists no modules and a `brief.md` at the project's root holds text that `docs/brief.md` does not, say in `status` and `draft` that the root file looks like the brief and that its text goes below the front matter of `docs/brief.md`.

#### Scenario: SCN-251a — The client's brief pushed first, forja's template beside it

- GIVEN `brief.md` at the root with the client's text, and `docs/brief.md` with forja's front matter and template body
- WHEN `specgate status` and `specgate draft` run
- THEN both name `brief.md` at the root and `docs/brief.md` as where its text goes

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-251.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-252 — An incomplete front matter is called incomplete

The system SHALL, when `draft` explains the four fields over a front matter that exists but needs fixes, say the front matter is incomplete, and say "no front matter yet" only when there is none.

#### Scenario: SCN-252a — forja's front matter, modules empty

- GIVEN forja's front matter with `modules: []`
- WHEN `specgate draft` runs
- THEN it says the front matter is incomplete and does not say "no front matter yet"

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-252.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-253 — The setup guide asks for the brief's own names

The system SHALL write in `BRIEF-SETUP.md` that each actor is named as the brief writes it, in the brief's language; that a brief has three to eight modules; and that, when `forja.config.json` lists the project's platforms, actors get only those surfaces, the others noted with `# check:`.

#### Scenario: SCN-253a — The guide an agent reads

- GIVEN any brief
- WHEN `specgate draft --agent` writes `docs/specs/BRIEF-SETUP.md`
- THEN it says to name actors as the brief writes them, in its language, three to eight modules, and only the surfaces `forja.config.json` lists

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-253.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-257 — The incomplete front matter is explained in a sentence

The system SHALL, when `draft` explains an incomplete front matter, say "The front matter at the top of <brief> is incomplete. These are the four fields that tell Specgate what to draft, and what to check each draft against."

#### Scenario: SCN-257a — forja's front matter, modules empty

- GIVEN forja's front matter with `modules: []`
- WHEN `specgate draft` runs
- THEN it says "These are the four fields that tell Specgate what to draft"

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-257.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-259 — The root brief's text goes below the front matter

The system SHALL, on `specgate draft` with or without `--agent`, when `docs/brief.md` lists no modules, its body is still a template's — it asks for the brief to be pasted there — and a `brief.md` at the project's root holds text `docs/brief.md` does not (REQ-251), put the root file's text below the front matter as it is, keep the root file, and say so, before the four fields are explained or the agent proposes them.

#### Scenario: SCN-259a — The client's brief pushed first, forja's template beside it

- GIVEN `brief.md` at the root with the client's text, and `docs/brief.md` with forja's front matter and its "Paste the client's brief here" body
- WHEN `specgate draft` runs
- THEN `docs/brief.md` holds forja's front matter followed by the client's text, `brief.md` is still at the root, and the output says the text was put there

#### Scenario: SCN-259b — A body the person wrote is left alone

- GIVEN `brief.md` at the root, and `docs/brief.md` whose body is a brief the person wrote
- WHEN `specgate draft` runs
- THEN `docs/brief.md` is unchanged

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-259.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-260 — The guide is removed once the front matter is complete

The system SHALL remove `docs/specs/BRIEF-SETUP.md`, the guide written for an agent to propose the front matter, once `specgate draft` finds the front matter complete — after `draft --agent` proposes one with no fix left, or on a later `draft` — so the working tree holds nothing the person must commit or delete.

#### Scenario: SCN-260a — The agent's front matter needs no fix

- GIVEN `docs/brief.md` without a front matter, and an agent that writes a complete one
- WHEN `specgate draft --agent` runs
- THEN `docs/specs/BRIEF-SETUP.md` does not exist

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-260.feature kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-261 — D6 reads a value made of listed parts

The system SHALL count a scenario's quoted value as listed when it is made of parts joined by ` › `, ` — ` or ` · ` — a screen path, a list row — and each part is in the brief, in the specification, or in a row of `assumptions.md` that names the scenario or its requirement.

#### Scenario: SCN-261a — The truck-flote fleet module

- GIVEN scenario values "1234-BCD › Ejes" and "Lucía Martín — E000001234567890", and rows listing "1234-BCD", "Ejes", "Lucía Martín" and "E000001234567890" for their requirements
- WHEN the draft is checked
- THEN neither is a D6 finding, and "1234-BCD › Remolque" still is

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-261.feature kind=functional status=Implemented test=tests/unit/draft-checklist.test.ts -->

### Requirement: REQ-262 — An answered question its requirement does not reflect is a finding

The system SHALL report, for each question of `questions.md` that has an answer and blocks a requirement still `Needs Clarification`, a finding naming the question and the requirement, whose fix says to fold the answer into the requirement's text and scenarios and drop the status, or to have the agent do it; the draft is not ready to review while one is left.

#### Scenario: SCN-262a — Q5 answered, REQ-010 still blocked

- GIVEN `questions.md` where Q5 blocks REQ-010 and its Answer cell says "Hasta dos conductores por camión", and REQ-010 still `Needs Clarification`
- WHEN the draft is checked
- THEN a finding names Q5 and REQ-010 and says to fold the answer into REQ-010 and drop its status

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-262.feature kind=functional status=Implemented test=tests/unit/draft-checklist.test.ts -->

### Requirement: REQ-263 — `status` says when the answer is in and the spec is not

The system SHALL, in `specgate status`, list a `Needs Clarification` requirement whose blocking questions are all answered under "Answered — update the spec", naming the question, instead of under "Waiting for an answer".

#### Scenario: SCN-263a — The client answered Q5

- GIVEN REQ-010 `Needs Clarification`, blocked by Q5 only, and Q5 answered in its `questions.md`
- WHEN `specgate status` runs
- THEN REQ-010 is under "Answered — update the spec" with Q5, and not under "Waiting for an answer"

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-263.feature kind=functional status=Implemented test=tests/unit/done-refuses-undeliverable.test.ts -->

### Requirement: REQ-277 — D6 reads a date or a time as one value

The system SHALL read, in a scenario step, an ISO date (`2026-10-29`), a time (`10:00:00`, `07:42`) and a date-time (`2026-10-29 10:00:00`, `2026-10-29T10:00:00Z`) as one stated value each, never as the numbers inside them.

#### Scenario: SCN-277a — A position with its time

- GIVEN the step "GIVEN truck TRK-001 last reported 45.7640, 4.8357 at 2026-10-29 10:00:00"
- WHEN D6 reads its values
- THEN they are 45.7640, 4.8357 and 2026-10-29 10:00:00, and none is 29 or 00

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-277.feature kind=functional status=Implemented test=tests/unit/draft-checklist.test.ts -->
