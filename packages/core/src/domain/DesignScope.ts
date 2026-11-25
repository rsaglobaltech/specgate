/**
 * What a design commits to build (shortcut-proof REQ-744): the source files
 * it names, and which new files of a delivery it does not. Pure.
 */

const SOURCE =
  /\.([cm]?[jt]sx?|java|kt|kts|scala|groovy|py|go|rb|cs|php|rs|swift|c|cc|cpp|h|hpp|vue|svelte)$/;

const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\.\//, "");

/** The source files a design names: a path with a source extension, written in backticks. */
export function designFiles(design: string): string[] {
  const out: string[] = [];
  for (const m of design.matchAll(/`([^`\s]+)`/g)) {
    const p = norm(m[1]!);
    if (SOURCE.test(p) && !/^(docs|features)\//.test(p) && !out.includes(p)) out.push(p);
  }
  return out;
}

/** The new source files the designs do not name; none when they name no file at all. */
export function outsideDesign(newFiles: string[], designed: string[]): string[] {
  if (designed.length === 0) return [];
  const named = new Set(designed.map(norm));
  return newFiles.map(norm).filter((f) => !named.has(f));
}
