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

/** Linear's public API. A self-hosted Linear does not exist; `base_url` is for tests and proxies. */
const PUBLIC_API = "https://api.linear.app";

interface LinearState {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}
interface LinearTeam {
  readonly id: string;
  readonly states?: { readonly nodes?: readonly LinearState[] };
}

/**
 * The state type of each phase (REQ-305). Linear's state names are the team's
 * own; its types — backlog, unstarted, started, completed, canceled — are not.
 */
const PHASE_TYPE: Readonly<Record<Phase, string>> = {
  proposed: "unstarted",
  building: "started",
  archived: "completed",
};

/**
 * Linear (REQ-308), through its GraphQL API.
 *
 * Every operation is one POST to `/graphql`, so a failure is in the body as
 * well as in the status: an answer with `errors` is a failed request even when
 * it comes with a 200. The personal API key goes in `Authorization` as it is —
 * Linear's keys are not bearer tokens — and never in a query.
 *
 * An issue is addressed by its identifier (`ENG-123`), which is what a person
 * reads on the board and what `issue(id:)` accepts. A cancelled issue reads as
 * open, as GitHub's "not planned" does: nobody delivered it.
 */
class LinearClient extends HttpAlmClient {
  readonly capabilities: AlmCapabilities = LINEAR_CAPABILITIES;

  private readonly headers: Readonly<Record<string, string>>;
  private readonly teamKey: string;
  private team: Promise<LinearTeam> | undefined;

  constructor(cfg: AlmConfig, fetchImpl?: FetchLike) {
    super({ ...cfg, base_url: cfg.base_url ?? PUBLIC_API }, fetchImpl);
    const token = HttpAlmClient.requireEnv(cfg.token_env);
    this.headers = { Authorization: token, "Content-Type": "application/json" };
    this.teamKey = String(cfg.team_key ?? "").trim();
    if (!/^[A-Z][A-Z0-9]*$/.test(this.teamKey)) {
      throw new Error(
        `alm.config.yaml: team_key '${this.teamKey}' is not a Linear team key.\n` +
          "Fix: write the key that prefixes its issues, e.g. `team_key: ENG`."
      );
    }
  }

  private async graphql<T>(what: string, query: string, variables: Record<string, unknown>) {
    const res = await this.request("/graphql", what, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ query, variables }),
    });
    const body = (await res.json()) as { data?: T; errors?: { message?: string }[] };
    if (body.errors && body.errors.length > 0) {
      throw new Error(`${what} failed: ${body.errors.map((e) => e.message).join("; ")}`);
    }
    if (!body.data) throw new Error(`${what} failed: Linear answered no data.`);
    return body.data;
  }

  /** The team, with its workflow states, read once. */
  private teamOf(): Promise<LinearTeam> {
    this.team ??= this.graphql<{ teams: { nodes: LinearTeam[] } }>(
      `Linear read team ${this.teamKey}`,
      "query TeamByKey($key: String!) { teams(filter: { key: { eq: $key } }) " +
        "{ nodes { id states { nodes { id name type } } } } }",
      { key: this.teamKey }
    ).then((data) => {
      const team = data.teams?.nodes?.[0];
      if (!team) {
        throw new Error(
          `Linear: no team with key ${this.teamKey} that this key can see.\n` +
            "Fix: check team_key, and that the API key belongs to a member of the team."
        );
      }
      return team;
    });
    return this.team;
  }

  private async stateFor(phase: Phase, name?: string): Promise<LinearState> {
    const states = (await this.teamOf()).states?.nodes ?? [];
    const state = name
      ? states.find((s) => s.name.toLowerCase() === name.toLowerCase())
      : states.find((s) => s.type === PHASE_TYPE[phase]);
    if (!state) {
      throw new Error(
        `Linear: team ${this.teamKey} has no ${name ? `state "${name}"` : `${PHASE_TYPE[phase]} state`}.\n` +
          `Fix: name the state of '${phase}' in phases: of alm.config.yaml, as the team calls it.`
      );
    }
    return state;
  }

  async createIssue(reqId: string, title: string): Promise<IssueRef> {
    return this.create(`${reqId} — ${title}`, `Linear create issue for ${reqId}`);
  }

  private async create(title: string, what: string, parentId?: string): Promise<IssueRef> {
    const team = await this.teamOf();
    const data = await this.graphql<{
      issueCreate: { success: boolean; issue?: { identifier: string; url?: string } };
    }>(
      what,
      "mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) " +
        "{ success issue { identifier url } } }",
      { input: { teamId: team.id, title, ...(parentId ? { parentId } : {}) } }
    );
    const issue = data.issueCreate?.issue;
    if (!data.issueCreate?.success || !issue) throw new Error(`${what} failed: not created.`);
    return { key: issue.identifier, url: issue.url ?? null };
  }

  private async issue(key: string): Promise<{ id: string; state?: { type?: string } }> {
    const data = await this.graphql<{ issue: { id: string; state?: { type?: string } } }>(
      `Linear read ${key}`,
      "query IssueStatus($id: String!) { issue(id: $id) { id state { type } } }",
      { id: identifier(key) }
    );
    return data.issue;
  }

  async getIssueStatus(issueKey: string): Promise<IssueStatus> {
    return (await this.issue(issueKey)).state?.type === "completed" ? "done" : "open";
  }

  async closeIssue(issueKey: string): Promise<void> {
    await this.setPhase(issueKey, "archived");
  }

  async listIssues(label: string): Promise<IssueSummary[]> {
    const data = await this.graphql<{
      issues: {
        nodes: { identifier: string; title?: string; description?: string; url?: string }[];
      };
    }>(
      `Linear search for issues labelled ${label}`,
      "query IssuesByLabel($key: String!, $label: String!) { issues(first: 100, filter: { " +
        'team: { key: { eq: $key } }, labels: { name: { eq: $label } }, state: { type: { nin: ["completed", "canceled"] } } }) ' +
        "{ nodes { identifier title description url } } }",
      { key: this.teamKey, label }
    );
    return (data.issues?.nodes ?? []).map((i) => ({
      key: i.identifier,
      title: String(i.title ?? ""),
      body: String(i.description ?? ""),
      url: i.url ?? null,
    }));
  }

  async setPhase(issueKey: string, phase: Phase, state?: string): Promise<string> {
    const target = await this.stateFor(phase, state);
    const data = await this.graphql<{ issueUpdate: { success: boolean } }>(
      `Linear move ${issueKey} to ${target.name}`,
      "mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }",
      { id: identifier(issueKey), input: { stateId: target.id } }
    );
    if (!data.issueUpdate?.success) throw new Error(`Linear move ${issueKey} failed.`);
    return target.name;
  }

  async createSubIssue(parentKey: string, title: string): Promise<IssueRef> {
    const parent = await this.issue(parentKey);
    return this.create(title, `Linear create a sub-issue of ${parentKey}`, parent.id);
  }

  async listComments(issueKey: string): Promise<IssueComment[]> {
    const data = await this.graphql<{
      issue: { comments?: { nodes?: { id: string; body?: string; user?: { name?: string } }[] } };
    }>(
      `Linear read the comments of ${issueKey}`,
      "query IssueComments($id: String!) { issue(id: $id) { comments(orderBy: createdAt) " +
        "{ nodes { id body user { name } } } } }",
      { id: identifier(issueKey) }
    );
    return (data.issue?.comments?.nodes ?? []).map((c) => ({
      id: String(c.id),
      author: String(c.user?.name ?? ""),
      body: String(c.body ?? ""),
    }));
  }

  async readIssueText(issueKey: string): Promise<{ title: string; body: string }> {
    const data = await this.graphql<{ issue: { title?: string; description?: string } }>(
      `Linear read ${issueKey}`,
      "query IssueText($id: String!) { issue(id: $id) { title description } }",
      { id: identifier(issueKey) }
    );
    return { title: String(data.issue?.title ?? ""), body: String(data.issue?.description ?? "") };
  }
}

/** An issue identifier, checked before it is sent: `ENG-123`. */
function identifier(key: string): string {
  if (!/^[A-Z][A-Z0-9]*-\d+$/.test(key)) {
    throw new Error(`Linear: '${key}' is not an issue identifier (TEAM-123).`);
  }
  return key;
}

const LINEAR_CAPABILITIES: AlmCapabilities = {
  create: true,
  readStatus: true,
  close: true,
  listIssues: true,
  phase: true,
  subIssues: true,
  comments: true,
  readText: true,
};

export const linearProvider: AlmProvider = {
  id: "linear",
  label: "Linear",
  config: {
    required: ["team_key", "token_env"],
    optional: ["base_url"],
  },
  capabilities: LINEAR_CAPABILITIES,
  create: (cfg, fetchImpl) => new LinearClient(cfg, fetchImpl),
};

export default linearProvider;
