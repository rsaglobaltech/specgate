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

The system SHALL treat an open question of a draft's `questions.md` whose Blocks cell is `none`, `nothing`, `ninguno`, `ninguna`, `nada`, `n/a` or a dash as a warning, `D7_question_blocks_nothing`, that does not keep the draft from Ready to review — `specgate propose --from-brief`, `specgate draft` and `draft --check` show it, say Ready to review and end with 0 when it is the draft's only finding, and do not hand it to the agent's fix pass — and SHALL still refuse an open question whose Blocks cell is empty with `D7_floating_question`, whose fix names `none`.

#### Scenario: SCN-176a — "none" is a warning

- GIVEN a draft whose questions.md has the open question Q4 "Should it export a backup?" with Blocks "none"
- WHEN the draft is checked
- THEN the only D7 finding is the warning D7_question_blocks_nothing naming Q4

#### Scenario: SCN-176b — An empty Blocks cell is still refused

- GIVEN the same question with an empty Blocks cell
- WHEN the draft is checked
- THEN D7_floating_question is an error whose fix names "none"

#### Scenario: SCN-176c — The warning alone leaves the draft ready

- GIVEN a complete draft whose only finding is the warning D7_question_blocks_nothing for Q4
- WHEN the Developer runs `specgate draft bookings`, then `specgate draft --check draft-bookings`
- THEN both show the warning, say Ready to review and end with 0, and `--json` says the draft is ready

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-176.feature kind=functional status=Implemented test=tests/unit/draft-checklist.test.ts,tests/unit/draft-from-brief.test.ts -->

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

### Requirement: REQ-658 — The project's domain model, to draw

The system SHALL answer, on `specgate brief model --json`, the project's domain model as its bounded contexts — each with its purpose, classification, integrations with their relationships and messages, terms, rules, flows (actor, command or policy with its trigger, outcomes, systems, views, and how it was placed), stories (numbered activities) and questions — read from the workshop's models in `docs/brief/models` when there are any; and, when there are none, from the specification: each capability or draft's module a context, each requirement a flow whose command is its title, whose actor is its trace's and whose outcomes are its scenarios, and each use case with a specification a story of its main flow's steps; and SHALL say which of the two it was read from.

> The studio draws the brief as DDD diagrams — a context map and each context's flows as an Event Storming — whether the project came from a workshop or not (issue #59, both ways).

#### Scenario: SCN-658a — From the claims workshop

- GIVEN a project where the motor-claims workshop was imported
- WHEN the Developer runs `specgate brief model --json`
- THEN it answers `source: workshop` and three contexts, siniestros core with its outbound ACL to Pólizas "Consultar cobertura", its flow "Asegurado · Declarar siniestro · Siniestro declarado", and its story of 26 activities, the first by the Asegurado

#### Scenario: SCN-658b — From the specification, with no workshop

- GIVEN a project with no workshop, a module pedidos whose draft has REQ-031 "Cancel an order" by the Customer with the scenario "Cancelled before shipping", and the use case UC-001 whose main flow has three steps
- WHEN the Developer runs `specgate brief model --json`
- THEN it answers `source: spec`, the context pedidos with the flow "Customer · Cancel an order · Cancelled before shipping", and the story of UC-001 with its three steps

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-658.feature kind=functional status=Implemented -->

### Requirement: REQ-659 — The domain model exported to DDD Toolbox

The system SHALL, on `specgate brief export [--out <dir>]`, write the project's domain model as boards DDD Toolbox opens — a Bounded Context Canvas per context, an Event Storming board of every flow along the timeline, and a Domain Storytelling board per story — in its exported file format and none of its code, under `docs/brief/ddd-toolbox` unless `--out` names another folder, and answer with `--json` the files written; boards read back by `brief import` SHALL give the same contexts, flows and stories.

#### Scenario: SCN-659a — The claims workshop, there and back

- GIVEN the claims workshop imported
- WHEN the Developer runs `specgate brief export` and imports the boards it wrote into an empty project
- THEN the three canvases, the Event Storming board and the story are written, and read back they give the same three contexts, 26 flows and the 26 activities in order

<!-- specgate:trace actor=Developer artifact="packages/core/src/domain/DddToolboxExport.ts, scripts/brief_export.ts, templates/ddd-toolbox/records.json" feature=features/brief-cards/REQ-659.feature kind=functional status=Implemented -->

### Requirement: REQ-655 — A DDD workshop's boards become the brief's modules

The system SHALL, on `specgate brief import <file>…` with boards exported by DDD Toolbox — Domain Storytelling, Event Storming, Bounded Context Canvas, its files only and none of its code — write the workshop's domain model as one readable file per bounded context, `docs/brief/models/<context>.yaml`, with its purpose, classification, integrations, terms, rules, flows, stories and questions; and SHALL add to `docs/brief.md` — writing it when there is none — each context as a module in the front matter, the stories' people and systems as actors (a system on `api`, a person on `web`), and a section "From the DDD workshop" naming each context's purpose, open questions and the file of its model — its rules kept in the model, a workshop giving no example for a module card's rules; it SHALL keep every line the brief already had, leave a module already there as it is, set the project's `language` to the workshop's when none is set, and with `--json` answer the contexts, the files written, the language and the flows it placed by assumption.

> Issue #59 of the studio: enterprise teams model the domain in DDD workshops; their boards become the brief instead of being typed again. The license respected: the exported files only.

#### Scenario: SCN-655a — The claims workshop imported into an empty project

- GIVEN a project with no brief, and the motor-claims workshop exported from dddtoolbox.com: its story, its Event Storming and the canvases Siniestros, Pólizas and Pagos
- WHEN the Developer runs `specgate brief import` with the five files
- THEN `docs/brief/models/siniestros.yaml`, `polizas.yaml` and `pagos.yaml` are written, the project's language is set to Spanish, the brief's front matter lists the modules siniestros, polizas and pagos and the actor Tramitador on web and Sistema de pagos on api, and the brief's workshop section names Siniestros with `docs/brief/models/siniestros.yaml`; and `propose --from-brief --check` finds the brief ready

#### Scenario: SCN-655b — An existing brief kept

- GIVEN a project whose brief has the module catalogo and its own text
- WHEN the Developer imports the claims workshop
- THEN the brief still has catalogo and every line it had, and also the three modules of the workshop

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-655.feature kind=functional status=Implemented -->

### Requirement: REQ-656 — A module from a workshop is drafted from its model

The system SHALL, when `specgate propose --from-brief <module>` drafts a module that has `docs/brief/models/<module>.yaml`, name that file in the drafting guide as a source beside the brief — its flows, rules, terms and questions to be worded in the brief's language, a flow placed by assumption to be confirmed or questioned — and SHALL say in the guide the language to write in — the project's `language`, its technical words (SHALL, GIVEN/WHEN/THEN, ids) kept in English — and how many flows the model holds against the requirement ids the draft has, the flows left out listed in `discover.md` for a next draft rather than dropped; and SHALL accept, in the draft's check (D6), a value stated in the workshop's models as stated in the brief.

#### Scenario: SCN-656a — The siniestros module drafted

- GIVEN the claims workshop imported
- WHEN the Developer runs `specgate propose --from-brief siniestros`
- THEN the draft's DRAFTING.md names `docs/brief/models/siniestros.yaml` as a source, says to write in Spanish and that the model holds 24 flows for 10 requirement ids, the rest listed in discover.md; and a scenario stating "75 %" passes D6 because the model says it

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-656.feature kind=functional status=Implemented -->

### Requirement: REQ-657 — From a workshop to a draft in one command

The system SHALL, on `specgate propose --from-model <file>…`, import the boards as `brief import` does and then draft the first module the import added, as `propose --from-brief <module>` does, saying the other modules to draft next.

#### Scenario: SCN-657a — Imported and drafted

- GIVEN a project with no brief and the claims workshop's five files
- WHEN the Developer runs `specgate propose --from-model` with them
- THEN the models and the brief are written, the draft change of siniestros is opened, and the answer names polizas and pagos as next

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-657.feature kind=functional status=Implemented -->

### Requirement: REQ-622 — An actor's name in quotes is read whole

The system SHALL read an actor's name written in double or single quotes in the brief's front matter — `- { name: "Padre, madre o tutor", surfaces: [web] }` — as the whole name without its quotes, a comma inside it included, wherever it reads actors (the brief's checks, its form, its cards, the domain docs); SHALL read a bare name as before; and SHALL write back, in the form, a name that holds a comma, a colon, a brace, a bracket, a hash or a quote in double quotes.

> Studio report (#541): the agent wrote `{ name: "Padre, madre o tutor", surfaces: [web] }` — valid YAML — and specgate refused with `brief_actor_without_surfaces "Padre has no surfaces`.

#### Scenario: SCN-622a — A quoted name with a comma

- GIVEN a brief whose actors include `- { name: "Padre, madre o tutor", surfaces: [web] }`
- WHEN specgate checks the brief
- THEN "Padre, madre o tutor" is one actor on web, and no `brief_actor_without_surfaces` is reported

#### Scenario: SCN-622b — The form writes such a name in quotes

- GIVEN the form's actor "Padre, madre o tutor" on web
- WHEN the form is written back to the brief
- THEN the line reads `- { name: "Padre, madre o tutor", surfaces: [web] }`, and reading it back gives the same actor

<!-- specgate:trace actor=Developer artifact=packages/core/src/domain/DraftChecklist.ts feature=features/brief-cards/REQ-622.feature kind=functional status=Implemented -->

### Requirement: REQ-486 — The brief read as a form, each field with its line

The system SHALL answer `specgate propose --from-brief --form --json`, and the API's `briefForm(dir)`, with the brief as a form — its front matter's product, surfaces, actors and modules, and each module with its key, name, prose, rules, examples and questions — giving the line of each field in the file, or null for one the file does not hold, and the brief's findings under `status`; and SHALL write nothing.

#### Scenario: SCN-486a — A module with its section and one without

- GIVEN docs/brief.md with `modules: [orders, payments]` on line 6, a section `## Module: orders` whose first rule is on line 14, no section for payments, and a paragraph "Notes from the call" outside every module
- WHEN `specgate propose --from-brief --form --json` runs
- THEN the form gives `modules` at line 6, orders' first rule with line 14, payments with a null line and no cards, and docs/brief.md is unchanged

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-486.feature kind=functional status=Implemented -->

### Requirement: REQ-487 — The form written back, every other byte kept

The system SHALL, with `specgate propose --from-brief --form <file>` (`-` reads standard input) and the API's `writeBriefForm(dir, form)`, write a form of REQ-486's shape back into the brief, rewriting only the front matter fields and the module sections whose values changed and keeping every other byte as it was — the line endings, CRLF included, the text after the last section, and every section that is not a module's; and the studio's own save of the brief SHALL use the same code.

#### Scenario: SCN-487a — A CRLF brief with notes after its last module

- GIVEN a docs/brief.md written with CRLF, with a `## Context` section, the modules orders and payments, and two blank lines and a note after payments' section
- WHEN its form is read, a rule is added to orders, and the form is written back
- THEN the brief has the new rule under orders, every line still ends in CRLF, and every byte outside orders' section is as it was; written back with no change, the file is identical byte for byte

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-487.feature kind=functional status=Implemented -->

### Requirement: REQ-488 — A client's text outside the project proposed as a form

The system SHALL, when `specgate propose --from-brief --brief <file> --agent <cmd> --json` runs on a file outside the project, let the agent write only that file, answer what it proposed under `form` in REQ-486's shape, and write, create or remove nothing inside the project — no `docs/specs/BRIEF-SETUP.md` or `docs/specs/BRIEF-CARDS.md` — even when the proposed front matter has problems.

#### Scenario: SCN-488a — The proposed front matter has a problem

- GIVEN a project in git and the client's text in a file outside it
- WHEN `specgate propose --from-brief --brief <that file> --agent <cmd> --json` runs and the agent proposes a front matter whose actor uses a surface `surfaces` does not list
- THEN the answer gives the form with the proposed product and modules and the problem under `status`, and the project's files and `git status` are as before

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-488.feature kind=functional status=Implemented -->

### Requirement: REQ-601 — Quality requirements under ISO/IEC 25010

The system SHALL read a brief's `## Quality` section (also `## Calidad`, `## Quality requirements`, `## Requisitos de calidad`, `## Non-functional requirements` or `## Requisitos no funcionales`), each list item written as `<characteristic> (<module>, …): <statement>` with the parenthesis optional; and SHALL report, on `specgate propose --from-brief --check` and before a draft opens: as the error `B14_quality_unmeasured` an entry whose statement uses a word no test can check or promises a quantity with no number; as the error `B14_quality_module` an entry naming a module that `modules:` does not list; as the warning `B14_quality_shape` an item with no characteristic; and as the warning `B14_quality_characteristic` a characteristic that is not one of ISO/IEC 25010:2023's nine — functional suitability, performance efficiency, compatibility, interaction capability, reliability, security, maintainability, flexibility, safety — nor a recognised alias of one, in English or Spanish, with a fix listing the nine. A brief with no such section SHALL get no finding about it.

#### Scenario: SCN-601a — A quality entry no test can check

- GIVEN a Lingo brief whose `## Quality` section says "- performance efficiency: The course list loads fast."
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it exits 1 with `B14_quality_unmeasured` naming the entry's line, and `specgate propose --from-brief courses` refuses with `brief_not_ready`

#### Scenario: SCN-601b — Measured entries, an alias and an unknown characteristic

- GIVEN a `## Quality` section saying "- performance (courses): The course list loads in under 2 seconds for 500 students at once.", "- disponibilidad: 99.5% each month." and "- beauty: Every screen uses the school's colours."
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it exits 0, reports `B14_quality_characteristic` for beauty with a fix naming the nine characteristics, and reports nothing for the other two

#### Scenario: SCN-601c — An unknown module and no characteristic

- GIVEN a `## Quality` section saying "- security (billing): Card numbers are never stored." and "- Every page meets WCAG 2.2 AA."
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it reports the error `B14_quality_module` for billing and the warning `B14_quality_shape` for the second item

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-601.feature kind=functional status=Implemented -->

### Requirement: REQ-602 — Objectives with a success you can measure

The system SHALL report as the warning `B15_why_unmeasured` a brief whose `## Why` section (also `## Por qué`, `## Goals`, `## Objectives` or `## Objetivos`) says something and states no number, with a fix asking for the problem, the objectives and a success measured with a value and a unit; and SHALL report nothing when the section is absent or holds only comments.

#### Scenario: SCN-602a — A why with no number

- GIVEN a Lingo brief whose `## Why` says "Students lose track of their lessons. We want them to find them easily."
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it exits 0 and reports `B15_why_unmeasured`

#### Scenario: SCN-602b — A measured why, and a brief without one

- GIVEN one Lingo brief whose `## Why` says "A student finds today's lesson in under 10 seconds." and another with no `## Why` section
- WHEN the developer runs `specgate propose --from-brief --check` on each
- THEN neither reports a `B15` finding

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-602.feature kind=functional status=Implemented -->

### Requirement: REQ-603 — Quality requirements reach the drafts

The system SHALL hand, in the `DRAFTING.md` of `specgate propose --from-brief <module>`, the `## Quality` entries that name that module, and — when the module is the first of `modules:` — the entries that name none, each to be written as a requirement of kind `non-functional` quoting its entry under `> Brief:`; SHALL hand no entry to any other module's draft; and SHALL write a `## Quality` section with commented examples and a `## Why` asking for a measurable success in the brief of `--new-brief`, ask in the guide an agent follows to propose a brief's sections for a `## Quality` section when the brief's text says how well the product must work, and name quality among what a good brief says when the project has no brief.

#### Scenario: SCN-603a — Scoped and product-wide entries

- GIVEN a Lingo brief with `modules: [courses, lessons]` whose `## Quality` says "- performance (lessons): A lesson opens in under 3 seconds." and "- reliability: Available 99.5% of each month."
- WHEN the developer runs `specgate propose --from-brief courses`, then `specgate propose --from-brief lessons`
- THEN courses' `DRAFTING.md` lists the reliability entry and not the performance one, and lessons' lists the performance entry and not the reliability one, each as a non-functional requirement to write

#### Scenario: SCN-603b — The new brief teaches both sections

- GIVEN a project with no brief
- WHEN the developer runs `specgate propose --from-brief --new-brief`
- THEN `docs/brief.md` has a `## Quality` section naming ISO/IEC 25010, a `## Why` asking for a success you can measure, and `specgate propose --from-brief --check` reports no `B14` or `B15` finding on it

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-603.feature kind=functional status=Implemented -->

### Requirement: REQ-653 — The agent's front matter is fixed before it is shown

The system SHALL tell the agent that proposes a brief's front matter that a system the brief names — a service the product calls or one that calls it, a provider, a device — uses `api`, which then goes in `surfaces` too, and that an actor's surfaces are never empty; and SHALL, when the front matter the agent wrote has problems and the brief below it is unchanged, run the agent once more with each problem and its fix before it answers, answering what that second pass left.

#### Scenario: SCN-653a — A service left with no surfaces

- GIVEN an agent whose first front matter gives "Servicio de transcripción" no surfaces, and which fixes a problem it is told
- WHEN the Developer runs `specgate draft --agent <it> --json`
- THEN the agent ran twice, the second time told brief_actor_without_surfaces, and the brief says `{ name: Servicio de transcripción, surfaces: [api] }` with no problem left and its body unchanged

#### Scenario: SCN-653b — The guide says it

- GIVEN any brief
- WHEN the agent's guide is written
- THEN it says a system the brief names uses `api` and an actor's surfaces are never empty

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-653.feature kind=functional status=Implemented -->

### Requirement: REQ-652 — Two modules drafted at once leave each other's draft alone

The system SHALL, while `specgate propose --from-brief <module> --agent` runs its agent, mark that the change's agent runs — and when it ended — inside git's own folder, where no status shows it; and SHALL, when it confines an agent to its change, neither keep nor undo what changed in the folder of another change whose agent ran at any time during this one, while still undoing everything else outside the change.

#### Scenario: SCN-652a — draft-b's agent writes while draft-a's runs

- GIVEN a project where draft-b's agent runs, and draft-a's agent writes its own draft, writes on in draft-b's folder and touches draft-c, which no agent drafts
- WHEN draft-a's agent ends
- THEN draft-a's draft is what it wrote, draft-b's files are as last written, draft-c's file is undone, and draft-a's mark says when its agent ran without showing in git's status

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-652.feature kind=functional status=Implemented -->

### Requirement: REQ-796 — The brief's guides are printed on request

The system SHALL, when `specgate propose --from-brief --guide setup` runs, print the guide an agent follows to propose the brief's front matter, and when `--guide cards` runs, the guide to propose a section per module, naming the modules of the brief's front matter — writing no file, so the working tree stays as it was; SHALL refuse `--guide cards` with `draft_guide_no_modules` while the front matter lists no module; and SHALL refuse any other value as a usage error.

> Reported on 2026-11-27: the `draft` skill sent the agent to `docs/specs/BRIEF-CARDS.md`, which only `--agent` writes, and to `docs/specs/BRIEF-SETUP.md`, which is not written while the front matter has problems; the agent read Specgate's source to learn the format.

#### Scenario: SCN-796a — The cards guide

- GIVEN `docs/brief.md` whose front matter lists `courses` and `lessons`, and no `## Module:` section
- WHEN `specgate propose --from-brief --guide cards` runs
- THEN it prints the guide to propose the module sections, naming `courses` and `lessons`, and `docs/specs/BRIEF-CARDS.md` does not exist

#### Scenario: SCN-796b — The setup guide while the front matter has problems

- GIVEN `docs/brief.md` whose front matter lists no module
- WHEN `specgate propose --from-brief --guide setup` runs
- THEN it prints the guide to propose the front matter, and `docs/specs/BRIEF-SETUP.md` does not exist

#### Scenario: SCN-796c — No module to write cards for

- GIVEN `docs/brief.md` whose front matter lists no module
- WHEN `specgate propose --from-brief --guide cards --json` runs
- THEN it fails with `draft_guide_no_modules`, whose fix names `--guide setup`

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-796.feature kind=functional status=Implemented -->

### Requirement: REQ-797 — The draft skill sends the agent to a guide that exists

The system SHALL, in the `draft` step every agent tool is given, send the agent to `specgate propose --from-brief --guide setup` when the front matter is missing or needs fixes, and to `--guide cards` when the brief has no `## Module:` section, instead of a file Specgate may not have written; and SHALL name the same command where `specgate propose --from-brief` reports those two states.

#### Scenario: SCN-797a — The step names the command

- GIVEN the `draft` step as `specgate agents init` writes it
- WHEN an agent reads it
- THEN it names `specgate propose --from-brief --guide setup` and `--guide cards`, and neither `docs/specs/BRIEF-SETUP.md` nor `docs/specs/BRIEF-CARDS.md`

#### Scenario: SCN-797b — The overview names the cards guide

- GIVEN `docs/brief.md` with a complete front matter listing `courses` and `lessons`, and no `## Module:` section
- WHEN `specgate propose --from-brief` runs
- THEN its output names `specgate propose --from-brief --guide cards`

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-797.feature kind=functional status=Implemented -->

### Requirement: REQ-820 — Determining whether is no condition

The system SHALL not read "si" after a verb of determining, evaluating, confirming, validating or reviewing ("determina si", "evalúa si", "confirma si", "valida si", "revisa si") — nor "if" after "determine", "evaluate", "confirm", "verify", "validate" or "find out" — as a condition placed last (B11); and SHALL still warn under B11 for a rule whose condition follows what must happen.

#### Scenario: SCN-820a — The operator determines whether

- GIVEN a module whose rule is "El operador determina si el reporte corresponde a un servicio municipal."
- WHEN the Product owner runs `specgate propose --from-brief --check`
- THEN no `B11_condition_last` is listed for it, and "La incidencia se cierra si el técnico la resuelve." still has one

<!-- specgate:trace actor="Product owner" feature=features/brief-cards/REQ-820.feature kind=functional status=Implemented -->
