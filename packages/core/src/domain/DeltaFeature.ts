/**
 * A delta's scenarios as a Gherkin feature file (phase-3 E2E finding).
 *
 * `change archive` promised to materialise the feature files, and did — but
 * only the `.feature` files an author had placed inside the change folder,
 * which neither the template nor `change instructions` ever asks for. An
 * author who followed the documented cycle wrote the scenario as
 * `- GIVEN / - WHEN / - THEN` bullets in the delta, pointed `feature=` at a
 * path, and archived into a matrix row naming a file that did not exist.
 *
 * The delta already says everything the file needs: the scenario's name, its
 * steps, and the requirement it belongs to.
 */

import type { ScenarioNode } from "./SpecParser";

const KEYWORD = /^(GIVEN|WHEN|THEN|AND|BUT|DADO|DADA|DADOS|DADAS|CUANDO|ENTONCES|Y|PERO)\b\s*/i;
const SPANISH = /^(DADO|DADA|DADOS|DADAS|CUANDO|ENTONCES|Y|PERO)\b/i;

/**
 * The Gherkin dialect a delta's scenarios are written in. The delta parser has
 * always accepted `DADO / CUANDO / ENTONCES`; rendering them as English
 * Gherkin produced `Feature:` files whose steps Cucumber read as prose, and
 * `validate --strict` reported every scenario empty (reservas_app, defect #47).
 */
function isSpanish(scenarios: ScenarioNode[]): boolean {
  const steps = scenarios.flatMap((sc) => sc.steps || []);
  return steps.length > 0 && steps.some((s) => SPANISH.test(s.trim()));
}

/** `GIVEN an order` → `Given an order`; `DADO un pedido` → `Dado un pedido`. */
function step(raw: string): string {
  const m = KEYWORD.exec(raw.trim());
  if (!m) return raw.trim();
  const kw = m[1].toLowerCase();
  return `${kw[0].toUpperCase()}${kw.slice(1)} ${raw.trim().slice(m[0].length)}`;
}

export function renderDeltaFeature(
  req: { id: string | null; name?: string; scenarios?: ScenarioNode[] },
  capability: string
): string {
  const es = isSpanish(req.scenarios || []);
  const lines = es
    ? ["# language: es", `Característica: ${req.name || capability}`, ""]
    : [`Feature: ${req.name || capability}`, ""];
  for (const sc of req.scenarios || []) {
    const tags = [req.id ? `@${req.id}` : null, sc.id ? `@${sc.id}` : null].filter(Boolean);
    if (tags.length > 0) lines.push(`  ${tags.join(" ")}`);
    lines.push(`  ${es ? "Escenario" : "Scenario"}: ${sc.name || sc.heading}`);
    for (const s of sc.steps || []) lines.push(`    ${step(s)}`);
    lines.push("");
  }
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

const REQUIREMENT = /^###\s+Requirement:\s*(REQ-[A-Za-z0-9.]+)/;
const TRACE = /^<!--\s*csda:trace\b(.*?)-->\s*$/;

/**
 * Give every requirement that has scenarios but names no feature file the
 * default one, `features/<capability>/<REQ>.feature`.
 *
 * `change archive` renders a requirement's scenarios only when its trace names
 * the file. A draft that never wrote `feature=` — nothing asked it to — was
 * archived with "0 materialised", and the gate then asked every requirement
 * for a scenario it already had (reservas_app, defect #46: 34 scenarios).
 */
export function withDefaultFeaturePaths(source: string, capability: string): string {
  const lines = source.split("\n");
  type Block = { id: string; heading: number; trace: number; scenarios: boolean };
  const blocks: Block[] = [];
  let current: Block | null = null;
  lines.forEach((line, i) => {
    const req = REQUIREMENT.exec(line);
    if (req) {
      current = { id: req[1], heading: i, trace: -1, scenarios: false };
      blocks.push(current);
      return;
    }
    if (/^#{1,3}\s/.test(line)) current = null;
    if (!current) return;
    if (current.trace === -1 && TRACE.test(line)) current.trace = i;
    if (/^####\s+Scenario:/.test(line)) current.scenarios = true;
  });
  const inserts: Array<{ at: number; line: string }> = [];
  for (const b of blocks) {
    if (!b.scenarios) continue;
    const feature = `feature=features/${capability}/${b.id}.feature`;
    if (b.trace === -1) {
      inserts.push({ at: b.heading + 1, line: `\n<!-- csda:trace ${feature} -->` });
    } else if (!/\bfeature=/.test(lines[b.trace])) {
      lines[b.trace] = lines[b.trace].replace(/csda:trace\s*/, `csda:trace ${feature} `);
    }
  }
  for (const ins of inserts.sort((a, b) => b.at - a.at)) lines.splice(ins.at, 0, ins.line);
  return lines.join("\n");
}
