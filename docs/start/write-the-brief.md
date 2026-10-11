# Write the brief

**Before you draft anything.** Specgate turns a brief into requirements, one
module at a time, and checks every draft against the brief's own words. This
page is about the brief: what goes in it, the four fields at its top, and how
your agent can propose those fields for you. About 15 minutes.

The example is **Lingo**, an invented online language school: a teacher, adult
students, the web and a phone.

| Who | Does what |
| --- | --- |
| **You** | Save your plan as it is; review the four fields |
| **Your agent** | Can propose the four fields from your plan — nothing else |
| **Specgate** | Says what a brief needs, and checks the fields in plain words |

## Step 1 — Save your plan as `docs/brief.md`

A brief is whatever says what the product must do: your own plan, a client's
email, notes from a meeting. Any markdown. **Paste it as it is** — Specgate
never rewrites it, and every draft is checked against its words.

Ask Specgate what it expects:

```bash
specgate draft
```

<!-- csda:out-brief-none:begin — generated; edit the source, not this block -->
```text
$ specgate draft
  No brief yet. Specgate drafts your specification from a brief: docs/brief.md.

  A brief is whatever says what the product must do — your own plan, a
  client's email, meeting notes. Any markdown. Paste it as it is: Specgate
  never rewrites it, and checks every draft against its words.

  A good brief says:
    · what the product is, and for whom
    · who uses it, and where — on the web, on a phone, through an API
    · what each of them must be able to do
    · the rules and numbers you already know — prices, limits, deadlines
    · what you don't know yet — those become questions, not guesses
    · what is out of scope

  Already have one?  Save it as docs/brief.md, then  specgate draft
  Starting fresh?    specgate draft --new-brief   writes one to fill in
```
<!-- csda:out-brief-none:end -->

### No plan yet?

`--new-brief` writes `docs/brief.md` for you to fill in: the four fields, each
with an example in a comment, and six short sections.

```bash
specgate draft --new-brief
```

<!-- csda:out-brief-new:begin — generated; edit the source, not this block -->
```text
$ specgate draft --new-brief
  ✔ Wrote docs/brief.md — a brief to fill in.

  Fill it in, in your own words:
    1. The four fields at the top — product, surfaces, actors, modules.
       Each has an example in the comment above it.
    2. The sections below — what the product is, who uses it and how, what
       each one must be able to do, the rules and numbers you already know,
       what you don't know yet, and what is out of scope.

  Have a plan or an email already? Paste it under the four fields instead
  of the sections — Specgate reads it as it is.

  Next  specgate draft  — it checks the four fields and says what is next
```
<!-- csda:out-brief-new:end -->

The sections ask, in this order: what the product is · who uses it and how ·
what each one must be able to do · the rules and numbers you already know
(only real ones) · what you don't know yet · what is out of scope. It never
overwrites a brief that exists.

## Step 2 — The four fields at the top

Lingo's owner saved their notes, as they were, with no fields yet:

```markdown
# Lingo

Lingo is an online language school. A teacher runs small groups of adult
students.

The teacher creates courses by level and publishes lessons with their
material. Students follow their course on the web or on their phone, do the
exercises of each lesson and see their progress. …
```

`specgate draft` explains each field, with an example, and the block to paste:

<!-- csda:out-brief-plain:begin — generated; edit the source, not this block -->
```text
$ specgate draft
  specgate draft  ·  docs/brief.md

  Your brief has no front matter yet: four fields at the very top of docs/brief.md
  that tell Specgate what to draft, and what to check each draft against.
  Your text below them stays exactly as it is.

  product   What you are building, in a few words.
            product: Lingo — online lessons for a language school

  surfaces  Where people reach it. Any of: api, web, mobile, desktop.
            api means another program calls it; web, mobile and desktop are screens.
            surfaces: [api, web, mobile]

  actors    Everyone who uses it, and where. Each gets a scenario on each of
            their surfaces — so no screen is forgotten. (In the first pilot every
            requirement was done and nobody could use the product: there was
            not a single screen.) Only people and systems your brief mentions.
            actors:
              - { name: Teacher, surfaces: [api, web] }
              - { name: Student, surfaces: [api, web, mobile] }

  modules   The pieces to specify and build, in the order you will build them.
            Each small enough to review in one sitting — 25 requirements at
            most. Lowercase words with dashes; each becomes `specgate draft <module>`.
            modules: [courses, lessons, exercises, progress]

  The whole block, to paste at the top and change:

    ---
    product: Lingo — online lessons for a language school
    surfaces: [api, web, mobile]
    actors:
      - { name: Teacher, surfaces: [api, web] }
      - { name: Student, surfaces: [api, web, mobile] }
    modules: [courses, lessons, exercises, progress]
    ---

  Or let your agent propose it from your brief. Paste this into Claude Code,
  Cursor, Codex…:

    Propose the front matter of docs/brief.md: follow docs/specs/BRIEF-SETUP.md

  or let Specgate call it:  specgate draft --agent "claude -p"

  Either way, review the four fields, then run  specgate draft  again.
```
<!-- csda:out-brief-plain:end -->

Why each one matters:

- **`product`** — names what is checked: one line, your words.
- **`surfaces`** — where people reach the product. `api` means another program
  calls it; `web`, `mobile` and `desktop` are screens. Nothing else: a tablet
  is `web` or `mobile`.
- **`actors`** — every person or system that uses it, and where. Each one gets
  a scenario on each of their surfaces. In the first pilot every requirement
  was done and nobody could use the product: no requirement asked for a single
  screen. This field is what prevents that.
- **`modules`** — the pieces to specify, in the order you will build them; what
  others depend on comes first. Each small enough to review in one sitting —
  25 requirements at most. Lowercase words with dashes: each becomes
  `specgate draft <module>`.

## Step 3 — Or let your agent propose them

Paste the line `specgate draft` printed into Claude Code, Cursor, Codex or any
other agent — or let Specgate call it:

```bash
specgate draft --agent "claude -p"
```

The agent follows `docs/specs/BRIEF-SETUP.md`: only what the brief states, no
invented actors or surfaces, and a `# check:` comment on anything it is unsure
of. It may write **only the top of `docs/brief.md`**. Anything else it writes is
undone, and if one character of your text below the fields changes, the whole
brief is put back and nothing is kept.

<!-- csda:out-brief-agent:begin — generated; edit the source, not this block -->
```text
$ specgate draft --agent "claude -p"
  → claude -p  is proposing the front matter of docs/brief.md…

Added a front matter to docs/brief.md: 2 actors, 4 modules; one line marked to check.

  The agent proposed this, at the top of docs/brief.md:

    ---
    product: Lingo — online lessons for a language school
    surfaces: [web, mobile]
    actors:
      - { name: Teacher, surfaces: [web] }
      # check: the brief says students use "the web or their phone"
      - { name: Student, surfaces: [web, mobile] }
    modules: [courses, lessons, exercises, progress]
    ---

  Your brief below it is unchanged.

  Review it — change anything — then  specgate draft
```
<!-- csda:out-brief-agent:end -->

(The recording uses a stand-in for Claude that writes the front matter above.)
In Claude Code, `/specgate:draft` does the same from inside the session and
stops for you to review.

## Step 4 — Review the fields, and check them

Read the four fields. Change anything: they are yours, not the agent's. Then
check them — say you added a tablet, an admin, and a module written as a title:

```bash
specgate draft
```

<!-- csda:out-brief-error:begin — generated; edit the source, not this block -->
```text
$ specgate draft
  specgate draft  ·  docs/brief.md

  The front matter at the top of docs/brief.md needs 3 fix(es):

  ✖  Teacher uses "tablet", which Specgate cannot check.
     Use api, web, mobile, desktop. A tablet or a kiosk is `web` or `mobile`.
  ✖  Admin has no surfaces.
     Write it as `- { name: Admin, surfaces: [web] }`, with every place Admin uses.
  ✖  The module "Live classes" has spaces, capitals or symbols.
     Write it as live-classes — it becomes a folder and a command: specgate draft live-classes.

  Next  fix them in docs/brief.md, then  specgate draft
```
<!-- csda:out-brief-error:end -->

Each problem says how to fix it. Fixed, `specgate draft` lists the modules and
names the first one:

<!-- csda:out-brief-ready:begin — generated; edit the source, not this block -->
```text
$ specgate draft
  specgate draft  ·  docs/brief.md

  Product  Lingo — online lessons for a language school

  Modules
    ○ courses    not started
    ○ lessons    not started
    ○ exercises  not started
    ○ progress   not started

  Next  specgate draft courses
```
<!-- csda:out-brief-ready:end -->

## You're done when…

- `docs/brief.md` holds your plan as you wrote it, with the four fields on top.
- `specgate draft` lists your modules and says `Next  specgate draft <module>`.

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `No brief yet.` | There is no `docs/brief.md` | Save your plan there, or run `specgate draft --new-brief` |
| `docs/brief.md already exists — nothing was written.` | `--new-brief` never overwrites | Edit the brief you have |
| `` `surfaces:` still says <surface> `` | A field from the template is not filled in | Replace every `<…>` |
| `The agent changed the brief itself, not only its front matter — undone.` | The agent rewrote your text | Run it again, or write the four fields yourself |
| `--agent needs a git repository.` | Git is how the agent's writes are confined | `git init`, or paste the line into your agent |

Drafting the modules is the next step, in the from-scratch journey:
[phase 2 — from the brief to a checked spec](scratch-2-specify.md). Starting
the project itself is [phase 1](scratch-1-install.md).
