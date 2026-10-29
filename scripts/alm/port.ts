/**
 * `AlmProvider` — the contract every ALM connector implements.
 *
 * The two connectors that existed before this module were a ternary in
 * `clients.ts` over `provider === "jira"`, which scales to two and no further.
 * Worse, nothing recorded *which configuration keys each provider reads*, and
 * three consequences of that shipped:
 *
 *   1. a Jira config with no `user_env` passes validation and fails later with
 *      "Environment variable JIRA_USER is not set" — a variable the file never
 *      named;
 *   2. `alm.config.yaml` accepts any key at all, so `nonsense_key: 42` and a
 *      `user_env` on an Azure config are read by nobody and reported by
 *      nobody. `harness.config.yaml` takes the opposite position, in this same
 *      repository, and says why: a key nobody reads is worse than a missing
 *      one, because the file looks configured;
 *   3. `done_state` is read by Azure and ignored by Jira, which discovers the
 *      transition from the workflow. Setting it on a Jira project does
 *      nothing, silently.
 *
 * So a provider declares three things, and each is read by something:
 *
 *   `config`        which keys it requires and which it merely accepts.
 *                   `lintAlmConfig` reports the rest.
 *   `capabilities`  which operations it can perform. `syncRequirements`
 *                   degrades instead of throwing when one is missing.
 *   `create`        the factory, taking the validated config and a fetch
 *                   implementation so every provider is testable offline.
 *
 * The declaration is not decoration: `tests/unit/alm-conformance.test.ts`
 * runs the same suite against every registered provider and fails when an
 * implementation and its declaration disagree.
 */

/** What an issue looks like once created: the key to store, and where a human reads it. */
export interface IssueRef {
  readonly key: string;
  readonly url: string | null;
}

/**
 * The only two states the core distinguishes. Every provider collapses its own
 * vocabulary — Jira status categories, Azure `System.State`, GitHub open/closed
 * — into one of these, so the sync logic never learns any provider's words.
 */
export type IssueStatus = "open" | "done";

/**
 * Where a change stands, as the board shows it (REQ-305): open and not yet
 * built, one of its requirements being built, or archived. The board state of
 * each is the provider's default or the one `phases:` names.
 */
export type Phase = "proposed" | "building" | "archived";
export const PHASES: readonly Phase[] = ["proposed", "building", "archived"];

/** One comment of a ticket, as `alm pull` brings it back (REQ-306). */
export interface IssueComment {
  readonly id: string;
  readonly author: string;
  readonly body: string;
}

/** Operations a provider may support. A capability the core does not branch on does not belong here. */
export interface AlmCapabilities {
  readonly create: boolean;
  readonly readStatus: boolean;
  readonly close: boolean;
  /**
   * Can it hand back the issues carrying a label?
   *
   * `alm pull` needs to read the board, which every other operation does not:
   * create, read-status and close all address one issue whose key we already
   * hold. Searching is where the providers stop resembling each other — Jira
   * has JQL, GitHub has query parameters, Azure has WIQL — so it is declared
   * rather than assumed, and a provider without it degrades with a message
   * instead of failing at the first request.
   */
  readonly listIssues: boolean;
  /**
   * The capabilities of the 1.0 line (REQ-305..307). Optional, so a community
   * provider written for 0.27 still declares itself correctly; one that leaves
   * them out degrades with a message per change.
   */
  readonly phase?: boolean;
  readonly subIssues?: boolean;
  readonly comments?: boolean;
  readonly readText?: boolean;
}

/** Which keys of `alm.config.yaml` a provider reads. */
export interface AlmConfigContract {
  readonly required: readonly string[];
  readonly optional: readonly string[];
}

/**
 * A parsed `alm.config.yaml`. Deliberately open: `provider` decides which of
 * the remaining keys mean anything, and `lintAlmConfig` reports the rest.
 */
export interface AlmConfig {
  provider: string;
  base_url?: string;
  project_key?: string;
  token_env?: string;
  user_env?: string;
  issue_type?: string;
  done_state?: string;
  [key: string]: unknown;
}

/**
 * One issue as `alm pull` reads it.
 *
 * Title and body and nothing else, because that is all a board holds. There is
 * deliberately no field for an acceptance criterion: a ticket does not contain
 * one, and inventing a place to put it would invite pretending otherwise
 * (ADR-0021).
 */
export interface IssueSummary {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly url: string | null;
}

/** The narrow half: four async methods and no provider vocabulary. */
export interface AlmClient {
  readonly capabilities: AlmCapabilities;
  createIssue(reqId: string, title: string): Promise<IssueRef>;
  getIssueStatus(issueKey: string): Promise<IssueStatus>;
  closeIssue(issueKey: string): Promise<void>;
  /** Present only when `capabilities.listIssues` is true. */
  listIssues?(label: string): Promise<IssueSummary[]>;
  /**
   * One issue as the provider's own JSON, for `propose --from-ticket`
   * (ADR-0039). Read-only, and only for the configured project's keys.
   */
  readIssue?(key: string): Promise<unknown>;
  /**
   * Move an issue to the board state of a phase (REQ-305): `state` when
   * `phases:` names one, the provider's default otherwise. Answers the state
   * it set, in the board's words.
   */
  setPhase?(issueKey: string, phase: Phase, state?: string): Promise<string>;
  /** A child issue of `parentKey` (REQ-307). */
  createSubIssue?(parentKey: string, title: string): Promise<IssueRef>;
  /** The ticket's comments, oldest first (REQ-306). */
  listComments?(issueKey: string): Promise<IssueComment[]>;
  /** The ticket's title and description as text (REQ-306). */
  readIssueText?(issueKey: string): Promise<{ title: string; body: string }>;
}

/** The subset of `fetch` the providers use, so tests can replay recordings. */
export type FetchLike = (url: string, init?: Record<string, unknown>) => Promise<HttpResponse>;

export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  /** Absent in older fakes; a provider that reads a header must cope with that. */
  readonly headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface AlmProvider {
  readonly id: string;
  readonly label: string;
  readonly config: AlmConfigContract;
  readonly capabilities: AlmCapabilities;
  create(cfg: AlmConfig, fetchImpl?: FetchLike): AlmClient;
}

/** Every capability a provider must declare, for the checks that iterate them. */
export const CAPABILITIES: readonly (keyof AlmCapabilities)[] = [
  "create",
  "readStatus",
  "close",
  "listIssues",
];

/** The capabilities a provider may declare (REQ-305..307). */
export const OPTIONAL_CAPABILITIES: readonly (keyof AlmCapabilities)[] = [
  "phase",
  "subIssues",
  "comments",
  "readText",
];

/** The client method each capability promises. */
export const CAPABILITY_METHOD: Readonly<Record<keyof AlmCapabilities, keyof AlmClient>> = {
  create: "createIssue",
  readStatus: "getIssueStatus",
  close: "closeIssue",
  listIssues: "listIssues",
  phase: "setPhase",
  subIssues: "createSubIssue",
  comments: "listComments",
  readText: "readIssueText",
};

/**
 * Config keys the core itself reads, whatever the provider. `phases` names the
 * board state of each phase (REQ-305); `mirror: false` keeps `alm sync` from
 * creating an issue per requirement on a project whose tickets are the source.
 */
export const CORE_CONFIG_KEYS: readonly string[] = [
  "alm_version",
  "provider",
  "pr",
  "phases",
  "mirror",
];

/**
 * Check a provider declaration is well formed.
 *
 * Called by the conformance kit rather than at import time: a malformed
 * provider is a bug in this repository, not a condition a user can reach, and
 * paying for the check on every CLI start would be a tax on everyone.
 *
 * @returns problems, empty when the declaration is sound
 */
export function checkProviderDeclaration(provider: unknown): string[] {
  if (!provider || typeof provider !== "object") return ["provider is not an object"];

  const candidate = provider as Partial<AlmProvider>;
  const problems: string[] = [];
  const at = (msg: string) => problems.push(`${candidate.id ?? "(anonymous)"}: ${msg}`);

  if (typeof candidate.id !== "string" || !candidate.id) at("declares no id");
  if (typeof candidate.label !== "string" || !candidate.label) at("declares no label");
  if (typeof candidate.create !== "function") at("declares no create() factory");

  problems.push(...checkConfigContract(candidate));
  problems.push(...checkCapabilities(candidate));
  return problems;
}

function checkConfigContract(candidate: Partial<AlmProvider>): string[] {
  const label = candidate.id ?? "(anonymous)";
  const config = candidate.config;
  if (!config || typeof config !== "object") return [`${label}: declares no config contract`];

  const problems: string[] = [];
  for (const bucket of ["required", "optional"] as const) {
    if (!Array.isArray(config[bucket])) problems.push(`${label}: config.${bucket} is not an array`);
  }

  const declared = [...(config.required ?? []), ...(config.optional ?? [])];
  const duplicated = declared.filter((key, i) => declared.indexOf(key) !== i);
  if (duplicated.length > 0) problems.push(`${label}: declares ${duplicated.join(", ")} twice`);

  for (const key of declared) {
    if (CORE_CONFIG_KEYS.includes(key))
      problems.push(`${label}: re-declares the core key '${key}'`);
  }
  return problems;
}

function checkCapabilities(candidate: Partial<AlmProvider>): string[] {
  const label = candidate.id ?? "(anonymous)";
  const caps = candidate.capabilities;
  if (!caps || typeof caps !== "object") return [`${label}: declares no capabilities`];

  const problems: string[] = [];
  for (const capability of CAPABILITIES) {
    if (typeof caps[capability] !== "boolean") {
      problems.push(`${label}: capability '${capability}' is not declared as a boolean`);
    }
  }

  for (const capability of OPTIONAL_CAPABILITIES) {
    if (capability in caps && typeof caps[capability] !== "boolean") {
      problems.push(`${label}: capability '${capability}' is not declared as a boolean`);
    }
  }

  const known = [...CAPABILITIES, ...OPTIONAL_CAPABILITIES];
  const extra = Object.keys(caps).filter((name) => !known.includes(name as keyof AlmCapabilities));
  if (extra.length > 0) {
    problems.push(`${label}: declares unknown capabilit(y/ies): ${extra.join(", ")}`);
  }
  return problems;
}
