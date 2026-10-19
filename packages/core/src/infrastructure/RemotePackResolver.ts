/**
 * Resolves a remote pack repository to a local on-disk path.
 *
 * Behaviour:
 *   resolveRemotePack({ repo, version, cacheDir? })
 *     → { packRoot: <local-dir>, commit: <sha>, version: <ref-as-provided> }
 *
 * Caching:
 *   ~/.cache/specgate/packs/<repo-hash>/<version>/
 *   The cache key is sha256(repo) so different repos with the same tag
 *   never collide. `cacheDir` can be overridden (used by tests).
 *
 * Side effects: spawns `git` and writes inside the cache directory.
 * Throws on any failure with a contextual message.
 */

import * as fs from "node:fs";
import { assertSafeGitRef, assertSafeGitRepo } from "../domain/GitSafety";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawnSync } from "node:child_process";

export const DEFAULT_CACHE_DIR = path.join(os.homedir(), ".cache", "specgate", "packs");
const GIT_TIMEOUT_MS = 60_000;

export function repoHash(repo: string): string {
  return crypto.createHash("sha256").update(String(repo)).digest("hex").slice(0, 16);
}

export function safeVersionDir(version: string): string {
  return String(version).replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** The two knobs every git invocation here needs. */
interface GitOptions {
  timeout?: number;
  cwd?: string;
}

function runGit(args: string[], options: GitOptions = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    timeout: options.timeout || GIT_TIMEOUT_MS,
    cwd: options.cwd,
  });
  if (result.error) {
    throw new Error(`git ${args[0]} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    throw new Error(`git ${args[0]} exited ${result.status}: ${stderr || "unknown error"}`);
  }
  return (result.stdout || "").trim();
}

export function gitAvailable() {
  const result = spawnSync("git", ["--version"], { encoding: "utf8" });
  return result.status === 0;
}

/** Offline mode: opt-in via option or the SPECGATE_OFFLINE env var (CI-friendly). */
function isOffline(opts: { offline?: boolean }): boolean {
  if (typeof opts.offline === "boolean") return opts.offline;
  const env = process.env.SPECGATE_OFFLINE;
  return env === "1" || env === "true";
}

/** What `resolveRemotePack` needs. `repo` and `version` are checked, not assumed. */
export interface ResolveRemotePackOptions {
  repo?: string;
  version?: string;
  cacheDir?: string;
  force?: boolean;
  offline?: boolean;
}

/** A pack checked out in the local cache. */
export interface ResolvedPack {
  packRoot: string;
  commit: string;
  version: string;
  cached: boolean;
}

export function resolveRemotePack(
  options: ResolveRemotePackOptions | null | undefined
): ResolvedPack {
  const opts: ResolveRemotePackOptions = options || {};
  if (!opts.repo) throw new Error("resolveRemotePack: 'repo' is required");
  if (!opts.version) throw new Error("resolveRemotePack: 'version' is required");
  if (!gitAvailable()) throw new Error("resolveRemotePack: 'git' is not available on PATH");

  const cacheRoot = opts.cacheDir || DEFAULT_CACHE_DIR;
  const targetDir = path.join(cacheRoot, repoHash(opts.repo), safeVersionDir(opts.version));

  const cached = fs.existsSync(path.join(targetDir, ".git"));
  if (cached && !opts.force) {
    const commit = runGit(["rev-parse", "HEAD"], { cwd: targetDir });
    return { packRoot: targetDir, commit, version: opts.version, cached: true };
  }

  if (isOffline(opts)) {
    throw new Error(
      `Offline mode: pack ${opts.repo}@${opts.version} is not in the local cache (${targetDir}).\n` +
        "Fix: on a connected machine run `specgate pack bundle --repo <url> --out pack.bundle`,\n" +
        "copy the bundle across, and use it as --pack-repo /path/to/pack.bundle."
    );
  }

  if (cached && opts.force) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  // Checked before git sees it: a value starting with `-` is an option to git,
  // and `--upload-pack=<cmd>` runs a command. `--` below stops the parsing; this
  // stops what `--` cannot (js/second-order-command-line-injection).
  const repo = assertSafeGitRepo(opts.repo, "pack repository");
  const version = assertSafeGitRef(opts.version, "pack version");

  fs.mkdirSync(path.dirname(targetDir), { recursive: true });

  // Shallow clone with the specific ref. Works for tags and branches.
  // Falls back to a full clone + checkout when --branch fails (e.g. for SHAs).
  try {
    runGit(["clone", "--depth", "1", "--branch", version, "--", repo, targetDir]);
  } catch {
    // Either the ref is a SHA or shallow-with-branch isn't supported.
    fs.rmSync(targetDir, { recursive: true, force: true });
    runGit(["clone", "--", repo, targetDir]);
    runGit(["checkout", "--detach", version, "--"], { cwd: targetDir });
  }

  const commit = runGit(["rev-parse", "HEAD"], { cwd: targetDir });
  return { packRoot: targetDir, commit, version: opts.version, cached: false };
}

/**
 * Create a single-file git bundle of a pack repository (all refs and tags),
 * transportable into air-gapped environments. The bundle is a valid clone
 * source, so `--pack-repo /path/to/pack.bundle` works everywhere a URL does.
 */
export function createPackBundle(
  options: { repo?: string; out?: string; tmpDir?: string } | null | undefined
): { out: string; refs: string[] } {
  const opts: { repo?: string; out?: string; tmpDir?: string } = options || {};
  if (!opts.repo) throw new Error("createPackBundle: 'repo' is required");
  if (!opts.out) throw new Error("createPackBundle: 'out' is required");
  if (!gitAvailable()) throw new Error("createPackBundle: 'git' is not available on PATH");

  const tmpRoot = opts.tmpDir || fs.mkdtempSync(path.join(os.tmpdir(), "specgate-bundle-"));
  const mirrorDir = path.join(tmpRoot, "mirror.git");
  try {
    // A mirror clone carries every branch and tag — bundles from shallow
    // clones are rejected by git, so this must be a full mirror.
    runGit(
      ["clone", "--mirror", "--", assertSafeGitRepo(opts.repo, "pack repository"), mirrorDir],
      {
        timeout: 300_000,
      }
    );
    const outAbs = path.resolve(opts.out);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    runGit(["bundle", "create", outAbs, "--all"], { cwd: mirrorDir });
    const refs = runGit(["bundle", "list-heads", outAbs])
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split(" ").slice(1).join(" "));
    return { out: outAbs, refs };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}
