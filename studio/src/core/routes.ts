/**
 * The studio's sections and their addresses (REQ-204): each section lives at
 * `#/<id>`, so Back, Forward, reloading and a link open the same section.
 */
export const SECTIONS = [
  "home",
  "brief",
  "changes",
  "questions",
  "build",
  "live",
  "report",
  "settings",
] as const;

export type Section = (typeof SECTIONS)[number];

/** The section an address names; Home for anything else. */
export function sectionOf(hash: string): Section {
  const id = hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  return (SECTIONS as readonly string[]).includes(id) ? (id as Section) : "home";
}

/** The address of a section. */
export const hrefOf = (s: Section) => `#/${s}`;
