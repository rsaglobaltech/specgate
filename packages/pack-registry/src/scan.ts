"use strict";

/**
 * Pure module — no fs side effects on the output side.
 * Scans a packs/ root and returns metadata for each pack found.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { loadPack } from "../../core/src/infrastructure/DiskPackRepository";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const CLI = path.join(REPO_ROOT, "bin/specgate.js");

export interface PackMetadata {
  id: string;
  name: string;
  domain: string;
  description: string;
  version: string;
  language: string;
  project_type: string;
  /** `proven` (from a product that implemented and tested it) or `starter`. */
  tier: "proven" | "starter";
  /** What proved a proven pack; empty for a starter. */
  provenance: string;
  requirements: number;
  useCases: number;
  aggregates: number;
  events: number;
  scenarios: number;
  lintStatus: "pass" | "warn" | "fail";
  lintMessages: string[];
}

export class PackScanner {
  public scanPacks(packsRoot: string): PackMetadata[] {
    if (!fs.existsSync(packsRoot)) {
      throw new Error(`packsRoot does not exist: ${packsRoot}`);
    }

    const packs: PackMetadata[] = [];
    for (const entry of fs.readdirSync(packsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const domainDir = path.join(packsRoot, entry.name);
      for (const sub of fs.readdirSync(domainDir, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue;
        const packYaml = path.join(domainDir, sub.name, "pack.yaml");
        if (!fs.existsSync(packYaml)) continue;
        const id = `${entry.name}/${sub.name}`;
        packs.push(this.buildMetadata(packsRoot, id));
      }
    }
    // Proven packs first: they are the ones a reader can build on as they are.
    return packs.sort(
      (a, b) =>
        Number(b.tier === "proven") - Number(a.tier === "proven") || a.id.localeCompare(b.id)
    );
  }

  private buildMetadata(packsRoot: string, id: string): PackMetadata {
    let pack: any;
    try {
      pack = loadPack(packsRoot, id).pack;
    } catch (err: unknown) {
      const error = err as Error;
      return {
        id,
        name: id,
        domain: id.split("/")[0],
        description: "",
        version: "?",
        language: "?",
        project_type: "?",
        tier: "starter",
        provenance: "",
        requirements: 0,
        useCases: 0,
        aggregates: 0,
        events: 0,
        scenarios: 0,
        lintStatus: "fail",
        lintMessages: [`Could not load pack.yaml: ${error.message}`],
      };
    }

    const lint = this.runLint(packsRoot, id);
    const meta = pack.metadata || {};
    const firstReq = Array.isArray(pack.requirements) && pack.requirements[0];
    const description = (firstReq && firstReq.description) || "";

    return {
      id,
      domain: id.split("/")[0],
      name: meta.name || id,
      description,
      version: meta.version || "0.0.0",
      language: meta.language || "en",
      project_type: meta.project_type || "backend",
      // A pack that says nothing about itself is a starter: "proven" has to be
      // claimed, and `pack lint` refuses the claim without a provenance.
      tier: meta.tier === "proven" ? "proven" : "starter",
      provenance: meta.provenance || "",
      requirements: this.count(pack.requirements),
      useCases: this.count(pack.use_cases),
      aggregates: this.count(pack.aggregates),
      events: this.count(pack.events),
      scenarios: this.count(pack.scenarios),
      lintStatus: lint.status,
      lintMessages: lint.messages,
    };
  }

  private count(arr: unknown): number {
    return Array.isArray(arr) ? arr.length : 0;
  }

  private runLint(
    packsRoot: string,
    id: string
  ): { status: "pass" | "warn" | "fail"; messages: string[] } {
    const result = spawnSync(
      process.execPath,
      [CLI, "pack", "lint", "--pack-root", packsRoot, "--pack", id],
      {
        encoding: "utf8",
        timeout: 15_000,
      }
    );
    const combined = (result.stdout || "") + "\n" + (result.stderr || "");
    const errors: string[] = [];
    const warnings: string[] = [];
    for (const line of combined.split("\n")) {
      // `✖`/`▲` lead the line since the CLI's 0.19 look; `[ERROR]`/`[WARN]` before it.
      const t = line.trim();
      if (t.startsWith("✖") || line.includes("[ERROR]"))
        errors.push(t.replace(/^(?:.*\[ERROR\]|✖)\s*/, "").trim());
      else if (t.startsWith("▲") || line.includes("[WARN]"))
        warnings.push(t.replace(/^(?:.*\[WARN\]|▲)\s*/, "").trim());
    }
    let status: "pass" | "warn" | "fail";
    if (errors.length > 0) status = "fail";
    else if (warnings.length > 0) status = "warn";
    else status = "pass";
    return { status, messages: [...errors, ...warnings] };
  }
}

// Keep legacy export signature for external callers in the transition
const scanner = new PackScanner();
export const scanPacks = (packsRoot: string) => scanner.scanPacks(packsRoot);
export const buildMetadata = (packsRoot: string, id: string) =>
  (scanner as any).buildMetadata(packsRoot, id);
