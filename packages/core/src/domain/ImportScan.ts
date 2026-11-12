/**
 * What a JavaScript or TypeScript file imports, read without running it
 * (REQ-510, REQ-516).
 *
 * `check --affected` runs the tests whose imports reach a changed file, and
 * the result cache re-runs a test when a file it imports changed. Both need
 * the imports, and both must know when they could not read them all: a
 * `require(name)` built at run time, or an import that names no file here and
 * no installed package, is a dependency nobody can see — the caller treats the
 * file as reaching anything.
 *
 * A regular expression over the text, not a parser: an import written inside
 * a comment or a string is counted too, which only ever adds a dependency.
 */

/** The files this scan reads. */
export const SCANNED = /\.(js|jsx|mjs|cjs|ts|tsx|mts|cts)$/i;

/** The extensions a relative import may leave out, in the order a resolver tries them. */
export const RESOLVED_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
];

export interface ImportScan {
  /** Every specifier written as a string literal, in file order. */
  specifiers: string[];
  /** A `require(…)` or `import(…)` of something other than a string literal. */
  dynamic: boolean;
}

const STATIC_FROM = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*(['"])([^'"\n]+)\1/g;
const BARE_IMPORT = /\bimport\s*(['"])([^'"\n]+)\1/g;
const CALL = /\b(?:require|import)\s*\(\s*([^)]*?)\s*\)/g;
const LITERAL = /^(['"])([^'"\n]+)\1$|^`([^`$\n]+)`$/;

/** The specifiers `source` imports, and whether one of them cannot be read. */
export function scanImports(source: string): ImportScan {
  const specifiers: string[] = [];
  let dynamic = false;
  const add = (s: string) => {
    if (!specifiers.includes(s)) specifiers.push(s);
  };
  for (const m of source.matchAll(STATIC_FROM)) add(m[2]);
  for (const m of source.matchAll(BARE_IMPORT)) add(m[2]);
  for (const m of source.matchAll(CALL)) {
    const arg = m[1].trim();
    // `import(…)` written in a type position or a comment with nothing in it.
    if (arg === "") continue;
    const lit = LITERAL.exec(arg);
    if (lit) add(lit[2] ?? lit[3]);
    else dynamic = true;
  }
  return { specifiers, dynamic };
}

/** `./a` and `../b/c`: a file of the project, not a package. */
export function isRelative(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../") || specifier === ".";
}

/** `lodash/fp` → `lodash`; `@scope/pkg/x` → `@scope/pkg`; null for `#internal` or `@/alias`. */
export function packageName(specifier: string): string | null {
  if (specifier.startsWith("#") || specifier.startsWith("/")) return null;
  const parts = specifier.replace(/^node:/, "").split("/");
  if (specifier.startsWith("@")) {
    return parts.length >= 2 && parts[0].length > 1 && parts[1] ? `${parts[0]}/${parts[1]}` : null;
  }
  return parts[0] || null;
}

/**
 * The project-relative paths a relative specifier may name, in the order a
 * resolver tries them: as written, with each extension, as a folder's index,
 * and a TypeScript source named by its compiled `.js`.
 */
export function candidatePaths(fromFile: string, specifier: string): string[] {
  const dir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  const joined = normalise(dir ? `${dir}/${specifier}` : specifier);
  if (joined === null) return [];
  const out = [joined];
  for (const ext of RESOLVED_EXTENSIONS) out.push(`${joined}${ext}`);
  for (const ext of RESOLVED_EXTENSIONS) out.push(`${joined}/index${ext}`);
  const compiled = /\.(m|c)?js$/.exec(joined);
  if (compiled) {
    const stem = joined.slice(0, -compiled[0].length);
    const flavour = compiled[1] || "";
    out.push(`${stem}.${flavour}ts`);
    if (!flavour) out.push(`${stem}.tsx`);
  }
  return out;
}

/** `a/./b/../c` → `a/c`; null when it climbs out of the project. */
function normalise(rel: string): string | null {
  const out: string[] = [];
  for (const part of rel.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return null;
      out.pop();
    } else {
      out.push(part);
    }
  }
  return out.join("/");
}

/**
 * Modules through which a file reaches what it does not import: the file
 * system, another process, the network, a browser. A test whose imports reach
 * one of them depends on more than its imports say, and the result cache
 * re-runs it whenever any source file changed (REQ-516).
 */
export const REACHES_BEYOND_IMPORTS = new Set([
  "fs",
  "fs/promises",
  "child_process",
  "worker_threads",
  "cluster",
  "net",
  "http",
  "https",
  "http2",
  "dgram",
  "tls",
  "execa",
  "cross-spawn",
  "zx",
  "fs-extra",
  "graceful-fs",
  "glob",
  "fast-glob",
  "globby",
  "@playwright/test",
  "playwright",
  "puppeteer",
  "cypress",
  "webdriverio",
  "selenium-webdriver",
  "supertest",
  "axios",
  "node-fetch",
  "undici",
]);

/** Ways to load files or reach the network that no import names. */
const BEYOND_IN_TEXT =
  /\bimport\.meta\.glob\b|\brequire\.context\s*\(|(?<![\w.])fetch\s*\(|\bnew\s+WebSocket\s*\(|\bXMLHttpRequest\b/;

/**
 * Does a file with these imports reach anything its imports do not name? Its
 * specifiers, as `scanImports` read them, and its text.
 */
export function reachesBeyondImports(specifiers: readonly string[], source: string): boolean {
  if (BEYOND_IN_TEXT.test(source)) return true;
  return specifiers.some((s) => {
    const name = packageName(s);
    return name !== null && REACHES_BEYOND_IMPORTS.has(name);
  });
}
