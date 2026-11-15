import * as fs from "node:fs";
import * as path from "node:path";
import { info } from "./diagnostics";
import type { Diagnostic } from "../../packages/core/src/domain/Diagnostic";

/**
 * The requirements an earlier `adopt` seeded from the code's layout and nobody
 * specified since (REQ-472): their section still says "Proposed, not
 * specified." — a folder's name and a `TBD` test, with no behaviour.
 */
export function unspecifiedProposals(projectDir: string): Array<{ id: string; title: string }> {
  const file = path.join(projectDir, "spec.md");
  if (!fs.existsSync(file)) return [];
  const out: Array<{ id: string; title: string }> = [];
  const sections = fs.readFileSync(file, "utf8").split(/^(?=##\s+REQ-\d+)/m);
  for (const s of sections) {
    const head = /^##\s+(REQ-\d+)\s+—\s+(.+)$/m.exec(s);
    if (head && /\*\*Proposed, not specified\.\*\*/.test(s))
      out.push({ id: head[1]!, title: head[2]!.trim() });
  }
  return out;
}

/** One finding per unspecified proposal, with how to fix it (REQ-472). */
export function proposalNotes(projectDir: string): Diagnostic[] {
  return unspecifiedProposals(projectDir).map((p) =>
    info(
      "proposal_unspecified",
      `${p.id} "${p.title}" is a proposal an earlier adoption read off the code: proposed, not specified — it says where code lives, not what it must do.`,
      {
        target: p.id,
        file: "spec.md",
        fix: `Specify it: rewrite ${p.id}'s section as one behaviour you rely on (or \`specgate new "<behaviour>"\` and remove ${p.id}'s section from spec.md).`,
      }
    )
  );
}
