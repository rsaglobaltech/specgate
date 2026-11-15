/**
 * Acceptance: a checklist a person signs (REQ-543).
 *
 * The gate proves a test passes; it cannot prove the behaviour is what the
 * business asked for. Acceptance is that second judgement, made by a person
 * and written down: one item per scenario, checked once seen, and a signature
 * that is refused while an item is still open. Signing is what moves a
 * requirement from Implemented to Verified. Pure: text in, text out.
 */

export const ACCEPTANCE_FILE = "acceptance.md";

export interface AcceptanceRequirement {
  readonly id: string;
  readonly title: string;
  readonly scenarios: ReadonlyArray<{ readonly title: string; readonly steps: readonly string[] }>;
}

/** The checklist, every item unchecked. */
export function renderAcceptance(change: string, reqs: readonly AcceptanceRequirement[]): string {
  const out = [
    `# Acceptance — ${change}`,
    "",
    "Check an item once you have seen the behaviour yourself, then sign:",
    `\`specgate acceptance ${change} --sign "<your name>"\`. Signing is refused while`,
    "an item is unchecked, and moves each Implemented requirement to Verified.",
    "",
  ];
  for (const r of reqs) {
    out.push(`## ${r.id}${r.title ? ` — ${r.title}` : ""}`, "");
    for (const s of r.scenarios) {
      out.push(`- [ ] ${s.title}`);
      for (const step of s.steps) out.push(`  - ${step}`);
    }
    if (r.scenarios.length === 0) out.push("- [ ] The requirement behaves as its text says");
    out.push("");
  }
  out.push("## Signed", "", "_Not yet._", "");
  return out.join("\n");
}

/** The items: checked and not. Steps under an item are not items. */
export function acceptanceItems(md: string): { checked: number; open: string[] } {
  let checked = 0;
  const open: string[] = [];
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    const m = /^- \[( |x|X)\] (.*)$/.exec(line);
    if (!m) continue;
    if (m[1] === " ") open.push(m[2].trim());
    else checked += 1;
  }
  return { checked, open };
}

/** Who signed, when, or null. */
export function signatureOf(md: string): { name: string; date: string } | null {
  const m = /^Signed by (.+) on (\d{4}-\d{2}-\d{2})\.$/m.exec(md);
  return m ? { name: m[1], date: m[2] } : null;
}

/** The file with its signature. The caller checks the items first. */
export function signed(md: string, name: string, date: string): string {
  const line = `Signed by ${name} on ${date}.`;
  return /^_Not yet\._$/m.test(md)
    ? md.replace(/^_Not yet\._$/m, line)
    : `${md.trimEnd()}\n\n## Signed\n\n${line}\n`;
}
