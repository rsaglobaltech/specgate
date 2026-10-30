/**
 * The workspace's live page (REQ-323): one panel per repository — the
 * requirement in flight, its gate step and the agent's last step — then each
 * story with its parts, and the cost. Each panel's name opens that
 * repository's own live view (REQ-411). Filled from `/live.json`, kept current by
 * `/live/stream`; every value is set with textContent, never as HTML.
 *
 * The script lives inside this template literal: it uses no backticks, no
 * dollar-brace, and no backslash escapes.
 */
export function workspaceLivePage(workspaceName: string): string {
  const title = String(workspaceName).replace(/[&<>"']/g, "");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Workspace live — ${title}</title>
<style>
  :root{--bg:#f6f8fa;--panel:#fff;--line:#d1d9e0;--ink:#1f2328;--muted:#59636e;--pass:#1a7f37;--fail:#cf222e;
    --run:#9a6700;--accent:#0969da;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color-scheme:light}
  @media (prefers-color-scheme: dark){:root{--bg:#0d1117;--panel:#151b23;--line:#3d444d;--ink:#f0f6fc;--muted:#9198a1;
    --pass:#3fb950;--fail:#f85149;--run:#d29922;--accent:#4493f8;color-scheme:dark}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 var(--sans)}
  header{padding:14px 20px;border-bottom:1px solid var(--line);background:var(--panel);display:flex;gap:12px;align-items:baseline}
  header b{font-size:16px} header span{color:var(--muted)}
  main{padding:16px 20px;display:grid;gap:20px}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin:0 0 8px}
  .repos{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px}
  .card h3{margin:0 0 6px;font-size:15px} .card h3 a{color:var(--accent);text-decoration:none} .card h3 a:hover{text-decoration:underline} .role{color:var(--muted);font-weight:400;font-size:12px;margin-left:6px}
  .idle{color:var(--muted)} .req{font-family:var(--mono)} .step{color:var(--run)} .agent{color:var(--muted);font-family:var(--mono);font-size:12px;word-break:break-all}
  .cost{margin-top:8px;color:var(--muted);font-size:12px}
  table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:8px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
  th{font-size:12px;color:var(--muted);font-weight:600}
  .state-building{color:var(--run)} .state-archived{color:var(--pass)} .state-missing{color:var(--fail)} .blocked{color:var(--fail);font-size:12px}
</style></head>
<body>
<header><b>Workspace live</b><span>${title}</span><span id="updated"></span></header>
<main>
  <section><h2>Repositories</h2><div class="repos" id="repos"></div></section>
  <section><h2>Stories</h2><table><thead><tr><th>Story</th><th>Parts</th><th>Cost</th></tr></thead><tbody id="stories"></tbody></table></section>
</main>
<script>
(function(){
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function cost(c){ var m = c.money === null ? "—" : "$" + c.money.toFixed(2); return m + " · " + c.minutes + " min"; }
  function since(t){ if (!t) return ""; var s = Math.max(0, Math.round(Date.now() / 1000 - t)); return s < 60 ? s + " s" : Math.floor(s / 60) + " min"; }
  function render(m){
    var repos = document.getElementById("repos"); repos.textContent = "";
    m.repos.forEach(function(r){
      var c = el("div", "card"); var h = el("h3"); var a = el("a", "", r.name); a.href = "/live/repo/" + encodeURIComponent(r.name) + "/"; a.title = "Open " + r.name + "'s live view"; h.appendChild(a); h.appendChild(el("span", "role", r.role)); c.appendChild(h);
      if (!r.exists) c.appendChild(el("div", "idle", "folder missing"));
      else if (!r.inFlight) c.appendChild(el("div", "idle", r.queue.length ? "queued: " + r.queue.join(", ") : "idle"));
      else {
        var f = r.inFlight; c.appendChild(el("div", "req", f.req + " · attempt " + f.attempt + (f.title ? " — " + f.title : "")));
        if (f.running) c.appendChild(el("div", "step", f.running.stage + (f.running.runner ? " (" + f.running.runner + ")" : "") + " · " + since(f.running.since)));
        else c.appendChild(el("div", "step", f.phase));
        if (f.agent) c.appendChild(el("div", "agent", f.agent.kind + " " + f.agent.target));
      }
      c.appendChild(el("div", "cost", r.requirements.pass + " passed · " + r.requirements.fail + " failed · " + cost(r.cost)));
      repos.appendChild(c);
    });
    var body = document.getElementById("stories"); body.textContent = "";
    m.stories.forEach(function(s){
      var tr = el("tr"); var name = el("td"); name.appendChild(el("div", "", s.title || s.id)); name.appendChild(el("div", "idle", s.done ? "done" : s.id)); tr.appendChild(name);
      var parts = el("td");
      s.subchanges.forEach(function(p){
        var d = el("div"); d.appendChild(el("span", "", p.repo + " ")); d.appendChild(el("span", "state-" + p.state, p.state));
        if (p.blockedBy.length) d.appendChild(el("div", "blocked", "waits on " + p.blockedBy.join(", ")));
        parts.appendChild(d);
      });
      tr.appendChild(parts); tr.appendChild(el("td", "", cost(s.cost))); body.appendChild(tr);
    });
    document.getElementById("updated").textContent = "updated " + new Date().toLocaleTimeString();
  }
  fetch("/live.json").then(function(r){ return r.json(); }).then(function(d){ render(d.live); });
  if (window.EventSource) {
    var es = new EventSource("/live/stream");
    es.addEventListener("live", function(ev){ try { render(JSON.parse(ev.data)); } catch (e) {} });
  }
})();
</script>
</body></html>
`;
}
