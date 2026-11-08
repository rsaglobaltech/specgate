/**
 * The new studio (change studio-redesign): one app built from typed source,
 * served by Specgate itself, carrying no runtime dependency.
 */

import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";
import { studioShell, studioAsset } from "../../scripts/lib/studio-shell";

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const DIST = path.join(ROOT_DIR, "dist", "studio");

test("REQ-432 SCN-432a: the package ships the studio's script and styles, and depends on nothing", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
  assert.deepEqual(pkg.dependencies ?? {}, {}, "installing Specgate adds no runtime dependency");
  assert.ok(pkg.files.includes("dist/studio/"), "the built studio is packed");
  for (const f of ["app.js", "app.css"]) {
    assert.ok(fs.existsSync(path.join(DIST, f)), `dist/studio/${f} is built`);
  }
  // Nothing from another host: not the shell, not the styles, not a font.
  const shell = studioShell("shop", "tok123");
  assert.doesNotMatch(shell, /https?:\/\//);
  assert.match(shell, /<meta name="specgate-token" content="tok123"/);
  assert.match(shell, /src="\/studio\/app\.js"/);
  assert.match(shell, /href="\/studio\/app\.css"/);
  assert.doesNotMatch(fs.readFileSync(path.join(DIST, "app.css"), "utf8"), /url\(\s*["']?https?:/);
  assert.doesNotMatch(fs.readFileSync(path.join(DIST, "app.js"), "utf8"), /fetch\(\s*["'`]https?:/);
});

test("REQ-432: the studio serves its own files, and nothing outside them", () => {
  const js = studioAsset("/studio/app.js");
  assert.ok(js && js.type.startsWith("text/javascript"), JSON.stringify(js && js.type));
  assert.equal(studioAsset("/studio/app.css")?.type.split(";")[0], "text/css");
  for (const bad of [
    "/studio/../package.json",
    "/studio/%2e%2e/package.json",
    "/studio/..\\package.json",
    "/studio/",
  ]) {
    assert.equal(studioAsset(bad), null, bad);
  }
});

// ── REQ-204: one app, a sidebar of sections, an address for each ──

const studio = require(path.join(ROOT_DIR, "dist", "studio-test", "studio.cjs"));

test("REQ-204 SCN-204a: the app lists its sections, each at its own address", () => {
  assert.deepEqual(studio.SECTIONS, [
    "home",
    "brief",
    "changes",
    "questions",
    "build",
    "live",
    "report",
    "settings",
  ]);
  // Reloading or following a link opens the same section.
  assert.equal(studio.sectionOf("#/questions"), "questions");
  assert.equal(studio.sectionOf("#/questions?q=Q1"), "questions");
  assert.equal(studio.sectionOf("#/nope"), "home");
  assert.equal(studio.sectionOf(""), "home");
  const html: string = studio.renderShell("questions", studio.DEFAULTS);
  for (const s of studio.SECTIONS) assert.match(html, new RegExp(`href="#/${s}"`), s);
  assert.match(html, /href="#\/questions" aria-current="page"/);
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  for (const word of [
    "Inicio",
    "Brief",
    "Cambios",
    "Preguntas",
    "Construir",
    "En vivo",
    "Informe",
    "Ajustes",
  ]) {
    assert.match(html, new RegExp(word), word);
  }
  assert.match(studio.renderShell("home", { ...studio.DEFAULTS, lang: "en" }), /Changes/);
});

test("REQ-204: Spanish and English say every word; the viewer's choices are remembered, and a refusing storage is no error", () => {
  assert.deepEqual(Object.keys(studio.TEXTS.en).sort(), Object.keys(studio.TEXTS.es).sort());
  const kept = new Map<string, string>();
  const storage = {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
  };
  assert.deepEqual(studio.readPrefs(storage), { mode: "simple", lang: "es", theme: "system" });
  studio.writePrefs(storage, { mode: "advanced", lang: "en", theme: "dark" });
  assert.deepEqual(studio.readPrefs(storage), { mode: "advanced", lang: "en", theme: "dark" });
  kept.set("sg-studio-prefs", "{not json");
  assert.deepEqual(studio.readPrefs(storage), studio.DEFAULTS);
  const refusing = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(studio.readPrefs(refusing), studio.DEFAULTS);
  assert.doesNotThrow(() => studio.writePrefs(refusing, studio.DEFAULTS));
});

// ── REQ-212: Home shows the route, and its next step opens the section that does it ──

const step = (key: string, state: string, counts: Record<string, number> = {}) => ({
  key,
  state,
  counts,
});

test("REQ-212 SCN-212a: a project with a brief and no draft — the next step opens Changes", () => {
  const route = {
    project: "shop",
    isProject: true,
    steps: [
      step("project", "done"),
      step("brief", "done", { modules: 3 }),
      step("drafts", "current", { done: 0, total: 3 }),
      step("questions", "open"),
      step("review", "open"),
      step("build", "locked"),
      step("report", "locked"),
    ],
    next: "drafts",
  };
  const html: string = studio.renderHome("es", route, {
    built: 0,
    total: 0,
    questions: 0,
    drafts: 0,
    ready: 0,
    modules: [{ name: "orders", done: 0, total: 3, waiting: 0, draft: true }],
  });
  assert.match(html, /\[ SIGUIENTE PASO \]/);
  assert.match(html, /Redacta los módulos del brief/);
  assert.match(html, /class="btn-primary" href="#\/changes"/);
  for (const [key, state] of [
    ["project", "done"],
    ["drafts", "current"],
    ["build", "locked"],
    ["report", "locked"],
  ]) {
    assert.match(html, new RegExp(`class="step step-${state}" data-state="${state}"`), key);
  }
  // A locked step is no link; an open one is.
  assert.doesNotMatch(html, /<a class="step-name" href="#\/build">/);
  assert.match(html, /<a class="step-name" href="#\/questions">/);
  assert.match(html, /aria-valuenow="0"/);
});

test("REQ-212 SCN-212b: a folder that is not a project — the next step is the project, in Settings", () => {
  const route = {
    project: "empty",
    isProject: false,
    steps: [
      step("project", "current"),
      ...["brief", "drafts", "questions", "review", "build", "report"].map((k) =>
        step(k, "locked")
      ),
    ],
    next: "project",
  };
  const html: string = studio.renderHome("en", route, null);
  assert.match(html, /Create the project/);
  assert.match(html, /class="btn-primary" href="#\/settings"/);
  assert.equal((html.match(/data-state="locked"/g) || []).length, 6);
});
