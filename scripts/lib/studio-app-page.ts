/**
 * The visual studio (REQ-204..210): Home, Questions, Review and Build, in a
 * simple mode with no command in sight and an advanced one that shows them,
 * in Spanish and English. Every value comes from `/api/*` and is set as text;
 * every write is a POST carrying this page's token.
 *
 * The script lives inside this template literal: it uses no backticks, no
 * dollar-brace, and no backslash escapes.
 */
export function studioAppPage(projectName: string, token = ""): string {
  const title = String(projectName).replace(/[&<>"']/g, "");
  const tok = String(token).replace(/[^0-9a-f]/g, "");
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="specgate-token" content="${tok}"/>
<title>Specgate Studio — ${title}</title>
<style>
  :root{--bg:#f6f8fa;--panel:#fff;--line:#d1d9e0;--soft:#eff2f5;--ink:#1f2328;--muted:#59636e;--pass:#1a7f37;--go:#1f883d;
    --warn:#7d4e00;--warn-bg:#fff8c5;--warn-line:#9a6700;--info:#0550ae;--info-bg:#ddf4ff;--accent:#0969da;--fail:#cf222e;
    --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif;color-scheme:light}
  @media (prefers-color-scheme: dark){:root{--bg:#0d1117;--panel:#151b23;--line:#3d444d;--soft:#212830;--ink:#f0f6fc;--muted:#9198a1;
    --pass:#3fb950;--go:#238636;--warn:#d29922;--warn-bg:#2c2513;--warn-line:#9e6a03;--info:#4493f8;--info-bg:#16263d;--accent:#4493f8;--fail:#f85149;color-scheme:dark}}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 var(--sans)}
  a{color:var(--accent);text-decoration:none} a:hover{text-decoration:underline}
  button{font:inherit;color:inherit;cursor:pointer}
  header{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:16px;padding:8px 24px;min-height:60px;background:var(--panel);border-bottom:1px solid var(--line)}
  .brand{display:flex;align-items:center;gap:8px;font-weight:600}
  nav{display:flex;flex-wrap:wrap;gap:4px}
  nav button{border:0;background:none;padding:8px 14px;border-radius:6px;color:var(--muted)}
  nav button[aria-current="page"]{background:var(--soft);color:var(--ink);font-weight:600}
  .badge{margin-left:6px;padding:1px 7px;border-radius:999px;font-size:12px;font-weight:600}
  .b-warn{background:var(--warn-bg);color:var(--warn)} .b-info{background:var(--info-bg);color:var(--info)}
  .toggles{margin-left:auto;display:flex;gap:14px;font-size:13px;color:var(--muted)}
  .toggles button{border:0;background:none;padding:2px 4px;color:var(--accent)} .toggles button[aria-pressed="true"]{color:var(--ink);font-weight:600}
  main{max-width:1120px;margin:0 auto;padding:28px 24px;display:flex;flex-direction:column;gap:20px}
  h1{margin:0;font-size:24px;font-weight:600} h2{margin:0;font-size:16px;font-weight:600} p{margin:0}
  .muted{color:var(--muted)} .small{font-size:13px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:18px 20px;display:flex;flex-direction:column;gap:10px}
  .card.warn{border-color:var(--warn-line)} .card.info{border-color:var(--accent)}
  .next{display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:20px;padding:24px}
  .next .t{flex:1 1 420px;display:flex;flex-direction:column;gap:6px}
  .eyebrow{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--warn)}
  .next h2{font-size:22px}
  .go{min-height:44px;padding:0 22px;border:0;border-radius:8px;background:var(--go);color:#fff;font-weight:600}
  .go[disabled]{opacity:.5;cursor:not-allowed}
  .ghost{min-height:38px;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
  .stat{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px 18px;display:flex;flex-direction:column;gap:4px}
  .stat b{font-size:24px;font-weight:600}
  .rows{background:var(--panel);border:1px solid var(--line);border-radius:8px}
  .row{display:grid;grid-template-columns:180px minmax(0,1fr) 170px;gap:12px;align-items:center;padding:12px 18px;border-bottom:1px solid var(--soft)}
  .row:last-child{border-bottom:0}
  .pick{display:flex;gap:12px;align-items:center;padding:12px 20px;border-bottom:1px solid var(--soft);cursor:pointer}
  .pick .pname{flex:1;min-width:0;display:flex;gap:10px;align-items:center}
  .rows>.cmd{display:block;padding:10px 20px}
  .bar{display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--soft)} .bar i{display:block}
  .pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600}
  textarea,input[type=text]{font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);width:100%;resize:vertical}
  .opt{display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:6px}
  .steps{border-left:3px solid var(--line);padding:2px 0 2px 12px;display:flex;flex-direction:column;gap:4px;font-size:13.5px}
  .kw{font-weight:600;color:var(--accent)}
  .split{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}
  .split>.main{flex:999 1 600px;min-width:0;display:flex;flex-direction:column;gap:16px}
  .split>aside{flex:1 1 300px;display:flex;flex-direction:column;gap:16px}
  .check{display:flex;gap:8px;align-items:flex-start} .dot{width:16px;height:16px;border-radius:50%;flex:none;margin-top:2px}
  .stages{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;font-size:13px}
  .stages div{display:flex;flex-direction:column;gap:6px} .stages i{height:6px;border-radius:3px;background:var(--soft);display:block}
  .run{background:repeating-linear-gradient(135deg,#bf8700 0 5px,#d4a72c 5px 10px)!important}
  .cmd{font:12px/1.7 var(--mono);color:var(--muted)}
  .log{background:#1f2328;color:#d1d9e0;border-radius:8px;padding:12px 16px;font:12px/1.7 var(--mono);overflow-x:auto}
  .msg{font-size:13px} .msg.err{color:var(--fail)} .msg.ok{color:var(--pass)}
  .empty{padding:32px;text-align:center;color:var(--muted)}
  [hidden]{display:none!important}
  @media (max-width:700px){.row{grid-template-columns:1fr} header{padding:8px 16px} main{padding:20px 16px}}
</style></head>
<body>
<header>
  <div class="brand"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>${title}</div>
  <nav aria-label="Sections" id="nav"></nav>
  <div class="toggles">
    <span><button type="button" id="mSimple"></button> · <button type="button" id="mAdv"></button></span>
    <span><button type="button" id="lEs">ES</button> · <button type="button" id="lEn">EN</button></span>
  </div>
</header>
<main id="view" aria-live="polite"></main>
<script>
(function(){
  var T = {
    es: {home:"Inicio", questions:"Preguntas", review:"Revisión", build:"Construir", simple:"Simple", adv:"Avanzado",
      next:"Lo siguiente", nAnswer1:"Responde la pregunta para seguir", nAnswerN:"Responde las N preguntas para seguir",
      nAnswerP:"El asistente o un borrador espera una decisión tuya. Con tu respuesta continúa.", goAnswer:"Responder ahora",
      nReview:"Revisa el borrador de M", nReviewP:"Léelo como lo leería alguien de tu equipo y apruébalo o pide cambios.", goReview:"Revisar",
      nBuild1:"Construye el requisito listo", nBuildN:"Construye los N requisitos listos", nBuildP:"El asistente programa, prueba y guarda cada uno.", goBuild:"Construir",
      loading:"Cargando…", mods:"módulos", nDone:"Todo está construido", nDoneP:"Añade algo al brief cuando quieras crecer la app.",
      sBuilt:"Construidos", sOf:"de", sWait:"Esperan tu respuesta", sReview:"Por revisar", sQuality:"Calidad", qChecking:"comprobando…", qOk:"Todo en verde", qBad:"Hay que arreglar",
      modules:"Módulos", ready:"listo", qWait:"pregunta", draft:"borrador por revisar",
      qTitle:"Preguntas", qIntro:"Lo que hay que decidir antes de seguir. Cada respuesta queda escrita como una decisión del proyecto.",
      fromAgent:"Preguntó el asistente", fromDraft:"Del borrador", fromProject:"Del proyecto", blocks:"bloquea", nothing:"nada",
      yourAnswer:"Tu respuesta", other:"Otra respuesta…", answer:"Responder", optionsSeen:"Opciones que vio specgate",
      toConfirm:"Respondidas, falta confirmar que la spec lo dice", inSpec:"Ya está en la spec", noQuestions:"No hay nada que decidir ahora.",
      rTitle:"Revisión", rIntro:"Léelo como lo leería alguien de tu equipo. Si algo no es lo que querías, pide el cambio con tus palabras.",
      reqs:"requisitos", checks:"Comprobaciones", allGood:"Todo listo para aprobar", approve:"Aprobar el borrador", approveWhen:"Se podrá aprobar cuando no quede nada pendiente.",
      ask:"Pedir un cambio", askBtn:"Pedir este cambio", notes:"Cambios pedidos", noDrafts:"No hay borradores por revisar.",
      given:"Dado", when:"Cuando", then:"Entonces", and:"Y", waitsAnswer:"espera una respuesta",
      bTitle:"Construir", bIntro:"El asistente programa cada requisito, lo prueba y solo lo guarda si todo pasa. Puedes cerrar la página: sigue solo.",
      readyN:"Listos para construir", minutes:"min aprox.", perReq:"por requisito", buildN:"Construir los N", build1:"Construir este", noAgent:"Falta configurar el asistente (agent en harness.config.yaml).",
      running:"En marcha", stP:"Programa", stT:"Prueba", stQ:"Revisa la calidad", stS:"Guarda", watch:"Ver en directo", stop:"Detener después de este", stopAsked:"Se detendrá al terminar este.",
      doneToday:"Terminados", nothingReady:"No hay nada listo para construir.", started:"En marcha: ", saved:"Guardado.", err:"No se pudo: "},
    en: {home:"Home", questions:"Questions", review:"Review", build:"Build", simple:"Simple", adv:"Advanced",
      next:"Next", nAnswer1:"Answer the question to go on", nAnswerN:"Answer the N questions to go on",
      nAnswerP:"The assistant or a draft is waiting for your decision. With your answer it goes on.", goAnswer:"Answer now",
      nReview:"Review the M draft", nReviewP:"Read it as someone on your team would, then approve it or ask for changes.", goReview:"Review",
      nBuild1:"Build the requirement that is ready", nBuildN:"Build the N requirements that are ready", nBuildP:"The assistant codes, tests and saves each one.", goBuild:"Build",
      loading:"Loading…", mods:"modules", nDone:"Everything is built", nDoneP:"Add to the brief whenever you want the app to grow.",
      sBuilt:"Built", sOf:"of", sWait:"Waiting for you", sReview:"To review", sQuality:"Quality", qChecking:"checking…", qOk:"All green", qBad:"Needs fixing",
      modules:"Modules", ready:"done", qWait:"question", draft:"draft to review",
      qTitle:"Questions", qIntro:"What has to be decided before going on. Each answer is written down as a decision of the project.",
      fromAgent:"The assistant asked", fromDraft:"From the draft", fromProject:"From the project", blocks:"blocks", nothing:"nothing",
      yourAnswer:"Your answer", other:"Another answer…", answer:"Answer", optionsSeen:"Options specgate saw",
      toConfirm:"Answered, the spec still has to say it", inSpec:"The spec says it", noQuestions:"Nothing to decide right now.",
      rTitle:"Review", rIntro:"Read it as someone on your team would. If something is not what you wanted, ask for the change in your words.",
      reqs:"requirements", checks:"Checks", allGood:"Ready to approve", approve:"Approve the draft", approveWhen:"It can be approved once nothing is pending.",
      ask:"Ask for a change", askBtn:"Ask for this change", notes:"Changes asked", noDrafts:"No draft to review.",
      given:"Given", when:"When", then:"Then", and:"And", waitsAnswer:"waits for an answer",
      bTitle:"Build", bIntro:"The assistant codes each requirement, tests it and only saves it when everything passes. You can close the page: it goes on.",
      readyN:"Ready to build", minutes:"min approx.", perReq:"per requirement", buildN:"Build the N", build1:"Build this one", noAgent:"The assistant is not configured yet (agent in harness.config.yaml).",
      running:"Running", stP:"Codes", stT:"Tests", stQ:"Checks quality", stS:"Saves", watch:"Watch live", stop:"Stop after this one", stopAsked:"It will stop once this one ends.",
      doneToday:"Finished", nothingReady:"Nothing is ready to build.", started:"Started: ", saved:"Saved.", err:"Could not: "}
  };
  function load(k, d){ try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function save(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
  var lang = load("sg-app-lang", "es"), mode = load("sg-app-mode", "simple"), view = load("sg-app-view", "home");
  var token = (document.querySelector('meta[name="specgate-token"]') || {}).content || "";
  var cache = {};
  function t(k){ return (T[lang] && T[lang][k]) || T.es[k] || k; }
  function $(id){ return document.getElementById(id); }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function adv(){ return mode === "adv"; }
  function cmd(text){ var c = el("code", "cmd", text); c.hidden = !adv(); c.setAttribute("data-adv", "1"); return c; }
  function get(url){ return fetch(url).then(function(r){ return r.json(); }); }
  function post(url, body){
    return fetch(url, {method:"POST", headers:{"content-type":"application/json", "x-specgate-token":token}, body:JSON.stringify(body || {})})
      .then(function(r){ return r.json(); });
  }
  function msgEl(){ return el("span", "msg"); }
  function say(m, r){ m.className = "msg " + (r.ok ? "ok" : "err"); m.textContent = r.ok ? t("saved") : t("err") + (r.message || ""); }
  function go(v){ view = v; save("sg-app-view", v); render(); }
  function button(cls, text, on){ var b = el("button", cls, text); b.type = "button"; if (on) b.addEventListener("click", on); return b; }
  function dot(color){ var d = el("span", "dot"); d.style.background = color; d.setAttribute("aria-hidden", "true"); return d; }

  function header(h){
    var nav = $("nav"); nav.replaceChildren();
    [["home", 0, ""], ["questions", h ? h.questions : 0, "b-warn"], ["review", h ? h.drafts : 0, "b-info"], ["build", 0, ""]].forEach(function(x){
      var b = button("", t(x[0]), function(){ go(x[0]); });
      if (view === x[0]) b.setAttribute("aria-current", "page");
      if (x[1]) b.appendChild(el("span", "badge " + x[2], String(x[1])));
      nav.appendChild(b);
    });
    $("mSimple").textContent = t("simple"); $("mAdv").textContent = t("adv");
    $("mSimple").setAttribute("aria-pressed", String(!adv())); $("mAdv").setAttribute("aria-pressed", String(adv()));
    $("lEs").setAttribute("aria-pressed", String(lang === "es")); $("lEn").setAttribute("aria-pressed", String(lang === "en"));
    document.documentElement.lang = lang;
  }

  // ── Home (REQ-205) ──────────────────────────────────────────────────────
  function viewHome(h){
    var m = $("view"); m.replaceChildren();
    var top = el("section"); top.append(el("h1", "", h.project), el("p", "muted", h.modules.length + " " + t("mods") + " · " + h.total + " " + t("reqs")));
    m.appendChild(top);
    var n = el("section", "card next" + (h.next.kind === "done" ? "" : " warn")), tx = el("div", "t");
    tx.appendChild(el("span", "eyebrow", t("next")));
    var head = "", para = "", btn = null;
    if (h.next.kind === "answer") { head = h.next.count === 1 ? t("nAnswer1") : t("nAnswerN").split("N").join(String(h.next.count)); para = t("nAnswerP"); btn = button("go", t("goAnswer"), function(){ go("questions"); }); }
    else if (h.next.kind === "review") { head = t("nReview").split("M").join(h.next.change.replace("draft-", "")); para = t("nReviewP"); btn = button("go", t("goReview"), function(){ go("review"); }); }
    else if (h.next.kind === "build") { head = h.next.count === 1 ? t("nBuild1") : t("nBuildN").split("N").join(String(h.next.count)); para = t("nBuildP"); btn = button("go", t("goBuild"), function(){ go("build"); }); }
    else { head = t("nDone"); para = t("nDoneP"); }
    tx.append(el("h2", "", head), el("p", "muted", para), cmd("specgate status · specgate questions · specgate harness run"));
    n.appendChild(tx); if (btn) n.appendChild(btn); m.appendChild(n);
    var s = el("section", "stats");
    var q = el("b", "", t("qChecking"));
    [[t("sBuilt"), h.built + " " + t("sOf") + " " + h.total, ""], [t("sWait"), String(h.questions), "var(--warn)"], [t("sReview"), String(h.drafts), "var(--info)"]].forEach(function(x){
      var d = el("div", "stat"), b = el("b", "", x[1]); if (x[2]) b.style.color = x[2]; d.append(el("span", "muted small", x[0]), b); s.appendChild(d);
    });
    var qd = el("div", "stat"); qd.append(el("span", "muted small", t("sQuality")), q); s.appendChild(qd);
    m.appendChild(s);
    get("api/gate").then(function(g){ q.textContent = g.ok ? t("qOk") : t("qBad"); q.style.color = g.ok ? "var(--pass)" : "var(--fail)"; if (!g.ok && g.findings.length) qd.appendChild(el("span", "small muted", g.findings[0])); });
    var rows = el("section", "rows"), hd = el("div", "row"); hd.append(el("h2", "", t("modules"))); rows.appendChild(hd);
    h.modules.forEach(function(g){
      var r = el("div", "row"), bar = el("div", "bar");
      var a = el("i"); a.style.flex = String(g.done); a.style.background = "var(--pass)";
      var w = el("i"); w.style.flex = String(g.waiting); w.style.background = "#d4a72c";
      var rest = el("i"); rest.style.flex = String(Math.max(0, g.total - g.done - g.waiting));
      bar.append(a, w, rest);
      var label = g.draft ? t("draft") : g.waiting ? g.done + " " + t("sOf") + " " + g.total + " · " + g.waiting + " " + t("qWait") : g.done + " " + t("sOf") + " " + g.total + (g.done === g.total ? " · " + t("ready") : "");
      var lab = el("span", "small", label); lab.style.textAlign = "right"; lab.style.color = g.draft ? "var(--info)" : g.waiting ? "var(--warn)" : "var(--muted)";
      r.append(el("b", "", g.name.charAt(0).toUpperCase() + g.name.slice(1)), bar, lab); rows.appendChild(r);
    });
    m.appendChild(rows);
  }

  // ── Questions (REQ-210) ─────────────────────────────────────────────────
  function viewQuestions(q){
    var m = $("view"); m.replaceChildren();
    var top = el("section"); top.append(el("h1", "", t("qTitle")), el("p", "muted", t("qIntro"))); m.appendChild(top);
    if (!q.open.length && !q.toReview.length) { m.appendChild(el("div", "card empty", t("noQuestions"))); return; }
    q.open.forEach(function(x){
      var c = el("article", "card" + (x.from === "agent" ? " warn" : ""));
      var meta = el("div", "small muted");
      var pill = el("span", "pill " + (x.from === "agent" ? "b-warn" : "b-info"), x.from === "agent" ? t("fromAgent") : x.from === "project" ? t("fromProject") : t("fromDraft"));
      meta.append(pill, document.createTextNode("  " + (x.change === "project" ? "" : x.change.replace("draft-", "") + " · ") + t("blocks") + " " + (x.blocks.length ? x.blocks.join(", ") : t("nothing"))));
      c.append(meta, el("h2", "", x.text));
      var ta = el("textarea"); ta.rows = 3; ta.setAttribute("aria-label", t("yourAnswer"));
      var chosen = { v: "" };
      if (x.options.length) {
        var fs0 = el("fieldset"); fs0.style.border = "0"; fs0.style.padding = "0"; fs0.style.margin = "0"; fs0.style.display = "flex"; fs0.style.flexDirection = "column"; fs0.style.gap = "8px";
        fs0.appendChild(el("legend", "small muted", t("optionsSeen")));
        x.options.concat([t("other")]).forEach(function(o, i){
          var l = el("label", "opt"), r = el("input"); r.type = "radio"; r.name = "o-" + x.change + "-" + x.id;
          r.addEventListener("change", function(){ chosen.v = i < x.options.length ? o : ""; ta.hidden = i < x.options.length; });
          l.append(r, document.createTextNode(o)); fs0.appendChild(l);
        });
        c.appendChild(fs0); ta.hidden = true;
      } else c.appendChild(el("label", "small muted", t("yourAnswer")));
      c.appendChild(ta);
      var row = el("div"); row.style.display = "flex"; row.style.gap = "12px"; row.style.alignItems = "center"; row.style.flexWrap = "wrap";
      var m0 = msgEl();
      row.append(button("go", t("answer"), function(){
        var text = chosen.v || ta.value.trim(); if (!text) return;
        post("api/answer", {question:x.id, change:x.change === "project" ? undefined : x.change, answer:text}).then(function(r){ say(m0, r); if (r.ok) refresh(); });
      }), m0);
      c.append(row, cmd("specgate answer " + x.id + " " + String.fromCharCode(34) + "…" + String.fromCharCode(34) + (x.change === "project" ? "" : " --change " + x.change)));
      m.appendChild(c);
    });
    if (q.toReview.length) {
      var s = el("section", "card"); s.appendChild(el("h2", "", t("toConfirm")));
      q.toReview.forEach(function(x){
        var r = el("div"); r.style.display = "flex"; r.style.flexWrap = "wrap"; r.style.gap = "12px"; r.style.alignItems = "center";
        var m1 = msgEl();
        r.append(el("span", "", (x.change === "project" ? "" : x.change.replace("draft-", "") + " · ") + (x.text || x.question)), button("ghost", t("inSpec"), function(){
          post("api/answer", {question:x.question, change:x.change === "project" ? undefined : x.change, reviewed:true}).then(function(res){ say(m1, res); if (res.ok) refresh(); });
        }), m1);
        s.append(r, cmd("specgate answer " + x.question + " --reviewed"));
      });
      m.appendChild(s);
    }
  }

  // ── Review (REQ-206, REQ-207) ───────────────────────────────────────────
  function kw(step){
    var sp = step.indexOf(" "), k = (sp > 0 ? step.slice(0, sp) : step).toUpperCase(), rest = sp > 0 ? step.slice(sp + 1) : "";
    var map = {GIVEN:"given", WHEN:"when", THEN:"then", AND:"and", DADO:"given", CUANDO:"when", ENTONCES:"then", Y:"and"};
    var line = el("span"); line.append(el("b", "kw", map[k] ? t(map[k]) : k), document.createTextNode(" " + rest)); return line;
  }
  function viewReview(list){
    var m = $("view"); m.replaceChildren();
    var top = el("section"); top.append(el("h1", "", t("rTitle")), el("p", "muted", t("rIntro"))); m.appendChild(top);
    if (!list.length) { m.appendChild(el("div", "card empty", t("noDrafts"))); return; }
    list.forEach(function(d){
      var split = el("section", "split"), main = el("div", "main"), aside = el("aside");
      main.appendChild(el("h2", "", d.module.charAt(0).toUpperCase() + d.module.slice(1) + " · " + d.requirements.length + " " + t("reqs")));
      d.requirements.forEach(function(r){
        var waits = d.questions.filter(function(q){ return q.blocks.indexOf(r.id) >= 0; });
        var c = el("article", "card" + (waits.length ? " warn" : ""));
        var h = el("div"); h.style.display = "flex"; h.style.justifyContent = "space-between"; h.style.gap = "12px";
        h.append(el("h2", "", r.title), el("span", "small muted", waits.length ? t("waitsAnswer") : r.id)); c.appendChild(h);
        if (r.statement) c.appendChild(el("p", "", r.statement));
        r.scenarios.forEach(function(s){ var st = el("div", "steps"); s.steps.forEach(function(x){ st.appendChild(kw(x)); }); c.appendChild(st); });
        var det = el("details"), sum = el("summary", "small", t("ask")); det.appendChild(sum);
        var ta = el("textarea"); ta.rows = 2; ta.setAttribute("aria-label", t("ask")); var m2 = msgEl();
        det.append(ta, button("ghost", t("askBtn"), function(){
          if (!ta.value.trim()) return;
          post("api/note", {change:d.change, req:r.id, text:ta.value}).then(function(res){ say(m2, res); if (res.ok) refresh(); });
        }), m2);
        c.append(det, cmd(d.change + " · " + r.id + " · specgate change note " + d.change + " … --req " + r.id));
        main.appendChild(c);
      });
      var ch = el("section", "card"); ch.appendChild(el("h2", "", t("checks")));
      if (!d.blockers.length) { var ok = el("div", "check"); ok.append(dot("var(--pass)"), el("span", "", t("allGood"))); ch.appendChild(ok); }
      d.blockers.forEach(function(b){ var x = el("div", "check"); x.append(dot("#d4a72c"), el("span", "small", b.message)); ch.appendChild(x); });
      aside.appendChild(ch);
      var act = el("section", "card"), m3 = msgEl();
      var ap = button("go", t("approve"), function(){ post("api/approve", {change:d.change}).then(function(res){ say(m3, res); if (res.ok) refresh(); }); });
      ap.disabled = d.blockers.length > 0;
      act.append(ap);
      if (d.blockers.length) act.appendChild(el("span", "small muted", t("approveWhen")));
      act.append(m3, cmd("specgate change approve " + d.change));
      aside.appendChild(act);
      if (d.notes.length) {
        var nt = el("section", "card"); nt.appendChild(el("h2", "", t("notes")));
        d.notes.forEach(function(n){ nt.appendChild(el("div", "small", (n.requirement ? n.requirement + " · " : "") + n.text)); });
        aside.appendChild(nt);
      }
      split.append(main, aside); m.appendChild(split);
    });
  }

  // ── Build (REQ-208, REQ-209) ────────────────────────────────────────────
  var picked = {};
  function stageOf(r){
    var gates = r.steps.filter(function(e){ return e.type === "gate" || e.type === "merge"; });
    if (r.steps.some(function(e){ return e.type === "merge"; })) return 3;
    if (gates.some(function(e){ return String(e.stage || "").indexOf("architecture") >= 0; })) return 2;
    if (gates.length) return 1;
    return 0;
  }
  function viewBuild(b, live){
    var m = $("view"); m.replaceChildren();
    var top = el("section"); top.append(el("h1", "", t("bTitle")), el("p", "muted", t("bIntro"))); m.appendChild(top);
    var cur = (live.requirements || []).filter(function(r){ return r.state === "running"; })[0];
    if (cur) {
      var rc = el("section", "card warn");
      var h = el("div"); h.style.display = "flex"; h.style.gap = "10px"; h.style.alignItems = "center"; h.style.flexWrap = "wrap";
      h.append(el("span", "pill b-warn", t("running")), el("b", "", cur.title || cur.req), el("span", "small muted", Math.round(Math.max(0, Date.now() / 1000 - cur.started) / 60) + " min"));
      rc.appendChild(h);
      var stg = el("div", "stages"), at = stageOf(cur);
      [t("stP"), t("stT"), t("stQ"), t("stS")].forEach(function(name, i){
        var d = el("div"), bar = el("i"); if (i < at) bar.style.background = "var(--pass)"; if (i === at) bar.className = "run";
        d.append(bar, el("span", i === at ? "" : "muted", name)); stg.appendChild(d);
      });
      rc.appendChild(stg);
      var said = cur.steps.filter(function(e){ return e.type === "message"; })[0];
      if (said) { var p0 = el("p", "small", String(said.text || "")); p0.style.padding = "10px 12px"; p0.style.background = "var(--soft)"; p0.style.borderRadius = "6px"; rc.appendChild(p0); }
      var acts = el("div"); acts.style.display = "flex"; acts.style.gap = "12px"; acts.style.alignItems = "center"; acts.style.flexWrap = "wrap";
      var lk = el("a", "", t("watch")); lk.href = "live";
      var m4 = msgEl();
      acts.append(lk, button("ghost", t("stop"), function(){ post("api/stop", {}).then(function(res){ m4.className = "msg " + (res.ok ? "ok" : "err"); m4.textContent = res.ok ? t("stopAsked") : t("err") + res.message; }); }), m4);
      rc.appendChild(acts);
      if (adv()) {
        var lg = el("div", "log"); lg.setAttribute("data-adv", "1");
        cur.steps.slice(0, 8).forEach(function(e){ lg.appendChild(el("div", "", (e.kind || e.type) + "  " + String(e.target || e.stage || e.text || ""))); });
        if (cur.agent) lg.appendChild(el("div", "", cur.agent.model + (cur.usage ? " · " + Math.round(cur.usage.context / 1000) + "k / " + Math.round(cur.usage.window / 1000) + "k" : "")));
        rc.appendChild(lg);
      }
      m.appendChild(rc);
    }
    var sec = el("section", "rows");
    var hd = el("div"); hd.style.display = "flex"; hd.style.flexWrap = "wrap"; hd.style.justifyContent = "space-between"; hd.style.alignItems = "center"; hd.style.gap = "12px"; hd.style.padding = "16px 20px"; hd.style.borderBottom = "1px solid var(--line)";
    var info = el("div"); info.append(el("h2", "", t("readyN") + " · " + b.ready.length));
    var est = [];
    if (b.estimate.minutes) est.push(b.estimate.minutes + " " + t("minutes"));
    if (b.estimate.costPerRequirement !== null) est.push("$" + b.estimate.costPerRequirement.toFixed(2) + " " + t("perReq"));
    if (est.length) info.appendChild(el("span", "small muted", est.join(" · ")));
    var m5 = msgEl();
    var chosen = function(){ return b.ready.filter(function(r){ return picked[r.id] !== false; }).map(function(r){ return r.id; }); };
    var label = function(){ var n = chosen().length; return n === 1 ? t("build1") : t("buildN").split("N").join(String(n)); };
    var go0 = button("go", label(), function(){
      post("api/build", {reqs:chosen()}).then(function(res){ m5.className = "msg " + (res.ok ? "ok" : "err"); m5.textContent = res.ok ? t("started") + res.started.join(", ") : t("err") + res.message; setTimeout(refresh, 1500); });
    });
    go0.disabled = !b.ready.length || !b.agent || !!b.running;
    hd.append(info, go0); sec.appendChild(hd);
    if (!b.agent) { var na = el("div", "msg err", t("noAgent")); na.style.padding = "10px 20px"; sec.appendChild(na); }
    m5.style.padding = "0 20px"; sec.appendChild(m5);
    if (!b.ready.length) sec.appendChild(el("div", "empty", t("nothingReady")));
    b.ready.forEach(function(r){
      var l = el("label", "pick"), cb = el("input"); cb.type = "checkbox"; cb.checked = picked[r.id] !== false;
      cb.addEventListener("change", function(){ picked[r.id] = cb.checked; go0.textContent = label(); go0.disabled = !chosen().length || !b.agent || !!b.running; });
      var name = el("span", "pname"); name.append(cb, document.createTextNode(" " + r.title));
      var mod = el("span", "small muted", r.module); mod.style.textAlign = "right";
      l.append(name, el("span", "small muted", adv() ? r.id : ""), mod); sec.appendChild(l);
    });
    sec.appendChild(cmd("specgate harness run --chain " + chosen().map(function(x){ return "--req " + x; }).join(" ")));
    m.appendChild(sec);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var done = (live.requirements || []).filter(function(r){ return r.state === "pass" && r.updated * 1000 >= today.getTime(); }).slice(0, 6);
    if (done.length) {
      var fin = el("section", "card"); fin.appendChild(el("h2", "", t("doneToday")));
      done.forEach(function(r){ var x = el("div", "check"); x.append(dot("var(--pass)"), el("span", "", r.title || r.req), el("span", "small muted", " " + Math.round(r.elapsed / 60) + " min")); fin.appendChild(x); });
      m.appendChild(fin);
    }
  }

  function render(){
    var h = cache.home;
    header(h);
    if (view === "home" && h) viewHome(h);
    else if (view === "questions" && cache.questions) viewQuestions(cache.questions);
    else if (view === "review" && cache.drafts) viewReview(cache.drafts);
    else if (view === "build" && cache.build) viewBuild(cache.build, cache.live || {});
    else $("view").replaceChildren(el("div", "card empty", t("loading")));
  }
  function refresh(){
    var reads = [get("api/home").then(function(x){ cache.home = x; })];
    if (view === "questions") reads.push(get("api/questions").then(function(x){ cache.questions = x; }));
    if (view === "review") reads.push(get("api/drafts").then(function(x){ cache.drafts = x; }));
    if (view === "build") { reads.push(get("api/build").then(function(x){ cache.build = x; })); reads.push(get("live.json").then(function(x){ cache.live = x; })); }
    Promise.all(reads).then(render).catch(function(){});
  }
  $("mSimple").addEventListener("click", function(){ mode = "simple"; save("sg-app-mode", mode); render(); });
  $("mAdv").addEventListener("click", function(){ mode = "adv"; save("sg-app-mode", mode); render(); });
  $("lEs").addEventListener("click", function(){ lang = "es"; save("sg-app-lang", lang); render(); });
  $("lEn").addEventListener("click", function(){ lang = "en"; save("sg-app-lang", lang); render(); });
  var origGo = go; go = function(v){ var k = {questions:"questions", review:"drafts", build:"build"}[v]; if (k) cache[k] = null; origGo(v); refresh(); };
  render();
  refresh();
  setInterval(function(){ if (view === "build" || view === "home") refresh(); }, 5000);
})();
</script>
</body></html>`;
}
