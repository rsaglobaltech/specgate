#!/usr/bin/env node
/**
 * `npm run contract:check` (REQ-568, REQ-569): the public surface compared
 * with the one the last release froze in `contract/surface.json`.
 *
 * - An item that disappears — a command, a flag, a code, a JSON key, a key's
 *   type — fails, unless the version is a new major and the item was listed in
 *   `contract/deprecations.json` before it went.
 * - An item that appears is reported: it needs at least a minor version.
 * - `--release <version>` also checks the version against the diff: a patch
 *   that adds to the surface, or a minor or patch that removes from it, fails.
 * - `--write` freezes the current surface as the baseline, at package.json's
 *   version — what a release does, in its own commit.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { snapshotSurface } from "./surface";

const ROOT = path.resolve(__dirname, "..", "..", "..").replace(/[\\/]dist$/, "");
export const BASELINE = path.join("contract", "surface.json");
export const DEPRECATIONS = path.join("contract", "deprecations.json");

export interface Baseline {
  version: string;
  items: string[];
}

export interface Deprecation {
  item: string;
  /** The version that deprecated it. */
  since: string;
  /** What to use instead. */
  use: string;
}

const major = (v: string) => Number((/^(\d+)/.exec(v) || [])[1] || 0);
const minor = (v: string) => Number((/^\d+\.(\d+)/.exec(v) || [])[1] || 0);

export interface Judgement {
  removed: string[];
  added: string[];
  /** Why this cannot ship; empty when it can. */
  errors: string[];
  /** Deprecated items still present, said on every run. */
  deprecated: Deprecation[];
}

/**
 * The verdict, pure. `version` is the version being built (package.json);
 * `release`, when given, the version about to be published.
 */
export function judge(
  baseline: Baseline,
  current: readonly string[],
  deprecations: readonly Deprecation[],
  version: string,
  release?: string
): Judgement {
  const now = new Set(current);
  const before = new Set(baseline.items);
  const removed = baseline.items.filter((i) => !now.has(i)).sort();
  const added = current.filter((i) => !before.has(i)).sort();
  const deprecatedBy = new Map(deprecations.map((d) => [d.item, d]));
  const errors: string[] = [];
  const newMajor = major(release || version) > major(baseline.version);
  for (const item of removed) {
    const d = deprecatedBy.get(item);
    if (!newMajor) {
      errors.push(
        `${item} is gone: removing from the public surface waits for ${major(baseline.version) + 1}.0.0` +
          (d ? "" : ", and for a deprecation in contract/deprecations.json first")
      );
    } else if (!d) {
      errors.push(
        `${item} is gone without a deprecation: list it in contract/deprecations.json in a minor release first`
      );
    }
  }
  if (release) {
    const sameMajor = major(release) === major(baseline.version);
    const sameMinor = sameMajor && minor(release) === minor(baseline.version);
    if (added.length > 0 && sameMinor) {
      errors.push(
        `${release} adds ${added.length} item(s) to the public surface: that is at least ${major(baseline.version)}.${minor(baseline.version) + 1}.0`
      );
    }
  }
  const deprecated = deprecations.filter((d) => now.has(d.item));
  return { removed, added, errors, deprecated };
}

function readJson<T>(rel: string, fallback: T): T {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : fallback;
}

function main(argv: string[]): number {
  const version = (
    JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as { version: string }
  ).version;
  const current = snapshotSurface();
  if (argv.includes("--write")) {
    fs.mkdirSync(path.join(ROOT, "contract"), { recursive: true });
    fs.writeFileSync(
      path.join(ROOT, BASELINE),
      `${JSON.stringify({ version, items: current }, null, 2)}\n`,
      "utf8"
    );
    process.stdout.write(
      `Froze ${current.length} item(s) of the public surface at ${version} in ${BASELINE}.\n`
    );
    return 0;
  }
  const baseline = readJson<Baseline | null>(BASELINE, null);
  if (!baseline) {
    process.stderr.write(`No ${BASELINE}: run \`npm run contract:write\` to freeze the surface.\n`);
    return 1;
  }
  const at = argv.indexOf("--release");
  const release = at !== -1 ? argv[at + 1] : undefined;
  const j = judge(baseline, current, readJson<Deprecation[]>(DEPRECATIONS, []), version, release);
  const list = (title: string, items: string[]) =>
    items.length ? `${title} (${items.length}):\n${items.map((i) => `  ${i}`).join("\n")}\n` : "";
  process.stdout.write(
    `Public surface: ${current.length} item(s), against ${baseline.version}'s ${baseline.items.length}.\n` +
      list("Added", j.added) +
      list("Removed", j.removed) +
      list(
        "Deprecated, still here",
        j.deprecated.map((d) => `${d.item} — since ${d.since}, use ${d.use}`)
      )
  );
  if (j.errors.length) {
    process.stderr.write(`\n${j.errors.map((e) => `✖ ${e}`).join("\n")}\n`);
    return 1;
  }
  process.stdout.write("✔ Nothing a user relies on is gone.\n");
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
