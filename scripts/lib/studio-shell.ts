import * as fs from "node:fs";
import * as path from "node:path";
import { findCliRoot } from "./project-root";

/**
 * The new studio's page (REQ-432): a small HTML shell that loads the app
 * Specgate built from `studio/src` into `dist/studio/`. Everything it loads
 * comes from the studio itself — no other host, no runtime dependency.
 */

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );

/**
 * The page: the token for writes (REQ-201), the project's name, the app's
 * script and styles; with a section, the one it opens on — `/live` opens Live (REQ-433).
 */
export function studioShell(projectName: string, token: string, section = ""): string {
  return [
    "<!doctype html>",
    '<html lang="es">',
    "<head>",
    '<meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
    `<meta name="specgate-token" content="${escape(token)}"/>`,
    `<meta name="specgate-project" content="${escape(projectName)}"/>`,
    ...(section ? [`<meta name="specgate-section" content="${escape(section)}"/>`] : []),
    `<title>Specgate Studio — ${escape(projectName)}</title>`,
    '<link rel="stylesheet" href="/studio/app.css"/>',
    "</head>",
    "<body>",
    '<div id="app"></div>',
    '<script src="/studio/app.js" defer></script>',
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

const TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

/** A file of the built studio for a request under `/studio/`, or null — never a file outside it. */
export function studioAsset(urlPath: string): { type: string; body: Buffer } | null {
  let rel: string;
  try {
    rel = decodeURIComponent(urlPath.replace(/^\/studio\//, ""));
  } catch {
    return null;
  }
  if (
    !rel ||
    rel.includes("\\") ||
    rel.split("/").some((s) => s === ".." || s === "." || s === "")
  ) {
    return null;
  }
  const type = TYPES[path.extname(rel)];
  if (!type) return null;
  const dir = path.join(findCliRoot(), "dist", "studio");
  const file = path.join(dir, ...rel.split("/"));
  if (path.relative(dir, file).startsWith("..")) return null;
  try {
    return { type, body: fs.readFileSync(file) };
  } catch {
    return null;
  }
}
