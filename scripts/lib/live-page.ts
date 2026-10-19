/**
 * The live view's page (ADR-0037): one self-contained document, no external
 * resources, filled from `/live.json` and kept current by `/live/stream`.
 * Every value from an event is set with textContent, never as HTML.
 */
export function livePage(projectName: string): string {
  const title = String(projectName).replace(/[&<>"]/g, "");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Harness live — ${title}</title>
<style>
  :root{--bg:#f6f7f9;--card:#fff;--ink:#16181d;--muted:#5f6673;--line:#e3e6eb;
        --run:#2563eb;--pass:#15803d;--fail:#b91c1c;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
  @media (prefers-color-scheme: dark){:root{--bg:#0f1115;--card:#171a21;--ink:#e7e9ee;--muted:#9aa1ad;
        --line:#272b35;--run:#60a5fa;--pass:#4ade80;--fail:#f87171}}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);
        font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:20px max(16px,4vw)}
  header{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:baseline;margin-bottom:16px}
  h1{font-size:18px;margin:0} .muted{color:var(--muted)} .dot{width:8px;height:8px;border-radius:50%;
        display:inline-block;background:var(--muted);margin-right:6px}
  .dot.on{background:var(--pass)} main{display:grid;gap:12px}
  .req{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--muted);
        border-radius:6px;padding:12px 14px}
  .req.running{border-left-color:var(--run)} .req.pass{border-left-color:var(--pass)}
  .req.fail{border-left-color:var(--fail)}
  .head{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline}
  .id{font:600 15px var(--mono)} .phase{font-weight:600;text-transform:uppercase;font-size:12px;letter-spacing:.04em}
  .running .phase{color:var(--run)} .pass .phase{color:var(--pass)} .fail .phase{color:var(--fail)}
  .facts{font-variant-numeric:tabular-nums}
  details{margin-top:8px} summary{cursor:pointer;color:var(--muted)}
  ol{list-style:none;margin:8px 0 0;padding:0;max-height:320px;overflow:auto}
  li{display:grid;grid-template-columns:5.5em 4.5em 1fr auto;gap:8px;padding:3px 0;
        border-top:1px solid var(--line);font-size:13px}
  li .t,li .k{color:var(--muted);font-variant-numeric:tabular-nums} li .target{font-family:var(--mono);
        overflow-wrap:anywhere} li .r.ok,li .r.pass{color:var(--pass)} li .r.error,li .r.fail{color:var(--fail)}
  .files{font-family:var(--mono);font-size:12px;color:var(--muted);overflow-wrap:anywhere}
  .empty{background:var(--card);border:1px dashed var(--line);border-radius:6px;padding:24px;color:var(--muted)}
</style></head>
<body>
<header><h1>Harness live</h1><span class="muted">${title}</span>
  <span class="muted"><span id="dot" class="dot"></span><span id="conn">connecting</span></span></header>
<main id="list"><div class="empty">No harness events yet. Run <code>specgate harness run</code>; each
requirement appears here as it starts.</div></main>
<script>
const list = document.getElementById("list");
const fmt = (s) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m ? m + "m " + (s % 60) + "s" : s + "s"; };
const clock = (t) => t ? new Date(t * 1000).toLocaleTimeString() : "";
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function render(model) {
  const reqs = (model && model.requirements) || [];
  if (!reqs.length) return;
  list.replaceChildren(...reqs.map((r) => {
    const card = el("section", "req " + r.state);
    const head = el("div", "head");
    head.append(el("span", "id", r.req), el("span", "phase", r.phase),
      el("span", "facts muted", "attempt " + r.attempt + " · " + fmt(r.elapsed) +
        (r.tests ? " · tests " + r.tests.pass + " pass, " + r.tests.fail + " fail" : "") +
        " · " + r.steps.length + " step" + (r.steps.length === 1 ? "" : "s")));
    card.append(head);
    if (r.files.length) card.append(el("div", "files", r.files.join("  ·  ")));
    const d = el("details"); if (r.state === "running") d.open = true;
    d.append(el("summary", "", "Steps, newest first"));
    const ol = el("ol");
    for (const s of r.steps) {
      const li = el("li");
      const what = s.type === "step" ? (s.kind || "") : s.type;
      const target = s.type === "message" ? s.text : s.type === "gate" ? s.stage : (s.target || s.tool || "");
      const res = s.result ? String(s.result) : "";
      li.append(el("span", "t", clock(s.ended || s.t)), el("span", "k", what), el("span", "target", target || ""),
        el("span", "r " + res, res + (s.pass !== undefined ? " " + s.pass + "/" + (s.pass + (s.fail || 0)) : "")));
      ol.append(li);
    }
    d.append(ol); card.append(d);
    return card;
  }));
}
fetch("live.json").then((r) => r.json()).then(render).catch(() => {});
const es = new EventSource("live/stream");
es.addEventListener("live", (e) => { try { render(JSON.parse(e.data)); } catch (err) {} });
es.onopen = () => { document.getElementById("dot").classList.add("on"); document.getElementById("conn").textContent = "live"; };
es.onerror = () => { document.getElementById("dot").classList.remove("on"); document.getElementById("conn").textContent = "reconnecting"; };
</script>
</body></html>`;
}
