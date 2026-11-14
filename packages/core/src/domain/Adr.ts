/**
 * Architecture decision records, recorded and superseded — never rewritten
 * (REQ-546).
 *
 * An ADR is history: the reasons a decision was right when it was made. A
 * decision that stops being right is not edited into a new one — that loses
 * the reasons, and the record of having changed course. A new ADR says what
 * replaced what, and the old one gains one line: its status. Everything else
 * in it stays exactly as written, so `git blame` on an ADR shows its author.
 *
 * Files are `docs/specs/adr/NNNN-<slug>.md`, the scheme this repository's own
 * ADRs use. Pure: text in, text out.
 */

export const ADR_DIR = "docs/specs/adr";

export interface AdrSummary {
  /** `0007`. */
  readonly number: string;
  readonly title: string;
  /** As written: `Accepted`, `Proposed`, `Superseded by 0009`, … — "" when none. */
  readonly status: string;
  /** The file name, without the folder. */
  readonly file: string;
}

const FILE_RE = /^(\d{4})-[a-z0-9-]+\.md$/;
const STATUS_RE = /^(\*\*Status:\*\*|Status:)[ \t]*(.*?)([ \t]*)$/;

/** True for a file name an ADR has. */
export function isAdrFile(name: string): boolean {
  return FILE_RE.test(name);
}

/** `Use SQLite for the edge` → `use-sqlite-for-the-edge`. */
export function adrSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "decision"
  );
}

/** The number after the highest one taken, zero-padded. */
export function nextAdrNumber(files: readonly string[]): string {
  const taken = files.map((f) => FILE_RE.exec(f)).filter(Boolean) as RegExpExecArray[];
  const max = taken.reduce((m, x) => Math.max(m, Number(x[1])), 0);
  return String(max + 1).padStart(4, "0");
}

/** What an ADR file says about itself: its number, title and status. */
export function readAdr(file: string, text: string): AdrSummary {
  const number = FILE_RE.exec(file)?.[1] ?? "";
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const heading = lines.find((l) => /^#\s+/.test(l)) || "";
  const title = heading
    .replace(/^#\s+/, "")
    .replace(/^ADR[- ]?\d+\s*[:—-]\s*/i, "")
    .trim();
  const statusLine = lines.find((l) => STATUS_RE.test(l));
  const status = statusLine ? (STATUS_RE.exec(statusLine)?.[2] ?? "").trim() : "";
  return { number, title, status, file };
}

/** A new ADR: Proposed, dated, with the three sections to fill in. */
export function renderAdr(
  number: string,
  title: string,
  date: string,
  supersedes?: string
): string {
  return [
    `# ADR-${number}: ${title}`,
    "",
    `**Date:** ${date}  `,
    `**Status:** Proposed  `,
    ...(supersedes ? [`**Supersedes:** ADR-${supersedes}  `] : []),
    "",
    "---",
    "",
    "## Context",
    "",
    supersedes
      ? `_What changed since ADR-${supersedes}, and the forces at play now._`
      : "_The forces at play: what makes this a decision, and what it is constrained by._",
    "",
    "## Decision",
    "",
    "_What we will do, in one or two sentences._",
    "",
    "## Consequences",
    "",
    "_What becomes easier, what becomes harder, and what we now have to do._",
    "",
  ].join("\n");
}

/**
 * The old ADR with only its status changed. `null` when it has no status line
 * to change: adding one would be rewriting it, which is the caller's to refuse.
 */
export function supersededText(text: string, by: string): string | null {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(eol);
  const at = lines.findIndex((l) => STATUS_RE.test(l));
  if (at === -1) return null;
  const m = STATUS_RE.exec(lines[at])!;
  lines[at] = `${m[1]} Superseded by ${by}${m[3]}`;
  return lines.join(eol);
}
