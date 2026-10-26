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
  .job .name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .job .d{font-size:12px;color:var(--muted);font-weight:400;font-variant-numeric:tabular-nums}
  .summary-btn{padding-left:10px;margin-bottom:6px;font-weight:600}
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
  .graph{padding:8px 4px} #chain{display:block;width:100%}
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
  <aside aria-label="Requirements by module"><div id="jobs"></div></aside>
  <main>
    <section id="runView">
      <div class="stick">
        <div class="head"><span id="runBadge" class="badge running"><i></i><span id="runState">Waiting</span></span><h1 id="runTitle">Harness run</h1></div>
        <div id="progress" class="box" role="status"></div>
      </div>
      <div class="gap">
        <div class="box graph"><svg id="chain" role="img" aria-label="The requirements of the run as a graph of jobs, finished modules folded"></svg></div>
        <section id="focus" class="box" aria-live="polite">
          <div class="fh"><b id="fName">—</b><span id="fMeta"></span></div>
          <div class="tabs" role="tablist" aria-label="About this requirement">
            <button type="button" role="tab" data-tab="steps" aria-selected="true">Steps</button>
            <button type="button" role="tab" data-tab="req" aria-selected="false">Requirement</button>
            <button type="button" role="tab" data-tab="files" aria-selected="false">Tests and files</button>
            <button type="button" role="tab" data-tab="attempts" aria-selected="false">Attempts</button>
          </div>
          <div class="pane" data-pane="steps"><ol id="pipeline" aria-label="Steps: Agent, Specification, Architecture, Tests, Merge"></ol></div>
          <div class="pane" data-pane="req" hidden></div>
          <div class="pane" data-pane="files" hidden></div>
          <div class="pane" data-pane="attempts" hidden></div>
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
    if (pinned) { var p = list.filter(function(r){ return r.req === pinned; })[0]; if (p) return p; }
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

  /** The sidebar: one accordion per module, opened and closed by the viewer and remembered. */
  function sidebar(list, sel){
    var box = $("jobs"), keepScroll = box.parentNode.scrollTop; box.replaceChildren();
    var sum = el("button", "job summary-btn" + (pinned ? "" : " sel"), "Summary"); sum.type = "button";
    sum.addEventListener("click", function(){ pinned = null; stepsKey = ""; draw(); }); box.appendChild(sum);
    groups(list).forEach(function(g){
      var key = g.name || "-", d = el("details"), has = sel && g.reqs.some(function(r){ return r.req === sel.req; });
      d.open = key in open ? open[key] : (!g.done || has);
      var sm = el("summary"), chev = s("svg", {viewBox:"0 0 16 16", "class":"chev", "aria-hidden":"true"});
      s("path", {d:"M6 4l4 4-4 4", fill:"none", stroke:"currentColor", "stroke-width":"1.8", "stroke-linecap":"round", "stroke-linejoin":"round"}, chev);
      sm.append(chev, icon(g.fail ? "fail" : g.done ? "pass" : "running", 14), el("span", "", cap(g.name)), el("span", "count", g.pass + "/" + g.reqs.length));
      d.appendChild(sm);
      d.addEventListener("toggle", function(){ open[key] = d.open; save("sg-live-open", open); });
      g.reqs.forEach(function(r){
        var b = el("button", "job" + (sel && sel.req === r.req ? " sel" : "")); b.type = "button";
        b.setAttribute("aria-current", sel && sel.req === r.req ? "true" : "false");
        b.append(icon(r.state), el("span", "name", r.req + " " + (r.title || "")), el("span", "d", dur(elapsed(r))));
        b.addEventListener("click", function(){ pick(r.req); });
        d.appendChild(b);
      });
      box.appendChild(d);
    });
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
     ["Agent time", dur(list.reduce(function(a, r){ return a + elapsed(r); }, 0))]].forEach(function(x){
      var d = el("div"); d.append(el("span", "", x[0]), el("b", "", x[1])); box.appendChild(d);
    });
    var bar = el("div", "bar"); bar.style.flexBasis = "100%"; var total = Math.max(1, list.length);
    [["var(--pass)", p], ["var(--run)", run], ["var(--fail)", f]].forEach(function(x){ var i = el("i"); i.style.width = (x[1] / total * 100) + "%"; i.style.background = x[0]; bar.appendChild(i); });
    box.appendChild(bar);
  }

  /** The graph of jobs: finished modules fold into one box, the rest one box per requirement, joined in the order they ran. */
  function graph(list, sel){
    var svg = $("chain"), W = Math.max(svg.clientWidth || 900, 360), bw = 168, bh = 40, gx = 24, gy = 34, padX = 18, padY = 30;
    var perRow = Math.max(1, Math.floor((W - padX * 2 + gx) / (bw + gx)));
    var nodes = [];
    groups(list).forEach(function(g){
      var has = sel && g.reqs.some(function(r){ return r.req === sel.req; });
      if (g.done && !has && !expanded[g.name]) nodes.push({fold:true, group:g});
      else g.reqs.forEach(function(r){ nodes.push({req:r, group:g}); });
    });
    var rows = [], row = null, lastGroup = null;
    nodes.forEach(function(n){
      var w = n.fold ? 2 : 1;
      if (!row || row.used + w > perRow || n.group.name !== lastGroup) { row = {label: n.group.name !== lastGroup ? n.group : null, items:[], used:0}; rows.push(row); }
      row.items.push(n); row.used += w; lastGroup = n.group.name;
    });
    var H = Math.max(80, padY + rows.length * (bh + gy) + 8);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("height", String(H)); svg.replaceChildren();
    if (!list.length) { var t0 = s("text", {x:W / 2, y:H / 2, "text-anchor":"middle", fill:"var(--muted)", "font-size":"13"}, svg); t0.textContent = "No harness events yet. Run specgate harness run: each requirement appears here as it starts."; return; }
    var placed = [];
    rows.forEach(function(rw, ri){
      var y = padY + ri * (bh + gy), x = padX;
      if (rw.label) { var l = s("text", {x:padX, y:y - 10, "font-size":"12", "font-weight":"600", fill:"var(--muted)"}, svg); l.textContent = cap(rw.label.name) + " · " + rw.label.pass + "/" + rw.label.reqs.length; }
      rw.items.forEach(function(n){ var w = n.fold ? bw * 2 + gx : bw; placed.push({n:n, x:x, y:y, w:w}); x += w + gx; });
    });
    for (var i = 1; i < placed.length; i++) {
      var a = placed[i - 1], b = placed[i], st = b.n.fold ? "pass" : b.n.req.state;
      var c = st === "running" ? "var(--run)" : st === "fail" ? "var(--fail)" : "var(--faint)";
      if (a.y === b.y) s("line", {x1:a.x + a.w, y1:a.y + bh / 2, x2:b.x, y2:b.y + bh / 2, stroke:c, "stroke-width":"1.5"}, svg);
      else s("path", {d:"M" + (a.x + a.w) + " " + (a.y + bh / 2) + " h" + (gx / 2) + " V" + (a.y + bh + gy / 2) + " H" + (b.x - gx / 2) + " V" + (b.y + bh / 2) + " H" + b.x, fill:"none", stroke:c, "stroke-width":"1.5"}, svg);
    }
    placed.forEach(function(p){
      var n = p.n, on = !n.fold && sel && sel.req === n.req.req;
      var g = s("g", {transform:"translate(" + p.x + "," + p.y + ")", tabindex:"0", role:"button", style:"cursor:pointer",
        "aria-label": n.fold ? cap(n.group.name) + ", all passed, unfold" : n.req.req + " " + (n.req.title || "") + ", " + n.req.state}, svg);
      s("rect", {width:p.w, height:bh, rx:6, fill: on ? "var(--sel)" : "var(--panel)", stroke: on ? "var(--accent)" : "var(--line)", "stroke-width": on ? 2 : 1}, g);
      var ic = icon(n.fold ? "pass" : n.req.state, 16); ic.setAttribute("x", "12"); ic.setAttribute("y", String(bh / 2 - 8)); g.appendChild(ic);
      var label = s("text", {x:36, y:bh / 2 + 4.5, "font-size":"13", "font-weight": on || n.fold ? "600" : "400", fill:"var(--ink)"}, g);
      label.textContent = n.fold ? cap(n.group.name) + " · " + n.group.reqs.length + " requirements" : n.req.req;
      var d = s("text", {x:p.w - 12, y:bh / 2 + 4.5, "text-anchor":"end", "font-size":"12", fill:"var(--muted)"}, g);
      d.textContent = n.fold ? dur(n.group.time) : dur(elapsed(n.req));
      var tip = s("title", {}, g); tip.textContent = n.fold ? "Click to unfold " + cap(n.group.name) : n.req.req + " — " + (n.req.title || "");
      var act = function(){ if (n.fold) { expanded[n.group.name] = true; draw(); } else pick(n.req.req); };
      g.addEventListener("click", act);
      g.addEventListener("keydown", function(ev){ if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); act(); } });
    });
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
  function focus(sel){
    $("fName").textContent = sel ? sel.req + " · " + (sel.title || "") : "—";
    $("fMeta").textContent = sel ? "attempt " + sel.attempt + (sel.group ? " · " + sel.group : "") + " · harness/" + sel.req : "";
    Array.prototype.forEach.call(document.querySelectorAll(".tabs button"), function(b){ b.setAttribute("aria-selected", String(b.dataset.tab === tab)); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-pane]"), function(p){ p.hidden = p.dataset.pane !== tab; });
    if (!sel) return steps(null);
    var key = sel.req + ":" + sel.attempt + ":" + sel.steps.length + ":" + sel.state + ":" + tab;
    if (key === stepsKey) return;
    stepsKey = key;
    if (tab === "steps") steps(sel);
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
    if (!matrixDirty || view !== "matrix") return;
    matrixDirty = false;
    fetch("live/matrix.json").then(function(x){ return x.json(); }).then(function(m){ matrix = m.rows || []; drawMatrix(); }).catch(function(){ matrixDirty = true; });
  }
  function setView(v){
    view = v; $("vRun").setAttribute("aria-pressed", String(v === "run")); $("vMatrix").setAttribute("aria-pressed", String(v === "matrix"));
    $("runView").hidden = v !== "run"; $("matrixView").hidden = v !== "matrix"; if (v === "matrix") refreshMatrix(); else { stepsKey = ""; draw(); }
  }

  function draw(){
    var list = ordered(model.requirements || []), sel = selected(list);
    sidebar(list, sel);
    if (view === "run") { summary(list); graph(list, sel); focus(sel); }
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
