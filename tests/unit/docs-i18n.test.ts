/**
 * The documentation in English and Spanish.
 *
 * English is the source, at the site's root; Spanish is under `es/`, from
 * `docs/es/<slug>.md` when a page is translated and from the English text, with
 * a note, when it is not. A translation records the English it was made from,
 * so a page whose English moved on says so instead of silently drifting.
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildSite } from "../../scripts/docs/build-site";
import { fingerprint, stamp, status, translationOf } from "../../scripts/docs/i18n";
import { NAV } from "../../scripts/docs/nav";

const ROOT = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const DOCS = path.join(ROOT, "docs");

let built: { dir: string; result: ReturnType<typeof buildSite> } | null = null;
function site() {
  if (!built) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-i18n-"));
    built = { dir, result: buildSite(dir) };
    process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
  }
  return built;
}
const read = (rel: string) => fs.readFileSync(path.join(site().dir, rel), "utf8");

test("a translation records the English it was made from, and goes stale when it moves", () => {
  const english = "# The gate\n\nIt checks.\n";
  const spanish = `<!-- translation-of: ${fingerprint(english)} -->\n# El gate\n\nComprueba.\n`;
  assert.deepEqual(translationOf(english, spanish), {
    status: "current",
    body: "# El gate\n\nComprueba.\n",
    recorded: fingerprint(english),
  });
  assert.equal(translationOf(english + "More.\n", spanish).status, "stale");
  assert.equal(translationOf(english, "# El gate\n").status, "stale");
  assert.deepEqual(translationOf(english, null), { status: "missing", body: english });
  // Line endings are not a change.
  assert.equal(fingerprint(english), fingerprint(english.replace(/\n/g, "\r\n")));
});

test("stamp writes the fingerprint of the English page the file translates", () => {
  const docs = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-stamp-"));
  try {
    fs.mkdirSync(path.join(docs, "es", "gate"), { recursive: true });
    fs.mkdirSync(path.join(docs, "gate"), { recursive: true });
    fs.writeFileSync(path.join(docs, "gate", "ci.md"), "# CI\n");
    const file = path.join(docs, "es", "gate", "ci.md");
    fs.writeFileSync(file, "<!-- translation-of: 000000000000 -->\n# CI en español\n");
    assert.equal(stamp(file, docs), fingerprint("# CI\n"));
    assert.equal(
      fs.readFileSync(file, "utf8"),
      `<!-- translation-of: ${fingerprint("# CI\n")} -->\n# CI en español\n`
    );
    fs.writeFileSync(path.join(docs, "es", "nowhere.md"), "# Nada\n");
    assert.throws(() => stamp(path.join(docs, "es", "nowhere.md"), docs), /translates nothing/);
  } finally {
    fs.rmSync(docs, { recursive: true, force: true });
  }
});

test("every Spanish page translates an English one, and records which", () => {
  const s = status();
  assert.deepEqual(s.orphans, [], "Spanish pages with no English page");
  const walk = (dir: string): string[] =>
    fs.existsSync(dir)
      ? fs
          .readdirSync(dir, { withFileTypes: true })
          .flatMap((e) =>
            e.isDirectory()
              ? walk(path.join(dir, e.name))
              : e.name.endsWith(".md")
                ? [path.join(dir, e.name)]
                : []
          )
      : [];
  for (const file of walk(path.join(DOCS, "es"))) {
    assert.match(
      fs.readFileSync(file, "utf8"),
      /^<!-- translation-of: [0-9a-f]{12} -->\n/,
      `${path.relative(ROOT, file)}: run node dist/scripts/docs/i18n.js --stamp on it`
    );
  }
});

test("every guide has a Spanish page, translated or showing the English with a note", () => {
  const { result } = site();
  for (const section of NAV) {
    for (const entry of section.entries) {
      const html = read(`es/${entry.slug}.html`);
      assert.match(html, /<html lang="es"/, entry.slug);
      const missing = result.translation.missing.includes(entry.slug);
      assert.equal(html.includes("Esta página aún no está traducida"), missing, entry.slug);
    }
  }
  assert.ok(fs.existsSync(path.join(site().dir, "es", "docs.html")));
  assert.ok(fs.existsSync(path.join(site().dir, "es", "assets", "search-index.json")));
});

test("the language picker opens the same page in the other language", () => {
  const dir = site().dir;
  for (const slug of ["gate/ci", "start", "docs"]) {
    const en = read(`${slug}.html`);
    const es = read(`es/${slug}.html`);
    const toEs = /<nav class="top__lang"[^>]*>.*?href="([^"]+)" hreflang="es"/.exec(en);
    const toEn = /<nav class="top__lang"[^>]*>.*?href="([^"]+)" hreflang="en"/.exec(es);
    assert.ok(toEs && toEn, slug);
    assert.equal(
      path.resolve(path.dirname(path.join(dir, `${slug}.html`)), toEs![1]),
      path.join(dir, "es", `${slug}.html`)
    );
    assert.equal(
      path.resolve(path.dirname(path.join(dir, "es", `${slug}.html`)), toEn![1]),
      path.join(dir, `${slug}.html`)
    );
  }
  const landing = read("index.html");
  assert.match(landing, /<nav class="top__lang"[^>]*>.*href="\.\/es\/" hreflang="es"/);
});

test("a Spanish page reaches the shared assets and the English-only specifications", () => {
  const dir = site().dir;
  const html = read("es/gate/ci.html");
  for (const m of html.matchAll(/(?:href|src)="((?:\.\.\/)+(?:assets|specs)\/[^"#]+)/g)) {
    const target = path.resolve(path.join(dir, "es", "gate"), m[1]);
    assert.ok(fs.existsSync(target), `${m[1]} from es/gate/ci.html`);
  }
  assert.match(html, /href="\.\.\/\.\.\/assets\/docs\.css"/);
});

test("the Spanish landing, once written, states the version this repository is on", () => {
  const file = path.join(DOCS, "es", "index.html");
  if (!fs.existsSync(file)) return;
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
  assert.ok(fs.readFileSync(file, "utf8").includes(`v${version}`), "update docs/es/index.html");
  const html = read("es/index.html");
  assert.match(html, /<html lang="es"/);
  assert.match(html, /href="\.\.\/assets\/docs\.css"/);
  assert.match(html, /<nav class="top__lang"[^>]*>.*href="\.\.\/" hreflang="en"/);
});
