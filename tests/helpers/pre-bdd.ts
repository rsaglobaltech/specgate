import * as fs from "node:fs";
import * as path from "node:path";

/**
 * A project as it was before executable scenarios (REQ-661 SCN-661c): `init`
 * and `adopt` now write `bdd: required` (REQ-663); a test about something else
 * takes it out, so its gate warns `bdd_not_set_up` and passes as it did.
 */
export function withoutBdd(dir: string): void {
  const file = path.join(dir, ".specgate", "gate.yaml");
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, text.replace(/^bdd:\s*required\s*$\n?/m, ""));
}
