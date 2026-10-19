/**
 * Which language a project asked for.
 *
 * `SPECGATE_LANGUAGE` wins over the project's `.specgate/config.json`, so a one-off run
 * can override the setting without editing it. An unreadable or absent config
 * is not an error: it means the project never chose, and English is the
 * default. The tables themselves are domain — see `domain/Language`.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { Phrases, languageFor, phrasesFor } from "../domain/Language";

/** The language tag written in the project's config, if any. */
export function readConfigured(projectDir: string | null | undefined): string | null | undefined {
  try {
    const file = path.join(projectDir || ".", ".specgate", "config.json");
    // A view, not a check: `languageFor` stringifies whatever is there.
    const parsed: { language?: string } | null = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && parsed.language;
  } catch {
    return null;
  }
}

/** The language tag in force for a project. */
export function resolveLanguage(projectDir: string | null | undefined): string {
  return languageFor(process.env.SPECGATE_LANGUAGE || readConfigured(projectDir));
}

/** The phrase table for a project. */
export function phrases(projectDir: string | null | undefined): Phrases {
  return phrasesFor(process.env.SPECGATE_LANGUAGE || readConfigured(projectDir));
}
