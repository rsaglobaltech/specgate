/**
 * The live view's page (ADR-0037): one self-contained document, no external
 * resources, filled from `/live.json` and kept current by `/live/stream`.
 * Every value from an event is set with textContent, never as HTML.
 *
 * REQ-179: laid out the way CI runs are read — a sidebar of requirements by
 * module, the run summed up, its requirements as a graph of jobs, and the
 * selected one's steps with the agent's stream as the log of the step in
 * progress.
 *
 * REQ-182: the sidebar is the run's work queue (now, needs attention, up next,
 * finished recently) with the agent's model, context and tokens; an Agent tab
 * shows the selected attempt's session and the prompt it was given.
 *
 * REQ-181: the header stays in view while the page scrolls; modules fold, in
 * the sidebar as an accordion the viewer opens and closes, and in the graph
 * once all their requirements have passed; the selected requirement opens into
 * tabs (Steps, Requirement, Tests and files, Attempts) read from
 * `/live/req/<id>.json`; and a second view shows the traceability matrix as it
 * stands, from `/live/matrix.json`.
 *
 * The script lives inside this template literal: it uses no backticks, no
 * dollar-brace, and no backslash escapes.
 */
export function livePage(projectName: string): string {
  const title = String(projectName).replace(/[&<>"']/g, "");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Harness live — ${title}</title>
<style>
  :root{--bg:#f6f8fa;--panel:#ffffff;--line:#d1d9e0;--soft:#eff2f5;--ink:#1f2328;--muted:#59636e;--faint:#8c959f;
    --pass:#1a7f37;--fail:#cf222e;--run:#9a6700;--run-bg:#fff8c5;--accent:#0969da;--sel:#ddf4ff;
    --log:#1f2328;--log-ink:#d1d9e0;--log-muted:#8c959f;--top:56px;
    --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif;color-scheme:light}
  @media (prefers-color-scheme: dark){:root{--bg:#0d1117;--panel:#151b23;--line:#3d444d;--soft:#212830;--ink:#f0f6fc;
    --muted:#9198a1;--faint:#656c76;--pass:#3fb950;--fail:#f85149;--run:#d29922;--run-bg:#2c2513;--accent:#4493f8;
    --sel:#16263d;--log:#010409;--log-ink:#d1d7e0;--log-muted:#656c76;color-scheme:dark}}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 var(--sans)}
  button{font:inherit;color:inherit} a{color:var(--accent);text-decoration:none} a:hover{text-decoration:underline}
  .top{position:sticky;top:0;z-index:20;height:var(--top);display:flex;align-items:center;gap:10px;padding:0 24px;
    background:var(--panel);border-bottom:1px solid var(--line)}
  .top svg{width:22px;height:22px;flex:none} .sep{color:var(--faint)}
  .views{display:flex;gap:4px;margin-left:24px}
  .views button{border:1px solid transparent;background:none;border-radius:6px;padding:4px 12px;cursor:pointer;color:var(--muted)}
  .views button[aria-pressed="true"]{border-color:var(--line);background:var(--soft);color:var(--ink);font-weight:600}
  .pill{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
  .pill i{width:8px;height:8px;border-radius:50%;background:var(--faint)} .pill.on i{background:var(--pass)}
  .layout{display:flex;align-items:flex-start}
  aside{position:sticky;top:var(--top);width:300px;flex:none;height:calc(100vh - var(--top));overflow:auto;
    background:var(--panel);border-right:1px solid var(--line);padding:12px}
  aside details{border-radius:6px} aside summary{list-style:none;display:flex;align-items:center;gap:8px;padding:7px 10px;
    border-radius:6px;cursor:pointer;font-weight:600;font-size:13px}
  aside summary::-webkit-details-marker{display:none} aside summary:hover{background:var(--soft)}
  aside summary .chev{width:12px;height:12px;transition:transform .15s} aside details[open]>summary .chev{transform:rotate(90deg)}
  aside summary .count{margin-left:auto;font-weight:400;color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}
  .job{display:flex;width:100%;align-items:center;gap:8px;padding:5px 10px 5px 30px;border:0;border-radius:6px;background:none;text-align:left;cursor:pointer;font-size:13px}
  .job:hover{background:var(--soft)} .job.sel{background:var(--sel);font-weight:600}
  .job .name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .job .name>span{display:block;overflow:hidden;text-overflow:ellipsis}
  .job .d{font-size:12px;color:var(--muted);font-weight:400;font-variant-numeric:tabular-nums}
  .summary-btn{padding-left:10px;margin-bottom:6px;font-weight:600}
  .qsec{margin:10px 0 14px} .qsec h2{display:flex;align-items:center;gap:8px;margin:0 0 4px;padding:0 10px;font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
  .qsec h2 .count{margin-left:auto;font-weight:400;font-variant-numeric:tabular-nums} .qsec .job{padding-left:10px;align-items:flex-start}
  .qsec .job .ic{margin-top:3px} .job small{display:block;font-size:11.5px;color:var(--muted);font-weight:400}
  .qsec p{margin:2px 10px 6px;font-size:12.5px} .muted{color:var(--muted)}
  .now{border:1px solid var(--run);border-radius:6px;padding:4px 0 8px;background:var(--panel)}
  .kv{display:grid;grid-template-columns:62px minmax(0,1fr);gap:4px 10px;margin:4px 10px 0;font-size:12.5px} .kv dt{color:var(--muted)} .kv dd{margin:0;min-width:0;overflow-wrap:anywhere}
  .ctx{display:flex;flex-direction:column;gap:3px} .ctx .d{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
  details.prompt{margin-top:10px} details.prompt summary{cursor:pointer;color:var(--accent);font-size:13px}
  details.prompt pre{max-height:420px;overflow:auto;background:var(--log);color:var(--log-ink);padding:12px;border-radius:6px;font:12px/1.55 var(--mono);white-space:pre-wrap}
  main{flex:1;min-width:0;padding:0 28px 28px}
  .stick{position:sticky;top:var(--top);z-index:10;background:var(--bg);padding:20px 0 12px;display:flex;flex-direction:column;gap:12px}
  .head{display:flex;align-items:center;gap:12px;flex-wrap:wrap} .head h1{margin:0;font-size:20px;font-weight:600}
  .badge{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600}
  .badge.running{background:var(--run-bg);color:var(--run)} .badge.pass{background:rgba(31,136,61,.12);color:var(--pass)}
  .badge.fail{background:rgba(207,34,46,.12);color:var(--fail)} .badge i{width:8px;height:8px;border-radius:50%;background:currentColor}
  .box{background:var(--panel);border:1px solid var(--line);border-radius:6px}
  #progress{display:flex;flex-wrap:wrap;gap:8px 40px;padding:12px 18px}
  #progress div span{display:block;font-size:12px;color:var(--muted)} #progress div b{font-weight:400;font-variant-numeric:tabular-nums}
  .bar{display:flex;height:6px;border-radius:999px;overflow:hidden;background:var(--soft)} .bar i{display:block}
  .gap{display:flex;flex-direction:column;gap:16px}
  .mm-row{display:grid;grid-template-columns:28px 150px minmax(0,1fr) 70px 90px;gap:12px;align-items:center;padding:11px 16px;border-bottom:1px solid var(--soft)}
  .mm-row:last-of-type{border-bottom:0} .mm-head{font-size:12px;font-weight:600;color:var(--muted);border-bottom-color:var(--line)}
  .mm-row b{font-weight:600} .mm-row .num{text-align:right;font-variant-numeric:tabular-nums} .mm-row .muted{color:var(--muted)}
  .mm-row.has-fail{background:rgba(207,34,46,.05)} .mm-row.has-run{background:var(--run-bg)} .mm-row.queued{color:var(--muted)}
  .mm-bar{display:flex;gap:3px}
  .seg{flex:1;min-width:6px;height:16px;border:0;border-radius:3px;padding:0;cursor:pointer;background:var(--soft)}
  .seg.pass{background:var(--pass)} .seg.fail{background:var(--fail)} .seg.queued{background:var(--soft);box-shadow:inset 0 0 0 1px var(--line)}
  .seg.running{background:repeating-linear-gradient(135deg,#bf8700 0 5px,#d4a72c 5px 10px)}
  .seg.blocked{background:none;box-shadow:inset 0 0 0 1.5px var(--faint)}
  .seg.on{outline:2px solid var(--accent);outline-offset:2px} .seg:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
  .mm-legend{display:flex;gap:16px;justify-content:flex-end;padding:10px 16px;font-size:12px;color:var(--muted);border-top:1px solid var(--line)}
  .mm-legend span{display:inline-flex;align-items:center;gap:6px} .mm-legend .seg{width:14px;height:10px;flex:none;cursor:default}
  #focus{display:flex;flex-direction:column;overflow:hidden}
  #focus .fh{padding:12px 16px 0;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  #focus .fh b{font-weight:600} #focus .fh span{font-size:12px;color:var(--muted)}
  .tabs{display:flex;gap:2px;padding:8px 12px 0;border-bottom:1px solid var(--line);overflow-x:auto}
  .tabs button{border:0;background:none;padding:8px 12px;cursor:pointer;color:var(--muted);border-bottom:2px solid transparent;white-space:nowrap}
  .tabs button[aria-selected="true"]{color:var(--ink);font-weight:600;border-bottom-color:#fd8c73}
  .pane{padding:0}
  #pipeline{list-style:none;margin:0;padding:0}
  #pipeline>li{display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--soft);font-size:13px}
  #pipeline .t{flex:1;min-width:0;overflow-wrap:anywhere} #pipeline .mono{font-family:var(--mono);font-size:12.5px}
  #pipeline .d{color:var(--muted);font-variant-numeric:tabular-nums}
  #pipeline li.running{background:var(--run-bg)} #pipeline li.running .d{color:var(--run)} #pipeline li.idle{color:var(--faint)}
  #pipeline li.logrow{display:block;padding:0;background:var(--log)}
  .feed{list-style:none;margin:0;padding:10px 16px 10px 42px;max-height:340px;overflow:auto;color:var(--log-ink);font:12px/1.65 var(--mono)}
  .feed li{display:grid;grid-template-columns:64px 56px minmax(0,1fr);gap:10px}
  .feed .ts,.feed .k{color:var(--log-muted)} .feed .ok{color:#3fb950} .feed .bad{color:#f85149}
  .feed .say{font-family:var(--sans);font-size:12.5px} .feed .x{overflow-wrap:anywhere}
  .sect{padding:14px 16px;border-bottom:1px solid var(--soft)} .sect:last-child{border-bottom:0}
  .sect h3{margin:0 0 8px;font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
  .stmt{font-size:14.5px;line-height:1.55} .meta{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12.5px;color:var(--muted)}
  .scn{border:1px solid var(--line);border-radius:6px;padding:10px 12px;margin-bottom:8px}
  .scn b{font-weight:600} .scn ol{margin:6px 0 0;padding-left:18px;font-size:13px}
  .scn .kw{font-weight:600;color:var(--accent)}
  .list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;font:12.5px var(--mono)}
  .list li{display:flex;gap:10px;align-items:baseline} .add{color:var(--pass)} .rem{color:var(--fail)}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th{text-align:left;font-weight:600;color:var(--muted);padding:7px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
  td{padding:7px 10px;border-bottom:1px solid var(--soft);vertical-align:top}
  td.mono{font-family:var(--mono);white-space:nowrap} td.tests{font-family:var(--mono);font-size:11.5px;overflow-wrap:anywhere}
  .st{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
  .st.Implemented,.st.Verified,.st.Released{color:var(--pass)} .st.Draft{color:var(--muted)} .st.running{color:var(--run)}
  .mtools{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  .mtools input{height:32px;padding:0 10px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);min-width:260px}
  .msum{font-size:12.5px;color:var(--muted)}
  .mgroup>summary{list-style:none;display:flex;gap:10px;align-items:center;padding:10px 14px;cursor:pointer;font-weight:600}
  .mgroup>summary::-webkit-details-marker{display:none} .mgroup>summary .count{font-weight:400;color:var(--muted);font-size:12.5px}
  .ic{flex:none;width:16px;height:16px;display:inline-block}
  .spin{animation:spin 1s linear infinite;transform-origin:50% 50%} @keyframes spin{to{transform:rotate(360deg)}}
  .empty{padding:40px 16px;text-align:center;color:var(--muted)}
  [hidden]{display:none!important}
  @media (max-width:900px){.layout{flex-direction:column} aside{position:static;width:auto;height:auto;max-height:300px;border-right:0;border-bottom:1px solid var(--line)} main{padding:0 14px 20px}}
  @media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
</style></head>
<body>
<div class="top">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>
  <a href="#">${title}</a><span class="sep">/</span><b>Harness live</b>
  <div class="views" role="group" aria-label="View">
    <button type="button" id="vRun" aria-pressed="true">Run</button>
    <button type="button" id="vMatrix" aria-pressed="false">Traceability</button>
  </div>
  <span id="conn" class="pill"><i></i><span id="connText">connecting</span></span>
</div>
<div class="layout">
  <aside aria-label="Work queue"><div id="jobs"></div></aside>
  <main>
    <section id="runView">
      <div class="stick">
        <div class="head"><span id="runBadge" class="badge running"><i></i><span id="runState">Waiting</span></span><h1 id="runTitle">Harness run</h1></div>
        <div id="progress" class="box" role="status"></div>
      </div>
      <div class="gap">
        <div class="box" id="chain" role="group" aria-label="The run by module: one segment per requirement"></div>
        <section id="focus" class="box" aria-live="polite">
          <div class="fh"><b id="fName">—</b><span id="fMeta"></span></div>
          <div class="tabs" role="tablist" aria-label="About this requirement">
            <button type="button" role="tab" data-tab="steps" aria-selected="true">Steps</button>
            <button type="button" role="tab" data-tab="req" aria-selected="false">Requirement</button>
            <button type="button" role="tab" data-tab="files" aria-selected="false">Tests and files</button>
            <button type="button" role="tab" data-tab="attempts" aria-selected="false">Attempts</button>
            <button type="button" role="tab" data-tab="agent" aria-selected="false">Agent</button>
          </div>
          <div class="pane" data-pane="steps"><ol id="pipeline" aria-label="Steps: Agent, Specification, Architecture, Tests, Merge"></ol></div>
          <div class="pane" data-pane="req" hidden></div>
          <div class="pane" data-pane="files" hidden></div>
          <div class="pane" data-pane="attempts" hidden></div>
          <div class="pane" data-pane="agent" hidden></div>
        </section>
      </div>
    </section>
    <section id="matrixView" hidden>
      <div class="stick">
        <div class="head"><h1>Traceability matrix</h1><span class="msum" id="mSum"></span></div>
        <div class="mtools"><input id="mFilter" type="search" placeholder="Filter by REQ, SCN, title, test or status" aria-label="Filter the matrix"/></div>
      </div>
      <div id="matrix" class="gap"></div>
    </section>
  </main>
</div>
<script>
(function(){
  var NS = "http:" + "//www.w3.org/2000/svg";
  var model = {requirements:[]}, projectDir = "", pinned = null, tab = "steps", stepsKey = "";
  var expanded = {}, details = {}, matrix = [], matrixDirty = true, view = "run";
  var open = load("sg-live-open") || {};
  function load(k){ try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function save(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function $(id){ return document.getElementById(id); }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function s(tag, attrs, parent){ var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function now(){ return Date.now() / 1000; }
  function two(n){ return (n < 10 ? "0" : "") + n; }
  function dur(sec){ sec = Math.max(0, Math.round(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), x = sec % 60;
    return h ? h + "h " + m + "m" : m ? m + "m " + x + "s" : x + "s"; }
  function stamp(t){ if (!t) return ""; var d = new Date(t * 1000); return two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds()); }
  function elapsed(r){ return r.state === "running" ? Math.max(r.elapsed, now() - r.started) : r.elapsed; }
  function clip(t, n){ t = String(t || ""); return t.length > n ? t.slice(0, n - 1) + "…" : t; }
  function cap(g){ return g ? g.charAt(0).toUpperCase() + g.slice(1) : "Requirements"; }
  /** A link that opens the file in VS Code, at its line when known. */
  function fileLink(rel, line){
    var a = el("a", "", rel + (line ? ":" + line : ""));
    if (projectDir) a.setAttribute("href", "vscode://file/" + (projectDir.split(String.fromCharCode(92)).join("/") + "/" + rel) + (line ? ":" + line : ""));
    a.title = "Open in VS Code"; return a;
  }
  function icon(state, size){
    var v = s("svg", {viewBox:"0 0 16 16", width:size || 16, height:size || 16, "class":"ic", "aria-hidden":"true"});
    if (state === "pass") { s("circle", {cx:8, cy:8, r:7, fill:"var(--pass)"}, v); s("path", {d:"M4.5 8.2l2.3 2.3 4.7-4.9", fill:"none", stroke:"#fff", "stroke-width":"1.8", "stroke-linecap":"round", "stroke-linejoin":"round"}, v); }
    else if (state === "fail") { s("circle", {cx:8, cy:8, r:7, fill:"var(--fail)"}, v); s("path", {d:"M5.5 5.5l5 5M10.5 5.5l-5 5", stroke:"#fff", "stroke-width":"1.8", "stroke-linecap":"round"}, v); }
    else if (state === "running") { s("circle", {cx:8, cy:8, r:6, fill:"none", stroke:"var(--run)", "stroke-width":"2", opacity:".25"}, v);
      s("path", {d:"M8 2a6 6 0 0 1 6 6", fill:"none", stroke:"var(--run)", "stroke-width":"2", "stroke-linecap":"round", "class":"spin"}, v); }
    else s("circle", {cx:8, cy:8, r:6.25, fill:"none", stroke:"var(--faint)", "stroke-width":"1.5"}, v);
    return v;
  }
  function selected(list){
    if (pinned) { var p = list.filter(function(r){ return r.req === pinned; })[0]; if (p) return p;
      var m = matrix.filter(function(x){ return x.requirement === pinned; })[0];
      if (m) return {req:m.requirement, title:m.title, group:m.group, state:"queued", attempt:0, steps:[], started:now(), updated:now(), elapsed:0, agent:null, usage:null, prompt:null}; }
    return list.filter(function(r){ return r.state === "running"; })[0] || list[0] || null;
  }
  function ordered(reqs){ return reqs.slice().sort(function(a, b){ return a.started - b.started; }); }
  function groups(list){
    var out = [], at = {};
    list.forEach(function(r){ var g = r.group || ""; if (!(g in at)) { at[g] = out.length; out.push({name:g, reqs:[]}); } out[at[g]].reqs.push(r); });
    out.forEach(function(g){ g.pass = g.reqs.filter(function(r){ return r.state === "pass"; }).length;
      g.fail = g.reqs.filter(function(r){ return r.state === "fail"; }).length; g.done = g.pass === g.reqs.length;
      g.time = g.reqs.reduce(function(a, r){ return a + elapsed(r); }, 0); });
    return out;
  }
  function pick(id){ pinned = pinned === id ? null : id; stepsKey = ""; draw(); }

  function kt(n){ n = Number(n) || 0; return n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "k" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(n); }
  function usd(n){ return n === null || n === undefined ? "—" : "$" + Number(n).toFixed(2); }
  function shortModel(m){ return String(m || "").replace(/^claude-/, ""); }
  /** How full the context is, as a bar: green, amber past 60%, red past 85%. */
  function ctxBar(u){
    var w = el("div", "ctx"), pct = u && u.window ? Math.min(100, u.context / u.window * 100) : 0;
    var bar = el("div", "bar"), i = el("i"); i.style.width = pct + "%";
    i.style.background = pct > 85 ? "var(--fail)" : pct > 60 ? "var(--run)" : "var(--pass)"; bar.appendChild(i);
    w.append(bar, el("span", "d", u && u.window ? kt(u.context) + " of " + kt(u.window) + " · " + Math.round(pct) + "%" : "—"));
    return w;
  }
  function jobBtn(r, sel, note, state){
    var b = el("button", "job" + (sel && sel.req === r.req ? " sel" : "")); b.type = "button";
    b.setAttribute("aria-current", sel && sel.req === r.req ? "true" : "false");
    var txt = el("span", "name"); txt.append(el("span", "", r.req + " " + (r.title || "")));
    if (note) txt.appendChild(el("small", "", note));
    b.append(icon(state || r.state), txt);
    b.addEventListener("click", function(){ pick(r.req); });
    return b;
  }
  function block(title, count){
    var d = el("section", "qsec"), h = el("h2"); h.append(el("span", "", title));
    if (count !== undefined) h.appendChild(el("span", "count", String(count)));
    d.appendChild(h); return d;
  }

  /**
   * The sidebar is the run's work queue (REQ-182), not a second map of it: what
   * runs now and with which model and context, what needs a person, what comes
   * next, and what finished last. The map is the matrix in the centre.
   */
  function sidebar(list, sel){
    var box = $("jobs"), keepScroll = box.parentNode.scrollTop; box.replaceChildren();
    var sum = el("button", "job summary-btn" + (pinned ? "" : " sel"), "Summary"); sum.type = "button";
    sum.addEventListener("click", function(){ pinned = null; stepsKey = ""; draw(); }); box.appendChild(sum);
    var since = model.queueStarted || 0, byReq = {}, titles = {};
    list.forEach(function(r){ byReq[r.req] = r; });
    matrix.forEach(function(m){ titles[m.requirement] = m.title; });

    var cur = list.filter(function(r){ return r.state === "running"; })[0];
    var now0 = block("Now");
    if (cur) {
      var card = el("div", "now"); card.appendChild(jobBtn(cur, sel, "attempt " + cur.attempt + " · " + cur.phase + " · " + dur(elapsed(cur))));
      var kv = el("dl", "kv");
      var add = function(k, v){ var dd = el("dd"); if (typeof v === "string") dd.textContent = v; else dd.appendChild(v); kv.append(el("dt", "", k), dd); };
      add("Model", cur.agent ? shortModel(cur.agent.model) : "not reported");
      add("Context", ctxBar(cur.usage));
      add("Output", cur.usage ? kt(cur.usage.output) + " tokens" : "—");
      if (cur.prompt) add("Prompt", "~" + kt(cur.prompt.tokens) + " tokens · " + cur.prompt.lines + " lines");
      card.appendChild(kv); now0.appendChild(card);
    } else now0.appendChild(el("p", "muted", "Nothing running."));
    box.appendChild(now0);

    var need = list.filter(function(r){ return r.state === "fail"; }).map(function(r){
      var g = r.steps.filter(function(e){ return e.type === "gate" && e.result !== "pass"; })[0];
      return {r:r, note:"failed · attempt " + r.attempt + (g ? " · " + clip(String(g.stage).split(":")[0], 40) : ""), st:"fail"}; });
    var seenB = {};
    matrix.forEach(function(m){ if (m.status === "Needs Clarification" && !byReq[m.requirement] && !seenB[m.requirement]) { seenB[m.requirement] = 1;
      need.push({r:{req:m.requirement, title:m.title, state:"idle"}, note:"blocked · needs clarification", st:"idle"}); } });
    var n1 = block("Needs attention", need.length);
    need.forEach(function(x){ n1.appendChild(jobBtn(x.r, sel, x.note, x.st)); });
    if (!need.length) n1.appendChild(el("p", "muted", "Nothing failed or blocked."));
    box.appendChild(n1);

    var done = list.filter(function(r){ return r.state === "pass" && r.started >= since; });
    var next = (model.queue || []).filter(function(id){ var r = byReq[id]; return !(r && r.started >= since); });
    var times = done.map(function(r){ return r.elapsed; }).sort(function(a, b){ return a - b; });
    var median = times.length ? times[Math.floor(times.length / 2)] : 0;
    var n2 = block("Up next", next.length);
    if (next.length && median) n2.appendChild(el("p", "muted", "about " + dur(next.length * median) + " at " + dur(median) + " each"));
    next.slice(0, 6).forEach(function(id){ n2.appendChild(jobBtn({req:id, title:titles[id] || "", state:"idle"}, sel, "", "idle")); });
    if (next.length > 6) n2.appendChild(el("p", "muted", "+ " + (next.length - 6) + " more"));
    if (!next.length) n2.appendChild(el("p", "muted", (model.queue || []).length ? "The queue is done." : "No queue recorded for this run."));
    box.appendChild(n2);

    var recent = list.filter(function(r){ return r.state === "pass"; }).sort(function(a, b){ return b.updated - a.updated; }).slice(0, 5);
    var n3 = block("Finished recently");
    recent.forEach(function(r){ n3.appendChild(jobBtn(r, sel, dur(r.elapsed) + (r.usage && r.usage.cost !== null ? " · " + usd(r.usage.cost) : ""), "pass")); });
    if (!recent.length) n3.appendChild(el("p", "muted", "None yet."));
    box.appendChild(n3);
    box.parentNode.scrollTop = keepScroll;
  }

  function summary(list){
    var p = 0, f = 0, run = 0, first = 0, last = 0;
    list.forEach(function(r){ if (r.state === "pass") p++; else if (r.state === "fail") f++; else run++;
      if (!first || r.started < first) first = r.started; last = Math.max(last, r.state === "running" ? now() : r.updated); });
    var state = run ? "running" : f ? "fail" : list.length ? "pass" : "running";
    $("runBadge").className = "badge " + state;
    $("runState").textContent = run ? "In progress" : f ? "Failed" : list.length ? "Completed" : "Waiting";
    var cur = list.filter(function(r){ return r.state === "running"; })[0];
    $("runTitle").textContent = cur ? cap(cur.group) + " · " + cur.req + " " + (cur.title || "") : groups(list).map(function(g){ return cap(g.name); }).join(", ") || "Harness run";
    var box = $("progress"); box.replaceChildren();
    [["Started", first ? stamp(first) : "—"], ["Duration", first ? dur(last - first) : "—"],
     ["Requirements", p + " passed · " + run + " running · " + f + " failed"],
     ["Agent time", dur(list.reduce(function(a, r){ return a + elapsed(r); }, 0))]].concat(model.totals && (model.totals.input || model.totals.output) ? [
     ["Tokens", kt(model.totals.input + model.totals.cacheRead + model.totals.cacheWrite) + " in · " + kt(model.totals.output) + " out"],
     ["Cost", usd(model.totals.cost)]] : []).forEach(function(x){
      var d = el("div"); d.append(el("span", "", x[0]), el("b", "", x[1])); box.appendChild(d);
    });
    var bar = el("div", "bar"); bar.style.flexBasis = "100%"; var total = Math.max(1, list.length);
    [["var(--pass)", p], ["var(--run)", run], ["var(--fail)", f]].forEach(function(x){ var i = el("i"); i.style.width = (x[1] / total * 100) + "%"; i.style.background = x[0]; bar.appendChild(i); });
    box.appendChild(bar);
  }

  /**
   * The run as a matrix of modules (REQ-181): one row per module, a segment
   * per requirement in id order, coloured by what happened to it in this run,
   * or by its status when the run has not reached it; the passed count and
   * the agent time. A segment opens its requirement below.
   */
  function modules(list, sel){
    var box = $("chain"); box.replaceChildren();
    var byReq = {}; list.forEach(function(r){ byReq[r.req] = r; });
    var reqs = [], seen = {};
    matrix.forEach(function(m){ if (seen[m.requirement] || m.requirement === "REQ-001") return; seen[m.requirement] = 1;
      reqs.push({req:m.requirement, title:m.title, group:m.group, status:m.status}); });
    list.forEach(function(r){ if (!seen[r.req]) { seen[r.req] = 1; reqs.push({req:r.req, title:r.title, group:r.group, status:"Draft"}); } });
    if (!reqs.length) { box.appendChild(el("div", "empty", "No harness events yet. Run specgate harness run: each requirement appears here as it starts.")); return; }
    var order = [], rowsBy = {};
    reqs.sort(function(x, y){ return x.req.localeCompare(y.req); }).forEach(function(q){
      var g = q.group || "spec"; if (!rowsBy[g]) { rowsBy[g] = []; order.push(g); } rowsBy[g].push(q); });
    var rank = function(g){ var rs = rowsBy[g], ev = rs.map(function(q){ return byReq[q.req]; }).filter(Boolean);
      return ev.length ? Math.min.apply(null, ev.map(function(r){ return r.started; })) : Infinity; };
    order.sort(function(x, y){ return rank(x) - rank(y); });
    var head = el("div", "mm-row mm-head");
    ["", "Module", "Requirements", "Passed", "Time"].forEach(function(h, i){ var c = el("span", i >= 3 ? "num" : "", h); head.appendChild(c); });
    box.appendChild(head);
    order.forEach(function(g){
      var rs = rowsBy[g], pass = 0, fail = 0, run = 0, time = 0;
      var row = el("div", "mm-row"), bar = el("span", "mm-bar");
      rs.forEach(function(q){
        var ev = byReq[q.req], st = ev ? ev.state : (q.status === "Implemented" || q.status === "Verified" || q.status === "Released") ? "pass"
          : q.status === "Needs Clarification" ? "blocked" : "queued";
        if (st === "pass") pass++; else if (st === "fail") fail++; else if (st === "running") run++;
        if (ev) time += elapsed(ev);
        var seg = el("button", "seg " + st + (sel && sel.req === q.req ? " on" : "")); seg.type = "button";
        seg.title = q.req + " — " + (q.title || "") + " · " + (ev ? st + " · " + dur(elapsed(ev)) : st);
        seg.setAttribute("aria-label", seg.title);
        seg.addEventListener("click", function(){ pick(q.req); });
        bar.appendChild(seg);
      });
      var state = fail ? "fail" : run ? "running" : pass === rs.length ? "pass" : "idle";
      if (fail) row.classList.add("has-fail"); else if (run) row.classList.add("has-run"); else if (state === "idle" && !pass) row.classList.add("queued");
      row.append(icon(state), el("b", "", cap(g === "spec" ? "" : g)), bar, el("span", "num", pass + "/" + rs.length), el("span", "num muted", time ? dur(time) : pass === rs.length ? "earlier" : "queued"));
      box.appendChild(row);
    });
    var legend = el("div", "mm-legend");
    [["pass", "passed"], ["running", "running"], ["fail", "failed"], ["blocked", "blocked"], ["queued", "queued"]].forEach(function(x){
      var s0 = el("span"), sw = el("i", "seg " + x[0]); s0.append(sw, document.createTextNode(x[1])); legend.appendChild(s0); });
    box.appendChild(legend);
  }

  function steps(r){
    var ol = $("pipeline");
    if (!r) { ol.replaceChildren(el("li", "empty", "Each requirement opens here as the harness works on it.")); return; }
    var events = r.steps.slice().reverse(), firstGate = events.filter(function(e){ return e.type === "gate"; })[0];
    var rows = [], seen = {Specification:false, Architecture:false, Tests:false, Merge:false};
    var agentEnd = firstGate ? Number(firstGate.t) : (r.state === "running" ? now() : r.updated);
    rows.push({name:"Agent", state: firstGate ? "pass" : r.state === "running" ? "running" : r.state, d: dur(agentEnd - r.started), log: !firstGate});
    var prevT = agentEnd;
    events.forEach(function(e){
      if (e.type !== "gate" && e.type !== "merge") return;
      var stage = e.type === "merge" ? "merge into " + (e.into || "HEAD") : String(e.stage || "");
      var kind = e.type === "merge" || stage.indexOf("post-merge") === 0 ? "Merge" : stage.indexOf("validate") >= 0 ? "Specification" : stage.indexOf("architecture") >= 0 ? "Architecture" : "Tests";
      seen[kind] = true;
      rows.push({name:stage, mono:true, state: e.type === "merge" || e.result === "pass" ? "pass" : "fail", d: dur(Number(e.t) - prevT)});
      prevT = Number(e.t);
    });
    var lastGate = events.filter(function(e){ return e.type === "gate"; }).slice(-1)[0];
    if (r.state === "running" && firstGate && !(lastGate && lastGate.result !== "pass")) {
      var next = ["Specification","Architecture","Tests","Merge"].filter(function(k){ return !seen[k]; })[0];
      if (next) { rows.push({name:next, state:"running", d: dur(now() - prevT), log:true}); seen[next] = true; }
    }
    ["Specification","Architecture","Tests","Merge"].forEach(function(k){ if (!seen[k] && r.state === "running") rows.push({name:k, state:"idle", d:""}); });
    ol.replaceChildren();
    rows.forEach(function(x){
      var li = el("li", x.state === "running" ? "running" : x.state === "idle" ? "idle" : "");
      li.append(icon(x.state), el("span", "t" + (x.mono ? " mono" : ""), x.name), el("span", "d", x.d));
      ol.appendChild(li);
      if (x.log) { var lr = el("li", "logrow"); lr.appendChild(log(r)); ol.appendChild(lr); }
    });
    if (!rows.some(function(x){ return x.log; }) && r.steps.length) { var lr2 = el("li", "logrow"); lr2.appendChild(log(r)); ol.appendChild(lr2); }
  }
  function log(r){
    var ul = el("ol", "feed"); ul.id = "feed";
    r.steps.slice(0, 40).slice().reverse().forEach(function(e){
      var li = el("li"), t = Number(e.ended || e.t) || 0, kind = e.type === "step" ? String(e.kind || "") : String(e.type || "");
      var what = e.type === "message" ? e.text : e.type === "gate" ? (e.result === "pass" ? "passed  " : "failed  ") + e.stage
        : e.type === "merge" ? "merged into " + (e.into || "HEAD") : (e.target || e.tool || "");
      if (e.added !== undefined || e.removed !== undefined) what += "  +" + (Number(e.added) || 0) + " −" + (Number(e.removed) || 0);
      li.append(el("span", "ts", stamp(t)), el("span", "k", e.type === "message" ? "agent" : kind),
        el("span", "x" + (e.type === "message" ? " say" : e.type === "gate" ? (e.result === "pass" ? " ok" : " bad") : ""), clip(what, 400)));
      ul.appendChild(li);
    });
    if (!ul.childNodes.length) ul.appendChild(el("li", "", "The agent's steps appear here as it works."));
    requestAnimationFrame(function(){ ul.scrollTop = ul.scrollHeight; });
    return ul;
  }

  /** The requirement's details, fetched once per change of its events. */
  function detail(r, then){
    var key = r.req + ":" + r.steps.length + ":" + r.state;
    if (details[r.req] && details[r.req].key === key) return then(details[r.req].d);
    fetch("live/req/" + encodeURIComponent(r.req) + ".json").then(function(x){ return x.json(); })
      .then(function(d){ details[r.req] = {key:key, d:d}; then(d); }).catch(function(){});
  }
  function sect(title){ var d = el("div", "sect"); d.appendChild(el("h3", "", title)); return d; }
  function paneReq(d){
    var p = document.querySelector('[data-pane="req"]'); p.replaceChildren();
    var a = sect("Requirement");
    a.appendChild(el("div", "stmt", d.statement || "No requirement text found in the specification."));
    var m = el("div", "meta"); m.style.marginTop = "8px";
    m.append(el("span", "", "Status: " + d.status), el("span", "", "Module: " + (d.group || "—")));
    if (d.source) { var sp = el("span", "", "Spec: "); sp.appendChild(fileLink(d.source.file, d.source.line)); m.appendChild(sp); }
    a.appendChild(m); p.appendChild(a);
    var b = sect("Scenarios · " + d.scenarios.length);
    d.scenarios.forEach(function(sc){
      var box = el("div", "scn"), h = el("div"); h.append(el("b", "", sc.id), document.createTextNode(" — " + sc.title)); box.appendChild(h);
      var ol = el("ol"); sc.steps.forEach(function(st){ var li = el("li"), sp2 = st.indexOf(" "), kw = sp2 > 0 ? st.slice(0, sp2) : st;
        li.append(el("span", "kw", kw), document.createTextNode(sp2 > 0 ? st.slice(sp2) : "")); ol.appendChild(li); });
      box.appendChild(ol); b.appendChild(box);
    });
    if (!d.scenarios.length) b.appendChild(el("div", "meta", "No scenario."));
    p.appendChild(b);
    if (d.assumptions.length) {
      var c = sect("Assumptions · " + d.assumptions.length), t = el("table"), hr = el("tr");
      ["#", "Assumption", "Status"].forEach(function(x){ hr.appendChild(el("th", "", x)); }); t.appendChild(hr);
      d.assumptions.forEach(function(x){ var tr = el("tr"); tr.append(el("td", "mono", x.id), el("td", "", x.text), el("td", "", x.status)); t.appendChild(tr); });
      c.appendChild(t); p.appendChild(c);
    }
  }
  function paneFiles(d){
    var p = document.querySelector('[data-pane="files"]'); p.replaceChildren();
    var a = sect("Tests that name it · " + d.tests.length), ul = el("ul", "list");
    d.tests.forEach(function(f){ var li = el("li"); li.appendChild(fileLink(f)); ul.appendChild(li); });
    if (!d.tests.length) ul.appendChild(el("li", "", "No test names it yet."));
    a.appendChild(ul); p.appendChild(a);
    var b = sect("Feature"), ul2 = el("ul", "list");
    d.features.forEach(function(f){ var li = el("li"); li.appendChild(fileLink(f)); ul2.appendChild(li); });
    if (!d.features.length) ul2.appendChild(el("li", "", "Written when its change is archived."));
    b.appendChild(ul2); p.appendChild(b);
    var c = sect("Files the agent changed (last attempt) · " + d.files.length), ul3 = el("ul", "list");
    d.files.forEach(function(f){ var li = el("li"); li.append(fileLink(f.path), el("span", "add", "+" + f.added), el("span", "rem", "−" + f.removed)); ul3.appendChild(li); });
    if (!d.files.length) ul3.appendChild(el("li", "", "No file changed yet."));
    c.appendChild(ul3); p.appendChild(c);
  }
  function paneAttempts(d){
    var p = document.querySelector('[data-pane="attempts"]'); p.replaceChildren();
    var a = sect("Attempts · " + d.attempts.length + " · branch harness/" + d.id);
    var t = el("table"), hr = el("tr"); ["#", "Result", "Started", "Duration", "Failed at", "Gate"].forEach(function(x){ hr.appendChild(el("th", "", x)); }); t.appendChild(hr);
    d.attempts.forEach(function(x){
      var tr = el("tr"), res = el("td"), st = el("span", "st");
      st.append(icon(x.result), document.createTextNode(x.result)); res.appendChild(st);
      tr.append(el("td", "mono", String(x.attempt)), res, el("td", "mono", stamp(x.started)), el("td", "", dur(x.duration)),
        el("td", "", x.failedAt || "—"), el("td", "tests", x.gates.map(function(g){ return (g.result === "pass" ? "✓ " : "✗ ") + g.stage; }).join("  ·  ")));
      t.appendChild(tr);
    });
    if (!d.attempts.length) { var tr0 = el("tr"), td0 = el("td", "", "No attempt recorded."); td0.colSpan = 6; tr0.appendChild(td0); t.appendChild(tr0); }
    a.appendChild(t); p.appendChild(a);
  }
  /** The agent's session for the selected attempt: model, context, tokens, cost and the prompt it was given (REQ-182). */
  function paneAgent(r){
    var p = document.querySelector('[data-pane="agent"]'); p.replaceChildren();
    if (!r.agent && !r.usage && !r.prompt) {
      p.appendChild(el("div", "empty", "No session reported for this attempt. Agents piped through specgate harness events --from claude report their model, tokens and prompt."));
      return;
    }
    var a = sect("Session"), m = el("div", "meta");
    m.append(el("span", "", "Model: " + (r.agent ? r.agent.model || "—" : "—")));
    if (r.agent && r.agent.version) m.appendChild(el("span", "", "Claude Code " + r.agent.version));
    if (r.agent && r.agent.permission) m.appendChild(el("span", "", "Permissions: " + r.agent.permission));
    if (r.agent && r.agent.tools) m.appendChild(el("span", "", r.agent.tools + " tools"));
    if (r.usage && r.usage.turns !== null) m.appendChild(el("span", "", r.usage.turns + " turns"));
    a.appendChild(m); p.appendChild(a);
    if (r.usage) {
      var c = sect("Context window"); c.appendChild(ctxBar(r.usage));
      c.appendChild(el("div", "meta", "Peak " + kt(r.usage.peak) + (r.usage.window ? " · " + Math.round(r.usage.peak / r.usage.window * 100) + "% of the window" : "")));
      p.appendChild(c);
      var t = sect("Tokens"), tb = el("table"), hr = el("tr");
      ["Input", "Cache read", "Cache write", "Output", "Cost"].forEach(function(x){ hr.appendChild(el("th", "", x)); }); tb.appendChild(hr);
      var tr = el("tr"), fin = r.usage.input || r.usage.cacheRead || r.usage.cacheWrite;
      [fin ? kt(r.usage.input) : "—", fin ? kt(r.usage.cacheRead) : "—", fin ? kt(r.usage.cacheWrite) : "—", kt(r.usage.output), usd(r.usage.cost)].forEach(function(x){ tr.appendChild(el("td", "mono", x)); });
      tb.appendChild(tr); t.appendChild(tb);
      if (!fin) t.appendChild(el("div", "meta", "Totals and cost arrive when the session ends."));
      p.appendChild(t);
    }
    if (r.prompt) {
      var q = sect("Prompt"), qm = el("div", "meta");
      qm.append(el("span", "", "For: " + r.prompt.role), el("span", "", r.prompt.lines + " lines"), el("span", "", kt(r.prompt.chars) + " characters"), el("span", "", "~" + kt(r.prompt.tokens) + " tokens (estimated)"));
      var url = "live/req/" + encodeURIComponent(r.req) + "/prompt/" + r.attempt + ".txt", open1 = el("a", "", "Open in a new tab"); open1.href = url; open1.target = "_blank"; open1.rel = "noopener";
      qm.appendChild(open1); q.appendChild(qm);
      var dt = el("details", "prompt"), ds = el("summary", "", "Show the prompt"), pre = el("pre");
      dt.append(ds, pre);
      dt.addEventListener("toggle", function(){ if (dt.open && !pre.textContent) fetch(url).then(function(x){ return x.text(); }).then(function(x){ pre.textContent = x; }).catch(function(){ pre.textContent = "Not kept."; }); });
      q.appendChild(dt); p.appendChild(q);
    }
  }
  function focus(sel){
    $("fName").textContent = sel ? sel.req + " · " + (sel.title || "") : "—";
    $("fMeta").textContent = sel ? "attempt " + sel.attempt + (sel.group ? " · " + sel.group : "") + " · harness/" + sel.req + (sel.agent ? " · " + shortModel(sel.agent.model) : "") : "";
    Array.prototype.forEach.call(document.querySelectorAll(".tabs button"), function(b){ b.setAttribute("aria-selected", String(b.dataset.tab === tab)); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-pane]"), function(p){ p.hidden = p.dataset.pane !== tab; });
    if (!sel) return steps(null);
    var key = sel.req + ":" + sel.attempt + ":" + sel.steps.length + ":" + sel.state + ":" + tab + ":" + (sel.usage ? sel.usage.context + "/" + sel.usage.output : "");
    if (key === stepsKey) return;
    stepsKey = key;
    if (tab === "steps") steps(sel);
    else if (tab === "agent") paneAgent(sel);
    else detail(sel, function(d){ if (tab === "req") paneReq(d); else if (tab === "files") paneFiles(d); else paneAttempts(d); });
  }

  /** The traceability matrix, one accordion per module, filtered as the viewer types. */
  function drawMatrix(){
    var q = String($("mFilter").value || "").toLowerCase(), box = $("matrix"); box.replaceChildren();
    var rows = matrix.filter(function(r){ return !q || [r.requirement, r.scenario, r.title, r.status, r.group, r.feature].concat(r.tests).join(" ").toLowerCase().indexOf(q) >= 0; });
    var reqs = {}, impl = {}; matrix.forEach(function(r){ reqs[r.requirement] = 1; if (r.status === "Implemented" || r.status === "Verified" || r.status === "Released") impl[r.requirement] = 1; });
    var tested = matrix.filter(function(r){ return r.tests.length; }).length;
    $("mSum").textContent = Object.keys(impl).length + " of " + Object.keys(reqs).length + " requirements delivered · " + tested + " of " + matrix.length + " scenario rows have a test";
    var running = {}; (model.requirements || []).forEach(function(r){ if (r.state === "running") running[r.req] = 1; });
    var byGroup = {}, order = [];
    rows.forEach(function(r){ var g = r.group || "spec.md"; if (!byGroup[g]) { byGroup[g] = []; order.push(g); } byGroup[g].push(r); });
    order.forEach(function(g){
      var list = byGroup[g], d = el("details", "box mgroup"), mk = "m:" + g; d.open = mk in open ? open[mk] : true;
      var done = {}; list.forEach(function(r){ if (r.status === "Implemented" || r.status === "Verified" || r.status === "Released") done[r.requirement] = 1; });
      var all = {}; list.forEach(function(r){ all[r.requirement] = 1; });
      var sm = el("summary"); sm.append(el("span", "", cap(g)), el("span", "count", Object.keys(done).length + " / " + Object.keys(all).length + " delivered")); d.appendChild(sm);
      d.addEventListener("toggle", function(){ open[mk] = d.open; save("sg-live-open", open); });
      var wrap = el("div"); wrap.style.overflowX = "auto";
      var t = el("table"), hr = el("tr"); ["Requirement", "Title", "Scenario", "Feature", "Tests", "Status"].forEach(function(x){ hr.appendChild(el("th", "", x)); }); t.appendChild(hr);
      list.forEach(function(r){
        var tr = el("tr"), reqTd = el("td", "mono"), a = el("a", "", r.requirement); a.href = "#"; a.addEventListener("click", function(ev){ ev.preventDefault(); setView("run"); pinned = r.requirement; tab = "req"; stepsKey = ""; draw(); });
        reqTd.appendChild(a);
        var feat = el("td", "tests"); if (r.feature) feat.appendChild(fileLink(r.feature)); else feat.textContent = "—";
        var tests = el("td", "tests"); if (r.tests.length) r.tests.forEach(function(f, i){ if (i) tests.appendChild(document.createElement("br")); tests.appendChild(fileLink(f)); }); else tests.textContent = "—";
        var stTd = el("td"), state = running[r.requirement] ? "running" : r.status, sp = el("span", "st " + state.split(" ").join(""));
        sp.append(icon(running[r.requirement] ? "running" : (r.status === "Implemented" || r.status === "Verified" || r.status === "Released") ? "pass" : "idle", 14),
          document.createTextNode(running[r.requirement] ? "in progress" : r.status + (r.source === "change" ? " · in change" : "")));
        stTd.appendChild(sp);
        tr.append(reqTd, el("td", "", r.title), el("td", "mono", r.scenario), feat, tests, stTd); t.appendChild(tr);
      });
      wrap.appendChild(t); d.appendChild(wrap); box.appendChild(d);
    });
    if (!order.length) box.appendChild(el("div", "empty box", matrix.length ? "No row matches the filter." : "Reading the matrix…"));
  }
  function refreshMatrix(){
    if (!matrixDirty) return;
    matrixDirty = false;
    fetch("live/matrix.json").then(function(x){ return x.json(); }).then(function(m){ matrix = m.rows || []; if (view === "matrix") drawMatrix(); else draw(); }).catch(function(){ matrixDirty = true; });
  }
  function setView(v){
    view = v; $("vRun").setAttribute("aria-pressed", String(v === "run")); $("vMatrix").setAttribute("aria-pressed", String(v === "matrix"));
    $("runView").hidden = v !== "run"; $("matrixView").hidden = v !== "matrix"; if (v === "matrix") refreshMatrix(); else { stepsKey = ""; draw(); }
  }

  function draw(){
    var list = ordered(model.requirements || []), sel = selected(list);
    sidebar(list, sel);
    if (view === "run") { summary(list); modules(list, sel); focus(sel); }
  }
  function tick(){
    var list = ordered(model.requirements || []), sel = selected(list);
    if (view === "run") { summary(list); if (sel && sel.state === "running" && tab === "steps") { stepsKey = ""; focus(sel); } }
  }
  function accept(m){ model = m && m.requirements ? m : {requirements:[]}; if (m && m.projectDir) projectDir = m.projectDir; matrixDirty = true; draw(); refreshMatrix(); }

  Array.prototype.forEach.call(document.querySelectorAll(".tabs button"), function(b){
    b.addEventListener("click", function(){ tab = b.dataset.tab; stepsKey = ""; draw(); });
  });
  $("vRun").addEventListener("click", function(){ setView("run"); });
  $("vMatrix").addEventListener("click", function(){ setView("matrix"); });
  $("mFilter").addEventListener("input", drawMatrix);
  fetch("live.json").then(function(x){ return x.json(); }).then(accept).catch(function(){});
  var es = new EventSource("live/stream");
  es.addEventListener("live", function(e){ try { accept(JSON.parse(e.data)); } catch (err) {} });
  es.onopen = function(){ $("conn").classList.add("on"); $("connText").textContent = "Live"; };
  es.onerror = function(){ $("conn").classList.remove("on"); $("connText").textContent = "Reconnecting"; };
  setInterval(tick, 1000);
  var t; window.addEventListener("resize", function(){ clearTimeout(t); t = setTimeout(function(){ stepsKey = ""; draw(); }, 120); });
})();
</script>
</body></html>`;
}
