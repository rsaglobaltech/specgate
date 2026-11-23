# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-622 — An actor's name in quotes is read whole

<!-- specgate:trace status=Implemented feature=features/brief-cards/REQ-622.feature actor=Developer kind=functional -->

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
