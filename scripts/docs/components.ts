/**
 * Content components, written as HTML comments inside markdown.
 *
 * ## Why comments
 *
 * Documentation here is read in two places: on the site, and on GitHub, where
 * `docs/*.md` is what a contributor opens. MDX-style `<Card>` tags would render
 * as literal angle brackets there. An HTML comment is invisible in both, so the
 * markdown between the markers stays a plain list or plain prose — which is why
 * the fallback for every component below is "the source, rendered normally".
 *
 * It is also the convention this repository already uses for generated regions
 * and diagrams (`blocks.ts`), so there is one syntax to learn rather than two.
 *
 * ## Why it fails the build
 *
 * An unterminated block is silent breakage: the reader gets a page missing a
 * section and nobody finds out until someone reads it. `inlineDiagrams` already
 * throws on an unknown diagram for the same reason.
 *
 * ## The vocabulary
 *
 * ```markdown
 * <!-- specgate:cards cols=2 -->
 * - [Getting started](./getting-started.md) — Install and run the gate.
 * <!-- specgate:endcards -->
 *
 * <!-- specgate:tabs -->
 * <!-- specgate:tab npm -->      …markdown…
 * <!-- specgate:tab Docker -->   …markdown…
 * <!-- specgate:endtabs -->
 *
 * <!-- specgate:steps -->
 * ### Install          ← each h3 becomes a numbered step
 * <!-- specgate:endsteps -->
 *
 * <!-- specgate:note -->  …  <!-- specgate:endnote -->   also: warning, tip, danger
 * ```
 */

import { icon } from "./icons";

export type RenderInline = (markdown: string) => string;
/** The site's own link rewriter: `./x.md` → `x.html`. Injected, not imported. */
export type RewriteHref = (href: string) => string;

/** Raised when a directive is malformed. Carries the page so the fix is obvious. */
export class ComponentError extends Error {}

const CALLOUTS: Record<string, { label: string; icon: string }> = {
  note: { label: "Note", icon: "book" },
  tip: { label: "Tip", icon: "spark" },
  warning: { label: "Warning", icon: "shield" },
  danger: { label: "Careful", icon: "shield" },
};

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function fail(slug: string, message: string): never {
  throw new ComponentError(`${slug}.md: ${message}`);
}

/** `<!-- specgate:name arg=value -->` → the raw attribute string, or null. */
function openTag(name: string): RegExp {
  return new RegExp(`<!--\\s*specgate:${name}([^>]*?)-->`, "i");
}
function closeTag(name: string): RegExp {
  return new RegExp(`<!--\\s*specgate:end${name}\\s*-->`, "i");
}

function attr(raw: string, key: string): string | undefined {
  const m = new RegExp(`\\b${key}\\s*=\\s*"?([\\w-]+)"?`).exec(raw || "");
  return m ? m[1] : undefined;
}

/**
 * Replace every `specgate:NAME … specgate:endNAME` region, innermost content passed to
 * `body`. Scans left to right so two blocks of the same kind on one page work.
 */
function replaceRegions(
  source: string,
  name: string,
  slug: string,
  body: (inner: string, args: string) => string
): string {
  let out = "";
  let rest = source;

  for (;;) {
    const open = openTag(name).exec(rest);
    if (!open) return out + rest;

    const start = open.index;
    const afterOpen = start + open[0].length;
    const close = closeTag(name).exec(rest.slice(afterOpen));
    if (!close) {
      fail(slug, `<!-- specgate:${name} --> is never closed with <!-- specgate:end${name} -->`);
    }

    const inner = rest.slice(afterOpen, afterOpen + close.index);
    out += rest.slice(0, start) + body(inner, open[1] || "");
    rest = rest.slice(afterOpen + close.index + close[0].length);
  }
}

// ── cards ────────────────────────────────────────────────────────────────────

/**
 * A markdown list of links becomes a grid of cards.
 *
 * `- [Label](href) — description` is the shape, and it is deliberately the
 * shape the list already had before anyone wrapped it: the markers can be
 * deleted and the page still reads.
 */
function cards(inner: string, args: string, slug: string, href: RewriteHref): string {
  const cols = attr(args, "cols") || "2";
  const items = [...inner.matchAll(/^\s*[-*]\s+\[([^\]]+)\]\(([^)]+)\)\s*(?:[—–-]\s*(.*))?$/gm)];
  if (items.length === 0) {
    fail(slug, "specgate:cards contains no `- [Label](href) — description` items");
  }

  const cells = items
    .map(([, label, target, blurb]) => {
      const ic = attr(args, "icon");
      return (
        // Through the site's rewriter, or a card would link to raw markdown —
        // the one thing every other link on the page is careful not to do.
        `<a class="card" href="${escapeAttr(href(target.trim()))}">` +
        (ic ? `<span class="card__icon">${icon(ic)}</span>` : "") +
        `<strong class="card__title">${label.trim()}</strong>` +
        (blurb ? `<span class="card__body">${blurb.trim()}</span>` : "") +
        `</a>`
      );
    })
    .join("");

  return `\n<div class="cards" data-cols="${cols}">${cells}</div>\n`;
}

// ── tabs ─────────────────────────────────────────────────────────────────────

function tabs(inner: string, slug: string, renderInline: RenderInline): string {
  const parts = inner.split(/<!--\s*specgate:tab\s+([^>]*?)-->/i);
  // split() yields [before, title, body, title, body…]; `before` must be blank.
  if (parts[0].trim() !== "") {
    fail(slug, "content inside specgate:tabs before the first <!-- specgate:tab NAME -->");
  }
  if (parts.length < 3) fail(slug, "specgate:tabs needs at least one <!-- specgate:tab NAME -->");

  const id = `t${Math.abs(hash(inner)).toString(36)}`;
  const heads: string[] = [];
  const panels: string[] = [];

  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i].trim();
    const selected = i === 1;
    heads.push(
      `<button class="tabs__tab" type="button" role="tab" id="${id}-t${i}" ` +
        `aria-controls="${id}-p${i}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}">` +
        `${title}</button>`
    );
    panels.push(
      `<div class="tabs__panel" role="tabpanel" id="${id}-p${i}" aria-labelledby="${id}-t${i}"` +
        `${selected ? "" : " hidden"}>${renderInline(parts[i + 1])}</div>`
    );
  }

  return (
    `\n<div class="tabs">` +
    `<div class="tabs__list" role="tablist">${heads.join("")}</div>` +
    panels.join("") +
    `</div>\n`
  );
}

/** Stable id per block, so the markup does not churn between builds. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// ── steps ────────────────────────────────────────────────────────────────────

/** Each `### Heading` inside the block becomes a numbered step. */
function steps(inner: string, slug: string, renderInline: RenderInline): string {
  const chunks = inner.split(/^###\s+(.+)$/gm);
  if (chunks[0].trim() !== "") fail(slug, "content inside specgate:steps before the first `### `");
  if (chunks.length < 3) fail(slug, "specgate:steps needs at least one `### ` heading");

  let n = 0;
  const items: string[] = [];
  for (let i = 1; i < chunks.length; i += 2) {
    n += 1;
    items.push(
      `<li class="steps__step">` +
        `<span class="steps__n" aria-hidden="true">${n}</span>` +
        `<div class="steps__body"><h3 class="steps__title">${chunks[i].trim()}</h3>` +
        `${renderInline(chunks[i + 1])}</div></li>`
    );
  }
  return `\n<ol class="steps">${items.join("")}</ol>\n`;
}

// ── callouts ─────────────────────────────────────────────────────────────────

function callout(kind: string, inner: string, renderInline: RenderInline): string {
  const { label, icon: ic } = CALLOUTS[kind];
  return (
    `\n<div class="callout callout--${kind}" role="note">` +
    `<p class="callout__label">${icon(ic, "icon callout__icon")}${label}</p>` +
    `<div class="callout__body">${renderInline(inner)}</div></div>\n`
  );
}

// ── the pass ─────────────────────────────────────────────────────────────────

/**
 * Expand every component in one markdown source.
 *
 * `renderInline` is the site's own markdown renderer, injected rather than
 * imported so this module has no dependency on `marked` and stays testable on
 * its own. It is called for component *bodies*, which is what lets a tab hold a
 * code block and a callout hold a list.
 */
export function expandComponents(
  source: string,
  slug: string,
  renderInline: RenderInline,
  rewriteHref: RewriteHref
): string {
  let out = source;

  out = replaceRegions(out, "cards", slug, (inner, args) => cards(inner, args, slug, rewriteHref));
  out = replaceRegions(out, "tabs", slug, (inner) => tabs(inner, slug, renderInline));
  out = replaceRegions(out, "steps", slug, (inner) => steps(inner, slug, renderInline));
  for (const kind of Object.keys(CALLOUTS)) {
    out = replaceRegions(out, kind, slug, (inner) => callout(kind, inner, renderInline));
  }

  // A stray closer means someone deleted the opener and left the pair broken.
  const orphan = /<!--\s*specgate:end(cards|tabs|steps|note|tip|warning|danger)\s*-->/i.exec(out);
  if (orphan) fail(slug, `<!-- specgate:${orphan[1]} --> closer with no opener`);
  const strayTab = /<!--\s*specgate:tab\s/i.exec(out);
  if (strayTab) fail(slug, "<!-- specgate:tab NAME --> outside a specgate:tabs block");

  return out;
}
