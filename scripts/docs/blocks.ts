/**
 * Generated blocks inside hand-written files.
 *
 * Two things on this site are produced by a script and live inside a file a
 * person edits: the diagrams, and the recorded terminal transcript. Both need
 * the same three operations — find the block, read it, replace it — and both
 * need the replacement to be idempotent, because a generator that appends on
 * every run is a generator nobody runs twice.
 *
 * The sentinels are HTML comments so the block survives in `index.html`, which
 * is published byte for byte, and in markdown, which passes HTML through.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Where the diagram sources live. One directory, one mechanism.
 *
 * Outside `assets/`, which is published wholesale: these are sources that get
 * inlined, so shipping them as separate files would be three more requests
 * nobody makes.
 */
export const DIAGRAM_DIR = "diagrams";

export function beginMarker(name: string): string {
  return `<!-- csda:${name}:begin — generated; edit the source, not this block -->`;
}

export function endMarker(name: string): string {
  return `<!-- csda:${name}:end -->`;
}

/**
 * The contents of a named block, or `null` if the file has no such block.
 *
 * Returns the text between the sentinels with the surrounding newlines trimmed,
 * which is what a comparison wants; `replaceBlock` puts them back.
 */
export function readBlock(source: string, name: string): string | null {
  const begin = source.indexOf(beginMarker(name));
  if (begin === -1) return null;
  const from = begin + beginMarker(name).length;
  const to = source.indexOf(endMarker(name), from);
  if (to === -1) throw new Error(`block "${name}" opens and never closes`);
  return source.slice(from, to).trim();
}

/**
 * The same file with one block's contents replaced.
 *
 * Throws rather than appending when the block is absent: a missing sentinel
 * means the file was edited in a way the generator does not understand, and
 * guessing where the block should go is how generated markup ends up in two
 * places at once.
 */
export function replaceBlock(source: string, name: string, content: string): string {
  const begin = source.indexOf(beginMarker(name));
  if (begin === -1) {
    throw new Error(`no "${name}" block to replace — expected ${beginMarker(name)}`);
  }
  const from = begin + beginMarker(name).length;
  const to = source.indexOf(endMarker(name), from);
  if (to === -1) throw new Error(`block "${name}" opens and never closes`);
  return `${source.slice(0, from)}\n${content.trim()}\n${source.slice(to)}`;
}

/** Every diagram source, by name. */
export function diagrams(docsDir: string): Map<string, string> {
  const dir = path.join(docsDir, DIAGRAM_DIR);
  const out = new Map<string, string>();
  if (!fs.existsSync(dir)) return out;
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith(".html")) continue;
    out.set(file.slice(0, -5), fs.readFileSync(path.join(dir, file), "utf8").trim());
  }
  return out;
}

/**
 * Markdown with `<!-- csda:diagram NAME -->` replaced by the diagram itself.
 *
 * Inline rather than `<img src>` on purpose: these diagrams are coloured with
 * the site's tokens, and a var does not cross into an externally loaded SVG. An
 * `<img>` diagram would follow `prefers-color-scheme` and ignore the theme
 * toggle, which is the one case where it would visibly disagree with the page
 * around it.
 */
export function inlineDiagrams(source: string, available: Map<string, string>): string {
  return source.replace(/<!--\s*csda:diagram\s+([a-z0-9-]+)\s*-->/g, (_match, name: string) => {
    const svg = available.get(name);
    if (!svg) {
      throw new Error(`no diagram named "${name}" in docs/${DIAGRAM_DIR}/`);
    }
    // A blank line ends an HTML block in Markdown, and the indented lines after
    // it become a code block: the rest of the SVG reached the page as escaped
    // text on domain-packs and in the article. Inlined, it has none.
    return svg.replace(/\n[ \t]*(?=\n)/g, "");
  });
}
