/**
 * Requirement prose in `spec.md` (Fase 3.1).
 *
 * ## The gap
 *
 * `req add` wrote a matrix row and nothing else. The title went into the *Use
 * Case* column and `spec.md` never gained a section, so the requirement existed
 * as a table entry with no text anywhere.
 *
 * That is one cause with two symptoms, and the second is the expensive one:
 *
 *     # Implement REQ-002
 *     - Feature file: -
 *     - Test artifact (write this first — TDD): -
 *     - Production artifact: -
 *     ## Gherkin scenario
 *     (empty)
 *
 * The harness prompt asks an agent to implement a requirement whose text is
 * nowhere in the prompt. A cold evaluator's words: *"the loop doesn't close on
 * a brownfield adopt"*. It cannot, because there is nothing to read.
 *
 * ## Why a placeholder obligation and not just the title
 *
 * `--strict-requirements` wants an RFC-2119 keyword, and a section that says
 * only what the user typed would fail the project's own gate the moment they
 * turned that flag on. Writing `MUST` into the sentence makes the generated
 * section pass the gate it will be measured by — and marks itself as a draft
 * the author is expected to rewrite, rather than pretending to be finished
 * prose.
 */

/** `## REQ-014 — title`, in the shape the validator and `plan` already read. */
export function renderRequirementSection(reqId: string, title: string): string {
  const heading = `## ${reqId} — ${title}`;
  // `MUST satisfy:` rather than `MUST <title>`: a title can start with an
  // identifier (`res.redirect sets …`) or an acronym, and gluing it onto a verb
  // produces something ungrammatical often enough that it is not worth the
  // heuristic that would try to guess.
  const obligation = String(title || "").trim() || "the behaviour named above";
  return (
    `${heading}\n\n` +
    `The system MUST satisfy: ${obligation}.\n\n` +
    `> Written by Specgate. Replace this sentence with the real ` +
    `obligation — what must hold, under which conditions, and how it is ` +
    `observed.\n`
  );
}

/**
 * The lines of a requirement section that are still what `specgate new` wrote
 * (#67). Empty once the author has replaced them.
 *
 * The placeholder above passes `--strict-requirements` on purpose, so nothing
 * else in the gate notices it: `done` closed a requirement whose only
 * obligation was "The system MUST satisfy: <its title>." The sentence is
 * matched against the section's own title, so a real obligation that happens
 * to start with "satisfy:" is not mistaken for it.
 */
export function templateObligationLines(section: string): string[] {
  const lines = String(section || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const heading = /^#{2,4}\s+REQ-[A-Za-z0-9.]+\s+—\s+(.*)$/.exec((lines[0] || "").trim());
  const title = heading ? heading[1].trim() : null;
  return lines
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.startsWith("> Written by Specgate. Replace this sentence") ||
        (title !== null &&
          (l === `The system MUST satisfy: ${title}.` ||
            l === "The system MUST satisfy: the behaviour named above."))
    );
}

/**
 * A requirement heading, at any level from `##` to `####`.
 *
 * Requirements are commonly nested under a section — the shipped template puts
 * them under "8. Key requirements" — so insisting on top-level `##` would fail
 * documents that are perfectly well organised. The level is captured because
 * the extractor needs to know where the section ends.
 */
const REQUIREMENT_HEADING = /^(#{2,4})\s+(.*)$/;

/**
 * The requirement ids a heading line declares.
 *
 * Four shapes turned up in real documents before this stopped enumerating them:
 * `## REQ-014 — title`, `### REQ-014`, `### Requirement: REQ-100 — title`, and
 * a table row. Matching "a heading that names the id" covers the first three
 * without a fifth special case the next document would break anyway.
 */
function headingRequirementIds(line: string): { level: number; ids: string[] } | null {
  const m = REQUIREMENT_HEADING.exec(line.trim());
  if (!m) return null;
  const ids = m[2].match(/\bREQ-[A-Za-z0-9.]+\b/g) || [];
  return ids.length > 0 ? { level: m[1].length, ids } : null;
}

/**
 * A requirement row in the `| ID | Requirement | … |` table §8 of the shipped
 * template uses.
 *
 * Two conventions are in the wild and both are legitimate: `adopt` writes
 * `## REQ-NNN` sections, while the original `init` template — and this
 * repository's own spec.md — put one row per requirement in a table. Outlawing
 * the table would have turned every project built from that template red on
 * upgrade, for text that is right there in the document.
 *
 * The prose has to be real: a row whose requirement cell is empty, `-` or `TBD`
 * is an id with nothing behind it, which is the case worth catching.
 */
const REQUIREMENT_TABLE_ROW = /^\|\s*(REQ-[A-Za-z0-9.]+)\s*\|([^|]*)\|/;

function tableRowText(specSource: string, reqId: string): string | null {
  const wanted = reqId.trim();
  for (const line of String(specSource || "")
    .replace(/\r\n/g, "\n")
    .split("\n")) {
    const m = REQUIREMENT_TABLE_ROW.exec(line.trim());
    if (!m || m[1] !== wanted) continue;
    const text = m[2].trim();
    if (text === "" || text === "-" || text.toUpperCase() === "TBD") return null;
    return text;
  }
  return null;
}

/** Does `spec.md` carry text for this requirement, in either convention? */
export function hasRequirementSection(specSource: string, reqId: string): boolean {
  if (!reqId) return false;
  const wanted = reqId.trim();
  const hasHeading = String(specSource || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .some((line) => {
      const heading = headingRequirementIds(line);
      return heading ? heading.ids.includes(wanted) : false;
    });
  return hasHeading || tableRowText(specSource, reqId) !== null;
}

/**
 * Every `REQ-NNN` that `spec.md` declares a section for.
 *
 * Used in the other direction by the gate: a matrix row whose requirement has
 * no section is a row describing something the specification never says.
 */
export function requirementSections(specSource: string): string[] {
  const found: string[] = [];
  for (const line of String(specSource || "")
    .replace(/\r\n/g, "\n")
    .split("\n")) {
    const heading = headingRequirementIds(line);
    if (heading) {
      for (const id of heading.ids) if (!found.includes(id)) found.push(id);
      continue;
    }
    const row = REQUIREMENT_TABLE_ROW.exec(line.trim());
    if (!row || found.includes(row[1])) continue;
    const text = row[2].trim();
    if (text === "" || text === "-" || text.toUpperCase() === "TBD") continue;
    found.push(row[1]);
  }
  return found;
}

/**
 * `spec.md` with a section for `reqId` appended, or unchanged if it has one.
 *
 * Appends rather than inserting in id order: `spec.md` is a document a person
 * writes in, and reordering someone's prose to satisfy a sort is a worse
 * surprise than a section at the end.
 */
export function appendRequirementSection(
  specSource: string,
  reqId: string,
  title: string
): { content: string; added: boolean } {
  if (hasRequirementSection(specSource, reqId)) {
    return { content: specSource, added: false };
  }
  const body = String(specSource || "").replace(/\s+$/, "");
  const separator = body === "" ? "" : "\n\n";
  return {
    content: `${body}${separator}${renderRequirementSection(reqId, title)}`,
    added: true,
  };
}

/**
 * The body of `## REQ-NNN` in `spec.md`, heading included, or `null`.
 *
 * A section runs until the next heading of the same or higher level, so a
 * `### ` subsection belongs to the requirement and a `## ` does not.
 */
export function extractRequirementSection(specSource: string, reqId: string): string | null {
  if (!reqId) return null;
  const lines = String(specSource || "")
    .replace(/\r\n/g, "\n")
    .split("\n");

  let start = -1;
  let level = 2;
  for (let i = 0; i < lines.length; i += 1) {
    const heading = headingRequirementIds(lines[i]);
    if (heading && heading.ids.includes(reqId.trim())) {
      start = i;
      level = heading.level;
      break;
    }
  }
  // No heading: the table row is the requirement's text, and the prompt needs
  // it just as much.
  if (start === -1) {
    const text = tableRowText(specSource, reqId);
    return text === null ? null : `## ${reqId.trim()}\n\n${text}`;
  }

  // The section ends at the next heading of the same level or higher, so a
  // `####` sub-heading stays inside the requirement and the next `###` does not.
  const boundary = new RegExp(`^#{1,${level}}\\s+\\S`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (boundary.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}
