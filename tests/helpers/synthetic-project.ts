/**
 * A synthetic specgate project of N requirements, for the scaling benchmark
 * (REQ-517): each requirement with its section in a capability spec, a
 * feature with one tagged scenario, a test that names the scenario and a
 * source file that names the requirement — the shape `check` reads on a real
 * project, at a size no real fixture has.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as assert from "node:assert/strict";
import { newProject } from "./project";
import { runCli } from "./cli";

const pad = (n: number) => String(n).padStart(4, "0");

/** Requirements per capability spec, as a real project spreads them. */
const PER_CAPABILITY = 50;

function put(dir: string, rel: string, text: string): void {
  const file = path.join(dir, ...rel.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

/**
 * A new project, removed with `removeProject`, holding `count` Implemented
 * requirements REQ-1000 … in capability specs of 50 each.
 */
export function syntheticProject(count: number, prefix = "sg-scale-"): string {
  const dir = newProject(prefix);
  const capabilities = new Map<string, string[]>();
  for (let i = 0; i < count; i++) {
    const n = 1000 + i;
    const id = `REQ-${pad(n)}`;
    const scn = `SCN-${pad(n)}a`;
    const cap = `area-${String(Math.floor(i / PER_CAPABILITY)).padStart(3, "0")}`;
    const module = `src/${cap}/req${pad(n)}.js`;
    const sections = capabilities.get(cap) || [];
    sections.push(
      `### Requirement: ${id} — Behaviour ${n}\n\n` +
        `The system SHALL keep behaviour ${n} as the customer expects it.\n\n` +
        `#### Scenario: ${scn} — Behaviour ${n} happens\n\n` +
        `- GIVEN a customer\n- WHEN they ask for behaviour ${n}\n- THEN it happens\n\n` +
        `<!-- specgate:trace status=Implemented actor=Customer kind=functional -->\n`
    );
    capabilities.set(cap, sections);
    put(
      dir,
      `features/${cap}/${id}.feature`,
      `Feature: Behaviour ${n}\n\n  @${id} @${scn}\n  Scenario: Behaviour ${n} happens\n` +
        `    Given a customer\n    When they ask for behaviour ${n}\n    Then it happens\n`
    );
    put(dir, module, `// ${id}: behaviour ${n}.\nexports.behaviour${n} = (x) => x + ${n};\n`);
    put(
      dir,
      `tests/${cap}/req${pad(n)}.test.js`,
      `// ${id} ${scn}\nconst { behaviour${n} } = require("../../${module}");\n` +
        `if (behaviour${n}(1) !== ${n + 1}) process.exit(1);\n`
    );
  }
  for (const [cap, sections] of capabilities) {
    put(
      dir,
      `docs/specs/capabilities/${cap}/spec.md`,
      `# ${cap} Specification\n\n## Purpose\n\nThe behaviours of ${cap}.\n\n## Requirements\n\n${sections.join("\n")}`
    );
  }
  // The generated matrix, written once, as `check` keeps it.
  const matrix = runCli(["matrix", "--project-dir", dir]);
  assert.equal(matrix.status, 0, matrix.stdout + matrix.stderr);
  return dir;
}
