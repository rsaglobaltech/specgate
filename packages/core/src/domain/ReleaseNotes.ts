/**
 * Release notes from what was archived between two refs (REQ-542).
 *
 * The changes archived in a release are already the record of what it
 * delivered: each one says why (its proposal's intent), what (the
 * requirements its deltas add or modify) and, since REQ-545, whether it adds
 * something or fixes something. Release notes are that record, grouped —
 * nobody re-types them from the commit log. Pure: the archived changes in,
 * Markdown out.
 */

export interface ReleasedRequirement {
  readonly id: string;
  readonly title: string;
}

export interface ReleasedChange {
  /** The change's id, without the archive's date prefix. */
  readonly id: string;
  /** `bug`, `enhancement`, or "" when the change does not say. */
  readonly kind: string;
  /** The first paragraph of its proposal's `## Intent`. */
  readonly intent: string;
  readonly requirements: readonly ReleasedRequirement[];
}

/** `2026-10-19-live-view` → `live-view`. */
export function changeIdOf(archiveFolder: string): string {
  return archiveFolder.replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

/** The first paragraph under `## Intent`, on one line. */
export function intentOf(proposal: string): string {
  const lines = proposal.replace(/\r\n/g, "\n").split("\n");
  const at = lines.findIndex((l) => /^##\s+Intent\b/i.test(l));
  if (at === -1) return "";
  const para: string[] = [];
  for (const line of lines.slice(at + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    if (line.trim() === "") {
      if (para.length) break;
      continue;
    }
    para.push(line.trim());
  }
  return para.join(" ");
}

/** The requirements a delta adds or modifies — not the ones it removes. */
export function deliveredBy(delta: string): ReleasedRequirement[] {
  const out: ReleasedRequirement[] = [];
  let section = "";
  for (const line of delta.replace(/\r\n/g, "\n").split("\n")) {
    const s = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\b/i.exec(line);
    if (s) {
      section = s[1].toUpperCase();
      continue;
    }
    if (section !== "ADDED" && section !== "MODIFIED") continue;
    const r = /^###\s+Requirement:\s+(REQ-\d+)\s*(?:[—:-]\s*(.*))?$/.exec(line);
    if (r) out.push({ id: r[1], title: (r[2] || "").trim() });
  }
  return out;
}

const GROUPS: Array<{ kind: string; title: string }> = [
  { kind: "enhancement", title: "Enhancements" },
  { kind: "bug", title: "Fixes" },
  { kind: "", title: "Other changes" },
];

/** The notes: Enhancements, then Fixes, then changes that do not say; empty groups left out. */
export function renderReleaseNotes(
  from: string,
  to: string,
  changes: readonly ReleasedChange[]
): string {
  const out = [`# Release notes — ${from}..${to}`, ""];
  if (changes.length === 0) {
    out.push("No change was archived between these refs.", "");
    return out.join("\n");
  }
  // A kind the groups do not know reads as no kind.
  const groupOf = (kind: string) => (GROUPS.some((g) => g.kind && g.kind === kind) ? kind : "");
  for (const g of GROUPS) {
    const inGroup = changes
      .filter((c) => groupOf(c.kind) === g.kind)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (inGroup.length === 0) continue;
    out.push(`## ${g.title}`, "");
    for (const c of inGroup) {
      out.push(`### ${c.id}`, "");
      if (c.intent) out.push(c.intent, "");
      for (const r of c.requirements) out.push(`- ${r.id}${r.title ? ` — ${r.title}` : ""}`);
      if (c.requirements.length) out.push("");
    }
  }
  return out.join("\n");
}
