"use strict";

/**
 * The documentation site, checked the way the gate checks everything else.
 *
 * ## Why this file exists
 *
 * `https://rsaglobaltech.github.io/specgate/` returned
 * 404 for months: the workflow deployed to `gh-pages` on every push and nobody
 * had ever switched Pages on. Underneath that, the site published twenty
 * markdown documents as `text/markdown`, so a reader who followed a link got
 * the source — and the landing page linked to four of them, leaving sixteen
 * unreachable.
 *
 * None of it was detectable from the repository, because nothing looked. These
 * tests look.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const DOCS = path.join(ROOT, "docs");

const { buildSite } = require("../../scripts/docs/build-site");
const { NAV, navEntry, navSlugs, neighbours } = require("../../scripts/docs/nav");

/** Build the site once; every test reads the same output. */
function site() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "csda-site-"));
  const result = buildSite(dir);
  return { dir, ...result };
}

// ── Navigation ───────────────────────────────────────────────────────────────

/** Every markdown file the site publishes, `docs/specs/` excluded, at any depth. */
function shippedSlugs() {
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name !== "specs" && entry.name !== "assets")
          walk(path.join(dir, entry.name), rel);
      } else if (entry.name.endsWith(".md")) {
        out.push(rel.slice(0, -3));
      }
    }
  };
  walk(DOCS, "");
  return out.sort();
}

test("every shipped document is reachable from the sidebar", () => {
  // A page nobody can navigate to is a page nobody reads. Sixteen were in that
  // state before this test existed — and two more survived it, because the walk
  // only looked at the top level while `articles/` and `case-studies/` sat one
  // directory down.
  const shipped = shippedSlugs();

  const orphans = shipped.filter((slug) => !navEntry(slug));
  assert.deepEqual(
    orphans,
    [],
    `These documents are published and unreachable. Add them to scripts/docs/nav.ts:\n  ${orphans.join("\n  ")}`
  );
});

test("the sidebar does not promise a page that is not there", () => {
  const missing = navSlugs().filter((slug) => !fs.existsSync(path.join(DOCS, `${slug}.md`)));
  assert.deepEqual(
    missing,
    [],
    `nav.ts links to documents that do not exist: ${missing.join(", ")}`
  );
});

test("every navigation entry carries a label and a blurb", () => {
  // The blurb is what the documentation home shows under each link. An entry
  // without one renders a card that says nothing.
  for (const section of NAV) {
    assert.ok(section.title.trim(), "a section with no title");
    assert.ok(section.summary.trim(), `${section.title}: no summary`);
    for (const entry of section.entries) {
      assert.ok(entry.label.trim(), `${entry.slug}: no label`);
      assert.ok(entry.blurb.trim(), `${entry.slug}: no blurb`);
    }
  }
});

test("reading order has no gaps at either end", () => {
  const slugs = navSlugs();
  assert.equal(neighbours(slugs[0]).prev, null);
  assert.equal(neighbours(slugs[slugs.length - 1]).next, null);
  assert.equal(neighbours(slugs[1]).prev.slug, slugs[0]);
});

// ── Rendering ────────────────────────────────────────────────────────────────

test("every document renders to HTML, not to markdown source", () => {
  const { dir, pages } = site();
  try {
    assert.ok(pages >= 20, `expected the shipped corpus, rendered ${pages}`);

    const harness = fs.readFileSync(path.join(dir, "harness.html"), "utf8");
    assert.match(harness, /<h1 id="[^"]+">/, "no rendered heading");
    assert.match(harness, /<figure class="code"/, "no rendered code block");
    assert.doesNotMatch(
      harness,
      /^# The harness$/m,
      "raw markdown reached the page — this is exactly what the old site served"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("internal links point at pages the site publishes", () => {
  // `[the harness](./harness.md)` has to become `harness.html`. Left alone, every
  // internal link dropped the reader back into raw source.
  const { dir } = site();
  try {
    const html = fs.readFileSync(path.join(dir, "getting-started.html"), "utf8");
    const links = [...html.matchAll(/href="([^"#:][^":]*)"/g)].map((m) => m[1]);
    const local = links.filter((h) => !/^https?:/.test(h) && !h.startsWith("#"));

    const broken = local
      .map((h) => h.split("#")[0])
      .filter(Boolean)
      .filter((h) => !h.endsWith("/"))
      .filter((h) => !fs.existsSync(path.join(dir, h)));

    assert.deepEqual(broken, [], `links to nothing: ${broken.join(", ")}`);
    assert.ok(!local.some((h) => h.endsWith(".md")), "an internal link still points at a .md file");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a link that climbs out of docs/ goes to GitHub, not to a page that never existed", () => {
  // `../SECURITY.md` is a repository file. Rewriting it to `../SECURITY.html`
  // invented a page; sending it to GitHub is the honest destination.
  const { dir } = site();
  try {
    const html = fs.readFileSync(path.join(dir, "supply-chain.html"), "utf8");
    assert.match(html, /href="https:\/\/github\.com\/[^"]+\/blob\/main\/SECURITY\.md/);
    assert.doesNotMatch(html, /href="\.\.\/SECURITY\.html"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("every page carries the shell: sidebar, search and a way back", () => {
  // Each of these was added deliberately and is invisible from the outside:
  // nothing else notices when a redesign quietly drops the breadcrumbs or the
  // contents rail, which is precisely why they are pinned here.
  const { dir } = site();
  try {
    for (const slug of ["harness", "commands", "tutorial"]) {
      const html = fs.readFileSync(path.join(dir, `${slug}.html`), "utf8");
      assert.match(html, /<aside class="side"/, `${slug}: no sidebar`);
      assert.match(html, /id="search"/, `${slug}: no search`);
      assert.match(html, /class="top__brand"/, `${slug}: no way back to the home page`);
      assert.match(html, /Edit this page/, `${slug}: no edit link`);
      assert.match(html, /<nav class="crumbs"/, `${slug}: no breadcrumbs`);
      assert.match(html, /<div class="rail"/, `${slug}: no contents rail`);
      assert.match(html, /id="palette"/, `${slug}: no search palette`);
      assert.match(html, /aria-keyshortcuts="Meta\+K Control\+K"/, `${slug}: no ⌘K hint`);
      assert.match(html, /<details class="side__group"/, `${slug}: sidebar groups do not collapse`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the landing page still names the daily loop and what each step does", () => {
  // A redesign moved this section from a numbered list to a staged journey and
  // silently dropped two of its commands along the way: the page kept its
  // shape and lost the thing it was for. A visual review does not catch that,
  // so the loop is pinned here — the five daily commands since 0.13, and the
  // harness that hands the same loop to an agent.
  const html = fs.readFileSync(path.join(ROOT, "docs", "index.html"), "utf8");
  for (const command of [
    "specgate status",
    "specgate new",
    "specgate done",
    "specgate check",
    "specgate harness run",
    "specgate init",
  ]) {
    assert.match(
      html,
      new RegExp(`<code>${command}</code>`),
      `the landing page no longer names \`${command}\``
    );
  }

  // What each one is for, not only that it exists.
  assert.match(html, /the single next\s+command to run/);
  assert.match(html, /marks it Implemented only if it\s+passes/);
  assert.match(html, /This is what CI runs/);
  assert.match(html, /stops if the gate says no/);
});

test("the landing page keeps the claims a reader decides on", () => {
  // Three facts an evaluator checks before reading anything else. They are
  // cheap to drop in a redesign and expensive to notice missing.
  const html = fs.readFileSync(path.join(ROOT, "docs", "index.html"), "utf8");
  for (const claim of ["Zero runtime dependencies", "Any agent CLI", "MIT"]) {
    assert.ok(html.includes(claim), `the landing page no longer claims: ${claim}`);
  }
});

test("no two links on the landing page share a label and disagree on the target", () => {
  // `Quickstart` pointed at `getting-started.html` while the sidebar's
  // `Quickstart` pointed at `quickstart.html` — a different page for a
  // different reader. Same word, two destinations, on the front door.
  // Repeated until it stops changing: one pass of `/<[^>]*>/g` leaves a nested
  // or malformed tag behind, which CodeQL reports as
  // `js/incomplete-multi-character-sanitization`. `build-site.ts` strips tags
  // the same way and for the same reason.
  const stripTags = (value: string) => {
    let out = value;
    let previous;
    do {
      previous = out;
      out = out.replace(/<[^>]*>/g, "");
    } while (out !== previous);
    return out;
  };

  const html = fs.readFileSync(path.join(ROOT, "docs", "index.html"), "utf8");
  const byLabel = new Map<string, Set<string>>();
  for (const m of html.matchAll(/<a [^>]*href="(\.\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const label = stripTags(m[2]).replace(/\s+/g, " ").trim();
    if (!label || label.length > 40) continue;
    if (!byLabel.has(label)) byLabel.set(label, new Set());
    byLabel.get(label)!.add(m[1].split("#")[0]);
  }
  const clashes = [...byLabel].filter(([, targets]) => targets.size > 1);
  assert.deepEqual(
    clashes.map(([label, t]) => `${label} → ${[...t].join(" / ")}`),
    [],
    "the same label points at two different pages"
  );
});

test("the landing page can be searched too", () => {
  // The front page is where most readers arrive and where the first question
  // gets asked. It is hand-written, so it does not inherit the generated shell
  // and has to carry the palette itself.
  const html = fs.readFileSync(path.join(ROOT, "docs", "index.html"), "utf8");
  assert.match(html, /id="search"/, "no search trigger");
  assert.match(html, /id="palette"/, "no search palette");
  assert.match(html, /id="palette-input"/, "the palette has no input");
  assert.match(html, /id="results"/, "the palette has nowhere to put results");
});

test("the sidebar opens the group holding the page you are on", () => {
  // A remembered fold is a good thing until it hides where the reader already
  // is. The generator forces the current group open; the script only restores
  // the others.
  const { dir } = site();
  try {
    const html = fs.readFileSync(path.join(dir, "harness.html"), "utf8");
    assert.match(
      html,
      /<details class="side__group" data-group="Agents and the harness" open>/,
      "the current page's group is not open"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("code blocks are highlighted and labelled", () => {
  // Highlighting happens at build time, so the page needs no JavaScript to be
  // readable — and a block that carries a label is one a reader can tell from
  // the five below it.
  const { dir } = site();
  try {
    const html = fs.readFileSync(path.join(dir, "getting-started.html"), "utf8");
    assert.match(html, /<figcaption class="code__head">/, "no code block header");
    assert.match(html, /<span class="code__lang">/, "no language label");
    assert.match(html, /<span class="tok tok--/, "nothing was highlighted");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the search index carries sections, not only pages", () => {
  // A hit that can only say "somewhere in tutorial.md" is barely a hit: that
  // page is over a thousand lines. Every section record carries the anchor.
  const { dir } = site();
  try {
    const index = JSON.parse(
      fs.readFileSync(path.join(dir, "assets", "search-index.json"), "utf8")
    );
    const sections = index.filter((r: any) => r.section);
    assert.ok(sections.length > index.length / 2, "most records should be sections");
    for (const record of sections) {
      assert.ok(record.hash, `${record.slug}: section record with no anchor`);
      assert.ok(record.text, `${record.slug}#${record.hash}: section record with no text`);
    }
    const deep = index.filter((r: any) => r.slug === "tutorial" && r.section);
    assert.ok(deep.length >= 5, "the longest page should be indexed section by section");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the documentation home lists every section and every page", () => {
  const { dir } = site();
  try {
    const html = fs.readFileSync(path.join(dir, "docs.html"), "utf8");
    for (const section of NAV) {
      assert.ok(html.includes(section.title), `docs home is missing "${section.title}"`);
      for (const entry of section.entries) {
        assert.ok(
          html.includes(`href="${entry.slug}.html"`),
          `docs home does not link to ${entry.slug}`
        );
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the search index covers what the sidebar offers", () => {
  const { dir } = site();
  try {
    const index = JSON.parse(fs.readFileSync(path.join(dir, "assets/search-index.json"), "utf8"));
    const indexed = new Set(index.map((e) => e.slug));
    const missing = navSlugs().filter((slug) => !indexed.has(slug));
    assert.deepEqual(missing, [], `not searchable: ${missing.join(", ")}`);
    assert.ok(
      index.every((e) => e.title && e.text !== undefined),
      "a search entry with no title"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the assets the pages ask for are published", () => {
  const { dir } = site();
  try {
    for (const asset of [
      "assets/docs.css",
      "assets/docs.js",
      "assets/home.css",
      "assets/terminal.css",
      "assets/terminal-demo.json",
      "index.html",
    ]) {
      assert.ok(fs.existsSync(path.join(dir, asset)), `missing ${asset}`);
    }
    // Jekyll would eat the assets directory and any file starting with an
    // underscore; GitHub Pages needs telling.
    assert.ok(fs.existsSync(path.join(dir, ".nojekyll")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("no page on the site links a reader to a raw markdown file", () => {
  // The complaint that started this: following a link landed you on
  // `text/markdown`, unstyled, mid-source. A link to a `.md` is only allowed
  // when it leaves for GitHub, where the file genuinely lives.
  const { dir } = site();
  try {
    const offenders = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".html"))) {
      const html = fs.readFileSync(path.join(dir, file), "utf8");
      for (const match of html.matchAll(/href="([^"]*\.md(?:#[^"]*)?)"/g)) {
        if (!match[1].startsWith("https://github.com/")) offenders.push(`${file} → ${match[1]}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `these send a reader to raw markdown:\n  ${offenders.join("\n  ")}`
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the ROI calculator is gone, and nothing still points at it", () => {
  // Removed on request: a page that estimates a saving is a sales artefact, and
  // it was the only one written in a different voice.
  const { dir } = site();
  try {
    assert.equal(fs.existsSync(path.join(dir, "roi.html")), false);
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".html"))) {
      const html = fs.readFileSync(path.join(dir, file), "utf8");
      assert.ok(!html.includes("roi.html"), `${file} still links to the ROI page`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── The landing page ─────────────────────────────────────────────────────────

test("the landing page states the version this repository is on", () => {
  // It said v0.1.0-beta.3 and "178 Tests Passing" while the repository was on
  // 0.7.0. A number nobody updates is worse than no number.
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
  const html = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
  assert.ok(
    html.includes(`v${version}`),
    `the landing page does not mention v${version} — update docs/index.html when cutting a release`
  );
});

test("the landing page routes to the documentation", () => {
  // It linked to four documents out of twenty and had no route to the rest.
  const html = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
  for (const target of ["./docs.html", "./getting-started.html", "./harness.html"]) {
    assert.ok(html.includes(`href="${target}"`), `the landing page does not link to ${target}`);
  }
});

test("the landing page counts what the repository actually has", () => {
  // Every figure on that page is checkable, so it is checked.
  const html = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
  // Count what a pack is: a directory carrying a pack.yaml.
  const packsRoot = path.join(ROOT, "packs");
  const packs = fs
    .readdirSync(packsRoot)
    .filter((domain) => fs.statSync(path.join(packsRoot, domain)).isDirectory())
    .flatMap((domain) =>
      fs
        .readdirSync(path.join(packsRoot, domain))
        .filter((type) => fs.existsSync(path.join(packsRoot, domain, type, "pack.yaml")))
    ).length;
  assert.ok(packs >= 10, `expected the curated packs, counted ${packs}`);

  const { SURFACE } = require("../../scripts/lib/surface");
  // Commands a person can reach, which is what the stat beside it claims.
  // `merge-traceability` is plumbing git invokes as a merge driver: no help
  // entry, no subcommands, no JSON mode. Counting it would make the sentence
  // next to the number false.
  const userFacing = SURFACE.filter((c: any) => c.help || c.subcommands).length;
  assert.ok(html.includes(`<dt>${userFacing}</dt>`), `command count is not ${userFacing}`);
  assert.ok(html.includes(`<dt>${packs}</dt>`), `pack count is not ${packs}`);
  assert.ok(html.includes("<dt>0</dt>"), "the zero-runtime-dependencies claim is missing");
});

// ── Diagrams ─────────────────────────────────────────────────────────────────

test("no page ships a mermaid block, because nothing on this site renders one", () => {
  // Two `graph LR` / `sequenceDiagram` blocks sat in the article for months and
  // were served as literal code. A fenced block the site cannot render is worse
  // than no diagram: it is a diagram the reader can see was meant to be there.
  const offenders = [];
  for (const slug of shippedSlugs()) {
    const source = fs.readFileSync(path.join(DOCS, `${slug}.md`), "utf8");
    if (/^```mermaid/m.test(source)) offenders.push(slug);
  }
  assert.deepEqual(
    offenders,
    [],
    `Replace the block with a diagram in docs/diagrams/ and a\n` +
      `  <!-- csda:diagram NAME --> marker:\n  ${offenders.join("\n  ")}`
  );
});

test("every diagram the pages ask for exists, and every diagram is asked for", () => {
  const { diagrams } = require("../../scripts/docs/blocks");
  const available = diagrams(DOCS);
  assert.ok(available.size > 0, "found no diagrams — docs/diagrams/ is missing");

  const requested = new Set();
  const sources = [
    ...shippedSlugs().map((slug) => fs.readFileSync(path.join(DOCS, `${slug}.md`), "utf8")),
    fs.readFileSync(path.join(DOCS, "index.html"), "utf8"),
  ];
  for (const source of sources) {
    for (const m of source.matchAll(/<!--\s*csda:diagram\s+([a-z0-9-]+)\s*-->/g))
      requested.add(m[1]);
  }

  const missing = [...requested].filter((name) => !available.has(name)).sort();
  assert.deepEqual(missing, [], `asked for but not in docs/diagrams/: ${missing.join(", ")}`);

  // The other direction: a diagram nobody shows is 3 KB published for nothing,
  // and is how the last two dead stylesheets got there.
  const unused = [...available.keys()].filter((name) => !requested.has(name)).sort();
  assert.deepEqual(unused, [], `in docs/diagrams/ and shown nowhere: ${unused.join(", ")}`);
});

test("an inlined diagram reaches the page as markup, not as escaped text", () => {
  const { dir } = site();
  const article = fs.readFileSync(path.join(dir, "articles", "specs-that-cannot-lie.html"), "utf8");
  assert.match(article, /<svg[^>]+class="dia__svg"/, "the harness loop did not inline");
  assert.match(article, /class="chain__n"/, "the traceability chain did not inline");
  assert.doesNotMatch(article, /&lt;svg/, "the diagram was escaped instead of inlined");
});

test("no page shows a diagram's markup as text", () => {
  // A blank line inside a diagram ended the HTML block, and everything after
  // it rendered as a code block of escaped SVG — on domain-packs and in the
  // article. Checking for an escaped `<svg` missed it: the opening tag was
  // fine, the rest was text.
  const { dir } = site();
  const offenders = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (
        e.name.endsWith(".html") &&
        /&lt;(defs&gt;|marker id=|rect x=|path d=|text x=|g class=)/.test(
          fs.readFileSync(p, "utf8")
        )
      )
        offenders.push(path.relative(dir, p));
    }
  };
  walk(dir);
  assert.deepEqual(offenders, [], `escaped diagram markup in: ${offenders.join(", ")}`);
});

test("a diagram's colours come from the token system", () => {
  // An inline diagram is the only place on the site where a hard-coded hex
  // would still follow the page in one theme and not the other.
  const { diagrams } = require("../../scripts/docs/blocks");
  const offenders = [];
  for (const [name, body] of diagrams(DOCS)) {
    const hexes = body.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    if (hexes.length > 0) offenders.push(`${name}: ${hexes.join(", ")}`);
  }
  assert.deepEqual(offenders, [], `use var(--…) instead:\n  ${offenders.join("\n  ")}`);
});

test("every csda command the landing page names is a command the CLI has", () => {
  // Written after the page claimed `csda sbom` and `csda license check`, neither
  // of which exists — the SBOM is an npm script and a CI job. A landing page
  // that invents commands is worse than one that says less.
  const { SURFACE } = require("../../scripts/lib/surface");
  const known = new Set();
  for (const command of SURFACE) {
    known.add(command.name);
    for (const sub of command.subcommands || []) known.add(`${command.name} ${sub.name}`);
  }

  const html = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
  const invented = new Set();
  for (const m of html.matchAll(/<code[^>]*>csda ([a-z][a-z0-9 -]*)/g)) {
    const words = m[1].trim().split(/\s+/);
    // Longest match wins: `harness run --req` is `harness run`.
    const named = known.has(`${words[0]} ${words[1]}`) ? `${words[0]} ${words[1]}` : words[0];
    if (!known.has(named)) invented.add(named);
  }
  assert.deepEqual(
    [...invented].sort(),
    [],
    `the landing page names commands that do not exist: ${[...invented].join(", ")}`
  );
});

test("the landing page lists every agent tool it claims a number for", () => {
  const { ALL_TOOLS } = require("../../scripts/agents/init");
  const html = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
  assert.ok(
    html.includes(`<dt>${ALL_TOOLS.length}</dt>`),
    `agent-tool count is not ${ALL_TOOLS.length}`
  );
  const missing = ALL_TOOLS.filter((tool) => !html.includes(`<code>${tool}</code>`));
  assert.deepEqual(missing, [], `counted but not listed: ${missing.join(", ")}`);
});

test("the project wears one mark everywhere", () => {
  // The README said 🧭 and the site said ⬡ — two brands for one product, and
  // nothing would ever have reported it.
  const MARK = "⬡";
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8").split("\n")[2];
  assert.ok(readme.includes(MARK), `the README heading no longer carries ${MARK}: ${readme}`);
  const html = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
  assert.ok(
    html.includes(`<span aria-hidden="true">${MARK}</span>`),
    "the site header lost its mark"
  );
});

test("the social card and the favicon are published, and the pages point at them", () => {
  const { dir } = site();
  try {
    for (const asset of ["assets/favicon.svg", "assets/og-card.svg"]) {
      assert.ok(fs.existsSync(path.join(dir, asset)), `missing ${asset}`);
    }
    // The PNG is rasterised in the Pages workflow, so only the SVG is here —
    // but every page must already ask for the PNG, or the card never appears.
    for (const page of ["index.html", "getting-started.html", "case-studies/case-1.html"]) {
      const html = fs.readFileSync(path.join(dir, page), "utf8");
      assert.match(html, /rel="icon"[^>]+favicon\.svg/, `${page} has no favicon`);
      assert.match(html, /property="og:image"[^>]+og-card\.png/, `${page} has no social card`);
    }
    const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/pages.yml"), "utf8");
    assert.match(workflow, /og-card\.png/, "nothing rasterises the card the pages ask for");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a case study that is not a real customer says so, at the top", () => {
  // `case-1.md` described a named company with a −74% defect rate and no
  // disclaimer anywhere, while the roadmap said nobody outside this repository
  // had used the tool. Publishing that as a customer story is not a style
  // problem.
  //
  // Three categories, and the middle one is the reason this list grew.
  // `illustration` is invented — case-1's numbers were constructed to show the
  // shape of the workflow. `agent-driven adoption` is measured for real, by
  // nobody who chose to be there: a simulated pilot under GATE-G6 (ADR-0025).
  // `verified customer` is the only one that closes GATE-G3. Collapsing the
  // middle into either of the others is what the ADR exists to prevent.
  const dir = path.join(DOCS, "case-studies");
  if (!fs.existsSync(dir)) return;
  const unmarked = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const head = fs.readFileSync(path.join(dir, file), "utf8").split("\n").slice(0, 12).join("\n");
    const declared =
      /illustration, not a customer|agent-driven adoption, not a customer|verified customer/i;
    if (!declared.test(head)) unmarked.push(file);
  }
  assert.deepEqual(
    unmarked,
    [],
    "a case study must open by saying whether it is a real customer or an illustration:\n  " +
      unmarked.join("\n  ")
  );
});
