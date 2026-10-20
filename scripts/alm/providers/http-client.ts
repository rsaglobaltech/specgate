import type {
  AlmCapabilities,
  AlmClient,
  AlmConfig,
  FetchLike,
  HttpResponse,
  IssueRef,
  IssueStatus,
} from "../port";

/**
 * What every HTTP-backed ALM connector shares: a credential read from the
 * environment, a base URL that does not grow a doubled slash, and a refusal to
 * carry on past a failed response.
 *
 * Credentials come from environment variables named in `alm.config.yaml` —
 * never from the file itself, which is committed.
 */
export abstract class HttpAlmClient implements AlmClient {
  abstract readonly capabilities: AlmCapabilities;

  protected readonly baseUrl: string;
  protected readonly fetchImpl: FetchLike;

  protected constructor(cfg: AlmConfig, fetchImpl?: FetchLike) {
    // A trailing slash in the config is invisible until it produces
    // `https://host//rest/api` against a real server, so it is stripped once,
    // here, rather than in each provider's URL building.
    this.baseUrl = String(cfg.base_url ?? "").replace(/\/$/, "");
    this.fetchImpl = fetchImpl ?? ((globalThis as { fetch: FetchLike }).fetch as FetchLike);
  }

  abstract createIssue(reqId: string, title: string): Promise<IssueRef>;
  abstract getIssueStatus(issueKey: string): Promise<IssueStatus>;
  abstract closeIssue(issueKey: string): Promise<void>;

  /** Read a credential, naming the variable and how to set it when it is absent. */
  protected static requireEnv(name: string | undefined): string {
    const value = name ? process.env[name] : undefined;
    if (!value) {
      throw new Error(
        `Environment variable ${name ?? "(unnamed)"} is not set.\n` +
          "Fix: export the ALM API token in that variable (CI: a masked secret)."
      );
    }
    return value;
  }

  /** Perform a request and fail loudly, with the server's own words, when it is refused. */
  protected async request(
    path: string,
    what: string,
    init?: Record<string, unknown>
  ): Promise<HttpResponse> {
    const res = await this.fetchImpl(`${await this.apiBase()}${path}`, init);
    const status = this.refusedAs(res) ?? (res.ok ? undefined : res.status);
    if (status !== undefined) {
      const body = await res.text().catch(() => "");
      const fix = this.fixFor(status);
      throw new Error(
        `${what} failed: HTTP ${status} ${body.slice(0, 300)}` + (fix ? `\nFix: ${fix}` : "")
      );
    }
    return res;
  }

  /**
   * Where API requests go. The site itself, unless a provider's API lives
   * elsewhere — Jira's scoped tokens only work through Atlassian's gateway.
   */
  protected async apiBase(): Promise<string> {
    return this.baseUrl;
  }

  /**
   * A response that says yes but means no. Some servers answer a refused
   * credential as an anonymous request — 200 and an empty result — and say
   * so only in a header; a provider maps that to the status it means.
   */
  protected refusedAs(_res: HttpResponse): number | undefined {
    return undefined;
  }

  /** A provider's own advice for a refused request; none by default. */
  protected fixFor(_status: number): string | undefined {
    return undefined;
  }

  /** The same, returning the parsed body, which is what every caller wants. */
  protected async requestJson<T>(
    path: string,
    what: string,
    init?: Record<string, unknown>
  ): Promise<T> {
    const res = await this.request(path, what, init);
    return (await res.json()) as T;
  }
}
