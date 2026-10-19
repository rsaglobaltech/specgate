"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseSpec,
  parseDelta,
  renderSpec,
  requirementKey,
  splitLabel,
  parseTraceComment,
} = require("../../packages/core/src/domain/SpecParser");
const { validateDelta, applyDelta } = require("../../scripts/change/delta");

const SPEC = `# Pricing

## Purpose

Tarificación de sesiones de aparcamiento.

## Requirements

### Requirement: REQ-007 — Base rate

El sistema SHALL cobrar 1,50 € por hora iniciada.

#### Scenario: SCN-007a — Una hora

- GIVEN una sesión de 45 minutos
- WHEN se calcula la tarifa
- THEN el importe es 1,50 €

### Requirement: REQ-008 — Rounding

El sistema SHALL redondear al alza.

#### Scenario: SCN-008a — Redondeo

- GIVEN una sesión de 61 minutos
- THEN el importe cubre dos horas
`;

/** A delta diagnostic, reduced to what these tests compare. */
interface Diagnostic {
  code: string;
}

const codes = (diags: Diagnostic[]): string[] => diags.map((d) => d.code).sort();

// ── parser ────────────────────────────────────────────────────────────────────

test("parseSpec extracts purpose, requirements and scenarios", () => {
  const spec = parseSpec(SPEC);
  assert.equal(spec.title, "Pricing");
  assert.match(spec.purpose, /Tarificación/);
  assert.equal(spec.requirements.length, 2);
  assert.equal(spec.requirements[0].id, "REQ-007");
  assert.equal(spec.requirements[0].name, "Base rate");
  assert.equal(spec.requirements[0].scenarios.length, 1);
  assert.equal(spec.requirements[0].scenarios[0].steps.length, 3);
});

test("splitLabel does not mistake a leading acronym for a requirement id", () => {
  assert.deepEqual(splitLabel("TOTP-based two-factor authentication"), {
    id: null,
    name: "TOTP-based two-factor authentication",
  });
  assert.deepEqual(splitLabel("REQ-014 — Dynamic pricing"), {
    id: "REQ-014",
    name: "Dynamic pricing",
  });
});

test("requirementKey falls back to a slug when there is no id", () => {
  assert.equal(requirementKey({ id: "REQ-007", name: "Base rate" }), "REQ-007");
  assert.equal(requirementKey({ id: null, name: "Session Expiration" }), "name:session-expiration");
});

test("parseTraceComment reads keys, quoted values included", () => {
  const trace = parseTraceComment(
    '<!-- specgate:trace uc=UC-007 cmd=CMD-011 feature=features/billing/x.feature note="two words" -->'
  );
  assert.equal(trace.uc, "UC-007");
  assert.equal(trace.feature, "features/billing/x.feature");
  assert.equal(trace.note, "two words");
});

test("a trace comment attaches to the requirement it sits under", () => {
  const delta = parseDelta(`## ADDED Requirements

### Requirement: REQ-014 — Dynamic pricing

El sistema SHALL aplicar un recargo.

#### Scenario: SCN-014a — Hora punta

- GIVEN una sesión a las 18:00
- THEN el importe incluye recargo

<!-- specgate:trace uc=UC-007 feature=features/billing/dynamic.feature -->
`);
  assert.equal(delta.added.length, 1);
  assert.equal(delta.added[0].trace.uc, "UC-007");
});

test("renderSpec round-trips: parse → render → parse is a fixed point", () => {
  const once = renderSpec(parseSpec(SPEC));
  const twice = renderSpec(parseSpec(once));
  assert.equal(once, twice);
  const reparsed = parseSpec(once);
  assert.equal(reparsed.requirements.length, 2);
  assert.equal(reparsed.requirements[0].scenarios[0].steps.length, 3);
});

// ── validateDelta ─────────────────────────────────────────────────────────────

test("a well-formed delta against an existing spec validates clean", () => {
  const { diagnostics } = validateDelta(
    `## ADDED Requirements

### Requirement: REQ-014 — Dynamic pricing

El sistema SHALL aplicar un recargo del 20 % en hora punta.

#### Scenario: SCN-014a — Hora punta

- GIVEN una sesión iniciada a las 18:00
- WHEN se calcula la tarifa
- THEN el importe incluye un recargo del 20 %
`,
    { specSource: SPEC }
  );
  assert.deepEqual(diagnostics, []);
});

test("an unknown section is an error and the fix lists the valid ones", () => {
  const { diagnostics } = validateDelta(`## CHANGED Requirements

### Requirement: REQ-014 — X

#### Scenario: A

- GIVEN x
`);
  const d = diagnostics.find((x: Diagnostic) => x.code === "delta_unknown_section");
  assert.ok(d, "expected delta_unknown_section");
  assert.equal(d.severity, "error");
  assert.match(d.fix, /ADDED Requirements/);
  assert.equal(typeof d.line, "number");
});

test("a requirement without a scenario is an error", () => {
  const { diagnostics } = validateDelta(`## ADDED Requirements

### Requirement: REQ-014 — Dynamic pricing

El sistema SHALL aplicar un recargo.
`);
  assert.ok(codes(diagnostics).includes("requirement_without_scenario"));
});

test("a duplicated requirement inside one delta is an error", () => {
  const { diagnostics } = validateDelta(`## ADDED Requirements

### Requirement: REQ-014 — A

El sistema SHALL a.

#### Scenario: S1

- GIVEN x
- THEN y

### Requirement: REQ-014 — B

El sistema SHALL b.

#### Scenario: S2

- GIVEN x
- THEN y
`);
  assert.ok(codes(diagnostics).includes("duplicate_requirement"));
});

test("MODIFIED of a requirement that does not exist is an error", () => {
  const { diagnostics } = validateDelta(
    `## MODIFIED Requirements

### Requirement: REQ-099 — Ghost

El sistema SHALL nada.

#### Scenario: S

- GIVEN x
- THEN y
`,
    { specSource: SPEC }
  );
  const d = diagnostics.find((x: Diagnostic) => x.code === "unknown_requirement");
  assert.ok(d);
  assert.match(d.fix, /ADDED Requirements/);
});

test("ADDED of a requirement that already exists is an error", () => {
  const { diagnostics } = validateDelta(
    `## ADDED Requirements

### Requirement: REQ-007 — Base rate

El sistema SHALL cobrar.

#### Scenario: S

- GIVEN x
- THEN y
`,
    { specSource: SPEC }
  );
  const d = diagnostics.find((x: Diagnostic) => x.code === "requirement_already_exists");
  assert.ok(d);
  assert.match(d.fix, /MODIFIED/);
});

test("cross-reference checks are skipped for a brand-new capability", () => {
  const { diagnostics } = validateDelta(`## Purpose

Nueva capability.

## ADDED Requirements

### Requirement: REQ-020 — Algo

El sistema SHALL algo.

#### Scenario: S

- GIVEN x
- THEN y
`);
  assert.deepEqual(diagnostics, []);
});

test("a requirement with no RFC 2119 keyword warns but does not fail", () => {
  const { diagnostics } = validateDelta(`## ADDED Requirements

### Requirement: REQ-021 — Vago

Estaría bien tener descuentos.

#### Scenario: S

- GIVEN x
- THEN y
`);
  const d = diagnostics.find((x: Diagnostic) => x.code === "no_rfc2119_keyword");
  assert.ok(d);
  assert.equal(d.severity, "warning");
});

test("an empty delta is an error", () => {
  const { diagnostics } = validateDelta("# Delta — pricing\n");
  assert.ok(codes(diagnostics).includes("delta_empty"));
});

// ── applyDelta ────────────────────────────────────────────────────────────────

test("ADDED appends a requirement and keeps the existing ones in order", () => {
  const { markdown, applied } = applyDelta(
    SPEC,
    `## ADDED Requirements

### Requirement: REQ-014 — Dynamic pricing

El sistema SHALL aplicar un recargo.

#### Scenario: SCN-014a — Hora punta

- GIVEN una sesión a las 18:00
- THEN el importe incluye recargo
`
  );
  assert.deepEqual(applied.added, ["REQ-014"]);
  const spec = parseSpec(markdown);
  assert.deepEqual(
    spec.requirements.map((r: { id: string }) => r.id),
    ["REQ-007", "REQ-008", "REQ-014"]
  );
});

test("MODIFIED replaces the whole block, it does not merge scenarios", () => {
  const { markdown, applied } = applyDelta(
    SPEC,
    `## MODIFIED Requirements

### Requirement: REQ-007 — Base rate

El sistema SHALL cobrar 2,00 € por hora iniciada.

#### Scenario: SCN-007b — Nueva tarifa

- GIVEN una sesión de 45 minutos
- THEN el importe es 2,00 €
`
  );
  assert.deepEqual(applied.modified, ["REQ-007"]);
  const spec = parseSpec(markdown);
  const req = spec.requirements.find((r: { id: string }) => r.id === "REQ-007");
  assert.match(req.text, /2,00/);
  assert.equal(req.scenarios.length, 1, "the old scenario must not survive");
  assert.equal(req.scenarios[0].id, "SCN-007b");
});

test("REMOVED deletes the requirement", () => {
  const { markdown, applied, retired } = applyDelta(
    SPEC,
    `## REMOVED Requirements

### Requirement: REQ-008 — Rounding

(Absorbido por REQ-007.)
`
  );
  assert.deepEqual(applied.removed, ["REQ-008"]);
  assert.equal(retired, false);
  const spec = parseSpec(markdown);
  assert.deepEqual(
    spec.requirements.map((r: { id: string }) => r.id),
    ["REQ-007"]
  );
});

test("removing the last requirement flags the capability as retired", () => {
  const { retired } = applyDelta(
    SPEC,
    `## REMOVED Requirements

### Requirement: REQ-007 — Base rate

(obsoleto)

### Requirement: REQ-008 — Rounding

(obsoleto)
`
  );
  assert.equal(retired, true);
});

test("applying to a missing spec seeds Purpose from the delta", () => {
  const { markdown } = applyDelta(
    null,
    `## Purpose

Gestión de notificaciones.

## ADDED Requirements

### Requirement: REQ-030 — Envío

El sistema SHALL enviar un correo.

#### Scenario: S

- GIVEN un evento
- THEN se envía un correo
`,
    { title: "Notifications" }
  );
  const spec = parseSpec(markdown);
  assert.equal(spec.title, "Notifications");
  assert.match(spec.purpose, /notificaciones/i);
  assert.equal(spec.requirements.length, 1);
});

test("applying a delta is idempotent — re-applying changes nothing", () => {
  const delta = `## ADDED Requirements

### Requirement: REQ-014 — Dynamic pricing

El sistema SHALL aplicar un recargo.

#### Scenario: SCN-014a — Hora punta

- GIVEN una sesión a las 18:00
- THEN el importe incluye recargo
`;
  const once = applyDelta(SPEC, delta).markdown;
  const twice = applyDelta(once, delta).markdown;
  assert.equal(once, twice);
});
