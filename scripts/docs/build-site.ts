#!/usr/bin/env node

/**
 * Render `docs/**.md` into a documentation site.
 *
 * ## Why this exists
 *
 * The site published twenty markdown documents as `text/markdown`, so a reader
 * who followed a link got the source — comment markers, front-matter, the lot.
 * The landing page linked to four of them. The other sixteen existed and were
 * unreachable.
 *
 * ## Why it renders at build time
 *
 * A page that needs JavaScript to show its own text is a page that is slower,
 * unindexable and broken behind a corporate proxy that strips scripts. These
 * are plain HTML documents; the JavaScript that ships alongside adds search,
 * copy buttons and a theme toggle, and the site reads fine without it.
 *
 * `marked` is a devDependency, so none of this reaches the published package —
 * `package.json` still has zero runtime dependencies, which is what lets the
 * CLI run through `npx` on someone else's machine.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { marked } from "marked";
import type { Tokens } from "marked";

import { NAV, navEntry, neighbours, journeyOf } from "./nav";
import type { NavEntry, NavSection } from "./nav";
import { translationOf, LANGS } from "./i18n";
import type { Lang } from "./i18n";
import { diagrams, inlineDiagrams } from "./blocks";
import { expandComponents } from "./components";
import { highlight } from "./highlight";
import { icon } from "./icons";

const ROOT = path.resolve(__dirname, "..", "..", "..");

/** Absolute base for metadata a link scraper resolves without a page context. */
const SITE = "https://rsaglobaltech.github.io/specgate";
const DOCS = path.join(ROOT, "docs");
const REPO = "https://github.com/rsaglobaltech/specgate";

/** Assets copied through untouched. */
// `roi.html` used to be here. A calculator that estimates a saving is a sales
// artefact, not documentation, and it was the only page on the site written in
// a different voice.
const VERBATIM = ["index.html", "assets"];

/**
 * Which documentation a build is (REQ-400, REQ-401). The stable line is
 * published at the root and the 1.0 candidate's under `next/`, one site built
 * twice; with both versions named, every page carries a picker between them.
 */
export interface SiteOptions {
  readonly channel?: "stable" | "next";
  readonly versions?: { readonly stable?: string; readonly next?: string };
}

/**
 * The language a page is rendered in. English is the source and lives at the
 * site's root; Spanish lives under `es/`, from `docs/es/<slug>.md` when the page
 * is translated and from the English source, with a note, when it is not yet.
 * Set per page by `buildSite`; the renderers below read it.
 */
let LANG: Lang = "en";

/**
 * A translated page's headings, English anchor → Spanish anchor. A Spanish
 * page keeps the English one's headings in the same order, so the n-th
 * heading's anchor maps to the n-th: a link written against the English —
 * from a page not translated yet — still lands on its section.
 */
const SPANISH_ANCHORS = new Map<string, Map<string, string>>();

/** What the site itself says, around the pages. */
const UI: Record<Lang, Record<string, string>> = {
  en: {
    skip: "Skip to content",
    openNav: "Open navigation",
    search: "search docs",
    searchLabel: "Search documentation",
    searchPlaceholder: "Search the documentation…",
    hint: "<kbd>↑</kbd><kbd>↓</kbd> to navigate · <kbd>↵</kbd> to open · <kbd>Esc</kbd> to close",
    results: "Results",
    docs: "Docs",
    projects: "Projects",
    theme: "Switch theme",
    previous: "Previous",
    next: "Next",
    neighbours: "Neighbouring pages",
    useful: "Was this page useful?",
    edit: "Edit this page",
    issue: "Something wrong? Open an issue",
    onThisPage: "On this page",
    breadcrumb: "Breadcrumb",
    documentation: "Documentation",
    anchor: "Link to this section",
    step: "Step",
    of: "of",
    language: "Language",
    docsTitle: "Documentation",
    docsLede:
      'Specifications that are checked, not admired. <a href="start.html">Start here</a> — an existing project or a new one, six commands each — or <a href="quickstart.html">Joining a project</a> if somebody set it up for you.',
    install: "Install",
    copy: "Copy",
  },
  es: {
    skip: "Ir al contenido",
    openNav: "Abrir la navegación",
    search: "buscar en la documentación",
    searchLabel: "Buscar en la documentación",
    searchPlaceholder: "Buscar en la documentación…",
    hint: "<kbd>↑</kbd><kbd>↓</kbd> para moverte · <kbd>↵</kbd> para abrir · <kbd>Esc</kbd> para cerrar",
    results: "Resultados",
    docs: "Documentación",
    projects: "Proyectos",
    theme: "Cambiar el tema",
    previous: "Anterior",
    next: "Siguiente",
    neighbours: "Páginas vecinas",
    useful: "¿Te ha servido esta página?",
    edit: "Editar esta página",
    issue: "¿Algo está mal? Abre un issue",
    onThisPage: "En esta página",
    breadcrumb: "Ruta",
    documentation: "Documentación",
    anchor: "Enlace a esta sección",
    step: "Paso",
    of: "de",
    language: "Idioma",
    docsTitle: "Documentación",
    docsLede:
      'Especificaciones que se comprueban, no que se admiran. <a href="start.html">Empieza aquí</a> — un proyecto existente o uno nuevo, seis comandos cada uno — o <a href="quickstart.html">Unirte a un proyecto</a> si alguien ya lo configuró.',
    install: "Instalar",
    copy: "Copiar",
  },
};
const t = (key: string): string => UI[LANG][key] ?? UI.en[key];

/** A sidebar entry's label and blurb in the page's language, English when not translated. */
const entryLabel = (e: NavEntry): string => (LANG === "es" && e.es?.label) || e.label;
const entryBlurb = (e: NavEntry): string => (LANG === "es" && e.es?.blurb) || e.blurb;
const entryGroup = (e: NavEntry): string | undefined => (LANG === "es" && e.es?.group) || e.group;
const sectionTitle = (s: NavSection): string => (LANG === "es" && s.es?.title) || s.title;
const sectionSummary = (s: NavSection): string => (LANG === "es" && s.es?.summary) || s.summary;

interface Page {
  /** `harness`, `case-studies/case-1` — the path without extension. */
  slug: string;
  title: string;
  html: string;
  headings: Array<{ id: string; text: string; level: number }>;
  /** Plain text, for the search index. */
  text: string;
  /** A Spanish page: `missing` shows the English text, `stale` a translation behind it. */
  translation?: "current" | "missing" | "stale";
}

// ── Markdown → HTML ──────────────────────────────────────────────────────────

/** `The harness` → `the-harness`. Stable, because anchors end up in links. */
function slugifyHeading(text: string, taken: Set<string>): string {
  const base =
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/`/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Rewrite a link the way the site serves it.
 *
 * `./harness.md` becomes `harness.html`, because that is what is published.
 * Leaving them pointing at `.md` was half of why the old site was unreadable:
 * every internal link dropped the reader back into raw source.
 */
function rewriteLink(href: string, slug: string): string {
  if (/^[a-z]+:/i.test(href) || href.startsWith("#") || href.startsWith("//")) return href;
  const [target, hash] = href.split("#");
  if (!target) return href;

  // A link that climbs out of `docs/` points at a repository file — README,
  // CONTRIBUTING, a pack's yaml — which is not published here. Sending it to
  // GitHub is the honest destination; rewriting `../SECURITY.md` to
  // `../SECURITY.html` invented a page that has never existed.
  const depth = slug.split("/").length - 1;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(slug), target));
  if (resolved.startsWith("..")) {
    const inRepo = path.posix.normalize(path.posix.join("docs", path.posix.dirname(slug), target));
    return `${REPO}/blob/main/${inRepo}${hash ? `#${hash}` : ""}`;
  }
  void depth;

  if (!target.endsWith(".md")) return href;
  // `docs/specs/` is published once, at the root: a Spanish page climbs out of `es/`.
  if (LANG === "es" && resolved.startsWith("specs/")) {
    const climb = "../".repeat(slug.split("/").length);
    return `${climb}${resolved.slice(0, -3)}.html${hash ? `#${hash}` : ""}`;
  }
  const html = `${target.slice(0, -3)}.html`;
  if (LANG === "es" && hash) {
    const spanish = SPANISH_ANCHORS.get(resolved.slice(0, -3))?.get(hash);
    if (spanish) return `${html}#${spanish}`;
  }
  return hash ? `${html}#${hash}` : html;
}

/**
 * A heading's plain text, for the anchor id and the contents list.
 *
 * Repeated until it stops changing: one pass of `/<[^>]+>/g` leaves a nested or
 * malformed tag behind — `<<b>i>` becomes `<i>` — which CodeQL reports as
 * `js/incomplete-multi-character-sanitization`. Nothing here reaches a browser
 * as markup, but a half-stripped heading would still produce a wrong anchor.
 */
function stripTags(html: string): string {
  let out = String(html);
  let previous;
  do {
    previous = out;
    out = out.replace(/<[^>]*>/g, "");
  } while (out !== previous);
  return out.trim();
}

/** The five entities `marked` writes, back to the characters they stand for. */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function renderMarkdown(
  source: string,
  currentSlug: string
): Pick<Page, "html" | "headings" | "title"> & { ids: string[] } {
  const headings: Page["headings"] = [];
  const taken = new Set<string>();
  const ids: string[] = [];
  let title = "";

  const renderer = new marked.Renderer();

  renderer.heading = ({ tokens, depth }: Tokens.Heading) => {
    const text = renderer.parser.parseInline(tokens);
    // `parseInline` returns HTML, so an apostrophe arrives as `&#39;`. The
    // heading's text is escaped again where it is printed — in the contents
    // rail and the page title — so decode it here, or "You're" reads
    // "You&#39;re" in both.
    const plain = decodeEntities(stripTags(text));
    if (depth === 1 && !title) title = plain;
    // The id is still made from the encoded text: every anchor already linked
    // keeps working.
    const id = slugifyHeading(stripTags(text), taken);
    ids.push(id);
    if (depth >= 2 && depth <= 3) headings.push({ id, text: plain, level: depth });
    return (
      `<h${depth} id="${id}">${text}` +
      `<a class="anchor" href="#${id}" aria-label="${t("anchor")}">#</a></h${depth}>\n`
    );
  };

  renderer.link = ({ href, title: linkTitle, tokens }: Tokens.Link) => {
    const text = renderer.parser.parseInline(tokens);
    const target = rewriteLink(String(href || ""), currentSlug);
    const external = /^https?:/i.test(target);
    const attrs = [
      `href="${escapeHtml(target)}"`,
      linkTitle ? `title="${escapeHtml(linkTitle)}"` : "",
      external ? 'target="_blank" rel="noreferrer"' : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<a ${attrs}>${text}</a>`;
  };

  // ```bash Install   →  language `bash`, label "Install" in the block header.
  // The label is how the reference documentation names the file or the shell a
  // snippet belongs to, and it is the difference between six unlabelled blocks
  // and six blocks you can tell apart.
  renderer.code = ({ text, lang }: Tokens.Code) => {
    const parts = String(lang || "")
      .trim()
      .split(/\s+/);
    const language = parts[0] || "text";
    const label = parts.slice(1).join(" ");
    // Output recorded from the CLI (`$ specgate …` first) is drawn as the
    // terminal it came from, in the CLI's own colours.
    if (language === "text" && /^\$ /.test(String(text))) return terminalBlock(String(text));
    return (
      `<figure class="code" data-lang="${escapeHtml(language)}">` +
      `<figcaption class="code__head">` +
      `<span class="code__lang">${escapeHtml(label || language)}</span>` +
      `<button class="code__copy" type="button" aria-label="Copy to clipboard">Copy</button>` +
      `</figcaption>` +
      `<pre><code class="language-${escapeHtml(language)}">${highlight(text, language)}</code></pre>` +
      `</figure>\n`
    );
  };

  renderer.table = ({ header, rows }: Tokens.Table) => {
    const head = header
      .map((cell) => `<th>${renderer.parser.parseInline(cell.tokens)}</th>`)
      .join("");
    const body = rows
      .map(
        (row) =>
          `<tr>${row
            .map((cell) => `<td>${renderer.parser.parseInline(cell.tokens)}</td>`)
            .join("")}</tr>`
      )
      .join("");
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>\n`;
  };

  const html = marked.parse(source, { renderer, gfm: true, breaks: false }) as string;
  return { html, headings, title, ids };
}

// ── The page shell ───────────────────────────────────────────────────────────

/** One line of recorded output → the class that colours it, as the CLI would. */
function termClass(line: string): string {
  const t = line.trim();
  if (/^\$ /.test(line)) return "prompt";
  if (/^◆ specgate/.test(t)) return "brand";
  if (/^(✖|❌)/.test(t)) return "err";
  if (/^(▲|⚠)/.test(t)) return "warn";
  if (/^(✔|✅|●)/.test(t) || /^\d+ passed/.test(t)) return "ok";
  if (/^ℹ/.test(t)) return "info";
  if (/^(➜|\d+\s+➜)/.test(t)) return "next";
  if (/─{4,}$/.test(t)) return "section";
  if (/^\+ /.test(t)) return "added";
  if (/^(fix:|·|…|[│└↳])/.test(t) || /^\d+\s+[^➜]/.test(t)) return "dim";
  return "out";
}

/** A recorded command and its output, as a terminal window. */
function terminalBlock(text: string): string {
  const lines = text.replace(/\n$/, "").split("\n");
  const body = lines
    .map((l) => {
      const cls = termClass(l);
      const html = escapeHtml(l).replace(/(█+)/g, '<span class="t-bar">$1</span>');
      return `<span class="t-line t-${cls}">${html || " "}</span>`;
    })
    .join("\n");
  return (
    `<figure class="code code--term" data-lang="text">` +
    `<figcaption class="code__head"><span class="term-dots" aria-hidden="true"><i></i><i></i><i></i></span>` +
    `<span class="code__lang">Terminal</span>` +
    `<button class="code__copy" type="button" aria-label="Copy to clipboard">Copy</button>` +
    `</figcaption><pre><code class="language-text">${body}</code></pre></figure>\n`
  );
}

/**
 * The sidebar, from a page that may be nested.
 *
 * `up` is not decoration: a page at `case-studies/case-1.html` linking to a
 * bare `getting-started.html` asks for `case-studies/getting-started.html`,
 * which does not exist. Every link out of a nested page needs the climb.
 */
function sidebar(currentSlug: string, up: string): string {
  return NAV.map((section) => {
    const open = section.entries.some((e) => e.slug === currentSlug);
    let group = "";
    const items = section.entries
      .map((entry) => {
        const active = entry.slug === currentSlug ? ' class="is-active" aria-current="page"' : "";
        // A subsection starts where the group changes: a small heading, not a link.
        const head =
          entry.group && entry.group !== group
            ? `<li class="side__sub" role="presentation">${escapeHtml(entryGroup(entry)!)}</li>`
            : "";
        group = entry.group || "";
        const step = entry.step
          ? `<span class="side__step" aria-hidden="true">${entry.step}</span>`
          : "";
        return `${head}<li><a href="${up}${entry.slug}.html"${active}>${step}${escapeHtml(entryLabel(entry))}</a></li>`;
      })
      .join("");
    // `open` on the group holding the current page, so a reader always lands
    // with their own section unfolded. The rest remember their last state in
    // localStorage; `details` keeps that working with JavaScript disabled.
    return (
      `<details class="side__group" data-group="${escapeHtml(section.title)}"${open ? " open" : ""}>` +
      `<summary class="side__head">${icon(section.icon, "icon side__icon")}` +
      `<span>${escapeHtml(sectionTitle(section))}</span></summary>` +
      `<ul>${items}</ul></details>`
    );
  }).join("");
}

/** `Reference › Command reference` above the title, so depth is visible. */
function breadcrumbs(slug: string, up: string): string {
  const section = NAV.find((s) => s.entries.some((e) => e.slug === slug));
  const entry = navEntry(slug);
  if (!section || !entry) return "";
  return (
    `<nav class="crumbs" aria-label="${t("breadcrumb")}"><ol>` +
    `<li><a href="${up}docs.html">${t("docs")}</a></li>` +
    `<li>${escapeHtml(sectionTitle(section))}</li>` +
    `<li aria-current="page">${escapeHtml(entryLabel(entry))}</li>` +
    `</ol></nav>`
  );
}

/**
 * `① Install ── ② Specify ── ③ Build …` above a journey page: where you are,
 * what is behind you, what comes next, and how long this step takes. Generated
 * from the sidebar's order, so it can never disagree with it.
 */
function stepper(slug: string, up: string): string {
  const steps = journeyOf(slug);
  if (steps.length === 0) return "";
  const current = steps.find((e) => e.slug === slug)!;
  const items = steps
    .map((e) => {
      const state = e.step! < current.step! ? "is-done" : e.slug === slug ? "is-current" : "";
      const aria = e.slug === slug ? ' aria-current="step"' : "";
      const mark = e.step! < current.step! ? "✓" : String(e.step);
      return (
        `<li class="stepper__item ${state}"${aria}><a href="${up}${e.slug}.html">` +
        `<span class="stepper__n" aria-hidden="true">${mark}</span>` +
        `<span class="stepper__label">${escapeHtml(entryLabel(e))}</span></a></li>`
      );
    })
    .join("");
  return (
    `<nav class="stepper" aria-label="${escapeHtml(entryGroup(current)!)} — ${t("step")} ${current.step} ${t("of")} ${steps.length}">` +
    `<p class="stepper__head"><span>${escapeHtml(entryGroup(current)!)}</span>` +
    `<span>${t("step")} ${current.step} ${t("of")} ${steps.length}${current.time ? ` · ${escapeHtml(current.time)}` : ""}</span></p>` +
    `<ol class="stepper__list">${items}</ol></nav>`
  );
}

function onThisPage(headings: Page["headings"]): string {
  if (headings.length < 2) return '<div class="rail" aria-hidden="true"></div>';
  const items = headings
    .map((h) => `<li class="toc__l${h.level}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`)
    .join("");
  return (
    `<div class="rail"><nav class="toc" aria-label="${t("onThisPage")}">` +
    `<h2>${t("onThisPage")}</h2><ul>${items}</ul></nav></div>`
  );
}

/**
 * The version at the top left: a plain badge, or — when the site carries both
 * lines — a picker whose stable entry opens the stable docs and whose candidate
 * entry opens what the candidate adds (REQ-400). `up` climbs to this build's root.
 */
function versionBadge(version: string, up: string, opts: SiteOptions): string {
  const { stable, next } = opts.versions || {};
  if (!stable || !next) return `<span class="top__version">v${escapeHtml(version)}</span>`;
  const onNext = opts.channel === "next";
  const stableRoot = onNext ? `${up}../` : up;
  const nextRoot = onNext ? up : `${up}next/`;
  const entry = (href: string, v: string, note: string, current: boolean) =>
    `<a href="${href}"${current ? ' aria-current="page"' : ""}>` +
    `<strong>v${escapeHtml(v)}</strong><span>${note}</span></a>`;
  return (
    `<details class="top__version">` +
    `<summary aria-label="Documentation version">v${escapeHtml(onNext ? next : stable)}` +
    `<span class="top__version-tag">${onNext ? "candidate" : "stable"}</span></summary>` +
    `<div class="top__version-menu">` +
    entry(
      `${stableRoot}docs.html`,
      stable,
      "Stable — what <code>npm install</code> gives",
      !onNext
    ) +
    entry(`${nextRoot}whats-new-1.0.html`, next, "Release candidate — what is new in 1.0", onNext) +
    `</div></details>`
  );
}

/** Over every page of the candidate's docs: what it is, and the way back (REQ-401). */
function candidateBanner(up: string, opts: SiteOptions): string {
  const { stable, next } = opts.versions || {};
  if (opts.channel !== "next" || !stable || !next) return "";
  return (
    `<div class="candidate-banner" role="note">You are reading the documentation of ` +
    `<strong>v${escapeHtml(next)}</strong>, a release candidate — ` +
    `<code>npm i -D @rsaglobaltech/specgate@next</code>. ` +
    `<a href="${up}../docs.html">The stable documentation, v${escapeHtml(stable)} →</a></div>`
  );
}

/**
 * `EN · ES` in the header: the same page in the other language. Choosing one
 * is remembered (`specgate-lang`), so the landing opens in it next time.
 * `up` climbs to this language's root; `slug` is the page's, the same in both.
 */
export function languagePicker(slug: string, up: string, lang: Lang): string {
  const href = lang === "en" ? `${up}es/${slug}.html` : `${up}../${slug}.html`;
  const item = (l: Lang) =>
    l === lang
      ? `<span aria-current="true">${l.toUpperCase()}</span>`
      : `<a href="${href}" hreflang="${l}" lang="${l}" data-lang="${l}">${l.toUpperCase()}</a>`;
  return (
    `<nav class="top__lang" aria-label="${UI[lang].language}">` +
    LANGS.map(item).join('<span aria-hidden="true">·</span>') +
    `</nav>`
  );
}

/** Over a Spanish page: the English text it shows, or a translation behind the English. */
function translationBanner(page: Page, up: string): string {
  if (LANG !== "es" || !page.translation || page.translation === "current") return "";
  const english = `${up}../${page.slug}.html`;
  return page.translation === "missing"
    ? `<div class="candidate-banner" role="note">Esta página aún no está traducida: la ves en inglés. ` +
        `<a href="${english}" hreflang="en">Ir a la versión en inglés →</a></div>`
    : `<div class="candidate-banner" role="note">La versión en inglés de esta página es más reciente que esta traducción. ` +
        `<a href="${english}" hreflang="en">Leer la versión en inglés →</a></div>`;
}

function pageShell(page: Page, version: string, opts: SiteOptions = {}): string {
  const entry = navEntry(page.slug);
  const { prev, next } = neighbours(page.slug);
  const depth = page.slug.split("/").length - 1;
  const up = "../".repeat(depth);
  // The assets live once, at the site's root: a Spanish page climbs out of `es/`.
  const assets = LANG === "es" ? `${up}../assets/` : `${up}assets/`;
  const link = (slug: string) => `${up}${slug}.html`;
  const description = escapeHtml((entry && entryBlurb(entry)) || page.title);

  const pager = [
    prev
      ? `<a class="pager__prev" href="${link(prev.slug)}"><span>${t("previous")}</span>${escapeHtml(entryLabel(prev))}</a>`
      : "<span></span>",
    next
      ? `<a class="pager__next" href="${link(next.slug)}"><span>${t("next")}</span>${escapeHtml(entryLabel(next))}</a>`
      : "<span></span>",
  ].join("");

  return `<!doctype html>
<html lang="${LANG}" data-slug="${escapeHtml(page.slug)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)} — Specgate</title>
<meta name="description" content="${description}">
<link rel="alternate" hreflang="en" href="${SITE}/${escapeHtml(page.slug)}.html">
<link rel="alternate" hreflang="es" href="${SITE}/es/${escapeHtml(page.slug)}.html">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="icon" href="${assets}favicon.svg" type="image/svg+xml">
<meta property="og:title" content="${escapeHtml(page.title)} — Specgate">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${SITE}/assets/og-card.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="${assets}docs.css">
<script>
  // Applied before paint so the page never flashes the wrong theme.
  (function () {
    var t = localStorage.getItem("specgate-theme");
    if (t) document.documentElement.setAttribute("data-theme", t);
  })();
</script>
</head>
<body>
<a class="skip" href="#content">${t("skip")}</a>

<header class="top">
  <button class="top__menu" type="button" aria-label="${t("openNav")}" aria-expanded="false">
    <span aria-hidden="true">☰</span>
  </button>
  <a class="top__brand" href="${up}index.html"><span aria-hidden="true">⬡</span> specgate<span class="top__brand-sub">/docs</span></a>
  ${versionBadge(version, up, opts)}
  <button class="top__search" id="search" type="button" aria-label="${t("searchLabel")}"
          aria-keyshortcuts="Meta+K Control+K">
    ${icon("search", "icon")}
    <span class="top__search-label">${t("search")}</span>
    <kbd class="top__kbd"><span class="top__kbd-mod">⌘</span>K</kbd>
  </button>
  <nav class="top__links">
    <a href="${up}docs.html">${t("docs")}</a>
    <a href="${up}projects/index.html">${t("projects")}</a>
    <a href="${REPO}" target="_blank" rel="noreferrer">GitHub</a>
    <a href="https://www.npmjs.com/package/@rsaglobaltech/specgate" target="_blank" rel="noreferrer">npm</a>
  </nav>
  ${languagePicker(page.slug, up, LANG)}
  <button class="top__theme" type="button" aria-label="${t("theme")}">◐</button>
</header>

<div class="shell">
  <aside class="side" id="side">
    <nav aria-label="${t("documentation")}">${sidebar(page.slug, up)}</nav>
  </aside>

  <main class="content" id="content">
    ${candidateBanner(up, opts)}
    ${translationBanner(page, up)}
    ${breadcrumbs(page.slug, up)}
    ${stepper(page.slug, up)}
    <article class="prose">
${page.html}
    </article>
    <nav class="pager" aria-label="${t("neighbours")}">${pager}</nav>
    <footer class="page-foot">
      <p class="page-foot__ask">${t("useful")}</p>
      <a href="${REPO}/edit/${opts.channel === "next" ? "next/1.0" : "main"}/docs/${LANG === "es" && page.translation !== "missing" ? "es/" : ""}${escapeHtml(page.slug)}.md" target="_blank" rel="noreferrer">${t("edit")}</a>
      <span aria-hidden="true">·</span>
      <a href="${REPO}/issues/new" target="_blank" rel="noreferrer">${t("issue")}</a>
    </footer>
  </main>

  ${onThisPage(page.headings)}
</div>

<div class="palette" id="palette" hidden>
  <div class="palette__scrim" data-close="1"></div>
  <div class="palette__box" role="dialog" aria-modal="true" aria-label="${t("searchLabel")}">
    <div class="palette__field">
      ${icon("search", "icon")}
      <input type="search" id="palette-input" placeholder="${t("searchPlaceholder")}"
             autocomplete="off" spellcheck="false" aria-label="${t("searchLabel")}"
             aria-controls="results" aria-expanded="true">
      <kbd class="palette__esc">Esc</kbd>
    </div>
    <div class="palette__results" id="results" role="listbox" aria-label="${t("results")}"></div>
    <p class="palette__hint">
      ${t("hint")}
    </p>
  </div>
</div>

<script src="${assets}docs.js" defer></script>
</body>
</html>
`;
}

// ── Walking the source ───────────────────────────────────────────────────────

function markdownFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...markdownFiles(full, rel));
    } else if (entry.name.endsWith(".md")) {
      out.push(rel.slice(0, -3));
    }
  }
  return out.sort();
}

/**
 * The hand-written parts of the site, copied across.
 *
 * `index.html` gets one transformation on the way: its `specgate:diagram` markers
 * are resolved, the same way a markdown page's are. The diagram is a source
 * file in the repository and the marker is one line, so there is nothing to go
 * stale between them — unlike the terminal recording, which needs the CLI to
 * regenerate and is therefore committed into the file rather than injected here.
 */
function copyVerbatim(
  outDir: string,
  available: Map<string, string>,
  version: string,
  opts: SiteOptions
): void {
  for (const name of VERBATIM) {
    const from = path.join(DOCS, name);
    if (!fs.existsSync(from)) continue;
    if (name === "index.html") {
      fs.writeFileSync(
        path.join(outDir, name),
        inlineDiagrams(fs.readFileSync(from, "utf8"), available).replace(
          /<span class="top__version">[^<]*<\/span>/,
          () => versionBadge(version, "", opts)
        ),
        "utf8"
      );
      continue;
    }
    fs.cpSync(from, path.join(outDir, name), { recursive: true });
  }
}

/**
 * The documentation home — every section, every page, one line each.
 *
 * The site had no such page. `index.html` is the marketing landing, so a reader
 * who wanted the documentation had nowhere to land and no way to see what
 * existed. Generated rather than hand-written, so a page added to `NAV` appears
 * here without anybody remembering to add it twice.
 */
function docsHome(version: string, opts: SiteOptions): string {
  const groups = NAV.map((section) => {
    const cards = section.entries
      .map(
        (entry) =>
          `<a class="card" href="${entry.slug}.html">` +
          `<strong class="card__title">${escapeHtml(entryLabel(entry))}</strong>` +
          `<span class="card__body">${escapeHtml(entryBlurb(entry))}</span></a>`
      )
      .join("");
    return (
      `<section class="home__group">` +
      `<h2>${icon(section.icon, "icon")}${escapeHtml(sectionTitle(section))}</h2>` +
      `<p class="home__summary">${escapeHtml(sectionSummary(section))}</p>` +
      `<div class="cards" data-cols="2">${cards}</div></section>`
    );
  }).join("");

  const page: Page = {
    slug: "docs",
    title: t("docsTitle"),
    headings: NAV.map((section) => ({
      id: slugifyHeading(sectionTitle(section), new Set()),
      text: sectionTitle(section),
      level: 2,
    })),
    text: "",
    html:
      `<h1>${t("docsTitle")}</h1>` +
      `<p class="home__lede">${t("docsLede")}</p>` +
      `<figure class="code" data-lang="bash">` +
      `<figcaption class="code__head"><span class="code__lang">${t("install")}</span>` +
      `<button class="code__copy" type="button" aria-label="Copy to clipboard">${t("copy")}</button>` +
      `</figcaption>` +
      `<pre><code class="language-bash">npx @rsaglobaltech/specgate@latest init</code></pre>` +
      `</figure>` +
      `<div class="home">${groups}</div>`,
  };
  return pageShell(page, version, opts);
}

/** Markdown reduced to prose: no fences, no marker punctuation. */
function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/[#*`>|_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * One search record per `##`/`###` section, carrying the anchor to jump to.
 *
 * Split on the heading text rather than re-parsing: `headings` already holds
 * the ids `renderMarkdown` minted, so the two cannot drift apart.
 */
function sectionChunks(
  markdown: string,
  headings: Page["headings"]
): Array<{ section: string; hash: string; text: string }> {
  const out: Array<{ section: string; hash: string; text: string }> = [];
  const lines = markdown.split("\n");

  let current: { section: string; hash: string; body: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const text = plainText(current.body.join("\n")).slice(0, 600);
    if (text) out.push({ section: current.section, hash: current.hash, text });
  };

  for (const line of lines) {
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      const plain = stripTags(m[2]).replace(/`/g, "");
      const heading = headings.find((h) => h.text === plain);
      current = heading ? { section: plain, hash: heading.id, body: [] } : null;
      continue;
    }
    if (current) current.body.push(line);
  }
  flush();
  return out;
}

type SearchRecord = { slug: string; title: string; section?: string; hash?: string; text: string };

/** One markdown page rendered into `outDir`, its search records added to `index`. */
function renderPage(
  slug: string,
  source: string,
  outDir: string,
  index: SearchRecord[],
  available: ReturnType<typeof diagrams>,
  version: string,
  opts: SiteOptions,
  translation?: Page["translation"]
): void {
  // The marker is ours and means nothing to a reader.
  const cleaned = inlineDiagrams(
    source.replace(/^<!--\s*specgate:allow-placeholders[^>]*-->\s*\n?/gm, ""),
    available
  );
  // Components expand before `marked` sees the source, and are handed the
  // site's own renderer so a tab can hold a code block and a callout a list.
  const expanded = expandComponents(
    cleaned,
    slug,
    (md) => renderMarkdown(md, slug).html,
    (href) => rewriteLink(href, slug)
  );
  const { html, headings, title } = renderMarkdown(expanded, slug);
  const entry = navEntry(slug);
  const page: Page = {
    slug,
    title: title || (entry && entryLabel(entry)) || slug,
    html,
    headings,
    text: plainText(cleaned).slice(0, 2000),
    translation,
  };

  const target = path.join(outDir, `${slug}.html`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, pageShell(page, version, opts), "utf8");

  index.push({ slug, title: page.title, text: page.text });
  for (const chunk of sectionChunks(cleaned, headings)) {
    index.push({ slug, title: page.title, ...chunk });
  }
}

/** The pages a Spanish build shows, and how far each one is translated. */
export interface TranslationReport {
  readonly translated: string[];
  readonly stale: string[];
  readonly missing: string[];
}

export function buildSite(
  outDir: string,
  opts: SiteOptions = {}
): { pages: number; orphans: string[]; translation: TranslationReport } {
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // `docs/es/` holds the Spanish pages: built below, under `es/`, not as English pages.
  const slugs = markdownFiles(DOCS).filter((slug) => !slug.startsWith("es/"));
  // One record per *section*, not per page. A search that can only answer
  // "which page" is close to useless on `tutorial.md`, which is 1075 lines; a
  // record per heading lands the reader on the paragraph they asked for.
  const index: SearchRecord[] = [];
  const available = diagrams(DOCS);

  LANG = "en";
  for (const slug of slugs) {
    const source = fs.readFileSync(path.join(DOCS, `${slug}.md`), "utf8");
    renderPage(slug, source, outDir, index, available, version, opts);
  }
  fs.writeFileSync(path.join(outDir, "docs.html"), docsHome(version, opts), "utf8");
  fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(outDir, "assets", "search-index.json"), JSON.stringify(index), "utf8");
  copyVerbatim(outDir, available, version, opts);

  // Spanish: every guide, from its translation when there is one, else from
  // the English text with a note. `docs/specs/` stays English, at the root.
  const translation = buildSpanish(outDir, slugs, available, version, opts);
  LANG = "en";

  fs.writeFileSync(path.join(outDir, ".nojekyll"), "", "utf8");

  // Depth used to exempt a page, which is how `articles/` and `case-studies/`
  // stayed published and unreachable. `docs/specs/` is the one real exception:
  // those pages are the project's own specifications, published so the links
  // that reference them resolve, and deliberately not in a reader's sidebar.
  const orphans = slugs.filter((slug) => !navEntry(slug) && !slug.startsWith("specs/"));
  return { pages: slugs.length, orphans, translation };
}

/** `es/`: the guides in Spanish, the docs home, the landing, and their search index. */
function buildSpanish(
  outDir: string,
  slugs: string[],
  available: ReturnType<typeof diagrams>,
  version: string,
  opts: SiteOptions
): TranslationReport {
  LANG = "es";
  const esDir = path.join(outDir, "es");
  const index: SearchRecord[] = [];
  const report = { translated: [] as string[], stale: [] as string[], missing: [] as string[] };
  const guides = slugs.filter((s) => !s.startsWith("specs/"));
  // First every translated page's anchors, English → Spanish, so a link from
  // any page — translated or not — can be pointed at the Spanish heading.
  SPANISH_ANCHORS.clear();
  for (const slug of guides) {
    const file = path.join(DOCS, "es", `${slug}.md`);
    if (!fs.existsSync(file)) continue;
    const english = renderMarkdown(
      fs.readFileSync(path.join(DOCS, `${slug}.md`), "utf8"),
      slug
    ).ids;
    const spanish = renderMarkdown(translationOf("", fs.readFileSync(file, "utf8")).body, slug).ids;
    if (english.length !== spanish.length) {
      process.stderr.write(
        `⚠️  [docs] es/${slug}.md has ${spanish.length} headings and its English ${english.length}: links into it keep their anchors\n`
      );
      continue;
    }
    SPANISH_ANCHORS.set(slug, new Map(english.map((id, i) => [id, spanish[i]])));
  }
  for (const slug of guides) {
    const english = fs.readFileSync(path.join(DOCS, `${slug}.md`), "utf8");
    const file = path.join(DOCS, "es", `${slug}.md`);
    const spanish = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    const state = translationOf(english, spanish);
    report[state.status === "current" ? "translated" : state.status].push(slug);
    renderPage(slug, state.body, esDir, index, available, version, opts, state.status);
  }
  fs.writeFileSync(path.join(esDir, "docs.html"), docsHome(version, opts), "utf8");
  fs.mkdirSync(path.join(esDir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(esDir, "assets", "search-index.json"), JSON.stringify(index), "utf8");

  // The landing: written with the root's paths, served one level down.
  const landing = path.join(DOCS, "es", "index.html");
  if (fs.existsSync(landing)) {
    const html = inlineDiagrams(fs.readFileSync(landing, "utf8"), available)
      .replace(/(href|src|data-term-src)="\.\/assets\//g, '$1="../assets/')
      .replace(/<span class="top__version">[^<]*<\/span>/, () => versionBadge(version, "", opts));
    fs.writeFileSync(path.join(esDir, "index.html"), html, "utf8");
  }
  return report;
}

if (require.main === module) {
  const at = process.argv.indexOf("--out");
  const outDir = at !== -1 ? process.argv[at + 1] : path.join(ROOT, "_site");
  // `--channel next --versions stable=0.27.9,next=1.0.0-rc.8`: what pages.yml
  // passes to each of the two builds of the site (REQ-400, REQ-401).
  const arg = (name: string) => {
    const i = process.argv.indexOf(name);
    return i !== -1 ? process.argv[i + 1] : undefined;
  };
  const versions = Object.fromEntries(
    (arg("--versions") || "")
      .split(",")
      .map((pair) => pair.split("="))
      .filter((pair) => pair.length === 2 && pair[1])
  );
  const channel = arg("--channel") === "next" ? "next" : "stable";
  const { pages, orphans, translation } = buildSite(path.resolve(outDir), { channel, versions });
  process.stdout.write(`ℹ️  [docs] rendered ${pages} page(s) into ${outDir}\n`);
  process.stdout.write(
    `ℹ️  [docs] Spanish: ${translation.translated.length} translated, ${translation.stale.length} behind the English, ${translation.missing.length} not translated yet\n`
  );
  if (translation.stale.length > 0) {
    process.stdout.write(
      `⚠️  [docs] Spanish pages behind their English source: ${translation.stale.join(", ")}\n`
    );
  }
  if (orphans.length > 0) {
    process.stdout.write(
      `⚠️  [docs] not in the sidebar, so nobody can navigate to them: ${orphans.join(", ")}\n`
    );
  }
}
