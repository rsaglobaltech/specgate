/**
 * The change's evidence as one web page (REQ-818): `EVIDENCE.html`, a single
 * file a reviewer opens with a double click or downloads from CI — the
 * screens inside it, each requirement's runs, calls and AI decisions before
 * and after, and its diagrams side by side. Mermaid draws the diagrams from a
 * pinned CDN build: Specgate ships no runtime dependency, and without a
 * network the diagram's text is shown instead. Written the same way every
 * time: no clock, nothing random.
 */

import * as fs from "node:fs";
import { checkMark } from "./sequence-check";
import * as path from "node:path";
import {
  attemptAi,
  attemptWhy,
  outcomeText,
  statusText,
  valueText,
  type CallPair,
  type Picture,
  type RequirementEvidence,
} from "./evidence-page";

/** The Mermaid build the page loads: pinned, so a page reads the same next year. */
export const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js";
/** A picture larger than this is linked, not put inside the page. */
const MAX_INLINE_BYTES = 2 * 1024 * 1024;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** `code` spans of a line of the Markdown page, as HTML. */
const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
const anchor = (id: string) => id.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function image(projectDir: string, p: Picture | null, side: string, test: string): string {
  if (!p) return `<div class="shot none">No ${side} screenshot</div>`;
  const file = path.join(projectDir, p.source);
  let data: Buffer;
  try {
    data = fs.readFileSync(file);
  } catch {
    return `<div class="shot none">${esc(p.source)} is gone</div>`;
  }
  if (data.length > MAX_INLINE_BYTES) {
    return `<div class="shot none">Over 2 MB, not inside the page: <code>${esc(p.source)}</code></div>`;
  }
  const mime = MIME[path.extname(file).toLowerCase()] || "image/png";
  return `<img class="shot" src="data:${mime};base64,${data.toString("base64")}" alt="${esc(`${test}, ${side}`)}" loading="lazy">`;
}

const mermaid = (text: string) => `<pre class="mermaid">${esc(text.trimEnd())}</pre>`;

const pill = (kind: "ok" | "bad" | "none", text: string) =>
  `<span class="pill ${kind}">${esc(text)}</span>`;

function outcomeCell(r: Parameters<typeof outcomeText>[0]): string {
  const text = outcomeText(r);
  if (!r) return `<td class="muted">—</td>`;
  const [head, ...why] = text.split(" — ");
  return `<td>${pill(r.passed ? "ok" : "bad", head)}${why.length ? `<div class="why">${inline(why.join(" — "))}</div>` : ""}</td>`;
}

function section(projectDir: string, r: RequirementEvidence): string {
  const out: string[] = [];
  const state = [
    r.hasBefore ? pill("bad", "before taken") : pill("none", "no before"),
    r.hasAfter ? pill("ok", "delivered") : pill("none", "not delivered"),
  ].join(" ");
  out.push(
    `<section class="req" id="${anchor(r.id)}">`,
    `<header class="req-head"><p class="eyebrow">${esc(r.id)}</p><h2>${esc(r.title)}</h2><div class="state">${state}</div></header>`
  );

  const missing: string[] = [];
  if (!r.hasBefore) missing.push(`No before: <code>specgate evidence before ${esc(r.id)}</code>`);
  if (!r.hasAfter) missing.push(`Not delivered yet: <code>specgate apply ${esc(r.id)}</code>`);
  if ((r.hasBefore || r.hasAfter) && r.screens.length === 0)
    missing.push(
      "No screenshots: <code>specgate doctor</code> says how to have the runner keep them"
    );
  if (missing.length)
    out.push(`<ul class="missing">${missing.map((m) => `<li>${m}</li>`).join("")}</ul>`);

  for (const s of r.screens) {
    out.push(
      `<h3>Screens · ${esc(s.test)}</h3>`,
      `<div class="pair"><figure><figcaption>${pill("bad", "Before")}</figcaption>${image(projectDir, s.before, "before", s.test)}</figure>`,
      `<figure><figcaption>${pill("ok", "After")}</figcaption>${image(projectDir, s.after, "after", s.test)}</figure></div>`
    );
  }

  if (r.scenarios.length) {
    out.push(
      "<h3>Scenarios</h3>",
      '<div class="scroll"><table><thead><tr><th>Scenario</th><th>Before</th><th>After</th></tr></thead><tbody>',
      ...r.scenarios.map(
        (s) => `<tr><td>${esc(s.scenario)}</td>${outcomeCell(s.before)}${outcomeCell(s.after)}</tr>`
      ),
      "</tbody></table></div>"
    );
  }

  if (r.calls.length) {
    const status = (x: Parameters<typeof statusText>[0]) =>
      !x
        ? `<td class="muted">—</td>`
        : `<td>${pill(x.status < 400 ? "ok" : "bad", statusText(x))}</td>`;
    out.push(
      "<h3>Calls to the service</h3>",
      '<div class="scroll"><table><thead><tr><th>Call</th><th>Before</th><th>After</th></tr></thead><tbody>',
      ...r.calls.map(
        (c) => `<tr><td><code>${esc(c.key)}</code></td>${status(c.before)}${status(c.after)}</tr>`
      ),
      "</tbody></table></div>"
    );
    // A call with no body on either side — one the server recorded — has nothing to unfold.
    const bodied = (x: CallPair) =>
      [x.before?.request, x.before?.response, x.after?.request, x.after?.response].some(Boolean);
    for (const c of r.calls.filter((x) => x.changed && bodied(x))) {
      const body = (label: string, text: string) =>
        text
          ? `<div><p class="label">${esc(label)}</p><pre class="json">${esc(text)}</pre></div>`
          : "";
      out.push(
        `<details open><summary><code>${esc(c.key)}</code> — what changed</summary><div class="bodies">`,
        body("Request", (c.after || c.before)!.request),
        body(`Before · ${statusText(c.before)}`, c.before?.response || ""),
        body(`After · ${statusText(c.after)}`, c.after?.response || ""),
        "</div></details>"
      );
    }
  }

  if (r.ai.length) {
    out.push(
      "<h3>AI decisions</h3>",
      '<div class="scroll"><table><thead><tr><th></th><th>Model</th><th>Input</th><th>Output</th><th>Time</th></tr></thead><tbody>',
      ...r.ai.map(
        ({ side, decision: d }) =>
          `<tr><td>${pill(side === "before" ? "bad" : "ok", side === "before" ? "Before" : "After")}</td><td>${esc(valueText(d.model))}</td><td>${esc(valueText(d.input))}</td><td><code>${esc(valueText(d.output))}</code></td><td class="num">${d.ms === undefined ? "" : `${esc(valueText(d.ms))} ms`}</td></tr>`
      ),
      "</tbody></table></div>"
    );
  }

  if (r.attempts.length) {
    out.push(
      "<h3>Failed attempts</h3>",
      '<div class="scroll"><table><thead><tr><th>Attempt</th><th>Why it failed</th><th>AI decisions</th></tr></thead><tbody>',
      ...r.attempts.map(
        (a) =>
          `<tr><td>${pill("bad", `#${a.n}`)}</td><td>${inline(attemptWhy(a))}</td><td><code>${esc(attemptAi(a))}</code></td></tr>`
      ),
      "</tbody></table></div>"
    );
  }

  for (const s of r.diagrams.sequences) {
    const side = (label: string, kind: "ok" | "bad", text: string | null, empty: string) =>
      `<figure><figcaption>${pill(kind, label)}</figcaption>${text ? mermaid(text) : `<p class="muted">${empty}</p>`}</figure>`;
    out.push(`<h3>Sequence · ${esc(s.scenario)}</h3>`);
    const check = r.checks.find((c) => c.scenario === s.scenario)?.check;
    if (check)
      out.push(`<p class="check-${check.state}">${checkMark(check)} ${inline(check.text)}</p>`);
    if (s.before !== null && s.before === s.after) {
      out.push(mermaid(s.after as string), `<p class="muted">Unchanged since the base.</p>`);
    } else if (s.before === null && s.after) {
      // Nothing to compare with: the diagram takes the whole width, not half beside a blank.
      out.push(`<p class="muted">New since the base.</p>`, mermaid(s.after));
    } else {
      out.push(
        `<div class="pair">${side("At the base", "bad", s.before, "New since the base.")}${side("Now", "ok", s.after, "Removed.")}</div>`
      );
    }
  }

  for (const c of r.diagrams.classes) {
    out.push(`<h3>Classes · ${esc(c.file)}</h3>`, mermaid(c.after));
    out.push(
      `<p class="legend">${c.legend ? inline(c.legend) : ""}${c.before === null ? `${c.legend ? " " : ""}New since the base.` : ""}</p>`
    );
    if (c.before !== null)
      out.push(`<details><summary>At the base</summary>${mermaid(c.before)}</details>`);
  }

  out.push("</section>");
  return out.join("\n");
}

const STYLE = `
:root {
  --bg: #f5f6f4; --surface: #ffffff; --fg: #1c2320; --muted: #5d6a63; --line: #d8ded9;
  --accent: #2f6f5e; --ok: #2f7a45; --ok-bg: #e6f4ea; --bad: #b23a3a; --bad-bg: #fbeceb; --none: #6b6f6d; --none-bg: #eceeed;
  --body: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; --mono: ui-monospace, "Cascadia Code", Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #141917; --surface: #1c2320; --fg: #e5ebe7; --muted: #9aa8a0; --line: #2e3833;
    --accent: #7cc4ad; --ok: #8fd3a3; --ok-bg: #1d3225; --bad: #f08a84; --bad-bg: #3a2121; --none: #b5bcb8; --none-bg: #262d2a; color-scheme: dark; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.55 var(--body); }
.wrap { max-width: 1200px; margin: 0 auto; padding: 32px max(16px, env(safe-area-inset-left)) 64px; display: grid; gap: 40px; }
h1, h2, h3 { margin: 0; line-height: 1.25; text-wrap: balance; }
h1 { font-size: 1.8rem; } h2 { font-size: 1.4rem; } h3 { font-size: 1rem; margin-top: 8px; }
p { margin: 0; }
code { font-family: var(--mono); font-size: .86em; }
.eyebrow { font: 600 .72rem/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
.muted, .legend { color: var(--muted); font-size: .9rem; }
.check-matches, .check-differs, .check-unchecked, .check-steps { font-size: .9rem; padding: .4rem .6rem; border-radius: 6px; } .check-matches { color: var(--ok); background: var(--ok-bg); } .check-differs { color: var(--bad); background: var(--bad-bg); } .check-unchecked, .check-steps { color: var(--none); background: var(--none-bg); }
nav { display: flex; flex-wrap: wrap; gap: 8px; }
nav a { color: var(--fg); text-decoration: none; border: 1px solid var(--line); background: var(--surface); padding: 6px 10px; border-radius: 6px; font-size: .88rem; }
nav a:hover, nav a:focus-visible { border-color: var(--accent); outline: none; }
.req { display: grid; gap: 14px; padding-top: 24px; border-top: 1px solid var(--line); min-width: 0; }
.req-head { display: grid; gap: 6px; }
.state { display: flex; gap: 6px; flex-wrap: wrap; }
.pill { display: inline-block; font: 600 .72rem/1 var(--mono); padding: 4px 7px; border-radius: 4px; white-space: nowrap; }
.ok { color: var(--ok); background: var(--ok-bg); } .bad { color: var(--bad); background: var(--bad-bg); } .none { color: var(--none); background: var(--none-bg); }
.missing { margin: 0; padding-left: 20px; color: var(--muted); }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
figure { margin: 0; display: grid; gap: 8px; align-content: start; min-width: 0; }
.shot { width: 100%; height: auto; border: 1px solid var(--line); border-radius: 6px; display: block; background: var(--surface); }
.shot.none { padding: 40px 12px; text-align: center; color: var(--muted); font-size: .9rem; }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: .9rem; background: var(--surface); }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.why { margin-top: 4px; color: var(--muted); font-size: .85rem; }
.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
details { display: grid; gap: 8px; }
summary { cursor: pointer; color: var(--muted); font-size: .9rem; }
.bodies { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 8px; }
.label { font-size: .8rem; color: var(--muted); margin-bottom: 4px; }
pre.json { margin: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 10px; font: .8rem/1.45 var(--mono); white-space: pre-wrap; word-break: break-word; }
pre.mermaid { margin: 0; background: #ffffff; color: #1c2320; border: 1px solid var(--line); border-radius: 6px; padding: 14px; overflow-x: auto; font: .78rem/1.4 var(--mono); }
@media (max-width: 760px) { .pair { grid-template-columns: 1fr; } }
`;

/** The whole page, as one HTML document. */
export function evidenceHtml(
  projectDir: string,
  changeId: string,
  gathered: RequirementEvidence[]
): string {
  const nav = gathered
    .map((r) => `<a href="#${anchor(r.id)}">${esc(r.id)} · ${esc(r.title)}</a>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evidence — ${esc(changeId)}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<header style="display:grid;gap:10px">
<p class="eyebrow">Specgate evidence</p>
<h1>${esc(changeId)}</h1>
<p class="muted">Each requirement before its code and after it: the screens, why each scenario was red, what the service answered, what the AI decided, and the code drawn as UML. Written by <code>specgate evidence ${esc(changeId)} --html</code> (ADR-0047). The diagrams are drawn by Mermaid from a CDN; offline, their text is shown.</p>
<nav>${nav}</nav>
</header>
${gathered.map((r) => section(projectDir, r)).join("\n")}
</div>
<script src="${MERMAID_URL}"></script>
<script>
  if (window.mermaid) {
    mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
    mermaid.run({ querySelector: "pre.mermaid" }).catch(function () {});
  }
</script>
</body>
</html>
`;
}

/** Writes `EVIDENCE.html` beside `EVIDENCE.md`; returns it, from the project. */
export function writeEvidenceHtml(
  projectDir: string,
  changeId: string,
  gathered: RequirementEvidence[]
): string {
  const file = path.join(projectDir, "docs", "specs", "changes", changeId, "EVIDENCE.html");
  fs.writeFileSync(file, evidenceHtml(projectDir, changeId, gathered), "utf8");
  return path.relative(projectDir, file).split(path.sep).join("/");
}
