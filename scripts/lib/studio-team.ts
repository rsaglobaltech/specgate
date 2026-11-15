/**
 * The studio served to a team (REQ-553, REQ-554).
 *
 * ## Who is asking: a proxy says so
 *
 * Specgate does not sign anyone in. `specgate studio --team` runs behind a
 * sign-in proxy the team already trusts — oauth2-proxy, Cloudflare Access,
 * Google IAP, an ingress with GitHub or GitLab sign-in — which puts the user
 * in a header (`X-Forwarded-User` unless `studio.team.yaml` names another).
 * The studio holds no OAuth secret and keeps no session. A request without the
 * header is refused, and with `SPECGATE_PROXY_SECRET` set, so is one that does
 * not carry the secret the proxy adds: the studio then answers the proxy only,
 * even if someone reaches its port directly.
 *
 * ## What they may do: a role
 *
 * `studio.team.yaml` gives each user `reader`, `editor` or `admin`; anyone not
 * listed is `reader`. A reader sees everything and writes nothing. An editor
 * may change the specification — answer a question, approve a change, note a
 * review, edit the brief. Running things — a build, an agent, a draft, a
 * project setting — is an admin's.
 *
 * ## Where an edit goes: a pull request
 *
 * In team mode no edit lands on the base branch. It is written in a worktree
 * on `studio/<user>/<change>`, committed with the user as its author, pushed,
 * and opened (or updated) as a pull request to the base — through the same
 * code `specgate alm pr` uses. The answer carries the pull request's URL.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { parseYamlLite } from "../../packages/core/src/domain/YamlLite";
import { openOrUpdatePr, prConfig, type PullRequest } from "../vcs/github-pr";

export const TEAM_FILE = "studio.team.yaml";
export const ROLES = ["reader", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** The writes that change the specification: an editor's, and each one a pull request. */
export const SPEC_WRITES = [
  "/live/answer",
  "/api/answer",
  "/api/approve",
  "/api/note",
  "/api/brief",
];

export interface TeamConfig {
  /** The header the proxy puts the signed-in user in, lower-cased. */
  readonly userHeader: string;
  /** The header with their e-mail, for the commit's author; optional. */
  readonly emailHeader: string;
  readonly roles: ReadonlyMap<string, Role>;
  /** The branch pull requests go to; `pr.base` of alm.config.yaml when unset. */
  readonly base: string;
  /** Origins the studio's page is served from, besides the loopback. */
  readonly origins: readonly string[];
  /** Host names requests may be addressed to (the proxy's public name). */
  readonly hosts: readonly string[];
}

/** `studio.team.yaml`, checked; throws with the fix. */
export function parseTeamConfig(text: string): TeamConfig {
  const doc = (parseYamlLite(text) || {}) as Record<string, unknown>;
  const rolesRaw = (doc.roles && typeof doc.roles === "object" ? doc.roles : {}) as Record<
    string,
    unknown
  >;
  const roles = new Map<string, Role>();
  for (const [user, role] of Object.entries(rolesRaw)) {
    const r = String(role).trim().toLowerCase();
    if (!(ROLES as readonly string[]).includes(r)) {
      throw new Error(
        `${TEAM_FILE}: ${user} has the role "${role}".\nFix: use reader, editor or admin.`
      );
    }
    roles.set(user.trim().toLowerCase(), r as Role);
  }
  const list = (v: unknown) =>
    (Array.isArray(v) ? v : v ? [v] : []).map((x) => String(x).trim()).filter(Boolean);
  return {
    userHeader: String(doc.user_header || "x-forwarded-user").toLowerCase(),
    emailHeader: String(doc.email_header || "x-forwarded-email").toLowerCase(),
    roles,
    base: String(doc.base || ""),
    origins: list(doc.origins),
    hosts: list(doc.hosts).map((h) => h.toLowerCase()),
  };
}

/** The project's team configuration, or null when it has none. */
export function readTeamConfig(projectDir: string): TeamConfig | null {
  const file = path.join(projectDir, TEAM_FILE);
  return fs.existsSync(file) ? parseTeamConfig(fs.readFileSync(file, "utf8")) : null;
}

/** A user's role; `reader` for anyone the file does not list. */
export function roleOf(cfg: TeamConfig, user: string): Role {
  return cfg.roles.get(user.trim().toLowerCase()) || "reader";
}

export type TeamRefusal = { status: 401 | 403; code: string; message: string };

/**
 * Whether a request may go on, before anything else reads it. `secret` is
 * `SPECGATE_PROXY_SECRET`, and `given` the secret header the request carried.
 */
export function teamGate(
  cfg: TeamConfig,
  req: { user: string; secret: string; given: string; method: string; url: string; write: boolean }
): TeamRefusal | { user: string; role: Role } {
  if (req.secret) {
    const a = Buffer.from(req.given);
    const b = Buffer.from(req.secret);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return {
        status: 401,
        code: "proxy_required",
        message: "This studio answers its sign-in proxy only.",
      };
    }
  }
  const user = req.user.trim();
  if (!user || !/^[\w.@+-]{1,100}$/.test(user)) {
    return {
      status: 401,
      code: "sign_in_required",
      message: "Sign in first: the studio is served to a team.",
    };
  }
  const role = roleOf(cfg, user);
  if (req.write) {
    const spec = SPEC_WRITES.includes(req.url);
    if (role === "reader" || (!spec && role !== "admin")) {
      return {
        status: 403,
        code: "role_forbidden",
        message: spec
          ? `${user} is a reader: reading only.`
          : `${user} is an ${role}: running things is an admin's.`,
      };
    }
  }
  return { user, role };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "spec";

/** `studio/<user>/<change>`. */
export function teamBranch(user: string, change: string): string {
  return `studio/${slug(user)}/${slug(change)}`;
}

/**
 * The `pr:` block of `alm.config.yaml`. A team's studio opens pull requests
 * whether or not the project tracks its work in an ALM, so the rest of the
 * file is not required here.
 */
function prBlock(projectDir: string): unknown {
  const file = path.join(projectDir, "alm.config.yaml");
  if (!fs.existsSync(file)) {
    throw new Error(
      "--team opens pull requests and alm.config.yaml has no pr: block.\nFix: add\npr:\n  provider: github\n  repo: <owner>/<repo>\n  base: main\n  token_env: GITHUB_TOKEN"
    );
  }
  return ((parseYamlLite(fs.readFileSync(file, "utf8")) || {}) as Record<string, unknown>).pr;
}

function git(dir: string, args: string[]) {
  return spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
}

export interface TeamEdit<T> {
  readonly result: T;
  readonly branch: string;
  readonly commit: string | null;
  readonly pullRequest: PullRequest | null;
}

/**
 * Run `write` in a worktree of the user's branch, commit what it changed as
 * that user, push it, and open or update the pull request. The base branch and
 * the studio's own working copy are never written.
 */
export async function onTeamBranch<T>(
  projectDir: string,
  cfg: TeamConfig,
  who: { user: string; email: string },
  change: string,
  title: string,
  write: (dir: string) => T
): Promise<TeamEdit<T>> {
  const pr = prConfig(prBlock(projectDir));
  const base = cfg.base || pr.base;
  const branch = teamBranch(who.user, change);
  const gitDir = path.resolve(
    projectDir,
    git(projectDir, ["rev-parse", "--git-dir"]).stdout.trim()
  );
  const dir = path.join(gitDir, "specgate-team", branch.replace(/\//g, "__"));
  if (!fs.existsSync(dir)) {
    const hasOrigin = git(projectDir, ["remote", "get-url", "origin"]).status === 0;
    if (hasOrigin) git(projectDir, ["fetch", "-q", "origin", base]);
    const exists = git(projectDir, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]);
    const from =
      hasOrigin &&
      git(projectDir, ["rev-parse", "--verify", "--quiet", `origin/${base}`]).status === 0
        ? `origin/${base}`
        : base;
    const added =
      exists.status === 0
        ? git(projectDir, ["worktree", "add", "-q", dir, branch])
        : git(projectDir, ["worktree", "add", "-q", "-b", branch, dir, from]);
    if (added.status !== 0) throw new Error(`git worktree failed: ${added.stderr.trim()}`);
  }
  const result = write(dir);
  git(dir, ["add", "-A"]);
  if (git(dir, ["diff", "--cached", "--quiet"]).status === 0) {
    return { result, branch, commit: null, pullRequest: null };
  }
  // The header is the proxy's, but it still only goes into git as a plain address.
  const email = /^[^\s<>@]{1,64}@[^\s<>@]{1,190}$/.test(who.email)
    ? who.email
    : `${slug(who.user)}@users.noreply.specgate`;
  const committed = git(dir, [
    "-c",
    `user.name=${who.user}`,
    "-c",
    `user.email=${email}`,
    "commit",
    "-q",
    "--author",
    `${who.user} <${email}>`,
    "-m",
    `${change}: ${title} (by ${who.user}, in the studio)`,
  ]);
  if (committed.status !== 0) throw new Error(`git commit failed: ${committed.stderr.trim()}`);
  const commit = git(dir, ["rev-parse", "HEAD"]).stdout.trim();
  const pushed = git(dir, ["push", "-q", "-u", "origin", branch]);
  if (pushed.status !== 0) throw new Error(`git push failed: ${pushed.stderr.trim()}`);
  const body = [
    `<!-- specgate:pr change=${change} -->`,
    `**Change:** \`docs/specs/changes/${change}/\` — edited by ${who.user} in the studio.`,
    "",
    "_Opened by `specgate studio --team`. Specgate never merges._",
    "<!-- /specgate:pr -->",
  ].join("\n");
  const pullRequest = await openOrUpdatePr(
    { ...pr, base },
    { head: branch, key: change, title: `${change}: ${title}`, body }
  );
  return { result, branch, commit, pullRequest };
}
