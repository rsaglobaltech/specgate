#!/usr/bin/env node
"use strict";
/**
 * Build the studio's app (REQ-432): `studio/src` (Preact, TSX) bundled into
 * `dist/studio/app.js`, its styles into `app.css`, its fonts copied — static
 * files Specgate serves itself, so installing Specgate adds no dependency.
 */
const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");
const out = path.join(root, "dist", "studio");
fs.mkdirSync(out, { recursive: true });

esbuild.buildSync({
  entryPoints: [path.join(root, "studio", "src", "main.tsx")],
  outfile: path.join(out, "app.js"),
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  jsxImportSource: "preact",
  legalComments: "none",
  logLevel: "warning",
});
esbuild.buildSync({
  entryPoints: [path.join(root, "studio", "src", "app.css")],
  outfile: path.join(out, "app.css"),
  bundle: true,
  minify: true,
  external: ["/studio/fonts/*"],
  logLevel: "warning",
});
const fonts = path.join(root, "studio", "fonts");
if (fs.existsSync(fonts)) {
  fs.mkdirSync(path.join(out, "fonts"), { recursive: true });
  for (const f of fs.readdirSync(fonts)) {
    if (/\.(woff2|txt)$/.test(f)) fs.copyFileSync(path.join(fonts, f), path.join(out, "fonts", f));
  }
}
