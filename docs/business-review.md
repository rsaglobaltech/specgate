# Review with people who do not read the repository

At the end of this page the people who decide whether a change is right — a
product owner, an operations lead, a client — have read it as a page, and the
paths users take across several requirements are tested end to end.

**You need:** a Specgate project with an open change.

## A change as a page

```bash
specgate review pdf-invoices
specgate review pdf-invoices --out review.html
```

This writes one HTML file (by default `<change>-review.html`) with:

- the change's title, its kind and its intent ("Why"),
- each requirement's title, text and status, with its scenarios as plain
  numbered steps ("Given a paid invoice", "When its owner downloads it"),
- the change's questions, the open ones marked, and its assumptions,
- the date and the commit it was made from.

The file loads nothing from outside itself: no script, no stylesheet, no
font, no image. It opens from a mail attachment, offline, and it follows the
reader's light or dark setting. Every value in it is escaped, so text from a
specification cannot run in the reader's browser. An unknown change is refused
with `change_not_found`.

## Journeys: requirements in a row

Each requirement can pass its own test while the path a user takes across
several of them breaks where they meet. A journey is a scenario tagged
`@JRN-NNN` together with the `@REQ-NNN` of every requirement it crosses:

```gherkin
Feature: Library

  @JRN-001 @REQ-002 @REQ-003
  Scenario: Borrow then return
    Given a member
    When they borrow a book and return it
    Then the book is available again
```

- `specgate status --json` lists each journey (`journeys`) with its
  requirements and the tests that name it.
- The traceability matrix does not count a journey as one of its
  requirements' own scenarios, and a feature file that holds only journeys
  needs no row.
- `specgate validate --strict` fails with `journey_untested` once every
  requirement of a journey is delivered and no test names the journey.
  `journey_requirement_unknown` means a tag names a requirement that does not
  exist.

A test links to a journey the way it links to a requirement, by naming it:

```js
test("JRN-001: a member borrows a book, returns it, and it is available again", …);
```

## Next

- [Change a shipped requirement](reviewing-changes.md)
- [Writing specs](writing-specs.md)
