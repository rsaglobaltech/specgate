/**
 * One pull request per ticket, on GitHub (ADR-0039 §4).
 *
 * The pull request belongs to the repository, not to the ALM: this lives
 * outside `scripts/alm/`, whose port still only creates, reads, closes and
 * lists issues. It opens or updates a pull request, and nothing else — no
 * merge, no close, no branch deletion. The token comes from the environment
 * variable `pr.token_env` names and is never printed.
 */

import type { FetchLike } from "../alm/port";
import { assertSecureUrl } from "../alm/providers/http-client";

export interface PrConfig {
  repo: string;
  base: string;
  tokenEnv: string;
  apiUrl: string;
}

export interface PullRequest {
  number: number;
  url: string;
  action: "created" | "updated";
}

/** The `pr:` block of `alm.config.yaml`, checked; throws with a fix. */
export function prConfig(raw: unknown): PrConfig {
  const pr = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const provider = String(pr.provider ?? "github");
  if (provider !== "github") {
    throw new Error(`pr.provider '${provider}' is not supported.\nFix: set pr.provider: github.`);
  }
  const repo = String(pr.repo ?? "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error(
      "alm.config.yaml has no pr.repo.\nFix: add\npr:\n  provider: github\n  repo: <owner>/<repo>\n  base: develop\n  token_env: GITHUB_TOKEN"
    );
  }
  const apiUrl = String(pr.base_url ?? "https://api.github.com").replace(/\/$/, "");
  assertSecureUrl(apiUrl, "pr.base_url");
  return {
    repo,
    base: String(pr.base ?? "develop"),
    tokenEnv: String(pr.token_env ?? "GITHUB_TOKEN"),
    apiUrl,
  };
}

interface OpenPr {
  number: number;
  html_url: string;
  title?: string;
  body?: string | null;
  base?: { ref?: string };
}

const BLOCK = /<!-- specgate:pr [^>]*-->[\s\S]*?<!-- \/specgate:pr -->/;
/** The block's opening marker, its closer deleted: everything after it was ours. */
const OPENED = /<!-- specgate:pr [^>]*-->[\s\S]*$/;

/** The description with Specgate's block replaced, or added after what is there. */
export function mergeBody(current: string, block: string): string {
  if (BLOCK.test(current)) return current.replace(BLOCK, () => block);
  if (OPENED.test(current)) return current.replace(OPENED, () => block);
  return current.trim() ? `${current.trimEnd()}\n\n${block}` : block;
}

export async function openOrUpdatePr(
  cfg: PrConfig,
  pr: { head: string; key: string; title: string; body: string },
  fetchImpl: FetchLike = (globalThis as { fetch: FetchLike }).fetch
): Promise<PullRequest> {
  const token = process.env[cfg.tokenEnv];
  if (!token) {
    throw new Error(
      `Environment variable ${cfg.tokenEnv} is not set.\n` +
        "Fix: export a token that may write pull requests to this repository " +
        "(a fine-grained token for this repository with Pull requests: read and write; pushing uses your git credentials)."
    );
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const call = async <T>(path: string, what: string, init: Record<string, unknown> = {}) => {
    const res = await fetchImpl(`${cfg.apiUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`GitHub: ${what} failed: HTTP ${res.status} ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  };
  const owner = cfg.repo.split("/")[0];
  const open = await call<OpenPr[]>(
    `/repos/${cfg.repo}/pulls?head=${encodeURIComponent(`${owner}:${pr.head}`)}` +
      `&base=${encodeURIComponent(cfg.base)}&state=open`,
    `list the pull requests of ${pr.head}`
  );
  const mine = open.find((p) => !p.base || p.base.ref === cfg.base);
  if (mine) {
    // What a person wrote stays: the title, once it names the ticket, and
    // every line outside Specgate's own block of the description.
    const patch: Record<string, string> = { body: mergeBody(mine.body ?? "", pr.body) };
    const key = pr.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`(^|[^A-Z0-9_-])${key}(?![0-9])`).test(mine.title ?? ""))
      patch.title = pr.title;
    const updated = await call<{ number: number; html_url: string }>(
      `/repos/${cfg.repo}/pulls/${mine.number}`,
      `update pull request #${mine.number}`,
      { method: "PATCH", body: JSON.stringify(patch) }
    );
    return { number: updated.number, url: updated.html_url, action: "updated" };
  }
  const created = await call<{ number: number; html_url: string }>(
    `/repos/${cfg.repo}/pulls`,
    `open a pull request for ${pr.head}`,
    {
      method: "POST",
      body: JSON.stringify({ title: pr.title, head: pr.head, base: cfg.base, body: pr.body }),
    }
  );
  return { number: created.number, url: created.html_url, action: "created" };
}
