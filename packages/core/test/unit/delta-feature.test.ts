/**
 * `change archive` materialises a delta's scenarios as a feature file when
 * the change brings none (E2E finding: the documented cycle produced a matrix
 * row naming a file that never existed).
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { renderDeltaFeature } from "../../src/domain/DeltaFeature";
import { analyseGherkinSource } from "../../src/domain/GherkinQuality";
import { csdaTagsIn } from "../../src/domain/GherkinTags";

const req = {
  id: "REQ-002",
  name: "Coupons reduce the order total",
  scenarios: [
    {
      id: "SCN-007",
      name: "A ten percent coupon",
      heading: "SCN-007 A ten percent coupon",
      line: 1,
      steps: [
        "GIVEN an order totalling 50 EUR",
        "WHEN a 10% coupon is applied",
        "THEN the total is 45 EUR",
      ],
    },
  ],
};

test("the delta's scenario becomes valid, tagged Gherkin", () => {
  const out = renderDeltaFeature(req, "billing");
  assert.match(out, /^Feature: Coupons reduce the order total/);
  assert.match(
    out,
    /\n {4}Given an order totalling 50 EUR\n {4}When a 10% coupon is applied\n {4}Then the total is 45 EUR\n/
  );
  assert.deepEqual(csdaTagsIn(out), ["@REQ-002", "@SCN-007"]);
  assert.deepEqual(analyseGherkinSource(out, "f.feature"), [], "and passes every scenario rule");
});

test("a scenario without an id is still tagged with its requirement", () => {
  const out = renderDeltaFeature(
    { ...req, scenarios: [{ ...req.scenarios[0], id: null }] },
    "billing"
  );
  assert.deepEqual(csdaTagsIn(out), ["@REQ-002"]);
});

test("#47: a delta written in Spanish becomes valid Spanish Gherkin", () => {
  const out = renderDeltaFeature(
    {
      id: "REQ-113",
      name: "Sin puestos no hay reserva",
      scenarios: [
        {
          id: "SCN-115",
          name: "Una franja sin puestos no se ofrece",
          heading: "SCN-115 Una franja sin puestos no se ofrece",
          line: 1,
          steps: [
            'DADO el calendario "Peluquería" sin puestos el domingo',
            "CUANDO un cliente consulta GET /api/comercios/pelu1/huecos",
            "ENTONCES la respuesta no contiene ninguna franja",
            "Y no se puede reservar",
          ],
        },
      ],
    },
    "calendario"
  );
  assert.match(out, /^# language: es\nCaracterística: Sin puestos no hay reserva\n/);
  assert.match(out, /\n {2}Escenario: Una franja sin puestos no se ofrece\n {4}Dado el calendario/);
  assert.match(
    out,
    /\n {4}Cuando un cliente.*\n {4}Entonces la respuesta.*\n {4}Y no se puede reservar\n/
  );
  assert.deepEqual(csdaTagsIn(out), ["@REQ-113", "@SCN-115"]);
  assert.deepEqual(analyseGherkinSource(out, "f.feature"), [], "and passes every scenario rule");
});
