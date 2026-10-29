import { HttpAlmClient } from "./http-client";
import type {
  AlmCapabilities,
  AlmConfig,
  AlmProvider,
  FetchLike,
  IssueRef,
  IssueStatus,
  Phase,
} from "../port";

/** The slices of Azure's work-item responses this connector reads. */
interface AzureWorkItem {
  readonly id: number | string;
  readonly _links?: { readonly html?: { readonly href?: string } };
  readonly fields?: Readonly<Record<string, string>>;
}

/** States the shipped Azure templates use for a finished work item. */
const DONE_STATES: readonly string[] = ["Done", "Closed", "Completed", "Resolved"];

const API_VERSION = "api-version=7.1";

/**
 * Azure Boards work items.
 *
 * The inverse of Jira: `System.State` is a plain field, so closing is a write
 * rather than a transition search, and the target state is configurable —
 * which is why this provider, and only this one, declares `done_state`.
 */
class AzureClient extends HttpAlmClient {
  readonly capabilities: AlmCapabilities = AZURE_CAPABILITIES;

  private readonly authorization: string;
  private readonly projectKey: string;
  private readonly issueType: string;
  private readonly doneState: string;

  constructor(cfg: AlmConfig, fetchImpl?: FetchLike) {
    super(cfg, fetchImpl);
    const token = HttpAlmClient.requireEnv(cfg.token_env);
    this.authorization = `Basic ${Buffer.from(`:${token}`).toString("base64")}`;
    this.projectKey = String(cfg.project_key ?? "");
    this.issueType = cfg.issue_type ?? "Task";
    this.doneState = cfg.done_state ?? "Done";
  }

  /** Work-item writes are JSON Patch; reads are not. */
  private patchHeaders(): Record<string, string> {
    return { Authorization: this.authorization, "Content-Type": "application/json-patch+json" };
  }

  async createIssue(reqId: string, title: string): Promise<IssueRef> {
    const path =
      `/${this.projectKey}/_apis/wit/workitems/` +
      `$${encodeURIComponent(this.issueType)}?${API_VERSION}`;

    const created = await this.requestJson<AzureWorkItem>(
      path,
      `Azure create work item for ${reqId}`,
      {
        method: "POST",
        headers: this.patchHeaders(),
        body: JSON.stringify([
          { op: "add", path: "/fields/System.Title", value: `${reqId} — ${title}` },
          { op: "add", path: "/fields/System.Tags", value: `spec-driven; ${reqId}` },
        ]),
      }
    );
    return { key: String(created.id), url: created._links?.html?.href ?? null };
  }

  async getIssueStatus(issueKey: string): Promise<IssueStatus> {
    const item = await this.requestJson<AzureWorkItem>(
      `/_apis/wit/workitems/${issueKey}?fields=System.State&${API_VERSION}`,
      `Azure read work item ${issueKey}`,
      { headers: { Authorization: this.authorization } }
    );
    const state = item.fields?.["System.State"];
    return state !== undefined && DONE_STATES.includes(state) ? "done" : "open";
  }

  /**
   * REQ-305: Azure Boards' default process states — New, Active, and the
   * configured done state — unless `phases:` names the project's own.
   */
  async setPhase(issueKey: string, phase: Phase, state?: string): Promise<string> {
    const target =
      state ?? (phase === "proposed" ? "New" : phase === "building" ? "Active" : this.doneState);
    await this.request(
      `/_apis/wit/workitems/${workItemId(issueKey)}?${API_VERSION}`,
      `Azure move work item ${issueKey} to ${target}`,
      {
        method: "PATCH",
        headers: this.patchHeaders(),
        body: JSON.stringify([{ op: "add", path: "/fields/System.State", value: target }]),
      }
    );
    return target;
  }

  /** REQ-307: a child work item, linked to its parent by the hierarchy relation. */
  async createSubIssue(parentKey: string, title: string): Promise<IssueRef> {
    const created = await this.requestJson<AzureWorkItem>(
      `/${this.projectKey}/_apis/wit/workitems/$${encodeURIComponent(this.issueType)}?${API_VERSION}`,
      `Azure create child of work item ${parentKey}`,
      {
        method: "POST",
        headers: this.patchHeaders(),
        body: JSON.stringify([
          { op: "add", path: "/fields/System.Title", value: title },
          { op: "add", path: "/fields/System.Tags", value: "spec-driven" },
          {
            op: "add",
            path: "/relations/-",
            value: {
              rel: "System.LinkTypes.Hierarchy-Reverse",
              url: `${this.baseUrl}/_apis/wit/workItems/${workItemId(parentKey)}`,
            },
          },
        ]),
      }
    );
    return { key: String(created.id), url: created._links?.html?.href ?? null };
  }

  /** REQ-306: the work item's title and description, its HTML flattened. */
  async readIssueText(issueKey: string): Promise<{ title: string; body: string }> {
    const item = await this.requestJson<AzureWorkItem>(
      `/_apis/wit/workitems/${workItemId(issueKey)}?fields=System.Title,System.Description&${API_VERSION}`,
      `Azure read work item ${issueKey}`,
      { headers: { Authorization: this.authorization } }
    );
    const html = String(item.fields?.["System.Description"] ?? "");
    return {
      title: String(item.fields?.["System.Title"] ?? ""),
      body: html
        .replace(/<br\s*\/?>|<\/(?:p|div|li)>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim(),
    };
  }

  async closeIssue(issueKey: string): Promise<void> {
    await this.request(
      `/_apis/wit/workitems/${issueKey}?${API_VERSION}`,
      `Azure close work item ${issueKey}`,
      {
        method: "PATCH",
        headers: this.patchHeaders(),
        body: JSON.stringify([{ op: "add", path: "/fields/System.State", value: this.doneState }]),
      }
    );
  }
}

/** A work item id as a path segment: digits, nothing a path could be walked with. */
function workItemId(key: string): string {
  if (!/^\d+$/.test(key)) throw new Error(`Azure: '${key}' is not a work item id.`);
  return key;
}

/** Comments are a preview API on Azure Boards: not read, and `alm pull` says so. */
const AZURE_CAPABILITIES: AlmCapabilities = {
  create: true,
  readStatus: true,
  close: true,
  // Azure searches with WIQL — a POST carrying a query language, then a
  // second request to hydrate each id. That is a different shape from the
  // other two, and declaring `false` degrades `alm pull` with a message
  // rather than pretending and failing at the first request.
  listIssues: false,
  phase: true,
  subIssues: true,
  comments: false,
  readText: true,
};

export const azureProvider: AlmProvider = {
  id: "azure",
  label: "Azure Boards",
  config: {
    required: ["base_url", "project_key", "token_env"],
    optional: ["issue_type", "done_state"],
  },
  capabilities: AZURE_CAPABILITIES,
  create: (cfg, fetchImpl) => new AzureClient(cfg, fetchImpl),
};

export default azureProvider;
