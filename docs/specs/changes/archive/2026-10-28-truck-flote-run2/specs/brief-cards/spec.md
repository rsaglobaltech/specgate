# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-244 — The brief checks read Spanish as written

The system SHALL not read "si" after a verb of saying, checking or deciding ("dice si", "comprueba si", "decide si") — nor "if" after "say", "check", "tell", "decide" — as a condition placed last (B11); and SHALL warn under B5 for "lo más … posible", "cerca", "casi", "aceptable", "as close as possible", "nearby", "almost" and "acceptable".

#### Scenario: SCN-244a — "dice si cabe" and "un desvío aceptable"

- GIVEN the rules "El sistema dice en menos de 1 s si cabe la carga." and "Un camión es candidato con un desvío aceptable."
- WHEN the brief is checked
- THEN the first has no B11 warning and the second has a B5 warning naming "aceptable"

<!-- specgate:trace status=Implemented test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->

### Requirement: REQ-245 — The brief's shape: its size and the surfaces the project has

The system SHALL warn when a brief lists more than eight modules, and when an actor uses `mobile` and the project has no mobile app (no `mobile` platform in `forja.config.json`, no React Native or Expo dependency), naming the actor.

#### Scenario: SCN-245a — Ten modules and a driver on mobile, in a web project

- GIVEN a front matter with ten modules and `{ name: Conductor, surfaces: [mobile] }`, in a project whose `forja.config.json` has `platforms: ["web"]`
- WHEN the brief is checked
- THEN it warns that ten modules is more than eight, and that Conductor uses mobile with no mobile app in the project

<!-- specgate:trace status=Implemented test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->

### Requirement: REQ-246 — draft explains the front matter it needs

The system SHALL, when `specgate draft` finds the front matter incomplete, say what each of product, surfaces, actors and modules is for, flag an actor left from the template (`Customer`), and name `specgate draft --agent "<cmd>"` as the way to have an agent propose them.

#### Scenario: SCN-246a — forja's template, modules empty

- GIVEN `docs/brief.md` with forja's front matter: actor `Customer` and `modules: []`, and the client's text below
- WHEN `specgate draft` runs
- THEN it explains the four fields, says `Customer` looks like the template's, and names `specgate draft --agent`

<!-- specgate:trace status=Implemented test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->

### Requirement: REQ-247 — D6 reads a value however the assumption writes it

The system SHALL count a scenario's value as listed when a row of `assumptions.md` that names the scenario or its requirement holds its number — also inside a list that writes the unit once ("7100, 11500 and 8000 kg"), or as a number word ("three", "tres", "drei") — and, for a quoted label with a colon ("Dispositivo: TRK-0001"), when it holds the value after the colon.

#### Scenario: SCN-247a — The truck-flote assumptions

- GIVEN scenario values "3 ejes", "7100 kg", "11500 kg" and "Dispositivo: TRK-0001", and rows "Three axles of 7100, 11500 and 8000 kg" for SCN-006 and "Device identifier TRK-0001" for SCN-008
- WHEN the draft is checked
- THEN none of them is a D6 finding, and "4 ejes" still is

<!-- specgate:trace status=Implemented test=tests/unit/draft-checklist.test.ts actor=Developer kind=functional -->

### Requirement: REQ-248 — The undo after an agent run keeps what it removes

The system SHALL, before putting back a file the agent run changed outside the draft, keep its content in the repository's git folder, `.git/specgate-undone/<run>/<path>`, and name that folder in the message, so a person's edit made during the run is never lost and the working tree is left exactly as it was.

#### Scenario: SCN-248a — A log edited by hand while the agent drafts

- GIVEN `docs/notes.md` changed while an agent run writes the draft
- WHEN the run ends and the change is undone
- THEN `docs/notes.md` is back as it was before the run, its changed content is in `.git/specgate-undone/<run>/docs/notes.md`, and `git status` shows nothing new

<!-- specgate:trace status=Implemented test=tests/unit/draft-from-brief.test.ts actor=Developer kind=functional -->
