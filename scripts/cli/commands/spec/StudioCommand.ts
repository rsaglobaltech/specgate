import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";
import { resolveProjectDir } from "../../../lib/project-root";
import { parseTraceability } from "./PlanCommand";
import { errorMessage } from "../../../lib/diagnostics";
import { BaseCommand } from "../../../lib/command";

import { c } from "../../../lib/ui";
import { readLive, liveSignature } from "../../../lib/live-model";
import { livePage } from "../../../lib/live-page";
import { requirementDetail, liveMatrix } from "../../../lib/live-detail";

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
}

export function parseArgs(argv: string[]) {
  const opts: StudioOptions = { projectDir: ".", port: 4173, host: "127.0.0.1", json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port" && argv[i + 1]) opts.port = Number(argv[++i]);
    else if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--out" && argv[i + 1]) opts.out = argv[++i];
    else if (a === "--host" && argv[i + 1]) opts.host = argv[++i];
    else if (a === "--json") opts.json = true;
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

    const server = http.createServer((req, res) => {
      if (!hostAllowed(opts.host, req.headers.host)) {
        res.writeHead(403, { "content-type": "text/plain" });
        res.end("Forbidden: studio answers on this machine only (see --host).\n");
        return;
      }
      const url = String(req.url || "/").split("?")[0];
      if (url === "/live" || url === "/live/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(livePage(path.basename(projectDir)));
        return;
      }
      if (url === "/live.json") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ schemaVersion: 1, projectDir, ...readLive(projectDir) }));
        return;
      }
      // REQ-180: one requirement's details, read when the viewer opens it.
      const reqMatch = /^\/live\/req\/(REQ-\d+)\.json$/.exec(url);
      if (reqMatch) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(requirementDetail(projectDir, reqMatch[1])));
        return;
      }
      // REQ-181: the traceability matrix as it stands.
      if (url === "/live/matrix.json") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ schemaVersion: 1, rows: liveMatrix(projectDir) }));
        return;
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
        return;
      }
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

      const model = loadModel(projectDir);
      if (req.url === "/status.json") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ schemaVersion: 1, projectDir, ...model }));
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderHtml(projectDir, model));
    });

    server.listen(opts.port, opts.host, () => {
      const shown = LOOPBACK.has(opts.host) ? "localhost" : opts.host;
      process.stdout.write(
        `\n  ${c.bold}🎨 specgate studio${c.reset} serving ${c.dim}${projectDir}${c.reset}\n` +
          `  ${c.green}▶ http://${shown}:${opts.port}${c.reset}  ${c.dim}(Ctrl-C to stop · /status.json for the model)${c.reset}\n` +
          `  ${c.green}▶ http://${shown}:${opts.port}/live${c.reset}  ${c.dim}the harness at work${c.reset}\n\n`
      );
    });
    server.on("error", (err: unknown) => {
      process.stderr.write(`${c.red}✖${c.reset}  Could not start server: ${errorMessage(err)}\n`);
      process.exit(1);
    });
  }
}
