/**
 * Pack integrity and provenance (supply-chain guardrails for specops).
 *
 * - computePackDigest: content-addressed sha256 of a pack directory tree.
 *   Recorded in `.specops.lock` on expand; a later expand of the same
 *   (repo, pack, version) with different content fails loudly — this
 *   catches moved tags and poisoned caches.
 * - verifyTagSignature: GPG verification through git (verify-tag, falling
 *   back to verify-commit). No new dependencies: enterprises already
 *   distribute GPG keys through git tooling.
 * - readSecurityPolicy: `require_signed_packs: true` in specops.config.yaml
 *   makes unsigned packs a hard error.
 *
 * Pure-ish module: no process.exit; throws or returns.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { parseYamlLite } from "../../packages/core/src/domain/YamlLite";

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

/**
 * Deterministic sha256 over a pack directory: sorted POSIX-relative paths
 * and file contents, NUL-separated. Independent of OS and clone order.
 * @returns {string} "sha256:<hex>"
 */
export function computePackDigest(packDir: string): string {
  if (!fs.existsSync(packDir) || !fs.statSync(packDir).isDirectory()) {
    throw new Error(`computePackDigest: not a directory: ${packDir}`);
  }
  const files = walkFiles(packDir)
    .map((abs) => ({ abs, rel: path.relative(packDir, abs).split(path.sep).join("/") }))
    .sort((a, b) => a.rel.localeCompare(b.rel));
  const hash = crypto.createHash("sha256");
  for (const { abs, rel } of files) {
    hash.update(rel);
    hash.update("\0");
    hash.update(fs.readFileSync(abs));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

/**
 * Read the pack-security policy from specops.config.yaml (flat key).
 * @returns {{ requireSignedPacks: boolean }}
 */
export function readSecurityPolicy(projectDir: string): { requireSignedPacks: boolean } {
  const cfgPath = path.join(projectDir, "specops.config.yaml");
  if (!fs.existsSync(cfgPath)) return { requireSignedPacks: false };
  try {
    const cfg = parseYamlLite(fs.readFileSync(cfgPath, "utf8"));
    const value = cfg ? cfg.require_signed_packs : undefined;
    return { requireSignedPacks: value === true || value === "true" };
  } catch {
    return { requireSignedPacks: false };
  }
}

/** The outcome of `verifyTagSignature`, with git's own words. */
export interface TagSignature {
  verified: boolean;
  method: "tag" | "commit" | null;
  output: string;
}

/**
 * Verify the GPG signature of a resolved pack: the version tag first,
 * the checked-out commit as a fallback (annotated-tag-less workflows).
 * @returns {{ verified: boolean, method: "tag"|"commit"|null, output: string }}
 */
export function verifyTagSignature(gitDir: string, version: string): TagSignature {
  const tag = spawnSync("git", ["-C", gitDir, "verify-tag", version], { encoding: "utf8" });
  if (tag.status === 0) {
    return { verified: true, method: "tag", output: (tag.stderr || "").trim() };
  }
  const commit = spawnSync("git", ["-C", gitDir, "verify-commit", "HEAD"], { encoding: "utf8" });
  if (commit.status === 0) {
    return { verified: true, method: "commit", output: (commit.stderr || "").trim() };
  }
  return {
    verified: false,
    method: null,
    output: ((tag.stderr || "") + (commit.stderr || "")).trim(),
  };
}

/**
 * Throw when the lockfile already pins this (repo, pack, version) to a
 * different content digest — the content behind the version changed.
 */
export function assertDigestUnchanged(
  lockEntry: { digest?: string; version?: string } | null | undefined,
  packId: string,
  version: string,
  actualDigest: string
): void {
  if (!lockEntry || !lockEntry.digest || lockEntry.version !== version) return;
  if (lockEntry.digest !== actualDigest) {
    throw new Error(
      `Pack integrity check failed for ${packId}@${version}:\n` +
        `  locked digest:  ${lockEntry.digest}\n` +
        `  fetched digest: ${actualDigest}\n` +
        "The content behind this version changed since it was locked (moved tag, " +
        "rewritten history, or a tampered cache).\n" +
        "Fix: investigate the pack repository first. If the change is legitimate, " +
        "re-pin with a new --pack-version, or remove the cached copy and re-run " +
        "`specops add` to accept the new digest explicitly."
    );
  }
}
