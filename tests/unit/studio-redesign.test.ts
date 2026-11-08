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
