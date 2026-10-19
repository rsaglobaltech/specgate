/**
 * Reader for `specops.config.yaml` — the declarative multi-pack composition file.
 *
 * Format:
 *   specops_version: 1
 *   packs:
 *     - repo: https://github.com/org/domain-specops.git
 *       version: v0.1.0
 *       pack_id: backend
 *       vars:
 *         PROJECT_NAME: My App
 *
 * When `.specops.lock` is absent, `specops sync` reads this file instead and
 * treats each entry as if it came from a lockfile (without a pinned commit, so
 * the fetch always re-resolves the tag on the first run).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseYamlLite } from "../domain/YamlLite";
import { PackEntry } from "../domain/Lockfile";

export const CONFIG_FILE = "specops.config.yaml";

/** One `packs[]` entry as written; `configToPacks` checks the required ones. */
export interface SpecopsConfigPack {
  repo?: string;
  version?: string;
  commit?: string;
  pack_id?: string;
  vars?: Record<string, string>;
}

/** A parsed `specops.config.yaml`. */
export interface SpecopsConfig {
  specops_version?: number;
  packs?: SpecopsConfigPack[];
  [key: string]: unknown;
}

export function readConfig(projectDir: string): SpecopsConfig | null {
  const filePath = path.join(projectDir, CONFIG_FILE);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  return parseYamlLite(raw);
}

/**
 * Validates the parsed config and returns pack entries normalised to the same
 * shape used by `readLock()`'s `packs[]` array so callers can handle both
 * sources uniformly.
 *
 * Throws with a descriptive message on malformed input.
 */
export function configToPacks(config: SpecopsConfig | null | undefined): PackEntry[] {
  if (!config || !Array.isArray(config.packs) || config.packs.length === 0) {
    throw new Error(`${CONFIG_FILE}: 'packs' must be a non-empty array`);
  }
  return config.packs.map((entry: SpecopsConfigPack, i: number) => {
    if (!entry.repo) throw new Error(`${CONFIG_FILE}: packs[${i}] missing 'repo'`);
    if (!entry.version) throw new Error(`${CONFIG_FILE}: packs[${i}] missing 'version'`);
    if (!entry.pack_id) throw new Error(`${CONFIG_FILE}: packs[${i}] missing 'pack_id'`);
    return {
      repo: entry.repo,
      version: entry.version,
      commit: entry.commit || "",
      pack_id: entry.pack_id,
      vars: entry.vars || {},
      expanded_at: "",
    };
  });
}
