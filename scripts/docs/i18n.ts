#!/usr/bin/env node

/**
 * The Spanish documentation, and how far behind the English it is.
 *
 * English is the source: `docs/<slug>.md`. A translation is `docs/es/<slug>.md`
 * and opens with the fingerprint of the English text it was made from:
 *
 *   <!-- translation-of: 3f9a1c0b7d2e -->
 *
 * When the English page changes, its fingerprint no longer matches and the
 * Spanish page is *stale*: the site still shows it, with a note that the
 * English is newer, and the build lists it. A page with no translation shows
 * the English text with a note. Nothing fails: a change to an English guide
 * never waits for its translation.
 *
 *   node dist/scripts/docs/i18n.js --status          every guide, translated, stale or missing
 *   node dist/scripts/docs/i18n.js --stamp <file>    after translating: record the English it matches
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export type Lang = "en" | "es";
export const LANGS: readonly Lang[] = ["en", "es"];

const ROOT = path.resolve(__dirname, "..", "..", "..");
const DOCS = path.join(ROOT, "docs");
const MARKER = /^<!--\s*translation-of:\s*([0-9a-f]{12})\s*-->[ \t]*\r?\n?/;

/** The English text's fingerprint: what a translation records it was made from. */
export function fingerprint(english: string): string {
  return crypto
    .createHash("sha256")
    .update(english.replace(/\r\n/g, "\n"))
    .digest("hex")
    .slice(0, 12);
}

export interface Translation {
  /** `current`: made from today's English; `stale`: from an older one; `missing`: none. */
  readonly status: "current" | "stale" | "missing";
  /** What the Spanish page shows: the translation without its marker, or the English. */
  readonly body: string;
  /** The fingerprint the translation records, when it has one. */
  readonly recorded?: string;
}

/** A guide in Spanish: its translation and whether it still matches the English. */
export function translationOf(english: string, spanish: string | null): Translation {
  if (spanish === null) return { status: "missing", body: english };
  const m = MARKER.exec(spanish);
  const body = m ? spanish.slice(m[0].length) : spanish;
  const recorded = m ? m[1] : undefined;
  return { status: recorded === fingerprint(english) ? "current" : "stale", body, recorded };
}

/** `docs/es/gate/ci.md` stamped with today's `docs/gate/ci.md`. Returns the fingerprint. */
export function stamp(spanishFile: string, docsDir = DOCS): string {
  const rel = path.relative(path.join(docsDir, "es"), path.resolve(spanishFile));
  if (rel.startsWith("..") || !rel.endsWith(".md")) {
    throw new Error(`${spanishFile} is not a page under ${path.join(docsDir, "es")}`);
  }
  const english = path.join(docsDir, rel);
  if (!fs.existsSync(english)) throw new Error(`${spanishFile} translates nothing: no ${english}`);
  const print = fingerprint(fs.readFileSync(english, "utf8"));
  const text = fs.readFileSync(spanishFile, "utf8");
  const body = text.replace(MARKER, "");
  fs.writeFileSync(spanishFile, `<!-- translation-of: ${print} -->\n${body}`, "utf8");
  return print;
}

/** Every guide under `docs/es/`, and every English guide still without one. */
export function status(docsDir = DOCS): {
  current: string[];
  stale: string[];
  missing: string[];
  orphans: string[];
} {
  const walk = (dir: string, prefix = ""): string[] =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
          const rel = prefix ? `${prefix}/${e.name}` : e.name;
          if (e.isDirectory()) return walk(path.join(dir, e.name), rel);
          return e.name.endsWith(".md") ? [rel.slice(0, -3)] : [];
        })
      : [];
  const english = walk(docsDir).filter((s) => !s.startsWith("es/") && !s.startsWith("specs/"));
  const spanish = walk(path.join(docsDir, "es"));
  const out = { current: [] as string[], stale: [] as string[], missing: [] as string[] };
  for (const slug of english) {
    const file = path.join(docsDir, "es", `${slug}.md`);
    const t = translationOf(
      fs.readFileSync(path.join(docsDir, `${slug}.md`), "utf8"),
      fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null
    );
    out[t.status].push(slug);
  }
  return { ...out, orphans: spanish.filter((s) => !english.includes(s)) };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "--stamp" && args.length > 1) {
    for (const file of args.slice(1)) {
      process.stdout.write(`stamped ${file}: ${stamp(file)}\n`);
    }
  } else {
    const s = status();
    process.stdout.write(
      `Spanish: ${s.current.length} translated, ${s.stale.length} behind the English, ${s.missing.length} not translated yet\n`
    );
    for (const slug of s.stale) process.stdout.write(`  stale    es/${slug}.md\n`);
    for (const slug of s.orphans)
      process.stdout.write(`  orphan   es/${slug}.md — no English page\n`);
    if (args.includes("--missing")) {
      for (const slug of s.missing) process.stdout.write(`  missing  ${slug}.md\n`);
    }
    process.exitCode = s.orphans.length > 0 ? 1 : 0;
  }
}
