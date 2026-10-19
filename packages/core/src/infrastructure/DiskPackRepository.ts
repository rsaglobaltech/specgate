/**
 * Reading packs and writing expanded files.
 *
 * The rules a pack must satisfy live in `domain/PackSpec`; this is the half
 * that touches a disk — loading `pack.yaml`, reading a template, writing an
 * expanded file, and refusing to write outside the project root.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { YamlDocument, parseYamlLite } from "../domain/YamlLite";
import {
  PackManifest,
  isSafeRelativePath,
  validatePackModel as validatePackSpec,
} from "../domain/PackSpec";
import { logInfo } from "./ConsoleReporter";

function fail(message: string): never {
  throw new Error(message);
}

/** A `pack.yaml` as read from disk, with where it was found. */
export interface LoadedPackFile {
  pack: YamlDocument;
  packFile: string;
  packRoot: string;
}

export function loadPack(packRoot: string, packId: string): LoadedPackFile {
  if (!packRoot) fail("Missing --pack-root <path>.");
  if (!packId) fail("Missing --pack <domain/type>.");

  const normalizedRoot = path.resolve(packRoot);
  const normalizedPackPath = path.resolve(normalizedRoot, packId);
  const packFile = path.join(normalizedPackPath, "pack.yaml");

  if (!normalizedPackPath.startsWith(normalizedRoot)) {
    fail(`Invalid pack path '${packId}'.`);
  }

  if (!fs.existsSync(packFile)) {
    fail(`Pack file not found: ${packFile}`);
  }

  const pack = parseYamlLite(fs.readFileSync(packFile, "utf8"));

  return {
    pack,
    packFile,
    packRoot: normalizedPackPath,
  };
}
export function ensureProjectDir(projectDir: string, dryRun: boolean): void {
  if (!projectDir) {
    fail("Missing --project-dir <path>.");
  }

  if (dryRun) return;

  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    fail(`Project directory does not exist: ${projectDir}`);
  }
}

export function readTemplate(packRoot: string, templatePath: string): string {
  return fs.readFileSync(path.resolve(packRoot, templatePath), "utf8");
}

// Records every file written in the current process so `expand` can snapshot
// a baseline after rendering. Reset per expansion via resetWrittenFiles().
/** One file `writeFile` put on disk, with what it wrote. */
export interface WrittenFile {
  file: string;
  content: string;
}

const _writtenFiles: WrittenFile[] = [];

export function writeFile(targetFile: string, content: string, dryRun: boolean): void {
  if (dryRun) {
    logInfo(`[dry-run] write ${targetFile}`);
    return;
  }

  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.writeFileSync(targetFile, content, "utf8");
  _writtenFiles.push({ file: targetFile, content });
}

export function getWrittenFiles(): WrittenFile[] {
  return _writtenFiles.slice();
}

export function resetWrittenFiles(): void {
  _writtenFiles.length = 0;
}

export function safeResolve(projectDir: string, relativePath: string): string {
  if (!isSafeRelativePath(relativePath)) {
    fail(`Invalid target path '${relativePath}'.`);
  }

  const absolute = path.resolve(projectDir, relativePath);
  const projectRoot = path.resolve(projectDir);
  if (!absolute.startsWith(projectRoot)) {
    fail(`Target path escapes project directory: '${relativePath}'.`);
  }

  return absolute;
}

/**
 * The pack rules, with the one filesystem question they ask wired to the real
 * disk. The rules themselves are pure and take the predicate explicitly; this
 * is the form every caller wants.
 */
export function validatePackModel(
  pack: PackManifest,
  packRoot: string
): { requiredVars: string[] } {
  return validatePackSpec(pack, packRoot, (absolute) => fs.existsSync(absolute));
}
