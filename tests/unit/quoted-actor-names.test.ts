/**
 * REQ-622: an actor's name in quotes is read whole — a comma inside it belongs
 * to the name — and the form writes such a name back in quotes (#541, found
 * from Specgate Studio importing a client's brief).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import { checkFrontMatter } from "../../scripts/draft/brief-setup";
import { actorName, actorSurfaces, yamlName } from "../../packages/core/src/domain/DraftChecklist";

const brief = (actor: string) => `---
product: PintaMundo AI
surfaces: [web, api]
actors:
  - { name: Niño, surfaces: [web] }
  - ${actor}
modules: [cuenta]
---
# PintaMundo

Why it exists.
`;

test('REQ-622 SCN-622a: { name: "Padre, madre o tutor", surfaces: [web] } — one actor, its whole name, its surface', () => {
  const b = brief('{ name: "Padre, madre o tutor", surfaces: [web] }');
  assert.deepEqual(actorSurfaces(b).get("padre, madre o tutor"), ["web"]);
  const problems = checkFrontMatter(b).filter((p) => p.code === "brief_actor_without_surfaces");
  assert.deepEqual(problems, [], JSON.stringify(problems));
});

test("REQ-622 SCN-622a: single quotes too, and a bare name as before", () => {
  assert.deepEqual(
    actorSurfaces(brief("{ name: 'Padre, madre o tutor', surfaces: [web] }")).get(
      "padre, madre o tutor"
    ),
    ["web"]
  );
  assert.deepEqual(actorSurfaces(brief("{ name: Tutor, surfaces: [web] }")).get("tutor"), ["web"]);
  assert.equal(actorName('  "Padre, madre o tutor" '), "Padre, madre o tutor");
  assert.equal(actorName("Tutor"), "Tutor");
});

test("REQ-622 SCN-622b: a name with a comma, a colon or a brace is written in double quotes; a plain one as it is", () => {
  assert.equal(yamlName("Padre, madre o tutor"), '"Padre, madre o tutor"');
  assert.equal(yamlName("Admin: global"), '"Admin: global"');
  assert.equal(yamlName("Niño"), "Niño");
  const written = brief(`{ name: ${yamlName("Padre, madre o tutor")}, surfaces: [web] }`);
  assert.deepEqual(actorSurfaces(written).get("padre, madre o tutor"), ["web"]);
});
