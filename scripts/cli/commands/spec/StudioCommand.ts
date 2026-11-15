import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";
import {
  SPEC_WRITES,
  TEAM_FILE,
  onTeamBranch,
  readTeamConfig,
  teamGate,
  type TeamConfig,
} from "../../../lib/studio-team";
import * as crypto from "node:crypto";
import { answer as answerQuestion, reviewed as reviewQuestion } from "../../../lib/clarification";
import { approveChange, noteChange } from "../../../lib/change-review";
import type { LayerId } from "../../../../packages/core/src/domain/ChangeLayers";
import {
  changesView,
  buildView,
  drafts,
  gate,
  home,
  questionsView,
  startBuild,
  stopBuild,
} from "../../../lib/studio-app";
import {
  configuredAgent,
  agentsInstalled,
  briefForm,
  createProject,
  draftsRoute,
  fillBrief,
  initQuality,
  qualityView,
  profilesView,
  report,
  reportHtml,
  route,
  saveBriefForm,
  saveBriefMarkdown,
  startDraft,
  stopJob,
  type NewProject,
  chooseAgent,
} from "../../../lib/studio-route";
import { resolveProjectDir } from "../../../lib/project-root";
import { studioAsset, studioShell } from "../../../lib/studio-shell";
import {
  actionView,
  almView,
  preferencesView,
  runAction,
  ticketBranchView,
} from "../../../lib/studio-actions";
import { parseTraceability } from "./PlanCommand";
import { errorMessage } from "../../../lib/diagnostics";
import { BaseCommand } from "../../../lib/command";

import { c } from "../../../lib/ui";
import { readLive, liveSignature } from "../../../lib/live-model";
import { livePage } from "../../../lib/live-page";
import { loadWorkspace } from "../../../lib/workspace";
import { readWorkspaceLive, workspaceLiveSignature } from "../../../lib/workspace-live";
import { workspaceLivePage } from "../../../lib/workspace-live-page";
import { requirementDetail, liveMatrix } from "../../../lib/live-detail";
import { promptFileFor } from "../../../lib/harness-events";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** The host part of a Host header: `localhost:4173` → `localhost`, `[::1]:80` → `[::1]`. */
export function hostOf(header: string | undefined): string {
  const h = String(header || "")
    .trim()
    .toLowerCase();
  if (h.startsWith("[")) return h.slice(0, h.indexOf("]") + 1);
  return h.split(":")[0];
}

/**
 * A request studio answers: any, when it was deliberately bound elsewhere with
 * `--host`; otherwise only one addressed to the loopback by name. A page on
 * another site that resolves its own name to 127.0.0.1 (DNS rebinding) sends
 * its own name, and is refused (ADR-0037).
 */
export function hostAllowed(bound: string, header: string | undefined): boolean {
  if (!LOOPBACK.has(bound)) return true;
  return LOOPBACK.has(hostOf(header));
}

/**
 * Whether a write from the live view may go through (REQ-201): studio's only
 * write, answering a question. Same-origin JSON carrying the token this start
 * of studio put in its page: a page on another site cannot read the token,
 * and a form post from one cannot send JSON with a custom header.
 */
export function writeAllowed(
  token: string,
  headers: { token?: string; contentType?: string; origin?: string },
  /** REQ-553: the origins a team's proxy serves the page from. */
  origins: readonly string[] = []
): boolean {
  const given = Buffer.from(String(headers.token || ""));
  const want = Buffer.from(token);
  if (!token || given.length !== want.length || !crypto.timingSafeEqual(given, want)) return false;
  if (!/^application\/json\b/i.test(String(headers.contentType || ""))) return false;
  // A browser always says where a cross-site request comes from.
  if (!headers.origin) return true;
  if (origins.includes(headers.origin.replace(/\/$/, ""))) return true;
  try {
    return LOOPBACK.has(new URL(headers.origin).hostname.toLowerCase());
  } catch {
    return false;
  }
}

const DONE = new Set(["Implemented", "Verified", "Released"]);

function usage() {
  process.stdout.write(
    `\n  ${c.bold}${c.cyan}🎨 studio${c.reset}  ${c.dim}— local read-only visualizer (status + REQ graph)${c.reset}\n\n` +
      `  ${c.bold}USAGE${c.reset}\n` +
      `    ${c.cyan}specgate studio${c.reset} [--port <n>] [--host <addr>] [--project-dir <path>] [--out <dir>] [--json]\n\n` +
      `  ${c.dim}/live shows the harness at work, from .harness/events/, updated as it runs.${c.reset}\n\n` +
      `  ${c.bold}OPTIONS${c.reset}\n` +
      `    ${c.green}--port <n>${c.reset}           ${c.dim}Port to serve on (default 4173).${c.reset}\n` +
      `    ${c.green}--host <addr>${c.reset}        ${c.dim}Address to bind (default 127.0.0.1: this machine only).${c.reset}\n` +
      `    ${c.green}--team${c.reset}               ${c.dim}Serve a team behind a sign-in proxy: roles from studio.team.yaml,${c.reset}\n` +
      `                         ${c.dim}a reader writes nothing, an editor's edits become pull requests.${c.reset}\n` +
      `    ${c.green}--project-dir <path>${c.reset} ${c.dim}Project root (auto-detected from cwd if omitted).${c.reset}\n` +
      `    ${c.green}--out <dir>${c.reset}            ${c.dim}Export static HTML/JSON/Mermaid bundle to <dir>.${c.reset}\n` +
      `    ${c.green}--json${c.reset}               ${c.dim}Print the model as JSON and exit (no server).${c.reset}\n` +
      `    ${c.green}-h, --help${c.reset}           ${c.dim}Show this help.${c.reset}\n\n`
  );
}

export interface StudioOptions {
  projectDir: string;
  port: number;
  host: string;
  json: boolean;
  out?: string;
  /** --port was given: a taken port is refused rather than moved from (REQ-445). */
  portGiven?: boolean;
  /** REQ-553: served to a team, behind a sign-in proxy. */
  team?: boolean;
}

export function parseArgs(argv: string[]) {
  const opts: StudioOptions = { projectDir: ".", port: 4173, host: "127.0.0.1", json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port" && argv[i + 1]) {
      opts.port = Number(argv[++i]);
      opts.portGiven = true;
    } else if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--out" && argv[i + 1]) opts.out = argv[++i];
    else if (a === "--host" && argv[i + 1]) opts.host = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "--team") opts.team = true;
    else if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    } else if (a.startsWith("-")) {
      process.stderr.write(`Unknown flag: ${a}\n`);
      process.exit(2);
    }
  }
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
    process.stderr.write(`Invalid --port: ${opts.port}\n`);
    process.exit(2);
  }
  return opts;
}

/** One requirement on the studio page. */
interface StudioRequirement {
  requirement: string;
  scenarioId: string;
  status: string;
  featureFile: string;
  done: boolean;
}

/** What the studio page draws: the counts and every requirement. */
export interface StudioModel {
  total: number;
  done: number;
  pending: number;
  requirements: StudioRequirement[];
}

export function buildModel(traceContent: string): StudioModel {
  const rows = parseTraceability(traceContent).filter((r) => /^REQ-\d+/.test(r.requirement || ""));
  const requirements = rows.map((r) => ({
    // The filter above kept only rows whose requirement is a REQ id.
    requirement: r.requirement as string,
    scenarioId: r.scenarioId || "",
    status: r.status || "Draft",
    featureFile: r.featureFile || "",
    // An absent status is never a done one.
    done: DONE.has(r.status as string),
  }));
  const total = requirements.length;
  const done = requirements.filter((r) => r.done).length;
  return { total, done, pending: total - done, requirements };
}

function esc(s: unknown) {
  return String(s).replace(/[&<>"]/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;"
  );
}

export function mermaid(model: StudioModel) {
  const lines = ["flowchart LR"];
  for (const r of model.requirements) {
    const id = r.requirement.replace(/-/g, "_");
    lines.push(`  ${id}["${r.requirement}<br/>${esc(r.status)}"]:::${r.done ? "done" : "pending"}`);
    if (r.scenarioId && r.scenarioId !== "-") {
      const sid = r.scenarioId.replace(/-/g, "_");
      lines.push(`  ${id} --> ${sid}(["${esc(r.scenarioId)}"])`);
    }
  }
  lines.push("  classDef done fill:#16a34a,color:#fff,stroke:#15803d;");
  lines.push("  classDef pending fill:#f59e0b,color:#111,stroke:#b45309;");
  return lines.join("\n");
}

export function renderHtml(projectDir: string, model: StudioModel) {
  const rowsHtml = model.requirements
    .map(
      (r) =>
        `<tr><td>${esc(r.requirement)}</td><td>${esc(r.scenarioId)}</td><td>${esc(
          r.status
        )}</td><td>${esc(r.featureFile)}</td></tr>`
    )
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>specgate studio — ${esc(path.basename(projectDir))}</title>
<style>
  body{font:14px/1.5 system-ui,sans-serif;margin:2rem;color:#111;background:#fafafa}
  h1{font-size:1.2rem} .muted{color:#666}
  table{border-collapse:collapse;margin-top:1rem;background:#fff}
  th,td{border:1px solid #ddd;padding:.4rem .6rem;text-align:left}
  .pill{display:inline-block;padding:.1rem .5rem;border-radius:999px;color:#fff}
  .done{background:#16a34a}.pending{background:#f59e0b;color:#111}
  .mermaid{margin-top:1rem;background:#fff;padding:1rem;border:1px solid #eee}
</style></head>
<body>
  <h1>🎨 specgate studio <span class="muted">${esc(projectDir)}</span></h1>
  <p>${model.total} requirements ·
     <span class="pill done">${model.done} done</span>
     <span class="pill pending">${model.pending} pending</span></p>
  <div class="mermaid">
${esc(mermaid(model))}
  </div>
  <table>
    <thead><tr><th>Requirement</th><th>Scenario</th><th>Status</th><th>Feature</th></tr></thead>
    <tbody>
${rowsHtml}
    </tbody>
  </table>
  <p class="muted">Read-only. Edit with <code>specgate req</code> / <code>specgate done</code>; refresh to update.</p>
  <script src="./mermaid.min.js"></script>
  <script>
    mermaid.initialize({ startOnLoad: true });
  </script>
</body></html>`;
}

function getMermaidPath() {
  const local = path.join(__dirname, "../../../../../vendor/mermaid.min.js");
  if (fs.existsSync(local)) return local;
  // Fallback for development if run directly from scripts/
  return path.join(__dirname, "../../../vendor/mermaid.min.js");
}

/**
 * The single project's live reads (REQ-180..182): its model, one requirement's
 * details and prompts, the matrix and the stream. Shared by the studio's own
 * project and, under `/live/repo/<name>/`, each workspace member (REQ-410).
 */
function projectLive(
  projectDir: string,
  url: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
): boolean {
  if (url === "/live.json") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ schemaVersion: 1, projectDir, ...readLive(projectDir) }));
    return true;
  }
  // REQ-180: one requirement's details, read when the viewer opens it.
  const reqMatch = /^\/live\/req\/(REQ-\d+)\.json$/.exec(url);
  if (reqMatch) {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(requirementDetail(projectDir, reqMatch[1])));
    return true;
  }
  // REQ-182: the prompt an attempt was given, as plain text.
  const promptMatch = /^\/live\/req\/(REQ-\d+)\/prompt\/(\d+)\.txt$/.exec(url);
  if (promptMatch) {
    let text = "";
    try {
      text = fs.readFileSync(
        promptFileFor(projectDir, promptMatch[1], Number(promptMatch[2])),
        "utf8"
      );
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("No prompt kept for this attempt.\n");
      return true;
    }
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end(text);
    return true;
  }
  // REQ-181: the traceability matrix as it stands.
  if (url === "/live/matrix.json") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ schemaVersion: 1, rows: liveMatrix(projectDir) }));
    return true;
  }
  if (url === "/live/stream") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    let last = "";
    const push = () => {
      const sig = liveSignature(projectDir);
      if (sig === last) return;
      last = sig;
      res.write(`event: live\ndata: ${JSON.stringify(readLive(projectDir))}\n\n`);
    };
    push();
    const timer = setInterval(push, 500);
    const beat = setInterval(() => res.write(": keep-alive\n\n"), 15000);
    req.on("close", () => {
      clearInterval(timer);
      clearInterval(beat);
    });
    return true;
  }
  return false;
}

function loadModel(projectDir: string) {
  const tracePath = path.join(projectDir, "docs/specs/traceability.md");
  if (!fs.existsSync(tracePath)) {
    process.stderr.write(
      `${c.red}✖${c.reset}  docs/specs/traceability.md not found in ${projectDir}\n`
    );
    process.exit(2);
  }
  return buildModel(fs.readFileSync(tracePath, "utf8"));
}

export class StudioCommand extends BaseCommand {
  public execute(): void {
    const opts = parseArgs(this.args);
    let projectDir: string;
    try {
      projectDir = resolveProjectDir(opts.projectDir);
    } catch (err) {
      process.stderr.write(`${errorMessage(err)}\n`);
      process.exit(2);
    }

    if (opts.json) {
      process.stdout.write(
        JSON.stringify({ schemaVersion: 1, projectDir, ...loadModel(projectDir) }, null, 2) + "\n"
      );
      process.exit(0);
    }

    if (opts.out) {
      fs.mkdirSync(opts.out, { recursive: true });
      const model = loadModel(projectDir);
      fs.writeFileSync(
        path.join(opts.out, "status.json"),
        JSON.stringify({ schemaVersion: 1, projectDir, ...model }, null, 2) + "\n"
      );
      fs.writeFileSync(path.join(opts.out, "index.html"), renderHtml(projectDir, model));

      const mermaidPath = getMermaidPath();
      if (fs.existsSync(mermaidPath)) {
        fs.copyFileSync(mermaidPath, path.join(opts.out, "mermaid.min.js"));
      } else {
        process.stderr.write(`${c.red}✖${c.reset}  Bundled mermaid.min.js not found\n`);
      }

      process.stdout.write(`\n  ${c.green}✔${c.reset}  Studio exported to ${opts.out}\n\n`);
      process.exit(0);
    }

    // REQ-553: a team's studio, behind its sign-in proxy.
    let team: TeamConfig | null = null;
    if (opts.team) {
      try {
        team = readTeamConfig(projectDir);
      } catch (err) {
        process.stderr.write(`${c.red}✖${c.reset}  ${errorMessage(err)}\n`);
        process.exit(2);
      }
      if (!team) {
        process.stderr.write(
          `${c.red}✖${c.reset}  --team needs ${TEAM_FILE}: the header your sign-in proxy sets, and the roles.\n` +
            `   Fix: write ${TEAM_FILE}, e.g.\n     user_header: X-Forwarded-User\n     roles:\n       ana: reader\n       luis: editor\n`
        );
        process.exit(2);
      }
    }
    const proxySecret = process.env.SPECGATE_PROXY_SECRET || "";
    if (team && !proxySecret) {
      process.stderr.write(
        `${c.yellow}▲${c.reset}  --team trusts the ${team.userHeader} header. Without SPECGATE_PROXY_SECRET,\n` +
          `   anyone who reaches this port directly can claim any user: keep it reachable by your proxy only.\n`
      );
    }
    // One per start of studio: the live page carries it, and a write needs it.
    const token = crypto.randomBytes(24).toString("hex");
    const server = http.createServer((req, res) => {
      const hostName = String(req.headers.host || "")
        .split(":")[0]
        .toLowerCase();
      if (!hostAllowed(opts.host, req.headers.host) && !(team && team.hosts.includes(hostName))) {
        res.writeHead(403, { "content-type": "text/plain" });
        res.end("Forbidden: studio answers on this machine only (see --host).\n");
        return;
      }
      const url = String(req.url || "/").split("?")[0];
      const json = (code: number, body: unknown) => {
        res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(body));
      };
      const one = (name: string) => {
        const v = req.headers[name];
        return String((Array.isArray(v) ? v[0] : v) || "");
      };
      // REQ-553: who is asking, as the proxy says, and what their role allows.
      let identity: { user: string; role: string; email: string } | null = null;
      if (team) {
        const verdict = teamGate(team, {
          user: one(team.userHeader),
          secret: proxySecret,
          given: one("x-specgate-proxy-secret"),
          method: String(req.method || "GET"),
          url,
          write: req.method === "POST",
        });
        if ("status" in verdict) {
          json(verdict.status, { ok: false, code: verdict.code, message: verdict.message });
          return;
        }
        identity = { ...verdict, email: one(team.emailHeader) };
      }
      // REQ-562: who is looking — the proxy's user in a team, git's identity otherwise.
      const viewer = identity ? { name: identity.user, email: identity.email } : undefined;
      // REQ-204: the app's reads, built from what the commands read.
      const reads: Record<string, () => unknown> = {
        // REQ-434: the page's heartbeat, to say when the studio cannot be reached.
        // It carries the token, as the page does: a studio started again has a
        // new one, and the page that reconnects needs it to write (REQ-201).
        // REQ-445: which project and process this is, so a second studio finds it.
        "/api/ping": () => ({ ok: true, token, project: projectDir, pid: process.pid }),
        // REQ-438: what the studio's command runs, and its output so far.
        "/api/action": () => actionView(projectDir),
        // REQ-442: the project's preferences, as config list gives them.
        "/api/preferences": () => preferencesView(projectDir),
        // REQ-444: the ALM — the token's variable and whether it is set, never its value.
        "/api/alm": () => almView(projectDir),
        "/api/branch": () => ticketBranchView(projectDir),
        "/api/home": () => home(projectDir),
        "/api/gate": () => gate(projectDir),
        "/api/questions": () => questionsView(projectDir),
        "/api/drafts": () => drafts(projectDir, viewer),
        // REQ-439: every open change, not only the brief's drafts.
        "/api/changes": () => changesView(projectDir),
        "/api/build": () => buildView(projectDir),
        // REQ-211..217: the route from an empty folder to the report.
        "/api/route": () => route(projectDir),
        "/api/profiles": () => ({
          profiles: profilesView(projectDir),
          installed: agentsInstalled(),
          // REQ-431: an agent set as a command of its own, not a profile.
          agent: configuredAgent(projectDir),
        }),
        "/api/brief": () => briefForm(projectDir),
        "/api/modules": () => draftsRoute(projectDir),
        "/api/report": () => report(projectDir),
        "/api/quality": () => qualityView(projectDir),
      };
      if (req.method === "GET" && reads[url]) {
        try {
          json(200, reads[url]());
        } catch (err) {
          // The details stay in this terminal; the page gets no exception text.
          process.stderr.write(`studio: ${url} failed: ${errorMessage(err)}\n`);
          json(500, {
            ok: false,
            message:
              "The studio could not read this; the terminal running specgate studio says why.",
          });
        }
        return;
      }
      // REQ-201, REQ-204: the writes — answering, approving, noting, building, stopping.
      const WRITES = [
        "/live/answer",
        "/api/answer",
        "/api/approve",
        "/api/note",
        "/api/build",
        "/api/stop",
        "/api/project",
        "/api/brief",
        "/api/brief/fill",
        "/api/draft",
        "/api/draft/stop",
        "/api/quality/init",
        "/api/agent",
        "/api/action",
      ];
      if (req.method === "POST" && WRITES.includes(url)) {
        const header = (name: string) => {
          const v = req.headers[name];
          return Array.isArray(v) ? v[0] : v;
        };
        if (
          !writeAllowed(
            token,
            {
              token: header("x-specgate-token"),
              contentType: header("content-type"),
              origin: header("origin"),
            },
            team ? team.origins : []
          )
        ) {
          json(403, { ok: false, message: "Refused: not the live page of this studio." });
          return;
        }
        let raw = "";
        req.on("data", (d: Buffer) => {
          raw += d;
          // A brief, or a client's text pasted whole, is the largest body.
          if (raw.length > 2 * 1024 * 1024) req.destroy();
        });
        req.on("end", () => {
          let body: {
            question?: string;
            change?: string;
            answer?: string;
            reviewed?: boolean;
            req?: string;
            text?: string;
            reqs?: string[];
            /** REQ-319: the layer an approval is of. */
            layer?: string;
            profile?: string;
            module?: string;
            replace?: boolean;
            markdown?: string;
            form?: Parameters<typeof saveBriefForm>[1];
            project?: NewProject;
            level?: string;
            kind?: string;
            command?: string;
            now?: boolean;
            action?: string;
            args?: Record<string, unknown>;
          };
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            json(400, { ok: false, message: "The body is not JSON." });
            return;
          }
          const today = new Date().toISOString().slice(0, 10);
          // The writes that change the specification: here, or — for a team —
          // on the user's branch, as a pull request (REQ-554).
          const specWrite = (dir: string): { status: number; payload: unknown } => {
            if (url === "/api/approve") {
              // REQ-319, REQ-562: one layer, approved for the viewer — the proxy's user in a team.
              const layer = body.layer ? (String(body.layer) as LayerId) : undefined;
              const r = approveChange(dir, String(body.change || ""), today, layer, viewer);
              return { status: r.ok ? 200 : 422, payload: r };
            }
            if (url === "/api/note") {
              const r = noteChange(
                dir,
                String(body.change || ""),
                String(body.text || ""),
                String(body.req || ""),
                today
              );
              return { status: r.ok ? 200 : 422, payload: r };
            }
            if (url === "/api/brief") {
              const form =
                typeof body.markdown === "string"
                  ? saveBriefMarkdown(dir, body.markdown)
                  : body.form
                    ? saveBriefForm(dir, body.form)
                    : null;
              return form
                ? { status: 200, payload: { ok: true, brief: form } }
                : { status: 400, payload: { ok: false, message: "No brief." } };
            }
            const q = String(body.question || "");
            if (!/^Q\d+$/.test(q))
              return { status: 400, payload: { ok: false, message: "No question id." } };
            const change = body.change ? String(body.change) : undefined;
            const r = body.reviewed
              ? reviewQuestion(dir, q, change)
              : answerQuestion(dir, q, String(body.answer || "").trim(), change);
            return { status: r.ok ? 200 : 422, payload: r };
          };
          if (SPEC_WRITES.includes(url)) {
            if (!team || !identity) {
              const w = specWrite(projectDir);
              json(w.status, w.payload);
              return;
            }
            const change = String(body.change || (url === "/api/brief" ? "brief" : "spec"));
            if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(change)) {
              json(400, { ok: false, code: "change_invalid", message: "Not a change id." });
              return;
            }
            const title = url.endsWith("answer")
              ? `answer ${String(body.question || "")}`
              : url.slice(url.lastIndexOf("/") + 1);
            let outcome: { status: number; payload: unknown } = { status: 500, payload: null };
            onTeamBranch(projectDir, team, identity, change, title, (dir) => {
              outcome = specWrite(dir);
              return outcome;
            })
              .then((edit) => {
                const payload = (outcome.payload || {}) as Record<string, unknown>;
                json(outcome.status, {
                  ...payload,
                  branch: edit.branch,
                  commit: edit.commit,
                  pullRequest: edit.pullRequest ? edit.pullRequest.url : null,
                });
              })
              .catch((err) => {
                process.stderr.write(
                  `studio: ${url} for ${identity!.user} failed: ${errorMessage(err)}\n`
                );
                json(502, {
                  ok: false,
                  code: "team_pull_request_failed",
                  message:
                    "The edit could not be opened as a pull request; the terminal running specgate studio says why.",
                });
              });
            return;
          }
          if (url === "/api/project") {
            const r = createProject(projectDir, (body.project || {}) as NewProject);
            json(r.ok ? 201 : 422, r);
            return;
          }
          if (url === "/api/brief/fill") {
            const r = fillBrief(
              projectDir,
              String(body.text || ""),
              String(body.profile || ""),
              body.replace === true
            );
            json(r.ok ? 202 : 422, r);
            return;
          }
          if (url === "/api/draft") {
            const r = startDraft(projectDir, String(body.module || ""), String(body.profile || ""));
            json(r.ok ? 202 : 422, r);
            return;
          }
          // REQ-438: one of the commands the studio offers — checked, never anything else.
          if (url === "/api/action") {
            const r = runAction(
              projectDir,
              String(body.action || ""),
              body.args && typeof body.args === "object" && !Array.isArray(body.args)
                ? body.args
                : {}
            );
            json(r.ok ? 202 : r.code === "action_running" ? 409 : 422, r);
            return;
          }
          // REQ-431: the agent chosen in the studio.
          if (url === "/api/agent") {
            const kind = String(body.kind || "");
            const r = chooseAgent(
              projectDir,
              kind === "custom"
                ? { kind: "custom", command: String(body.command || "") }
                : { kind: kind === "codex" ? "codex" : "claude" }
            );
            json(r.ok ? 200 : 422, r);
            return;
          }
          if (url === "/api/quality/init") {
            const r = initQuality(projectDir, String(body.level || ""));
            json(r.ok ? 200 : 422, r);
            return;
          }
          if (url === "/api/draft/stop") {
            const r = stopJob(projectDir);
            json(r.ok ? 200 : 422, r);
            return;
          }
          if (url === "/api/build") {
            const r = startBuild(
              projectDir,
              Array.isArray(body.reqs) ? body.reqs.map(String) : [],
              String(body.profile || "")
            );
            json(r.ok ? 202 : 422, r);
            return;
          }
          if (url === "/api/stop") {
            // REQ-433: after the current requirement, or at once.
            const r = stopBuild(projectDir, body.now === true);
            json(r.ok ? 200 : 422, r);
            return;
          }
          json(404, { ok: false, message: "No such write." });
        });
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { "content-type": "text/plain", allow: "GET, HEAD" });
        res.end("Studio only reads, except its app's POST actions.\n");
        return;
      }
      // REQ-204, REQ-432: the studio at its root — the app built from studio/src.
      // `/app` and `/next` named it while the old page lived; they still open it.
      if (url === "/" || url === "/app" || url === "/app/" || url === "/next" || url === "/next/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(studioShell(path.basename(projectDir), token));
        return;
      }
      // The overview the app replaced: its address leads into the app.
      if (url === "/overview" || url === "/overview/") {
        res.writeHead(302, { location: "/" });
        res.end();
        return;
      }
      if (url.startsWith("/studio/")) {
        const asset = studioAsset(url);
        if (!asset) {
          res.writeHead(404, { "content-type": "text/plain" });
          res.end("Not found.\n");
          return;
        }
        res.writeHead(200, { "content-type": asset.type, "cache-control": "no-cache" });
        res.end(asset.body);
        return;
      }
      // REQ-217: the report as a page of its own, to keep or send.
      if (url === "/report.html") {
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "content-disposition": `attachment; filename="${path.basename(projectDir)}-report.html"`,
        });
        res.end(reportHtml(report(projectDir)));
        return;
      }
      if (url === "/report") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(reportHtml(report(projectDir)));
        return;
      }
      // REQ-323: in a workspace repository, the live view is the workspace's.
      const ws = fs.existsSync(path.join(projectDir, "specgate.workspace.yaml"))
        ? loadWorkspace(projectDir).ws
        : null;
      // REQ-410..412: each repository's own live view, from the workspace's studio.
      const repoMatch = ws ? /^\/live\/repo\/([^/]+)(\/.*)?$/.exec(url) : null;
      if (ws && repoMatch) {
        const name = decodeURIComponent(repoMatch[1]);
        const member = ws.config.repos.find((r) => r.name === name);
        const text = (code: number, body: string) => {
          res.writeHead(code, { "content-type": "text/plain; charset=utf-8" });
          res.end(body);
        };
        if (!member) {
          text(
            404,
            `The workspace ${ws.config.name} has no repository ${name}: it has ` +
              `${ws.config.repos.map((r) => r.name).join(", ")}.
`
          );
          return;
        }
        const dir = ws.dirs[name];
        if (!dir || !fs.existsSync(dir)) {
          text(
            404,
            `${name}'s folder is missing: ${member.path}.
`
          );
          return;
        }
        const rest = repoMatch[2];
        if (rest === undefined) {
          res.writeHead(301, { location: `/live/repo/${encodeURIComponent(name)}/` });
          res.end();
          return;
        }
        if (rest === "/") {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          // No token: the member's view reads, its own studio writes.
          res.end(
            livePage(name, "", { role: member.role, back: "/live", workspace: ws.config.name })
          );
          return;
        }
        if (req.method === "GET" && projectLive(dir, rest, req, res)) return;
        text(
          404,
          `No such page in ${name}'s live view.
`
        );
        return;
      }
      if (ws && (url === "/live" || url === "/live/")) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(workspaceLivePage(ws.config.name));
        return;
      }
      // REQ-433: the live view is the app's Live section.
      if (url === "/live" || url === "/live/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(studioShell(path.basename(projectDir), token, "live"));
        return;
      }
      if (ws && url === "/live.json") {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ schemaVersion: 1, live: readWorkspaceLive(ws) }));
        return;
      }
      if (ws && url === "/live/stream") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        let last = "";
        const push = () => {
          const sig = workspaceLiveSignature(ws);
          if (sig === last) return;
          last = sig;
          res.write(`event: live\ndata: ${JSON.stringify(readWorkspaceLive(ws))}\n\n`);
        };
        push();
        const timer = setInterval(push, 1000);
        const beat = setInterval(() => res.write(": keep-alive\n\n"), 15000);
        req.on("close", () => {
          clearInterval(timer);
          clearInterval(beat);
        });
        return;
      }
      if (url === "/live" || url === "/live/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(livePage(path.basename(projectDir), token));
        return;
      }
      if (projectLive(projectDir, url, req, res)) return;
      if (req.url === "/mermaid.min.js") {
        const mermaidPath = getMermaidPath();
        if (fs.existsSync(mermaidPath)) {
          res.writeHead(200, { "content-type": "application/javascript" });
          fs.createReadStream(mermaidPath).pipe(res);
        } else {
          res.writeHead(404);
          res.end("Not found");
        }
        return;
      }

      // Before `specgate init` the folder has no matrix: the app's own page
      // offers to create the project, and anything else is not here yet.
      if (!fs.existsSync(path.join(projectDir, "docs/specs/traceability.md"))) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Not a Specgate project yet: open / to create it.");
        return;
      }
      const model = loadModel(projectDir);
      if (req.url === "/status.json") {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ schemaVersion: 1, projectDir, ...model }));
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderHtml(projectDir, model));
    });

    const announce = () => {
      // The port it got: a taken one may have moved it (REQ-445).
      const port = (server.address() as import("node:net").AddressInfo).port;
      const shown = LOOPBACK.has(opts.host) ? "localhost" : opts.host;
      process.stdout.write(
        `\n  ${c.bold}🎨 specgate studio${c.reset} serving ${c.dim}${projectDir}${c.reset}\n` +
          `  ${c.green}▶ http://${shown}:${port}${c.reset}  ${c.dim}(Ctrl-C to stop · /status.json for the model)${c.reset}\n` +
          `  ${c.green}▶ http://${shown}:${port}/live${c.reset}  ${c.dim}the harness at work${c.reset}\n\n`
      );
    };
    // REQ-445: a taken port is asked what holds it — the same project's studio is
    // named and left alone; anything else is moved from, unless --port named it.
    const first = opts.port;
    const tryPort = (port: number) => {
      server.once("error", async (err: NodeJS.ErrnoException) => {
        if (err.code !== "EADDRINUSE") {
          process.stderr.write(
            `${c.red}✖${c.reset}  Could not start server: ${errorMessage(err)}\n`
          );
          process.exit(1);
        }
        const holder = await studioOn(port);
        if (holder && path.resolve(holder.project) === path.resolve(projectDir)) {
          process.stdout.write(
            `\n  ${c.green}✔${c.reset}  A studio of this project is already running: ${c.green}http://localhost:${port}${c.reset}\n` +
              `     ${c.dim}Open it, or stop it: ${process.platform === "win32" ? `taskkill /pid ${holder.pid} /F` : `kill ${holder.pid}`} (process ${holder.pid}).${c.reset}\n\n`
          );
          process.exit(0);
        }
        const who = holder ? `a studio of ${holder.project}` : "another program";
        if (opts.portGiven || port - first >= 10) {
          process.stderr.write(
            `${c.red}✖${c.reset}  Port ${port} is taken by ${who}. Pass another one: --port <n>.\n`
          );
          process.exit(1);
        }
        process.stdout.write(
          `  ${c.yellow}▲${c.reset}  Port ${port} is taken by ${who}; trying ${port + 1}.\n`
        );
        tryPort(port + 1);
      });
      server.listen(port, opts.host);
    };
    server.once("listening", announce);
    tryPort(first);
  }
}

/** What answers /api/ping on a local port, when it is a studio: its project and process. */
function studioOn(port: number): Promise<{ project: string; pid: number } | null> {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port,
        path: "/api/ping",
        headers: { host: `localhost:${port}` },
        timeout: 1500,
      },
      (res) => {
        let body = "";
        res.on("data", (d: Buffer) => (body += d));
        res.on("end", () => {
          try {
            const j = JSON.parse(body) as { ok?: boolean; project?: string; pid?: number };
            resolve(
              j.ok && typeof j.project === "string" && Number.isInteger(j.pid)
                ? { project: j.project, pid: j.pid! }
                : null
            );
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}
