/**
 * onboarding-fixes: one short page to start (REQ-475). Two paths, each at most
 * six steps that name their command; the other start pages point to it.
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** The numbered steps under a `## ` heading, up to the next one. */
function steps(page: string, heading: string): string[] {
  const at = page.indexOf(`## ${heading}`);
  assert.ok(at >= 0, `no "## ${heading}" section`);
  const rest = page.slice(at + 3);
  const section = rest.slice(0, rest.search(/\n## /) >= 0 ? rest.search(/\n## /) : undefined);
  return section.split("\n").filter((l) => /^\d+\. /.test(l));
}

test("REQ-475 SCN-475a: the Start page — an existing project in at most six steps, each with its command, from install to the first applied requirement", () => {
  const start = read("docs/start.md");
  const existing = steps(start, "An existing project");
  assert.ok(existing.length >= 1 && existing.length <= 6, `${existing.length} steps`);
  existing.forEach((s, i) => {
    assert.ok(s.startsWith(`${i + 1}. `), `step ${i + 1} is numbered ${s.slice(0, 3)}`);
    assert.match(s, /`[^`]*specgate[^`]*`|`npm i[^`]*`/, `step ${i + 1} names no command: ${s}`);
  });
  assert.match(existing[0]!, /npm i -D @rsaglobaltech\/specgate/);
  assert.ok(
    existing.some((s) => /`npx specgate adopt`/.test(s)),
    "adopt is a step"
  );
  assert.ok(
    existing.some((s) => /`npx specgate apply REQ-\d+`/.test(s)),
    "the first applied requirement is a step"
  );
});

test("REQ-475 SCN-475a: the Start page — a new project in at most six steps, each with its command", () => {
  const fresh = steps(read("docs/start.md"), "A new project");
  assert.ok(fresh.length >= 1 && fresh.length <= 6, `${fresh.length} steps`);
  for (const s of fresh) assert.match(s, /`[^`]*specgate[^`]*`/, `no command: ${s}`);
  assert.ok(
    fresh.some((s) => /specgate@latest init`/.test(s)),
    "init is a step"
  );
});

test("REQ-475 SCN-475a: getting-started and quickstart point to Start, briefly; the home page's Get started goes there", () => {
  for (const rel of ["docs/getting-started.md", "docs/quickstart.md"]) {
    const page = read(rel);
    assert.match(page, /\]\(start\.md\)/, `${rel} does not link to start.md`);
    assert.ok(words(page) < 200, `${rel} has ${words(page)} words`);
  }
  for (const rel of fs
    .readdirSync(path.join(ROOT, "docs/start"))
    .filter((f) => f.endsWith(".md"))) {
    assert.match(
      read(`docs/start/${rel}`),
      /\]\(\.\.\/start\.md\)/,
      `start/${rel} does not point to start.md`
    );
  }
  const home = read("docs/index.html");
  const getStarted = [...home.matchAll(/<a [^>]*href="([^"]+)"[^>]*>Get started<\/a>/g)].map(
    (m) => m[1]
  );
  assert.ok(getStarted.length > 0, "no Get started link");
  for (const href of getStarted) assert.match(href, /start\.(html|md)$/);
});
