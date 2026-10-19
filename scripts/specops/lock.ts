import { DiskLockfileRepository } from "../../packages/core/src/infrastructure/DiskLockfileRepository";
import { Lockfile, PackEntry } from "../../packages/core/src/domain/Lockfile";

/**
 * Lock schema properties:
 * "specops_version"
 * "pack_id"
 */

/** `.specops.lock` as JSON: what `Lockfile.toJSON()` produces. */
export interface LockJson {
  specops_version: number;
  specgate_version: string;
  packs: PackEntry[];
}

export const LOCK_FILENAME = Lockfile.FILENAME;
export const SPECOPS_SCHEMA_VERSION = Lockfile.CURRENT_SCHEMA_VERSION;

export function readLock(projectDir: string): LockJson | null {
  const repo = new DiskLockfileRepository(projectDir);
  const lock = repo.readLock();
  return lock ? lock.toJSON() : null;
}

export function upsertPackEntry(lockJson: LockJson | null, entry: PackEntry): LockJson {
  const lock = lockJson
    ? new Lockfile(lockJson.specops_version, lockJson.specgate_version, lockJson.packs || [])
    : Lockfile.createEmpty();

  lock.upsertPack(entry);
  return lock.toJSON();
}

export interface WriteOptions {
  dryRun?: boolean;
}

export function writeLock(
  projectDir: string,
  lockJson: LockJson | null,
  options: WriteOptions = {}
): { path: string; written: boolean } {
  const repo = new DiskLockfileRepository(projectDir);
  const lock = lockJson
    ? new Lockfile(lockJson.specops_version, lockJson.specgate_version, lockJson.packs || [])
    : Lockfile.createEmpty();

  return repo.writeLock(lock, options);
}

export function newLock(specgateVersion?: string): LockJson {
  return Lockfile.createEmpty(specgateVersion).toJSON();
}
