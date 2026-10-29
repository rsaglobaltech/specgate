import { HttpAlmClient } from "./http-client";
import type {
  AlmCapabilities,
  AlmConfig,
  AlmProvider,
  FetchLike,
  IssueComment,
  IssueRef,
  IssueStatus,
  IssueSummary,
  Phase,
} from "../port";

/** The slices of GitHub's issue responses this connector reads. */
interface GitHubIssue {
  readonly id?: number;
  readonly number: number;
  readonly title?: string;
  readonly body?: string | null;
  /** Present when the "issue" is really a pull request. */
  readonly pull_request?: unknown;
  readonly html_url?: string;
  readonly state?: string;
  /** "completed" | "not_planned" | "reopened" | null — only on closed issues. */
  readonly state_reason?: string | null;
}

/** github.com. A GitHub Enterprise Server install sets `base_url` instead. */
const PUBLIC_API = "https://api.github.com";

/** Pinned so a future default does not change what this connector sends. */
const API_VERSION = "2022-11-28";

/**
 * GitHub Issues.
 *
 * The unit is a **repository**, not a project, which is why this provider
 * declares `repo` rather than reusing `project_key`. Writing
 * `project_key: acme/widgets` would read as a lie, and the config contract
 * exists precisely so a provider can say what it actually needs.
 *
 * There is no `issue_type`: GitHub has labels, and the connector applies the
 * same two every other provider does. There is no `done_state` either — an
 * issue is open or closed — and declaring one would be read by nobody, which
 * is the defect `done_state` on Jira already was.
 *
 * **Closed is not always done.** GitHub distinguishes closing an issue as
 * `completed` from closing it as `not_planned`, and only the first means the
 * work happened. Collapsing both to "done" would tell the traceability matrix
 * a requirement was delivered when the team had in fact abandoned it — so
 * `not_planned` reads as open, and the mismatch surfaces as drift for a human,
 * which is what ADR-0021 asks for.
 */
class GitHubClient extends HttpAlmClient {
  readonly capabilities: AlmCapabilities = GITHUB_CAPABILITIES;

  private readonly headers: Readonly<Record<string, string>>;
  private readonly repo: string;

  constructor(cfg: AlmConfig, fetchImpl?: FetchLike) {
    // github.com has one API host, so `base_url` is only for Enterprise Server.
    // Defaulting here keeps it out of every config that does not need it.
    super({ ...cfg, base_url: cfg.base_url ?? PUBLIC_API }, fetchImpl);

    const token = HttpAlmClient.requireEnv(cfg.token_env);
    this.headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": API_VERSION,
      "Content-Type": "application/json",
    };
    this.repo = GitHubClient.requireRepo(cfg.repo);
  }

  /**
   * `owner/name`, checked here rather than discovered as a 404.
   *
   * A bare repository name builds `/repos/widgets/issues`, which GitHub answers
   * with a 404 that says nothing about the real mistake.
   */
  private static requireRepo(value: unknown): string {
    const repo = String(value ?? "").replace(/^\/+|\/+$/g, "");
    if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
      throw new Error(
        `alm.config.yaml: repo '${String(value ?? "")}' is not in owner/name form.\n` +
          "Fix: write it as `repo: acme/widgets`."
      );
    }
    return repo;
  }

  async createIssue(reqId: string, title: string): Promise<IssueRef> {
    const created = await this.requestJson<GitHubIssue>(
      `/repos/${this.repo}/issues`,
      `GitHub create issue for ${reqId}`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          title: `${reqId} — ${title}`,
          labels: ["spec-driven", reqId],
        }),
      }
    );
    // The number is enough to address the issue because the repository comes
    // from the config — the same shape Azure uses for its work-item ids.
    return { key: String(created.number), url: created.html_url ?? null };
  }

  async getIssueStatus(issueKey: string): Promise<IssueStatus> {
    const issue = await this.requestJson<GitHubIssue>(
      `/repos/${this.repo}/issues/${issueKey}`,
      `GitHub read issue ${issueKey}`,
      { headers: this.headers }
    );
    if (issue.state !== "closed") return "open";
    return issue.state_reason === "not_planned" ? "open" : "done";
  }

  /**
   * Open issues carrying a label.
   *
   * `pulls` are filtered out: GitHub's issues endpoint returns pull requests
   * too — every PR is an issue — and a pull request is not a requirement
   * somebody proposed.
   */
  async listIssues(label: string): Promise<IssueSummary[]> {
    const issues = await this.requestJson<GitHubIssue[]>(
      `/repos/${this.repo}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=100`,
      `GitHub list issues labelled ${label}`,
      { headers: this.headers }
    );
    return (issues || [])
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        key: String(issue.number),
        title: String(issue.title ?? ""),
        body: String(issue.body ?? ""),
        url: issue.html_url ?? null,
      }));
  }

  /**
   * REQ-305: GitHub has two states, so a phase short of archived is a label —
   * `specgate:proposed`, `specgate:building`, or the one `phases:` names — and
   * the other phase's label comes off. Archived closes the issue.
   */
  async setPhase(issueKey: string, phase: Phase, state?: string): Promise<string> {
    const n = issueNumber(issueKey);
    if (phase === "archived") {
      await this.closeIssue(n);
      return "closed";
    }
    const label = state ?? `specgate:${phase}`;
    const other = phase === "proposed" ? "specgate:building" : "specgate:proposed";
    await this.request(`/repos/${this.repo}/issues/${n}/labels`, `GitHub label issue ${n}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ labels: [label] }),
    });
    // The other phase's label may never have been set: a 404 is the answer
    // that it is not there, which is what removing it wanted.
    await this.fetchImpl(
      `${this.baseUrl}/repos/${this.repo}/issues/${n}/labels/${encodeURIComponent(other)}`,
      { method: "DELETE", headers: this.headers }
    );
    return label;
  }

  /** REQ-307: a new issue, attached to its parent as a sub-issue. */
  async createSubIssue(parentKey: string, title: string): Promise<IssueRef> {
    const parent = issueNumber(parentKey);
    const created = await this.requestJson<GitHubIssue>(
      `/repos/${this.repo}/issues`,
      `GitHub create a sub-issue of #${parent}`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ title, labels: ["spec-driven"] }),
      }
    );
    await this.request(
      `/repos/${this.repo}/issues/${parent}/sub_issues`,
      `GitHub attach #${created.number} to #${parent}`,
      { method: "POST", headers: this.headers, body: JSON.stringify({ sub_issue_id: created.id }) }
    );
    return { key: String(created.number), url: created.html_url ?? null };
  }

  /** REQ-306: the issue's comments, oldest first. */
  async listComments(issueKey: string): Promise<IssueComment[]> {
    const comments = await this.requestJson<
      { id: number; user?: { login?: string }; body?: string | null }[]
    >(
      `/repos/${this.repo}/issues/${issueNumber(issueKey)}/comments?per_page=100`,
      `GitHub read the comments of #${issueKey}`,
      { headers: this.headers }
    );
    return (comments || []).map((c) => ({
      id: String(c.id),
      author: String(c.user?.login ?? ""),
      body: String(c.body ?? ""),
    }));
  }

  /** REQ-306: the issue's title and body. */
  async readIssueText(issueKey: string): Promise<{ title: string; body: string }> {
    const issue = await this.requestJson<GitHubIssue>(
      `/repos/${this.repo}/issues/${issueNumber(issueKey)}`,
      `GitHub read issue #${issueKey}`,
      { headers: this.headers }
    );
    return { title: String(issue.title ?? ""), body: String(issue.body ?? "") };
  }

  async closeIssue(issueKey: string): Promise<void> {
    await this.request(`/repos/${this.repo}/issues/${issueKey}`, `GitHub close issue ${issueKey}`, {
      method: "PATCH",
      headers: this.headers,
      // `completed` rather than the default, so `getIssueStatus` reads back
      // as done and the two halves of this connector agree.
      body: JSON.stringify({ state: "closed", state_reason: "completed" }),
    });
  }
}

/** An issue number as a path segment. */
function issueNumber(key: string): string {
  const n = String(key).replace(/^#/, "");
  if (!/^\d+$/.test(n)) throw new Error(`GitHub: '${key}' is not an issue number.`);
  return n;
}

const GITHUB_CAPABILITIES: AlmCapabilities = {
  create: true,
  readStatus: true,
  close: true,
  listIssues: true,
  phase: true,
  subIssues: true,
  comments: true,
  readText: true,
};

export const githubProvider: AlmProvider = {
  id: "github",
  label: "GitHub Issues",
  config: {
    required: ["repo", "token_env"],
    // Only GitHub Enterprise Server needs a base URL; github.com is the default.
    optional: ["base_url"],
  },
  capabilities: GITHUB_CAPABILITIES,
  create: (cfg, fetchImpl) => new GitHubClient(cfg, fetchImpl),
};

export default githubProvider;
