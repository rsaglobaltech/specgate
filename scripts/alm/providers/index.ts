import { jiraProvider } from "./jira";
import { azureProvider } from "./azure";
import { githubProvider } from "./github";
import { linearProvider } from "./linear";
import { checkProviderDeclaration } from "../port";
import type { AlmProvider } from "../port";

/**
 * The provider registry. Adding an ALM is a row here plus a module beside it;
 * nothing else in the CLI learns its name.
 *
 * The conformance kit iterates this list, so a provider that is registered is
 * a provider that is tested — there is no way to add one quietly.
 */
export const PROVIDERS: readonly AlmProvider[] = [
  jiraProvider,
  azureProvider,
  githubProvider,
  linearProvider,
];

const BY_ID: ReadonlyMap<string, AlmProvider> = new Map(PROVIDERS.map((p) => [p.id, p]));

/** Every registered provider id, in registration order. */
export const providerIds = (): string[] => PROVIDERS.map((p) => p.id);

// ── community providers ──────────────────────────────────────────────────────
//
// Two tiers, because the alternative is worse in both directions. Every
// connector is somebody else's API, changing on their schedule; carrying six of
// them here would make this repository's release cadence hostage to six
// vendors. Refusing them all would make the tool useless to a team on YouTrack.
//
// So: `jira`, `azure`, `github` and `linear` are core — maintained here, exercised by the
// conformance kit in CI. Anything else is resolved by package name:
//
//     provider: npm:specgate-alm-youtrack
//
// **This runs third-party code, and that code is handed your ALM credential**,
// because a connector cannot talk to a board without one. The trust model is
// therefore exactly that of a devDependency, and the guards below are the ones
// that make it no worse than that:
//
//   - nothing is ever installed automatically. The package must already be in
//     the project's `node_modules`, which means somebody added it deliberately
//     and it went through whatever review dependencies get;
//   - the name must be a package name — no paths, no URLs, no `..`. A config
//     file cannot be made to load an arbitrary file off the disk;
//   - the module is checked against the port before a single method is called,
//     so a package that is not a provider fails with a diagnostic rather than a
//     stack trace from inside `sync`.

const PACKAGE_PREFIX = "npm:";

/** npm's own naming rules, minus the length limit: scoped or bare, lowercase. */
const PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

export const isCommunityProvider = (id: string): boolean => String(id).startsWith(PACKAGE_PREFIX);

/** Cache by resolved path: a provider is a module, and re-requiring it is pointless. */
const communityCache = new Map<string, AlmProvider>();

function loadCommunityProvider(id: string, projectDir: string): AlmProvider {
  const packageName = id.slice(PACKAGE_PREFIX.length);

  if (!PACKAGE_NAME.test(packageName)) {
    throw new Error(
      `Invalid community provider '${id}'.\n` +
        "Fix: `provider: npm:<package-name>` — a package name, not a path or a URL. " +
        "Loading a provider from a path would let a config file run any file on the disk."
    );
  }

  let entry: string;
  try {
    entry = require.resolve(packageName, { paths: [projectDir] });
  } catch {
    throw new Error(
      `ALM provider package '${packageName}' is not installed in this project.\n` +
        `Fix: install it first — npm install --save-dev ${packageName}\n` +
        "It is never installed automatically: a provider runs in your process and " +
        "is given your ALM token, so adding one is a dependency decision, not a " +
        "configuration one."
    );
  }

  const cached = communityCache.get(entry);
  if (cached) return cached;

  const loaded = require(entry);
  const provider = (loaded && loaded.default ? loaded.default : loaded) as AlmProvider;

  const problems = checkProviderDeclaration(provider);
  if (problems.length > 0) {
    throw new Error(
      `'${packageName}' does not implement the ALM provider contract:\n` +
        problems.map((p) => `  - ${p}`).join("\n") +
        "\nFix: report it to the package author. The contract is documented in docs/alm.md."
    );
  }

  communityCache.set(entry, provider);
  return provider;
}

/**
 * Look one up, or explain which ones exist.
 *
 * @param projectDir where a community package is resolved from. Required for
 *                   `npm:` ids; core providers never need it.
 */
export function getProvider(id: string, projectDir?: string): AlmProvider {
  if (isCommunityProvider(id)) {
    if (!projectDir) {
      throw new Error(
        `Community provider '${id}' needs a project directory to resolve from.\n` +
          "Fix: this is a bug in the caller — report it."
      );
    }
    return loadCommunityProvider(id, projectDir);
  }

  const provider = BY_ID.get(id);
  if (!provider) {
    throw new Error(
      `Unknown ALM provider '${id}'. Available: ${providerIds().join(", ")}.\n` +
        "Fix: set `provider:` in alm.config.yaml to one of those, or to " +
        "`npm:<package>` for a community connector you have installed."
    );
  }
  return provider;
}
