#!/usr/bin/env node
"use strict";

/**
 * Pack-registry static site generator.
 *
 * Usage:
 *   node packages/pack-registry/src/build.js [--packs <dir>] [--out <dir>]
 *
 * Defaults:
 *   --packs ./packs
 *   --out   ./packages/pack-registry/dist
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { PackScanner } from "./scan";
import { renderIndex } from "./render";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const DEFAULT_PACKS = path.join(REPO_ROOT, "packs");
const DEFAULT_OUT = path.join(REPO_ROOT, "packages/pack-registry/dist");

export interface BuildOptions {
  packs: string;
  out: string;
}

export class PackRegistryBuilder {
  private scanner: PackScanner;

  constructor() {
    this.scanner = new PackScanner();
  }

  public parseArgs(argv: string[]): BuildOptions {
    const opts: BuildOptions = { packs: DEFAULT_PACKS, out: DEFAULT_OUT };
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--packs" && argv[i + 1]) opts.packs = path.resolve(argv[++i]);
      else if (argv[i] === "--out" && argv[i + 1]) opts.out = path.resolve(argv[++i]);
      else if (argv[i] === "--help" || argv[i] === "-h") {
        process.stdout.write("Usage: pack-registry-build [--packs <dir>] [--out <dir>]\n");
        process.exit(0);
      }
    }
    return opts;
  }

  public build(opts: BuildOptions): void {
    process.stdout.write(`Scanning ${opts.packs}…\n`);
    const packs = this.scanner.scanPacks(opts.packs);
    process.stdout.write(`Found ${packs.length} pack(s).\n`);

    fs.mkdirSync(opts.out, { recursive: true });

    // We assume renderIndex is also exported or we will refactor it
    // The install command on every card pins the release this site documents.
    const version = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")
    ).version;
    const html = renderIndex(packs, { title: "Specgate domain packs", version });
    const outFile = path.join(opts.out, "index.html");
    fs.writeFileSync(outFile, html, "utf8");
    process.stdout.write(`Wrote ${outFile}\n`);

    // Also emit a JSON manifest for tooling
    const manifest = {
      generated: new Date().toISOString(),
      packs: packs.map((p) => ({
        id: p.id,
        name: p.name,
        version: p.version,
        lintStatus: p.lintStatus,
        counts: {
          requirements: p.requirements,
          useCases: p.useCases,
          aggregates: p.aggregates,
          events: p.events,
          scenarios: p.scenarios,
        },
      })),
    };
    const manifestFile = path.join(opts.out, "manifest.json");
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), "utf8");
    process.stdout.write(`Wrote ${manifestFile}\n`);

    // Exit 1 if any pack fails lint — so CI catches regressions
    const failed = packs.filter((p) => p.lintStatus === "fail");
    if (failed.length > 0) {
      process.stderr.write(`\n${failed.length} pack(s) failed lint:\n`);
      for (const p of failed) process.stderr.write(`  - ${p.id}\n`);
      process.exit(1);
    }
  }
}

export function main() {
  const builder = new PackRegistryBuilder();
  const opts = builder.parseArgs(process.argv.slice(2));
  builder.build(opts);
}

if (require.main === module) main();

// Legacy export if needed for tests
export const parseArgs = (argv: string[]) => new PackRegistryBuilder().parseArgs(argv);
