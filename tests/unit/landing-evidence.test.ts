/**
 * landing-evidence: the landing page shows the agent without and with the
 * gate (REQ-762), where each control runs (REQ-763), and the nine controls
 * with what agents tried, in English and Spanish (REQ-764).
 */
import test from "node:test";
import assert from "node:assert/strict";
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, ""));
const EN = fs.readFileSync(path.join(ROOT_DIR, "docs", "index.html"), "utf8");
const ES = fs.readFileSync(path.join(ROOT_DIR, "docs", "es", "index.html"), "utf8");

/** The page's body after its top bar: what a reader meets first. */
const afterHeader = (html: string) => html.slice(html.indexOf("</header>"));

test("REQ-762 SCN-762a: the first screen — without and with the gate, and the measured figures", () => {
  const body = afterHeader(EN);
  const firstSection = body.slice(body.indexOf("<section"), body.indexOf("</section>"));
  assert.match(firstSection, /Without Specgate/);
  assert.match(firstSection, /With Specgate/);
  assert.match(firstSection, /44%/);
  // landing-figures-v16: the replication on the released version, both arms in one session.
  assert.match(firstSection, /89%/);
  assert.match(firstSection, /16 of 36/);
  assert.match(firstSection, /32 of 36/);
  assert.match(firstSection, /p &lt; 0\.001/);
});

test("REQ-763 SCN-763a: named figures — the trust boundary with the outside judge, and the guard's decision", () => {
  const figures = [...EN.matchAll(/<figure[\s\S]*?<\/figure>/g)].map((m) => m[0]);
  const named = (re: RegExp) =>
    figures.find((f) => {
      const label = (/role="img"[^>]*aria-label="([^"]+)"/.exec(f) || /aria-label="([^"]+)"[^>]*role="img"/.exec(f) || [])[1] || "";
      return re.test(label) && /<figcaption/.test(f);
    });
  const boundary = named(/trust boundary/i);
  assert.ok(boundary, "a figure named for the trust boundary, with a caption");
  assert.match(boundary!, /outside judge/i);
  assert.ok(named(/guard/i), "a figure named for the guard's decision, with a caption");
});

test("REQ-764 SCN-764a: both pages list C1 to C9, the Spanish one in Spanish", () => {
  for (const [html, lang] of [[EN, "en"], [ES, "es"]] as const) {
    for (let i = 1; i <= 9; i++) assert.match(html, new RegExp(`>C${i}<`), `${lang}: C${i}`);
  }
  assert.match(EN, /What an agent tried/);
  assert.match(ES, /Lo que intentó un agente/);
  assert.match(ES, /Juez externo/);
});
