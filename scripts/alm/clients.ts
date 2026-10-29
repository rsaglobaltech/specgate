import { getProvider } from "./providers";
import type { AlmClient, AlmConfig, FetchLike } from "./port";

/**
 * Client construction, resolved through the provider registry.
 *
 * This file used to *be* the two connectors, selected by a ternary on
 * `cfg.provider`. The connectors now live in `providers/` behind the
 * `AlmProvider` port (see `port.ts` for why), and what is left here is the
 * lookup plus the names the rest of the tree already imports.
 *
 * A client carries its provider's capabilities, because the core has to know
 * what an ALM cannot do — `syncRequirements` reports a requirement it cannot
 * close rather than throwing — and the client is the only thing it holds.
 */
export function makeClient(cfg: AlmConfig, fetchImpl?: FetchLike, projectDir?: string): AlmClient {
  return getProvider(cfg.provider, projectDir).create(cfg, fetchImpl);
}

// The two provider-specific factories, kept under the names they have always
// had. Callers that want one connector directly — the tests do — should not
// have to know the registry exists.
export const jiraClient = (cfg: AlmConfig, fetchImpl?: FetchLike): AlmClient =>
  getProvider("jira").create(cfg, fetchImpl);

export const azureClient = (cfg: AlmConfig, fetchImpl?: FetchLike): AlmClient =>
  getProvider("azure").create(cfg, fetchImpl);

export const githubClient = (cfg: AlmConfig, fetchImpl?: FetchLike): AlmClient =>
  getProvider("github").create(cfg, fetchImpl);

export const linearClient = (cfg: AlmConfig, fetchImpl?: FetchLike): AlmClient =>
  getProvider("linear").create(cfg, fetchImpl);
