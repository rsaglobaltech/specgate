/**
 * REQ-634: the use-case diagram and each use case's activity diagram,
 * generated in Mermaid and PlantUML from the catalog and the specifications.
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { renderUseCaseDiagrams, renderUseCasesPuml } from "../../src/domain/UseCaseDiagrams";
import { parseUseCaseSpec } from "../../src/domain/UseCaseSpec";

const CASES = [
  { id: "UC-004", name: "Create a child profile", actor: "Tutor", requirements: ["REQ-012"] },
  { id: "UC-002", name: "Register a family", actor: "Tutor", requirements: ["REQ-001"] },
];

const SPEC = parseUseCaseSpec(`# UC-004 — Create a child profile

## Overview

The tutor gives a child a profile.

## Main flow (SCN-012)

1. The tutor presses "New profile".
2. The tutor writes a nickname.
3. The system saves the profile.

## Alternative flows

### A1 — The nickname is taken (at step 3) (SCN-013)

1. The system says the nickname is taken.
`);

test("REQ-634 SCN-634a: the Mermaid use-case diagram — Tutor linked to each use case, by id — and UC-004's activity with A1 branching at step 3", () => {
  const md = renderUseCaseDiagrams(CASES, [SPEC])!;
  assert.match(md, /^# Use case diagrams\n/);
  assert.match(md, /Do not edit: `specgate check` rewrites it/);
  const chart = md.slice(md.indexOf("flowchart LR"), md.indexOf("```", md.indexOf("flowchart LR")));
  assert.ok(chart.indexOf("UC_002(") < chart.indexOf("UC_004("), "sorted by id");
  assert.match(chart, /actor_Tutor\(\["Tutor"\]\)/);
  assert.match(chart, /actor_Tutor --- UC_004/);
  assert.match(md, /## UC-004 — Create a child profile\n\n```mermaid\nflowchart TD/);
  assert.match(md, /start -- SCN-012 --> m1/);
  assert.match(md, /m3 -\. "A1: The nickname is taken \(SCN-013\)" \.-> A1_1/);
  assert.match(md, /A1_1 --> finish/);
  assert.equal(renderUseCaseDiagrams(CASES, [SPEC]), md, "the same bytes for the same sources");
});

test("REQ-634 SCN-634b: the PlantUML export — the use cases inside System, and UC-004's activity with A1 as a branch", () => {
  const puml = renderUseCasesPuml(CASES, [SPEC])!;
  assert.match(puml, /@startuml use-cases\nleft to right direction\nactor "Tutor" as actor_Tutor/);
  assert.match(puml, /usecase "UC-004 — Create a child profile" as UC_004/);
  assert.match(puml, /actor_Tutor --> UC_004/);
  assert.match(
    puml,
    /@startuml UC-004\ntitle UC-004 — Create a child profile\nstart\n:The tutor presses 'New profile'\.;/
  );
  assert.match(
    puml,
    /:The system saves the profile\.;\nif \(A1: The nickname is taken\?\) then \(yes\)\n {2}:The system says the nickname is taken\.;\n {2}stop\nendif\nstop\n@enduml/
  );
});

test("REQ-634: no use case of its own — nothing to draw", () => {
  assert.equal(renderUseCaseDiagrams([], []), null);
  assert.equal(renderUseCasesPuml([], []), null);
});
