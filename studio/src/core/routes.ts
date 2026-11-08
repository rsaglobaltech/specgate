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

const isSection = (id: string): id is Section => (SECTIONS as readonly string[]).includes(id);

/**
 * The section an address names; with none named, the one the page opens on
 * (`/live` opens Live, REQ-433), else Home.
 */
export function sectionOf(hash: string, opensOn = ""): Section {
  const id = hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  if (isSection(id)) return id;
  return !id && isSection(opensOn) ? opensOn : "home";
}

/** The address of a section. */
export const hrefOf = (s: Section) => `#/${s}`;
