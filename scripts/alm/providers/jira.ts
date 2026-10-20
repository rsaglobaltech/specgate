import { HttpAlmClient } from "./http-client";
import type {
  AlmCapabilities,
  AlmConfig,
  AlmProvider,
  FetchLike,
  HttpResponse,
  IssueRef,
  IssueStatus,
  IssueSummary,
} from "../port";

/** The slices of Jira's REST responses this connector reads. */
interface JiraIssue {
  readonly key: string;
}
interface JiraStatusResponse {
  readonly fields?: { readonly status?: { readonly statusCategory?: { readonly key?: string } } };
}
interface JiraTransition {
  readonly id: string;
  readonly to?: { readonly statusCategory?: { readonly key?: string } };
}
interface JiraTransitions {
  readonly transitions?: readonly JiraTransition[];
}
interface JiraSearchResult {
  readonly issues?: readonly {
    readonly key: string;
    readonly fields?: { readonly summary?: string; readonly description?: unknown };
  }[];
  readonly nextPageToken?: string;
  readonly isLast?: boolean;
}

/** Issues per page, the most `/search/jql` returns with these fields. */
const PAGE_SIZE = 100;
/** Where a search stops: a pull of more than this is a query to narrow, not a page to read. */
export const SEARCH_LIMIT = 1000;
/** Atlassian's API gateway, the only door a token created with scopes opens. */
const GATEWAY = "https://api.atlassian.com/ex/jira";

/**
 * Jira Cloud.
 *
 * "Done" is not a state here, it is a *category*: Jira's workflows are
 * per-project, so the only portable question is whether the current status
 * belongs to the `done` category, and the only portable way to close is to
 * find a transition that leads to one. That is why this provider declares no
 * `done_state` — configuring one would be read by nobody.
 */
class JiraClient extends HttpAlmClient {
  readonly capabilities: AlmCapabilities = {
    create: true,
    readStatus: true,
    close: true,
    listIssues: true,
  };

  private readonly headers: Readonly<Record<string, string>>;
  private readonly projectKey: string;
  private readonly issueType: string;
  private readonly cloudId: string | undefined;
  private gateway: Promise<string> | undefined;

  constructor(cfg: AlmConfig, fetchImpl?: FetchLike) {
    super(cfg, fetchImpl);
    const token = HttpAlmClient.requireEnv(cfg.token_env);
    // Jira Cloud's Basic auth pairs the token with an account email, and
    // $JIRA_USER is the conventional home for it.
    const user = HttpAlmClient.requireEnv(cfg.user_env ?? "JIRA_USER");
    this.headers = {
      Authorization: `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}`,
      "Content-Type": "application/json",
    };
    this.projectKey = String(cfg.project_key ?? "");
    this.issueType = cfg.issue_type ?? "Task";
    this.cloudId = cfg.cloud_id ? String(cfg.cloud_id).trim() : undefined;
  }

  /**
   * The site, or — with `cloud_id` — the gateway. `auto` asks the site for
   * its id once, without credentials: `tenant_info` is public, and a token
   * has no business travelling to an endpoint that does not need it.
   */
  protected override apiBase(): Promise<string> {
    if (!this.cloudId) return Promise.resolve(this.baseUrl);
    this.gateway ??= this.resolveCloudId().then((id) => `${GATEWAY}/${id}`);
    return this.gateway;
  }

  private async resolveCloudId(): Promise<string> {
    if (this.cloudId !== "auto") return this.cloudId!;
    const res = await this.fetchImpl(`${this.baseUrl}/_edge/tenant_info`, {
      headers: { Accept: "application/json" },
    });
    const body = res.ok ? ((await res.json()) as { cloudId?: unknown }) : {};
    if (typeof body.cloudId !== "string" || !body.cloudId) {
      throw new Error(
        `Jira: could not read the site id from ${this.baseUrl}/_edge/tenant_info (HTTP ${res.status}).\n` +
          "Fix: check base_url, or set cloud_id to the site id itself."
      );
    }
    return body.cloudId;
  }

  /**
   * Jira answers a credential it rejects as an anonymous request: a search
   * returns 200 and no issues, and only `X-Seraph-LoginReason` tells. Read as
   * a 401, so a scoped token sent to the site is not "nothing found".
   */
  protected override refusedAs(res: HttpResponse): number | undefined {
    return res.headers?.get?.("x-seraph-loginreason") === "AUTHENTICATED_FAILED" ? 401 : undefined;
  }

  protected override fixFor(status: number): string | undefined {
    if (status === 401 && !this.cloudId) {
      return (
        "a token created with scopes only works through Atlassian's gateway — " +
        "set `cloud_id: auto` in alm.config.yaml. Otherwise check the token and the account email."
      );
    }
    if (status === 401)
      return "check the token, its scopes (read:jira-work) and the account email.";
    return undefined;
  }

  async createIssue(reqId: string, title: string): Promise<IssueRef> {
    const created = await this.requestJson<JiraIssue>(
      "/rest/api/3/issue",
      `Jira create issue for ${reqId}`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          fields: {
            project: { key: this.projectKey },
            issuetype: { name: this.issueType },
            summary: `${reqId} — ${title}`,
            labels: ["spec-driven", reqId],
          },
        }),
      }
    );
    return { key: created.key, url: `${this.baseUrl}/browse/${created.key}` };
  }

  async getIssueStatus(issueKey: string): Promise<IssueStatus> {
    const issue = await this.requestJson<JiraStatusResponse>(
      `/rest/api/3/issue/${issueKey}?fields=status`,
      `Jira read ${issueKey}`,
      { headers: this.headers }
    );
    return issue.fields?.status?.statusCategory?.key === "done" ? "done" : "open";
  }

  /**
   * Open issues carrying a label, via JQL, page by page.
   *
   * The project is pinned as well as the label: a label is global in Jira, so
   * searching on it alone reaches across every project the credential can see.
   *
   * Jira Cloud returns `description` as Atlassian Document Format — a document
   * tree, not a string — so the text is flattened out of it. A body that does
   * not flatten comes back empty rather than as `[object Object]`.
   */
  async listIssues(label: string): Promise<IssueSummary[]> {
    const jql = `project = "${this.projectKey}" AND labels = "${label}" AND statusCategory != Done`;
    const found: IssueSummary[] = [];
    let token: string | undefined;
    // `/search/jql` pages with a token, not an offset: a page says whether it
    // is the last, and the next one is asked for by the token the last gave.
    do {
      const result = await this.requestJson<JiraSearchResult>(
        `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,description` +
          `&maxResults=${PAGE_SIZE}` +
          (token ? `&nextPageToken=${encodeURIComponent(token)}` : ""),
        `Jira search for issues labelled ${label}`,
        { headers: this.headers }
      );
      for (const issue of result.issues ?? []) {
        found.push({
          key: issue.key,
          title: String(issue.fields?.summary ?? ""),
          body: flattenAdf(issue.fields?.description),
          url: `${this.baseUrl}/browse/${issue.key}`,
        });
      }
      token = result.isLast ? undefined : result.nextPageToken;
      if (token && found.length >= SEARCH_LIMIT) {
        process.stderr.write(
          `Jira: stopped after ${SEARCH_LIMIT} issues labelled ${label}; narrow the label to pull the rest.\n`
        );
        break;
      }
    } while (token);
    return found;
  }

  async closeIssue(issueKey: string): Promise<void> {
    const transition = await this.findDoneTransition(issueKey);
    await this.request(`/rest/api/3/issue/${issueKey}/transitions`, `Jira transition ${issueKey}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ transition: { id: transition.id } }),
    });
  }

  /** The workflow decides which transition means done; there may be none. */
  private async findDoneTransition(issueKey: string): Promise<JiraTransition> {
    const { transitions } = await this.requestJson<JiraTransitions>(
      `/rest/api/3/issue/${issueKey}/transitions`,
      `Jira list transitions for ${issueKey}`,
      { headers: this.headers }
    );
    const done = (transitions ?? []).find((t) => t.to?.statusCategory?.key === "done");
    if (!done) {
      throw new Error(`Jira: no transition to a done state available for ${issueKey}.`);
    }
    return done;
  }
}

/**
 * The plain text inside an Atlassian Document Format value.
 *
 * ADF nests content nodes arbitrarily; only the `text` leaves matter here, and
 * a shape this does not recognise yields "" rather than a stringified object.
 */
function flattenAdf(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const node = value as { text?: unknown; content?: unknown };
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return node.content
    .map((child) => flattenAdf(child))
    .filter(Boolean)
    .join("\n")
    .trim();
}

export const jiraProvider: AlmProvider = {
  id: "jira",
  label: "Jira Cloud",
  config: {
    required: ["base_url", "project_key", "token_env"],
    // Optional because $JIRA_USER is the conventional default. Naming the
    // variable in the config is better, not compulsory.
    // `cloud_id` routes a token created with scopes through Atlassian's
    // gateway: a site id, or `auto` to read it from the site.
    optional: ["user_env", "issue_type", "cloud_id"],
  },
  capabilities: { create: true, readStatus: true, close: true, listIssues: true },
  create: (cfg, fetchImpl) => new JiraClient(cfg, fetchImpl),
};

export default jiraProvider;
