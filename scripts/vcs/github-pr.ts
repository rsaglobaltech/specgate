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
  return {
    repo,
    base: String(pr.base ?? "develop"),
    tokenEnv: String(pr.token_env ?? "GITHUB_TOKEN"),
    apiUrl: String(pr.base_url ?? "https://api.github.com").replace(/\/$/, ""),
  };
}

export async function openOrUpdatePr(
  cfg: PrConfig,
  pr: { head: string; title: string; body: string },
  fetchImpl: FetchLike = (globalThis as { fetch: FetchLike }).fetch
): Promise<PullRequest> {
  const token = process.env[cfg.tokenEnv];
  if (!token) {
    throw new Error(
      `Environment variable ${cfg.tokenEnv} is not set.\n` +
        "Fix: export a token that may write pull requests to this repository " +
        "(a fine-grained token: Contents and Pull requests, read and write)."
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
  const open = await call<Array<{ number: number; html_url: string }>>(
    `/repos/${cfg.repo}/pulls?head=${encodeURIComponent(`${owner}:${pr.head}`)}&state=open`,
    `list the pull requests of ${pr.head}`
  );
  if (open.length > 0) {
    const updated = await call<{ number: number; html_url: string }>(
      `/repos/${cfg.repo}/pulls/${open[0].number}`,
      `update pull request #${open[0].number}`,
      { method: "PATCH", body: JSON.stringify({ title: pr.title, body: pr.body }) }
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
