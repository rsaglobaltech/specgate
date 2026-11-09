/**
 * The documentation site with both versions: the stable documentation at the
 * root and the 1.0 candidate's under `next/`, built by pages.yml from next/1.0,
 * and a version picker at the top left of every page.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { buildSite } = require("../../scripts/docs/build-site");

const made: string[] = [];
test.after(() => {
  for (const d of made)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function built(opts?: object): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-site-versions-"));
  made.push(dir);
  buildSite(dir, opts);
  return dir;
}

const read = (dir: string, file: string) => fs.readFileSync(path.join(dir, file), "utf8");
const versions = { stable: "0.27.9", next: "1.0.0-rc.8" };

/** The picker of a page: each entry's href, label and whether it is current. */
function picker(html: string) {
  const m = html.match(/<details class="top__version"[^]*?<\/details>/);
  if (!m) return null;
  return [...m[0].matchAll(/<a ([^>]*)>([^]*?)<\/a>/g)].map((a) => ({
    href: (a[1].match(/href="([^"]*)"/) || [])[1],
    current: /aria-current="page"/.test(a[1]),
    text: a[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  }));
}

test("SCN-400a: every page of the stable site names both versions, the stable one current", () => {
  const dir = built({ channel: "stable", versions });
  const caseStudy = fs
    .readdirSync(path.join(dir, "case-studies"))
    .find((f: string) => f.endsWith(".html"));
  for (const [file, up] of [
    ["harness.html", ""],
    [`case-studies/${caseStudy}`, "../"],
    ["index.html", ""],
  ]) {
    const entries = picker(read(dir, file))!;
    assert.ok(entries, `${file} has no version picker`);
    assert.equal(entries.length, 2, file);
    assert.match(entries[0].text, /v0\.27\.9/);
    assert.equal(entries[0].current, true, file);
    assert.equal(entries[0].href, `${up}docs.html`, file);
    assert.match(entries[1].text, /v1\.0\.0-rc\.8/);
    assert.equal(entries[1].current, false, file);
    assert.equal(entries[1].href, `${up}next/whats-new-1.0.html`, file);
  }
  assert.doesNotMatch(read(dir, "harness.html"), /class="candidate-banner"/);
});

test("SCN-400a: a site of one version keeps the plain badge", () => {
  const dir = built();
  const html = read(dir, "harness.html");
  assert.equal(picker(html), null);
  assert.match(html, /<span class="top__version">v[0-9]/);
});

test("SCN-401a: the candidate's pages say so, lead back to the stable docs and edit next/1.0", () => {
  const dir = built({ channel: "next", versions });
  const html = read(dir, "harness.html");
  const entries = picker(html)!;
  assert.ok(entries);
  assert.equal(entries[0].href, "../docs.html");
  assert.equal(entries[0].current, false);
  assert.equal(entries[1].href, "whats-new-1.0.html");
  assert.equal(entries[1].current, true);
  const banner = html.match(/<div class="candidate-banner"[^]*?<\/div>/);
  assert.ok(banner, "no candidate banner");
  assert.match(banner[0], /1\.0\.0-rc\.8/);
  assert.match(banner[0], /href="\.\.\/docs\.html"/);
  assert.match(html, /\/edit\/next\/1\.0\/docs\/harness\.md/);
  assert.equal(picker(read(dir, "index.html"))?.[1].current, true);
});
