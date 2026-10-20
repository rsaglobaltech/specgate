# Write the brief

**Before you draft anything.** A brief says what the product must do, in the
words of the people who need it. Specgate drafts the specification from it one
module at a time, and checks every draft against it. This page teaches the
brief in eight steps, about 25 minutes, with one example throughout:
**Lingo**, an invented online language school.

| Who | Does what |
| --- | --- |
| **You** | Write the brief, or review what your agent proposes from your notes |
| **Your agent** | Can propose the fields and the module sections — nothing else |
| **Specgate** | Checks the brief before anything is drafted, each finding with its fix |

## Do you need a brief?

Often not. A brief is for a product, or a large part of one.

| You are… | Do this |
| --- | --- |
| One behaviour to fix or change | No brief. `specgate propose <change-id>`, and write the requirement in the delta. |
| A feature with a few rules (2–6) | No brief. `specgate propose <change-id>`, with the rules and examples in the delta. |
| A product, or a large area of one | A brief, then `specgate propose --from-brief`, one module at a time. |

## Words used here

- **Brief** — `docs/brief.md`: what the product must do, before anything is specified.
- **Front matter** — the fields between the two `---` lines at the top of the brief.
- **Module** — a piece of the product, drafted and reviewed on its own.
- **Actor** — a person or system that uses the product.
- **Surface** — where an actor reaches it: `api`, `web`, `mobile` or `desktop`.
- **Rule**, **example**, **question** — the three kinds of card in a module.
- **Requirement**, **scenario** — what a rule and an example become in the draft.
- **Draft** — the change `specgate propose --from-brief <module>` opens.

## Start the file

Have notes, an email, a plan? Save them as `docs/brief.md` as they are and
jump to [Already have notes?](#already-have-notes). Starting from nothing:

```bash
specgate propose --from-brief --new-brief
```

<!-- specgate:out-brief-new:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief --new-brief
  ◆ specgate · propose --from-brief --new-brief

  ✔  Wrote docs/brief.md — a brief to fill in.

  Fill it in, in your own words:
    1. The four fields at the top — product, surfaces, actors, modules.
       Each has an example in the comment above it.
    2. Why — the problem, and a success you can measure.
    3. Per module, a section: its Rules, an Example per rule, and the
       Questions you cannot answer yet.

  Have a plan or an email already? Paste it under Notes — your agent can
  turn it into the module sections: specgate propose --from-brief --agent "claude -p"

  Next ───────────────────────────────────────────────────
  ➜  specgate propose --from-brief --check
     it checks the brief and says what is missing
```
<!-- specgate:out-brief-new:end -->

## Step 1 — Why (3 minutes)

Under `## Why`, the problem in two sentences, and one or two successes you can
measure. They become the non-functional rules later.

- Good: "A student finds today's lesson in under 10 seconds."
- Not: "Fast and easy to use." No test can check it.

## Step 2 — Who and where (3 minutes)

The top of the brief names the product, where people reach it, and who uses
it where. Each actor gets a scenario on each of their surfaces, so no screen is
forgotten.

```yaml
product: Lingo — online lessons for a language school
surfaces: [web, mobile]
actors:
  - { name: Teacher, surfaces: [web] }
  - { name: Student, surfaces: [web, mobile] }
```

`api` means another program calls the product; `web`, `mobile` and `desktop`
are screens. A tablet is `web` or `mobile`.

## Step 3 — What it will not do (2 minutes)

`non_goals: [video calls]`. The cheapest guard against a draft that grows: a
rule or example that names a non-goal gets a warning.

## Step 4 — Modules (3 minutes)

`modules: [courses, lessons, exercises, progress]` — three to eight pieces, in
the order you will build them, what others depend on first. Lowercase words
with dashes. Each small enough to review in one sitting: 25 requirements at
most, and at most seven rules in its section.

## Step 5 — Rules, per module (8 minutes)

One section per module, `## Module: courses`, and under `Rules` one sentence
per thing that must hold. Each rule becomes a requirement.

- Numbers with their unit; labels and messages in double quotes, exactly as the
  screen will say them. A draft that uses the brief's values passes the
  check that compares them (D6) by construction.
- When a rule has a condition, open with it — the EARS patterns:

| Pattern | Example |
| --- | --- |
| Always | A course has one level, from "A1" to "C2". |
| When (an event) | When a lesson is published, the students of its course see it. |
| While (a state) | While a course is full, joining it is refused. |
| Where (an option) | Where the school sells by course, a student pays per course. |
| If (unwanted) … then | If a student misses 3 lessons, then the teacher is told. |

- A law or standard that applies: name it, with its source.
- Screenshots: say in words what they show. A value only in an image is
  invisible to the check.

## Step 6 — Examples, per rule (4 minutes)

Under `Examples`, at least one per rule: "The one where…", with the rule's own
values. Each becomes a scenario. Include how each actor finds what they act on
— a list, a search — or the draft cannot say where an id comes from.

## Step 7 — Questions (2 minutes)

Under `Questions`, what you do not know yet about this module — at most
three. They become rows of `questions.md`, for the client to answer: never
guesses.

## Step 8 — Check it

```bash
specgate propose --from-brief --check
```

Errors stop a draft from opening: a field in the wrong shape, an empty module,
a module without its section, rules without examples. Warnings are for you to
judge: a vague word, a promise without a number, a framework named in a rule,
a module too big, a condition placed last. On the Lingo brief the agent
proposed below:

<!-- specgate:out-brief-check:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief --check
  ◆ specgate · propose --from-brief --check   docs/brief.md

  ▲  B5_vague  progress  "A student sees their progress quickly." says "quickly", which no test can check.
     fix: Say what it means in values: "in under 2 seconds", "with one tap", or move it to Questions.
  ▲  B6_unmeasured  progress  "A student sees their progress quickly." promises a quantity and states no number.
     fix: Give the number and its unit: "within 2 seconds", "for 500 students at once".

  ✔  Ready to draft — 2 warning(s) for you to judge

  Next ───────────────────────────────────────────────────
  ➜  specgate propose --from-brief courses
     the first module
```
<!-- specgate:out-brief-check:end -->

"Quickly" became "in under 2 seconds" — the success from Step 1.

## Already have notes?

Paste them into `docs/brief.md` as they are. Your agent proposes the fields
first, then the module sections; you review each before anything is drafted.

```bash
specgate propose --from-brief --agent "claude -p"
```

<!-- specgate:out-brief-agent:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief --agent "claude -p"
  ◆ specgate · propose --from-brief --agent   docs/brief.md

  ➜  claude -p --permission-mode acceptEdits  is proposing the front matter of docs/brief.md…
     edit permission added: claude -p cannot write files otherwise

Added a front matter to docs/brief.md: 2 actors, 4 modules; one line marked to check.

  ────────────────────────────────────────────────────────────────────────────

  ✔  The agent proposed this, at the top of docs/brief.md:

    │ ---
    │ product: Lingo — online lessons for a language school
    │ surfaces: [web, mobile]
    │ actors:
    │   - { name: Teacher, surfaces: [web] }
    │   # check: the brief says students use "the web or their phone"
    │   - { name: Student, surfaces: [web, mobile] }
    │ modules: [courses, lessons, exercises, progress]
    │ ---

  ℹ  Your brief below it is unchanged.

  Next ───────────────────────────────────────────────────
  ➜  specgate propose --from-brief
     review it — change anything — then run it
```
<!-- specgate:out-brief-agent:end -->

Review the fields — here, settle the `# check:` line and add `non_goals` — and
run the same command again. With the fields complete, the agent proposes a
section per module, from your notes only:

<!-- specgate:out-brief-cards-agent:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief --agent "claude -p"
  ◆ specgate · propose --from-brief --agent   docs/brief.md

  ➜  claude -p --permission-mode acceptEdits  is proposing the module sections of docs/brief.md…
     edit permission added: claude -p cannot write files otherwise

Added 4 module sections from your notes; 3 questions the notes leave open.

  ────────────────────────────────────────────────────────────────────────────

  ✔  The agent proposed 4 module section(s) in docs/brief.md: courses, lessons, exercises, progress

  ℹ  Every line you wrote is still there.

  Next ───────────────────────────────────────────────────
  ➜  specgate propose --from-brief --check
     review the sections — change anything — then check them
```
<!-- specgate:out-brief-cards-agent:end -->

The agent may write only `docs/brief.md`, and only add to it: if one line of
your notes changes, the brief is put back as it was. (The recording uses a
stand-in for Claude that writes the text shown below.)

## The whole example

Lingo's brief, reviewed:

<!-- specgate:example-brief -->
```markdown
---
product: Lingo — online lessons for a language school
surfaces: [web, mobile]
actors:
  - { name: Teacher, surfaces: [web] }
  - { name: Student, surfaces: [web, mobile] }
modules: [courses, lessons, exercises, progress]
non_goals: [video calls]
---

# Lingo

Lingo is an online language school. A teacher runs small groups of adult
students.

The teacher creates courses by level and publishes lessons with their
material. Students follow their course on the web or on their phone, do the
exercises of each lesson and see their progress quickly. The teacher sees
each student's progress and corrects written exercises.

We don't know yet whether students pay per course or per month.

## Module: courses

Rules
- A teacher creates a course with one level, from "A1" to "C2".
- A student follows one course.

Examples
- The one where the teacher creates "Spanish A2".
- The one where Ana follows "Spanish A2".

Questions
- Can a student follow two courses at once?
- Do students pay per course or per month?

## Module: lessons

Rules
- A teacher publishes a lesson in a course, with its material.
- When a lesson is published, the students of its course see it.

Examples
- The one where the teacher publishes "Greetings" in "Spanish A2" with a PDF.
- The one where Ana opens "Spanish A2" on her phone and sees "Greetings".

## Module: exercises

Rules
- A lesson has exercises, done on the web or on the phone.
- The teacher corrects written exercises.

Examples
- The one where Ana answers the 3 exercises of "Greetings".
- The one where the teacher corrects Ana's written answer.

Questions
- Are the other exercises corrected automatically?

## Module: progress

Rules
- A student's progress opens in under 2 seconds.
- The teacher sees each student's progress.

Examples
- The one where Ana has done 2 of the 3 exercises of "Greetings" and sees 2 of 3.
- The one where the teacher sees Ana at 2 of 3.
```

Ready, it lists the modules and names the first:

<!-- specgate:out-brief-ready:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief
  ◆ specgate · propose --from-brief   docs/brief.md

  Product   Lingo — online lessons for a language school
  Progress  ░░░░░░░░░░░░░░░░░░░░  0 of 4 archived

  Modules ────────────────────────────────────────────────
    ○ courses    not started
    ○ lessons    not started
    ○ exercises  not started
    ○ progress   not started

  Next ───────────────────────────────────────────────────
  ➜  specgate propose --from-brief courses
```
<!-- specgate:out-brief-ready:end -->

Opening the first module's draft hands whoever writes it — you or your agent
— that module's cards, its values and its questions, in `DRAFTING.md`:

<!-- specgate:out-brief-draft:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief courses
  ◆ specgate · propose --from-brief courses   docs/brief.md

  ✔  Draft draft-courses opened · REQ ids REQ-002…REQ-011 reserved

    + docs/specs/changes/draft-courses/DRAFTING.md                how to write it
    + docs/specs/changes/draft-courses/specs/courses/spec.md      the requirements go here
    + docs/specs/changes/draft-courses/change.yaml, proposal.md

  Have your agent write it ───────────────────────────────
  Paste this into Claude Code, Cursor, Codex…

    Draft the courses module: follow docs/specs/changes/draft-courses/DRAFTING.md
… 4 more lines
```
<!-- specgate:out-brief-draft:end -->

<!-- specgate:out-brief-scope:begin — generated; edit the source, not this block -->
```text
$ sed -n '/^## 0/,/^## 1/p' docs/specs/changes/draft-courses/DRAFTING.md | sed '$d'
## 0. Your scope — the courses section of the brief

This is the only text you draft from. Each **rule** becomes a requirement
(quote it under `> Brief:`), each **example** a scenario of that
requirement, each **question** a row of `questions.md`.

````markdown
## Module: courses

Rules
- A teacher creates a course with one level, from "A1" to "C2".
- A student follows one course.

Examples
- The one where the teacher creates "Spanish A2".
- The one where Ana follows "Spanish A2".

Questions
- Can a student follow two courses at once?
- Do students pay per course or per month?
````

**The values you may use** — write them exactly so; any other value goes
in `assumptions.md` or becomes a question:

`"A1"` · `"C2"` · `"Spanish A2"`

**Questions to copy into `questions.md`**, each with the requirements it
blocks:

- Can a student follow two courses at once?
- Do students pay per course or per month?
```
<!-- specgate:out-brief-scope:end -->

One rule of lessons, as its draft would write it — the rule quoted, the
example a scenario with the brief's own values:

```markdown
### Requirement: REQ-004 — Students see a published lesson

<!-- specgate:trace actor=Student kind=functional surfaces=mobile -->

The system SHALL show a lesson to the students of its course once it is published.

> Brief: "When a lesson is published, the students of its course see it."

#### Scenario: SCN-006 — Ana sees "Greetings" on her phone

- GIVEN the teacher published "Greetings" in "Spanish A2", which Ana follows
- WHEN Ana opens "Spanish A2" on her phone
- THEN she sees "Greetings" among its lessons
```

## You're done when…

- `specgate propose --from-brief --check` says **Ready to draft**.
- `specgate propose --from-brief` lists your modules and names the first.

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `brief_wrong_shape` | A field is written as words, not a list | Use the shape its fix shows: `surfaces: [web]` |
| `B2_empty_module` | A module's section is still empty or a comment | Write its rules and examples |
| `B3_no_section` | A module has no `## Module:` section | Add one, or take it off `modules:` |
| `brief_not_ready` | `propose --from-brief <module>` found an error | Run `--check` and fix what it says |
| `draft_brief_text_lost` | The agent changed your notes | Nothing was kept; run it again, or write the sections yourself |

Drafting the modules is the next step, in the from-scratch journey:
[phase 2 — from the brief to a checked spec](scratch-2-specify.md). Starting
the project itself is [phase 1](scratch-1-install.md).
