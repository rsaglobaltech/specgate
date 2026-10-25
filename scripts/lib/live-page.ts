/**
 * The live view's page (ADR-0037): one self-contained document, no external
 * resources, filled from `/live.json` and kept current by `/live/stream`.
 * Every value from an event is set with textContent, never as HTML.
 *
 * REQ-179: laid out the way CI runs are read. A sidebar lists the run's
 * requirements by module with their status and duration; the main pane sums
 * the run up, draws its requirements as a graph of jobs, and opens the
 * selected one (the requirement at work, unless another is clicked) into its
 * steps — Agent, then each stage of the gate, up to the merge — with the step
 * in progress showing the agent's own stream as its log.
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
    --log:#1f2328;--log-ink:#d1d9e0;--log-muted:#8c959f;
    --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif;color-scheme:light}
  @media (prefers-color-scheme: dark){:root{--bg:#0d1117;--panel:#151b23;--line:#3d444d;--soft:#212830;--ink:#f0f6fc;
    --muted:#9198a1;--faint:#656c76;--pass:#3fb950;--fail:#f85149;--run:#d29922;--run-bg:#2c2513;--accent:#4493f8;
    --sel:#16263d;--log:#010409;--log-ink:#d1d7e0;--log-muted:#656c76;color-scheme:dark}}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 var(--sans)}
  button{font:inherit;color:inherit}
  .top{height:56px;display:flex;align-items:center;gap:10px;padding:0 24px;background:var(--panel);border-bottom:1px solid var(--line)}
  .top svg{width:22px;height:22px} .crumb{color:var(--accent)} .sep{color:var(--faint)}
  .pill{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
  .pill i{width:8px;height:8px;border-radius:50%;background:var(--faint)} .pill.on i{background:var(--pass)}
  .layout{display:flex;min-height:calc(100vh - 56px)}
  aside{width:300px;flex:none;background:var(--panel);border-right:1px solid var(--line);padding:16px 12px;overflow:auto}
  aside h3{margin:16px 10px 6px;font-size:12px;font-weight:600;color:var(--muted)}
  .job{display:flex;width:100%;align-items:center;gap:8px;padding:6px 10px;border:0;border-radius:6px;background:none;text-align:left;cursor:pointer}
  .job:hover{background:var(--soft)} .job.sel{background:var(--sel);font-weight:600}
  .job .name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .job .d{font-size:12px;color:var(--muted);font-weight:400;font-variant-numeric:tabular-nums}
  .summary-btn{margin-bottom:4px}
  main{flex:1;min-width:0;padding:24px 28px;display:flex;flex-direction:column;gap:16px}
  .head{display:flex;align-items:center;gap:12px;flex-wrap:wrap} .head h1{margin:0;font-size:20px;font-weight:600}
  .badge{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600}
  .badge.running{background:var(--run-bg);color:var(--run)} .badge.pass{background:rgba(31,136,61,.12);color:var(--pass)}
  .badge.fail{background:rgba(207,34,46,.12);color:var(--fail)} .badge i{width:8px;height:8px;border-radius:50%;background:currentColor}
  .box{background:var(--panel);border:1px solid var(--line);border-radius:6px}
  #progress{display:flex;flex-wrap:wrap;gap:12px 40px;padding:14px 18px}
  #progress div span{display:block;font-size:12px;color:var(--muted)} #progress div b{font-weight:400;font-variant-numeric:tabular-nums}
  .graph{padding:8px 4px} #chain{display:block;width:100%}
  #focus{display:flex;flex-direction:column;overflow:hidden}
  #focus .fh{padding:12px 16px;border-bottom:1px solid var(--line);display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  #focus .fh b{font-weight:600} #focus .fh span{font-size:12px;color:var(--muted)}
  #pipeline{list-style:none;margin:0;padding:0}
  #pipeline>li{display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--soft);font-size:13px}
  #pipeline>li:last-child{border-bottom:0} #pipeline .t{flex:1;min-width:0;overflow-wrap:anywhere}
  #pipeline .mono{font-family:var(--mono);font-size:12.5px} #pipeline .d{color:var(--muted);font-variant-numeric:tabular-nums}
  #pipeline li.running{background:var(--run-bg)} #pipeline li.running .d{color:var(--run)}
  #pipeline li.idle{color:var(--faint)} #pipeline li.logrow{display:block;padding:0;background:var(--log)}
  #feed{list-style:none;margin:0;padding:10px 16px 10px 42px;max-height:300px;overflow:auto;color:var(--log-ink);font:12px/1.65 var(--mono)}
  #feed li{display:grid;grid-template-columns:64px 56px minmax(0,1fr);gap:10px;animation:in .3s ease both}
  #feed .ts{color:var(--log-muted)} #feed .k{color:var(--log-muted)} #feed .ok{color:#3fb950} #feed .bad{color:#f85149}
  #feed .say{font-family:var(--sans);font-size:12.5px} #feed .x{overflow-wrap:anywhere}
  .ic{flex:none;width:16px;height:16px;display:inline-block}
  .spin{animation:spin 1s linear infinite;transform-origin:50% 50%}
  @keyframes spin{to{transform:rotate(360deg)}} @keyframes in{from{opacity:0}to{opacity:1}}
  .empty{padding:48px 16px;text-align:center;color:var(--muted)}
  @media (max-width:900px){.layout{flex-direction:column} aside{width:auto;border-right:0;border-bottom:1px solid var(--line);max-height:280px}}
  @media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style></head>
<body>
<div class="top">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>
  <span class="crumb">${title}</span><span class="sep">/</span><span class="crumb">Harness</span><span class="sep">/</span><b>Live</b>
  <span id="conn" class="pill"><i></i><span id="connText">connecting</span></span>
</div>
<div class="layout">
  <aside aria-label="Requirements of the run"><div id="jobs"></div></aside>
  <main>
    <div class="head"><span id="runBadge" class="badge running"><i></i><span id="runState">Waiting</span></span><h1 id="runTitle">Harness run</h1></div>
    <div id="progress" class="box" role="status"></div>
    <div class="box graph"><svg id="chain" role="img" aria-label="The requirements of the run as a graph of jobs"></svg></div>
    <section id="focus" class="box" aria-live="polite">
      <div class="fh"><b id="fName">—</b><span id="fMeta"></span></div>
      <ol id="pipeline" aria-label="Steps: Agent, Specification, Architecture, Tests, Merge"></ol>
    </section>
  </main>
</div>
<script>
(function(){
  var NS = "http:" + "//www.w3.org/2000/svg";
  var model = {requirements:[]}, pinned = null, logKey = "";
  function $(id){ return document.getElementById(id); }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function s(tag, attrs, parent){ var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function now(){ return Date.now() / 1000; }
  function dur(sec){ sec = Math.max(0, Math.round(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), x = sec % 60;
    return h ? h + "h " + m + "m" : m ? m + "m " + x + "s" : x + "s"; }
  function two(n){ return (n < 10 ? "0" : "") + n; }
  function stamp(t){ if (!t) return ""; var d = new Date(t * 1000); return two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds()); }
  function elapsed(r){ return r.state === "running" ? Math.max(r.elapsed, now() - r.started) : r.elapsed; }
  function clip(t, n){ t = String(t || ""); return t.length > n ? t.slice(0, n - 1) + "…" : t; }

  /** A status icon: a check, a cross, a turning ring, or an empty circle. */
  function icon(state, size){
    var v = s("svg", {viewBox:"0 0 16 16", width:size || 16, height:size || 16, "class":"ic", "aria-hidden":"true"});
    if (state === "pass") { s("circle", {cx:8, cy:8, r:7, fill:"var(--pass)"}, v); s("path", {d:"M4.5 8.2l2.3 2.3 4.7-4.9", fill:"none", stroke:"#fff", "stroke-width":"1.8", "stroke-linecap":"round", "stroke-linejoin":"round"}, v); }
    else if (state === "fail") { s("circle", {cx:8, cy:8, r:7, fill:"var(--fail)"}, v); s("path", {d:"M5.5 5.5l5 5M10.5 5.5l-5 5", stroke:"#fff", "stroke-width":"1.8", "stroke-linecap":"round"}, v); }
    else if (state === "running") { s("circle", {cx:8, cy:8, r:6, fill:"none", stroke:"var(--run)", "stroke-width":"2", opacity:".25"}, v);
      s("path", {d:"M8 2a6 6 0 0 1 6 6", fill:"none", stroke:"var(--run)", "stroke-width":"2", "stroke-linecap":"round", "class":"spin"}, v); }
    else s("circle", {cx:8, cy:8, r:6.25, fill:"none", stroke:"var(--faint)", "stroke-width":"1.5"}, v);
    return v;
  }
  function selected(reqs){
    if (pinned) { var p = reqs.filter(function(r){ return r.req === pinned; })[0]; if (p) return p; }
    return reqs.filter(function(r){ return r.state === "running"; })[0] || reqs[0] || null;
  }
  function ordered(reqs){ return reqs.slice().sort(function(a, b){ return a.started - b.started; }); }
  function groups(list){
    var out = [], at = {};
    list.forEach(function(r){ var g = r.group || ""; if (!(g in at)) { at[g] = out.length; out.push({name:g, reqs:[]}); } out[at[g]].reqs.push(r); });
    return out;
  }
  function pick(id){ pinned = pinned === id ? null : id; logKey = ""; draw(); }

  function sidebar(list, sel){
    var box = $("jobs"); box.replaceChildren();
    var sum = el("button", "job summary-btn" + (pinned ? "" : " sel"), "Summary"); sum.type = "button";
    sum.addEventListener("click", function(){ pinned = null; logKey = ""; draw(); }); box.appendChild(sum);
    groups(list).forEach(function(g){
      box.appendChild(el("h3", "", g.name ? g.name.charAt(0).toUpperCase() + g.name.slice(1) : "Requirements"));
      g.reqs.forEach(function(r){
        var b = el("button", "job" + (sel && sel.req === r.req ? " sel" : "")); b.type = "button";
        b.setAttribute("aria-current", sel && sel.req === r.req ? "true" : "false");
        b.append(icon(r.state), el("span", "name", r.req + " " + (r.title || "")), el("span", "d", dur(elapsed(r))));
        b.addEventListener("click", function(){ pick(r.req); });
        box.appendChild(b);
      });
    });
  }

  function summary(list){
    var p = 0, f = 0, run = 0, first = 0, last = 0;
    list.forEach(function(r){ if (r.state === "pass") p++; else if (r.state === "fail") f++; else run++;
      if (!first || r.started < first) first = r.started; last = Math.max(last, r.state === "running" ? now() : r.updated); });
    var state = run ? "running" : f ? "fail" : list.length ? "pass" : "running";
    $("runBadge").className = "badge " + state;
    $("runState").textContent = run ? "In progress" : f ? "Failed" : list.length ? "Completed" : "Waiting";
    var mods = groups(list).map(function(g){ return g.name; }).filter(Boolean);
    $("runTitle").textContent = mods.length ? mods.map(function(m){ return m.charAt(0).toUpperCase() + m.slice(1); }).join(", ") : "Harness run";
    var box = $("progress"); box.replaceChildren();
    [["Started", first ? stamp(first) : "—"], ["Duration", first ? dur(last - first) : "—"],
     ["Requirements", p + " passed · " + run + " running · " + f + " failed"],
     ["Agent time", dur(list.reduce(function(a, r){ return a + elapsed(r); }, 0))]].forEach(function(x){
      var d = el("div"); d.append(el("span", "", x[0]), el("b", "", x[1])); box.appendChild(d);
    });
  }

  /** The graph of jobs: one row per module, boxes joined in the order they ran, a bend between rows. */
  function graph(list, sel){
    var svg = $("chain"), W = Math.max(svg.clientWidth || 900, 360), bw = 168, bh = 40, gx = 24, gy = 34, padX = 18, padY = 30;
    var perRow = Math.max(1, Math.floor((W - padX * 2 + gx) / (bw + gx)));
    var rows = [];
    groups(list).forEach(function(g){ for (var i = 0; i < g.reqs.length; i += perRow) rows.push({name: i ? "" : g.name, reqs: g.reqs.slice(i, i + perRow)}); });
    var H = Math.max(80, padY + rows.length * (bh + gy) + 8);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("height", String(H)); svg.replaceChildren();
    if (!list.length) { var t = s("text", {x:W / 2, y:H / 2, "text-anchor":"middle", fill:"var(--muted)", "font-size":"13"}, svg); t.textContent = "No harness events yet. Run specgate harness run: each requirement appears here as it starts."; return; }
    var pos = {}, prev = null;
    rows.forEach(function(row, ri){
      var y = padY + ri * (bh + gy);
      if (row.name) { var l = s("text", {x:padX, y:y - 10, "font-size":"12", "font-weight":"600", fill:"var(--muted)"}, svg); l.textContent = row.name.charAt(0).toUpperCase() + row.name.slice(1); }
      row.reqs.forEach(function(r, i){ pos[r.req] = {x:padX + i * (bw + gx), y:y}; });
    });
    list.forEach(function(r){
      var a = prev && pos[prev.req], b = pos[r.req];
      if (a) {
        var c = r.state === "running" ? "var(--run)" : prev.state === "pass" ? "var(--faint)" : "var(--line)";
        if (a.y === b.y) s("line", {x1:a.x + bw, y1:a.y + bh / 2, x2:b.x, y2:b.y + bh / 2, stroke:c, "stroke-width":"1.5"}, svg);
        else s("path", {d:"M" + (a.x + bw) + " " + (a.y + bh / 2) + " h" + (gx / 2) + " V" + (a.y + bh + gy / 2) + " H" + (b.x - gx / 2) + " V" + (b.y + bh / 2) + " H" + b.x,
          fill:"none", stroke:c, "stroke-width":"1.5"}, svg);
      }
      prev = r;
    });
    list.forEach(function(r){
      var p = pos[r.req], on = sel && sel.req === r.req;
      var g = s("g", {transform:"translate(" + p.x + "," + p.y + ")", tabindex:"0", role:"button", style:"cursor:pointer",
        "aria-label": r.req + " " + (r.title || "") + ", " + r.state}, svg);
      s("rect", {width:bw, height:bh, rx:6, fill: on ? "var(--sel)" : "var(--panel)", stroke: on ? "var(--accent)" : "var(--line)", "stroke-width": on ? 2 : 1}, g);
      var ic = icon(r.state, 16); ic.setAttribute("x", "12"); ic.setAttribute("y", String(bh / 2 - 8)); g.appendChild(ic);
      var n = s("text", {x:36, y:bh / 2 + 4.5, "font-size":"13", "font-weight": on ? "600" : "400", fill:"var(--ink)"}, g); n.textContent = r.req;
      var d = s("text", {x:bw - 12, y:bh / 2 + 4.5, "text-anchor":"end", "font-size":"12", fill:"var(--muted)"}, g); d.textContent = dur(elapsed(r));
      var tip = s("title", {}, g); tip.textContent = r.req + " — " + (r.title || "");
      g.addEventListener("click", function(){ pick(r.req); });
      g.addEventListener("keydown", function(ev){ if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(r.req); } });
    });
  }

  /** The selected requirement's steps: the agent, then each stage of the gate as it ran, the rest still to come. */
  function steps(r){
    var ol = $("pipeline");
    if (!r) { $("fName").textContent = "—"; $("fMeta").textContent = ""; ol.replaceChildren(el("li", "empty", "Each requirement opens here as the harness works on it.")); return; }
    $("fName").textContent = r.req + " · " + (r.title || "");
    $("fMeta").textContent = "attempt " + r.attempt + (r.group ? " · " + r.group : "") + " · harness/" + r.req;
    var events = r.steps.slice().reverse(), firstGate = events.filter(function(e){ return e.type === "gate"; })[0];
    var rows = [], seen = {Specification:false, Architecture:false, Tests:false, Merge:false};
    var agentEnd = firstGate ? Number(firstGate.t) : (r.state === "running" ? now() : r.updated);
    rows.push({name:"Agent", mono:false, state: firstGate ? "pass" : r.state === "running" ? "running" : r.state, d: dur(agentEnd - r.started), log: !firstGate});
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
      if (next) { rows.push({name: next, mono:false, state:"running", d: dur(now() - prevT), log:true}); seen[next] = true; }
    }
    ["Specification","Architecture","Tests","Merge"].forEach(function(k){ if (!seen[k] && r.state === "running") rows.push({name:k, mono:false, state:"idle", d:""}); });
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
    var ul = el("ol"); ul.id = "feed";
    r.steps.slice(0, 40).slice().reverse().forEach(function(e){
      var li = el("li"), t = Number(e.ended || e.t) || 0, kind = e.type === "step" ? String(e.kind || "") : String(e.type || "");
      var what = e.type === "message" ? e.text : e.type === "gate" ? (e.result === "pass" ? "passed  " : "failed  ") + e.stage
        : e.type === "merge" ? "merged into " + (e.into || "HEAD") : (e.target || e.tool || "");
      if (e.added !== undefined || e.removed !== undefined) what += "  +" + (Number(e.added) || 0) + " −" + (Number(e.removed) || 0);
      var x = el("span", "x" + (e.type === "message" ? " say" : e.type === "gate" ? (e.result === "pass" ? " ok" : " bad") : ""), clip(what, 400));
      li.append(el("span", "ts", stamp(t)), el("span", "k", e.type === "message" ? "agent" : kind), x);
      ul.appendChild(li);
    });
    if (!ul.childNodes.length) ul.appendChild(el("li", "", "The agent's steps appear here as it works."));
    requestAnimationFrame(function(){ ul.scrollTop = ul.scrollHeight; });
    return ul;
  }

  function draw(){
    var list = ordered(model.requirements || []), sel = selected(list);
    sidebar(list, sel); summary(list); graph(list, sel);
    var key = sel ? sel.req + ":" + sel.attempt + ":" + sel.steps.length + ":" + sel.state : "";
    if (key !== logKey) { logKey = key; steps(sel); }
  }
  function tick(){
    var list = ordered(model.requirements || []), sel = selected(list);
    summary(list); sidebar(list, sel);
    var run = document.querySelector("#pipeline li.running .d");
    if (run && sel && sel.state === "running") draw();
  }
  function accept(m){ model = m && m.requirements ? m : {requirements:[]}; draw(); }

  fetch("live.json").then(function(x){ return x.json(); }).then(accept).catch(function(){});
  var es = new EventSource("live/stream");
  es.addEventListener("live", function(e){ try { accept(JSON.parse(e.data)); } catch (err) {} });
  es.onopen = function(){ $("conn").classList.add("on"); $("connText").textContent = "Live"; };
  es.onerror = function(){ $("conn").classList.remove("on"); $("connText").textContent = "Reconnecting"; };
  setInterval(tick, 1000);
  var t; window.addEventListener("resize", function(){ clearTimeout(t); t = setTimeout(function(){ logKey = ""; draw(); }, 120); });
})();
</script>
</body></html>`;
}
