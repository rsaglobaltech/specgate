/**
 * REQ-589: one download cache for every worktree of a run (`dependency_cache:
 * true`). Each requirement gets a fresh worktree, and its setup installs the
 * dependencies again; pointing every package manager's cache at one folder of
 * the project makes the second install read from disk instead of the network.
 *
 * Only caches of downloaded packages — never an installed tree such as
 * `node_modules`, which the agent may change and another worktree must not see.
 */

/** The variable each package manager reads its download cache from, and the folder under the cache. */
export const CACHE_VARIABLES: ReadonlyArray<readonly [string, string]> = [
  ["npm_config_cache", "npm"],
  ["YARN_CACHE_FOLDER", "yarn"],
  ["npm_config_store_dir", "pnpm"],
  ["PIP_CACHE_DIR", "pip"],
  ["UV_CACHE_DIR", "uv"],
  ["GOMODCACHE", "go/mod"],
  ["GOCACHE", "go/build"],
  ["NUGET_PACKAGES", "nuget"],
];

/**
 * The environment that points every package manager at `root` (with `/`),
 * leaving alone any variable the person already set.
 */
export function cacheEnvironment(
  root: string,
  env: Record<string, string | undefined>
): Record<string, string> {
  const out: Record<string, string> = {};
  const base = root.replace(/[\\/]+$/, "");
  for (const [name, folder] of CACHE_VARIABLES) {
    if (env[name]) continue;
    out[name] = `${base}/${folder}`;
  }
  return out;
}
