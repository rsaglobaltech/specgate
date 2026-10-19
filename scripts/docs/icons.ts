/**
 * The icon set the site draws from.
 *
 * Inline SVG rather than an icon font or sprite sheet, for two reasons that
 * both come from how this site is built: there is no bundler to subset a font
 * with, and every colour on the page is a `var(--…)` token so the theme toggle
 * works — `stroke="currentColor"` inherits that for free, a font glyph or a
 * remote `<img>` would not.
 *
 * Twenty-four by twenty-four, 1.5 stroke, no fills. Keep them geometric: these
 * sit at 16-20px in a sidebar and anything fussier turns to mud.
 */

const ICONS: Record<string, string> = {
  // Start here — a flag planted at the beginning.
  rocket:
    '<path d="M12 3c3 2 5 5.5 5 9l-5 4-5-4c0-3.5 2-7 5-9Z"/><circle cx="12" cy="10" r="1.6"/><path d="M9 17l-2 4 4-2M15 17l2 4-4-2"/>',
  // Writing specs — a document with lines.
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  // Agents — a small machine with an eye.
  robot:
    '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M8 4h8"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M9 17h6"/>',
  // Running it for real — a stack of servers.
  server:
    '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>',
  // Reference — a book.
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 5.5v15"/>',
  // Background — a compass, for reading around the subject.
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
  // The gate itself.
  shield: '<path d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 6 3.5-6 3.5Z"/>',
  package: '<path d="M21 8v8l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  code: '<path d="m8 6-5 6 5 6M16 6l5 6-5 6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  spark:
    '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};

/**
 * One icon as inline SVG, or the empty string when the name is unknown.
 *
 * Unknown names return empty rather than throwing: an icon is decoration, and
 * a missing one should not take the build down the way a missing diagram does.
 * `aria-hidden` because every icon here sits beside its own text label.
 */
export function icon(name: string | undefined, cls = "icon"): string {
  if (!name) return "";
  const body = ICONS[name];
  if (!body) return "";
  return (
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
  );
}
