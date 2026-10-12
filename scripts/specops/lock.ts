import { DiskLockfileRepository } from "../../packages/core/src/infrastructure/DiskLockfileRepository";
import { Lockfile, PackEntry } from "../../packages/core/src/domain/Lockfile";

/**
 * Lock schema properties:
 * "specops_version"
 * "pack_id"
 */

export const LOCK_FILENAME = Lockfile.FILENAME;
export const SPECOPS_SCHEMA_VERSION = Lockfile.CURRENT_SCHEMA_VERSION;

export function readLock(projectDir: string): any {
  const repo = new DiskLockfileRepository(projectDir);
  const lock = repo.readLock();
  return lock ? lock.toJSON() : null;
}

export function upsertPackEntry(lockJson: any, entry: PackEntry): any {
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
  lockJson: any,
  options: WriteOptions = {}
): { path: string; written: boolean } {
  const repo = new DiskLockfileRepository(projectDir);
  const lock = lockJson
    ? new Lockfile(lockJson.specops_version, lockJson.specgate_version, lockJson.packs || [])
    : Lockfile.createEmpty();

  return repo.writeLock(lock, options);
}

export function newLock(specgateVersion?: string): any {
  return Lockfile.createEmpty(specgateVersion).toJSON();
}
