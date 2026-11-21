/**
 * REQ-640: a use case's step says who does it — `1. [Child] Writes an idea` —
 * and a step that does not is the first actor's; a lane no actor of the use
 * case names is refused. REQ-641: the activity drawn with a lane per actor, in
 * Mermaid and in PlantUML.
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { checkUseCaseSpec, parseUseCaseSpec } from "../../src/domain/UseCaseSpec";
import { activityChart, renderUseCasesPuml } from "../../src/domain/UseCaseDiagrams";

const SPEC = `# UC-007 — Ask for a colouring sheet

## Overview

The child asks for a sheet; the system checks it is safe and draws it.

## Actors

- Child
- PintaMundo
- Safety service

## Main flow (SCN-021)

1. [Child] Writes or picks an idea.
2. Presses "Create my drawing".
3. [PintaMundo] Receives the request.
4. [Safety service] Checks the request.
5. [PintaMundo] Shows the sheet.

## Alternative flows

### A1 — The request is unsafe (at step 4) (SCN-046)

1. [PintaMundo] Proposes a safe alternative.

## Postconditions

- The child has a sheet, or a safe alternative.
`;

test("REQ-640 SCN-640a: each step's lane read from its tag; an untagged step is the first actor's; the text keeps no tag", () => {
  const s = parseUseCaseSpec(SPEC);
  const main = s.flows.find((f) => f.id === "main")!;
  assert.deepEqual(main.lanes, ["Child", "Child", "PintaMundo", "Safety service", "PintaMundo"]);
  assert.equal(main.steps[0], "Writes or picks an idea.");
  assert.equal(main.steps[1], 'Presses "Create my drawing".');
  assert.deepEqual(s.flows.find((f) => f.id === "A1")!.lanes, ["PintaMundo"]);
  assert.deepEqual(checkUseCaseSpec(s, "UC-007", new Set(["SCN-021", "SCN-046"])), []);
});

test("REQ-640 SCN-640b: a lane no actor of the use case names is refused", () => {
  const s = parseUseCaseSpec(SPEC.replace("4. [Safety service]", "4. [Moderator]"));
  const fs = checkUseCaseSpec(s, "UC-007", new Set(["SCN-021", "SCN-046"]));
  assert.deepEqual(
    fs.map((f) => f.code),
    ["ucs_unknown_lane"]
  );
  assert.match(fs[0]!.message, /Moderator/);
});

test("REQ-640: a specification with no tag has one lane, its actor's, and draws as before", () => {
  const plain = SPEC.replace(/\[[^\]]+\] /g, "");
  const s = parseUseCaseSpec(plain);
  assert.ok(s.flows.every((f) => f.lanes.every((l) => l === "Child")));
  assert.doesNotMatch(activityChart(s).join("\n"), /subgraph/);
});

test("REQ-641 SCN-641a: the activity in Mermaid has a lane per actor, each step inside its own", () => {
  const chart = activityChart(parseUseCaseSpec(SPEC)).join("\n");
  assert.match(chart, /subgraph lane_Child\["Child"\][\s\S]*?m1\[[\s\S]*?m2\[[\s\S]*?end/);
  assert.match(chart, /subgraph lane_Safety_service\["Safety service"\][\s\S]*?m4\[[\s\S]*?end/);
  assert.match(chart, /subgraph lane_PintaMundo\["PintaMundo"\][\s\S]*?A1_1\[/);
  assert.match(chart, /m3 --> m4/);
});

test("REQ-641 SCN-641b: the activity in PlantUML switches lane where a step does", () => {
  const puml = renderUseCasesPuml(
    [
      {
        id: "UC-007",
        name: "Ask for a colouring sheet",
        actor: "Child",
        requirements: ["REQ-021"],
      },
    ] as never,
    [parseUseCaseSpec(SPEC)]
  )!;
  const act = puml.slice(puml.indexOf("@startuml UC-007"));
  assert.match(
    act,
    /\|Child\|\nstart\n:Writes or picks an idea\.;\n:Presses 'Create my drawing'\.;\n\|PintaMundo\|\n:Receives the request\.;\n\|Safety service\|\n:Checks the request\.;/
  );
  assert.match(
    act,
    /if \(A1: The request is unsafe\?\) then \(yes\)\n\|PintaMundo\|\n {2}:Proposes a safe alternative\.;/
  );
});
