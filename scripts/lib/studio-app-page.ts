/**
 * The visual studio (REQ-204..217): a route of seven steps — Project, Brief,
 * Drafts, Questions, Review, Build, Report — in a simple mode with no command
 * in sight and an advanced one that shows them, in Spanish and English. Every
 * value comes from `/api/*` and is set as text; every write is a POST
 * carrying this page's token.
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
  :root{--bg:#f6f8fa;--panel:#fff;--line:#d1d9e0;--soft:#eff2f5;--ink:#1f2328;--muted:#59636e;--pass:#1a7f37;--pass-bg:#dafbe1;--go:#1f883d;
    --warn:#7d4e00;--warn-bg:#fff8c5;--warn-line:#9a6700;--info:#0550ae;--info-bg:#ddf4ff;--accent:#0969da;--fail:#cf222e;--here:#f6faff;
    --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif;color-scheme:light}
  @media (prefers-color-scheme: dark){:root{--bg:#0d1117;--panel:#151b23;--line:#3d444d;--soft:#212830;--ink:#f0f6fc;--muted:#9198a1;
    --pass:#3fb950;--pass-bg:#12261e;--go:#238636;--warn:#d29922;--warn-bg:#2c2513;--warn-line:#9e6a03;--info:#4493f8;--info-bg:#16263d;--accent:#4493f8;--fail:#f85149;--here:#121d2b;color-scheme:dark}}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 var(--sans)}
  a{color:var(--accent);text-decoration:none} a:hover{text-decoration:underline}
  button{font:inherit;color:inherit;cursor:pointer}
  header{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:8px 24px;min-height:60px;background:var(--panel);border-bottom:1px solid var(--line)}
  .brand{display:flex;align-items:center;gap:8px;font-weight:600}
  nav{display:flex;flex-wrap:wrap;align-items:center;gap:2px}
  nav button{display:flex;align-items:center;gap:6px;border:0;background:none;padding:8px 10px;border-radius:6px;color:var(--muted)}
  nav button[aria-current="page"]{background:var(--soft);color:var(--ink);font-weight:600}
  nav button[disabled]{cursor:default;opacity:.7}
  nav .sep{width:1px;height:20px;background:var(--line);margin:0 6px}
  .num{width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;border:1px solid var(--line);flex:none}
  .num.done{background:var(--pass-bg);color:var(--pass);border-color:transparent}
  .num.current{background:var(--accent);color:#fff;border-color:transparent}
  .num.locked{border-style:dashed}
  .badge{padding:1px 7px;border-radius:999px;font-size:12px;font-weight:600}
  .b-warn{background:var(--warn-bg);color:var(--warn)} .b-info{background:var(--info-bg);color:var(--info)} .b-pass{background:var(--pass-bg);color:var(--pass)} .b-soft{background:var(--soft);color:var(--muted)}
  .toggles{margin-left:auto;display:flex;gap:14px;font-size:13px;color:var(--muted)}
  .toggles button{border:0;background:none;padding:2px 4px;color:var(--accent)} .toggles button[aria-pressed="true"]{color:var(--ink);font-weight:600}
  main{max-width:1120px;margin:0 auto;padding:28px 24px;display:flex;flex-direction:column;gap:20px}
  main.narrow{max-width:780px}
  h1{margin:0;font-size:24px;font-weight:600} h2{margin:0;font-size:16px;font-weight:600} p{margin:0}
  .muted{color:var(--muted)} .small{font-size:13px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:18px 20px;display:flex;flex-direction:column;gap:10px}
  .card.warn{border-color:var(--warn-line)} .card.info{border-color:var(--accent)}
  .next{display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:20px;padding:24px}
  .next .t{flex:1 1 420px;display:flex;flex-direction:column;gap:6px}
  .eyebrow{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--info)}
  .next h2{font-size:22px}
  .go{min-height:44px;padding:0 22px;border:0;border-radius:8px;background:var(--go);color:#fff;font-weight:600}
  .go[disabled],.ghost[disabled]{opacity:.5;cursor:not-allowed}
  .ghost{min-height:38px;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
  .link{border:0;background:none;padding:4px 0;color:var(--accent);font-size:13px;text-align:left}
  .danger{color:var(--fail)}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
  .stat{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px 18px;display:flex;flex-direction:column;gap:4px}
  .stat b{font-size:24px;font-weight:600}
  .rows{background:var(--panel);border:1px solid var(--line);border-radius:8px}
  .row{display:grid;grid-template-columns:180px minmax(0,1fr) 170px;gap:12px;align-items:center;padding:12px 18px;border-bottom:1px solid var(--soft)}
  .row:last-child{border-bottom:0}
  .line{display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--soft)}
  .line:last-child{border-bottom:0} .line.here{background:var(--here)}
  .line .grow{flex:999 1 300px;min-width:0;display:flex;flex-direction:column;gap:4px}
  .line .name{flex:0 0 130px;font-weight:600}
  .step .num{width:32px;height:32px;font-size:14px}
  .pick{display:flex;gap:12px;align-items:center;padding:12px 20px;border-bottom:1px solid var(--soft);cursor:pointer}
  .pick .pname{flex:1;min-width:0;display:flex;gap:10px;align-items:center}
  .rows>.cmd{display:block;padding:10px 20px}
  .bar{display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--soft)} .bar i{display:block}
  .pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600}
  textarea,input[type=text],select{font:inherit;padding:9px 11px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);width:100%}
  textarea{resize:vertical} select{width:auto}
  .opt{display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:6px}
  .choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
  .choice{display:flex;flex-direction:column;gap:6px;padding:14px;border:1px solid var(--line);border-radius:8px;cursor:pointer}
  .choice.on{border:2px solid var(--accent);background:var(--here);padding:13px}
  .choice .h{display:flex;align-items:center;gap:8px;font-weight:600}
  .field{display:flex;flex-direction:column;gap:8px;padding:18px 22px;border-bottom:1px solid var(--line)}
  .field:last-child{border-bottom:0} .field>label,.field>.lab{font-weight:600}
  .form{background:var(--panel);border:1px solid var(--line);border-radius:8px;display:flex;flex-direction:column}
  .chips{display:flex;flex-wrap:wrap;gap:6px}
  .chip{padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:var(--panel)}
  .chip[aria-selected="true"]{border-color:var(--accent);background:var(--info-bg);color:var(--info);font-weight:600}
  .cards{display:flex;flex-direction:column;gap:14px;padding:16px;border:1px solid var(--line);border-radius:8px;background:var(--bg)}
  .item{display:flex;gap:8px;align-items:center} .item input{flex:1}
  .x{border:0;background:none;color:var(--muted);padding:4px 8px;border-radius:6px}
  .steps{border-left:3px solid var(--line);padding:2px 0 2px 12px;display:flex;flex-direction:column;gap:4px;font-size:13.5px}
  .kw{font-weight:600;color:var(--accent)}
  .split{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}
  .split>.main{flex:999 1 600px;min-width:0;display:flex;flex-direction:column;gap:16px}
  .split>aside{flex:1 1 300px;display:flex;flex-direction:column;gap:16px}
  .check{display:flex;gap:8px;align-items:flex-start} .dot{width:16px;height:16px;border-radius:50%;flex:none;margin-top:2px}
  .stages{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;font-size:13px}
  .stages div{display:flex;flex-direction:column;gap:6px} .stages i{height:6px;border-radius:3px;background:var(--soft);display:block}
  .run{background:repeating-linear-gradient(135deg,#bf8700 0 5px,#d4a72c 5px 10px)!important}
  .progress{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px}
  .progress .ok{color:var(--pass)} .progress .now{color:var(--info);font-weight:600} .progress .todo{color:var(--muted)}
  .cmd{font:12px/1.7 var(--mono);color:var(--muted);white-space:pre-wrap;word-break:break-word}
  .log{background:#1f2328;color:#d1d9e0;border-radius:8px;padding:12px 16px;font:12px/1.7 var(--mono);overflow-x:auto;white-space:pre-wrap}
  .msg{font-size:13px} .msg.err{color:var(--fail)} .msg.ok{color:var(--pass)}
  .empty{padding:32px;text-align:center;color:var(--muted)}
  .table{width:100%;border-collapse:collapse} .table th,.table td{text-align:left;padding:10px 20px;border-top:1px solid var(--line)} .table th{font-size:12px;color:var(--muted);font-weight:600}
  .scroll{overflow-x:auto}
  [hidden]{display:none!important}
  @media (max-width:700px){.row{grid-template-columns:1fr} header{padding:8px 16px} main{padding:20px 16px} .line .name{flex-basis:100%}}
  @media print{header{display:none}}
</style></head>
<body>
<header>
  <div class="brand"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>${title}</div>
  <nav aria-label="Steps" id="nav"></nav>
  <div class="toggles">
    <span><button type="button" id="mSimple"></button> · <button type="button" id="mAdv"></button></span>
    <span><button type="button" id="lEs">ES</button> · <button type="button" id="lEn">EN</button></span>
  </div>
</header>
<main id="view" aria-live="polite"></main>
<script>
(function(){
  var T = {
    es: {route:"Ruta", project:"Proyecto", brief:"Brief", drafts:"Borradores", report:"Informe",
      home:"Inicio", questions:"Preguntas", review:"Revisión", build:"Construir", simple:"Simple", adv:"Avanzado",
      routeTitle:"Tu proyecto, paso a paso", routeIntro:"Del brief a la app construida y probada. Cada paso se abre cuando el anterior está listo; puedes volver a cualquiera.",
      next:"Lo siguiente", stepN:"paso", open:"Abrir", allDone:"Todo hecho", allDoneP:"Todo está construido y probado. Añade algo al brief cuando quieras crecer la app.",
      nx_project:"Crea tu proyecto", nxp_project:"Cinco preguntas y specgate prepara esta carpeta.", go_project:"Empezar",
      nx_brief:"Escribe el brief", nxp_brief:"Qué tiene que hacer la app, con tus palabras. De aquí salen los requisitos.", go_brief:"Abrir el brief",
      nx_drafts:"Redacta los borradores", nxp_drafts:"El asistente convierte cada módulo del brief en requisitos con ejemplos.", go_drafts:"Redactar",
      nx_questions:"Responde las preguntas", nxp_questions:"El asistente o un borrador espera una decisión tuya.", go_questions:"Responder",
      nx_review:"Revisa los borradores", nxp_review:"Léelos como lo haría alguien de tu equipo y apruébalos o pide cambios.", go_review:"Revisar",
      nx_build:"Construye lo que está listo", nxp_build:"El asistente programa, prueba y guarda cada requisito.", go_build:"Construir",
      nx_report:"Mira lo que está hecho", nxp_report:"Lo que se construyó, cómo se probó y qué falta.", go_report:"Ver el informe",
      s_project_done:"Specgate preparado en esta carpeta", s_project_todo:"Crea el proyecto en esta carpeta",
      s_brief_done:"N módulos · las comprobaciones pasan", s_brief_open:"Escribe qué tiene que hacer la app", s_brief_fix:"N módulos · hay cosas por completar",
      s_drafts:"D de N módulos redactados", s_questions_open:"N esperan tu respuesta", s_questions_done:"Nada que decidir",
      s_review_open:"N borradores por leer y aprobar", s_review_done:"Nada por revisar",
      s_build:"R listos · B de T construidos", s_build_locked:"Se abre cuando apruebes un borrador",
      s_report:"B de T construidos y probados", s_report_locked:"Aparece con el primer requisito construido", s_locked:"Se abre con el paso anterior",
      repeat:"Los pasos 3 a 6 se repiten por módulo: puedes construir uno mientras redactas otro.",
      loading:"Cargando…", mods:"módulos", sOf:"de", modules:"Módulos", ready:"listo", qWait:"pregunta", draft:"borrador por revisar", reqs:"requisitos", own_product:"producto", own_architect:"arquitectura", own_developer:"desarrollo", layerDone:"escrito", layerTodo:"por escribir", layerApproved:"aprobado", layerWaits:"aprobaciones", approveLayer:"Aprobar", byWhom:"por",
      newTitle:"Empecemos un proyecto", newIntro:"Esta carpeta está vacía. Cinco preguntas y specgate la prepara: especificación, pruebas y el asistente que programa.",
      q1:"1 · ¿Cómo se llama?", q2:"2 · ¿Qué vas a construir?", q3:"3 · ¿Con qué tecnología?", q4:"4 · ¿Qué asistente programa?",
      kWeb:"Una web", kWebP:"Pantallas que se abren en el navegador", kApi:"Un servicio (API)", kApiP:"Datos y reglas para otras apps", kMob:"Una app móvil", kMobP:"Para el teléfono",
      stNode:"Node.js + React (recomendado para una web)", stJava:"Java + Spring Boot", stPy:"Python + FastAPI", stCustom:"Otra… (la escribes tú)",
      stackHint:"Decide el lenguaje y cómo se prueba.", customStack:"Tecnología", customTest:"Cómo se prueba (comando)",
      aClaude:"Claude Code", aCodex:"Codex CLI", aNone:"Elegirlo más tarde", found:"detectado en este equipo", notFound:"no encontrado", liveTok:"tokens y coste en vivo", stepsOnly:"solo pasos",
      create:"Crear proyecto", createP:"Crea la estructura, la especificación vacía y un brief para rellenar.", creating:"Creando…",
      notEmpty:"Esta carpeta ya tiene archivos", notEmptyP:"Para no tocar lo que hay, adóptala desde una terminal con este comando y vuelve a abrir el studio:",
      projReady:"Proyecto listo", projReadyP:"Specgate está preparado. Estos son los asistentes que puede usar:", noProfiles:"No hay asistentes configurados todavía.",
      profilesHint:"Se añaden en .harness/profiles.yaml:", isDefault:"por defecto", assistant:"Asistente",
      bTitleBrief:"El brief", bIntroBrief:"Qué tiene que hacer la app, dicho con tus palabras. De aquí salen los requisitos: lo que no está aquí, no se construye.",
      paste:"¿Tienes el texto del cliente, un correo o notas?", pasteP:"Pégalo tal cual: el asistente propone producto, usuarios y módulos. Tú lo corriges después.",
      pasteBtn:"Que el asistente lo estructure", replace:"Reemplazar el brief actual", fromScratch:"Empezar desde cero", fromScratchP:"Un formulario vacío: producto, usuarios y módulos.",
      reading:"El asistente está leyendo el texto…", stopIt:"Parar",
      product:"El producto, en una frase", who:"Quién lo usa", addActor:"+ Añadir otro tipo de usuario", actorName:"Tipo de usuario",
      modsTitle:"Módulos: las partes de la app", addModule:"+ Módulo", moduleName:"Nombre del módulo", removeModule:"Quitar este módulo",
      rules:"Reglas", rulesP:"lo que siempre se cumple", examples:"Ejemplos", examplesP:"una situación concreta, con nombres y números", doubts:"Dudas", doubtsP:"lo que aún no sabes; se convertirán en preguntas",
      addRule:"+ Regla", addExample:"+ Ejemplo", addDoubt:"+ Duda", remove:"Quitar",
      checksB:"Comprobaciones", checksBP:"Se revisan cada vez que guardas", briefOk:"Todo en orden", savedAt:"Guardado", saving:"Guardando…",
      toDrafts:"Siguiente: redactar borradores", formTab:"Formulario", mdTab:"Markdown", saveMd:"Guardar",
      dTitle:"Borradores", dIntro:"Cada módulo del brief se convierte en requisitos con ejemplos que se pueden probar. El asistente los escribe; tú los revisas antes de construir.",
      noBrief:"Primero escribe el brief.", nOfM:"N módulos · D redactados", draftNext:"Redactar el siguiente", draftIt:"Redactar", retry:"Reintentar",
      stTodo:"Sin redactar", stStopped:"Se detuvo sin escribir nada", stDrafting:"Redactando…", stReview:"N requisitos · Q preguntas abiertas", stApproved:"Aprobado · listo para construir", stArchived:"Construido",
      pRead:"Lee su parte del brief", pReqs:"Escribe los requisitos", pScn:"Escribe los ejemplos (Dado / Cuando / Entonces)", pNotes:"Anota supuestos y preguntas", pCheck:"Comprueba el borrador",
      checkOf:"Comprobación de M", toFix:"N cosas por resolver", lastRun:"Última ejecución",
      qTitle:"Preguntas", qIntro:"Lo que hay que decidir antes de seguir. Cada respuesta queda escrita como una decisión del proyecto.",
      fromAgent:"Preguntó el asistente", fromDraft:"Del borrador", fromProject:"Del proyecto", blocks:"bloquea", nothing:"nada",
      yourAnswer:"Tu respuesta", other:"Otra respuesta…", answer:"Responder", optionsSeen:"Opciones que vio specgate",
      toConfirm:"Respondidas, falta confirmar que la spec lo dice", inSpec:"Ya está en la spec", noQuestions:"No hay nada que decidir ahora.",
      rTitle:"Revisión", rIntro:"Léelo como lo leería alguien de tu equipo. Si algo no es lo que querías, pide el cambio con tus palabras.",
      checks:"Comprobaciones", allGood:"Todo listo para aprobar", approve:"Aprobar el borrador", approveWhen:"Se podrá aprobar cuando no quede nada pendiente.",
      ask:"Pedir un cambio", askBtn:"Pedir este cambio", notes:"Cambios pedidos", noDrafts:"No hay borradores por revisar.",
      given:"Dado", when:"Cuando", then:"Entonces", and:"Y", waitsAnswer:"espera una respuesta",
      bTitle:"Construir", bIntro:"El asistente programa cada requisito, lo prueba y solo lo guarda si todo pasa. Puedes cerrar la página: sigue solo.",
      whoCodes:"¿Quién programa?", whoCodesP:"Los asistentes de este proyecto. Se recuerda tu elección.", noEstimate:"Sin estimación todavía", perRun:"por requisito",
      readyN:"Listos para construir", minutes:"min aprox.", perReq:"por requisito", buildN:"Construir los N", build1:"Construir este", noAgent:"Falta configurar el asistente (agent en harness.config.yaml).",
      running:"En marcha", stP:"Programa", stT:"Prueba", stQ:"Revisa la calidad", stS:"Guarda", watch:"Ver en directo", stop:"Detener después de este", stopAsked:"Se detendrá al terminar este.",
      doneToday:"Terminados", nothingReady:"No hay nada listo para construir.", started:"En marcha: ", savedGit:"la especificación quedó guardada en git (N archivos)", saved:"Guardado.", err:"No se pudo: ",
      repTitle:"Lo que está hecho", repIntro:"Cada requisito se construyó y se probó con el ejemplo que lo describe. Este informe sale de la especificación y de las pruebas.",
      download:"Descargar informe", print:"Imprimir / PDF", rBuilt:"Construido", rExamples:"Ejemplos probados", rGate:"Calidad", rGateOk:"Pasa", rGateBad:"No pasa", rCost:"Coste del asistente",
      byModule:"Por módulo", colModule:"Módulo", colBuilt:"Hecho", colEx:"Ejemplos", colState:"Estado", complete:"Completo", waitingN:"N esperan una respuesta", notBuilt:"Sin construir",
      whatDoes:"Qué hace ya la app", provedBy:"Probado con: ", missing:"Lo que falta", missingNone:"Nada.", waitsFor:"espera la respuesta a: ", decisions:"Decisiones y supuestos",
      decisionsP:"Q preguntas respondidas · A supuestos anotados.", nothingBuilt:"Todavía no hay nada construido.",
      qualTitle:"Calidad del código", qualIntro:"Comprobaciones que el asistente debe pasar en cada requisito, todas en Docker y sin cuentas.",
      qualNone:"Sin comprobaciones de calidad todavía.", qualBasic:"Activar el nivel básico", qualStrict:"Activar el nivel estricto",
      toBasic:"Cambiar a básico", toStrict:"Cambiar a estricto", gates:"bloquea", advises:"avisa", notRunnable:"no se puede ejecutar aquí",
      dockerOn:"Docker responde", dockerOff:"Docker no responde: arranca Docker Desktop", thresholds:"Umbrales: cobertura de lo cambiado C % · mutación M %",
      stAttempt:"en cada intento", stEnd:"al final", stCi:"en CI",
      q5:"5 · ¿Qué nivel de calidad?", qlBasic:"Básico (recomendado)", qlBasicP:"Secretos, dependencias, tests que cubren lo cambiado y análisis estático. Todo en Docker.",
      qlStrict:"Estricto", qlStrictP:"Además: tests de mutación, complejidad y SAST. Más lento, más exigente.", qlNone:"Ninguno por ahora", qlNoneP:"Se puede activar después en Proyecto.",
      rQuality:"Calidad del código", rQualityP:"cobertura C % · mutación M %", covShort:"cobertura", mutShort:"mutación", rGaps:"Dónde se desvió", rGapsP:"spec → código S % · intención → spec I %"},
    en: {route:"Route", project:"Project", brief:"Brief", drafts:"Drafts", report:"Report",
      home:"Home", questions:"Questions", review:"Review", build:"Build", simple:"Simple", adv:"Advanced",
      routeTitle:"Your project, step by step", routeIntro:"From the brief to the app built and proven. Each step opens once the one before is ready; you can go back to any.",
      next:"Next", stepN:"step", open:"Open", allDone:"All done", allDoneP:"Everything is built and proven. Add to the brief whenever you want the app to grow.",
      nx_project:"Create your project", nxp_project:"Five questions and specgate prepares this folder.", go_project:"Start",
      nx_brief:"Write the brief", nxp_brief:"What the app has to do, in your words. The requirements come from it.", go_brief:"Open the brief",
      nx_drafts:"Draft the modules", nxp_drafts:"The assistant turns each module of the brief into requirements with examples.", go_drafts:"Draft",
      nx_questions:"Answer the questions", nxp_questions:"The assistant or a draft is waiting for your decision.", go_questions:"Answer",
      nx_review:"Review the drafts", nxp_review:"Read them as someone on your team would, then approve them or ask for changes.", go_review:"Review",
      nx_build:"Build what is ready", nxp_build:"The assistant codes, tests and saves each requirement.", go_build:"Build",
      nx_report:"See what is done", nxp_report:"What was built, how it was proven and what is missing.", go_report:"See the report",
      s_project_done:"Specgate is set up in this folder", s_project_todo:"Create the project in this folder",
      s_brief_done:"N modules · the checks pass", s_brief_open:"Write what the app has to do", s_brief_fix:"N modules · things to complete",
      s_drafts:"D of N modules drafted", s_questions_open:"N wait for your answer", s_questions_done:"Nothing to decide",
      s_review_open:"N drafts to read and approve", s_review_done:"Nothing to review",
      s_build:"R ready · B of T built", s_build_locked:"Opens once you approve a draft",
      s_report:"B of T built and proven", s_report_locked:"Appears with the first requirement built", s_locked:"Opens with the step before",
      repeat:"Steps 3 to 6 repeat per module: you can build one while another is drafted.",
      loading:"Loading…", mods:"modules", sOf:"of", modules:"Modules", ready:"done", qWait:"question", draft:"draft to review", reqs:"requirements", own_product:"product", own_architect:"architect", own_developer:"developer", layerDone:"written", layerTodo:"to write", layerApproved:"approved", layerWaits:"approvals", approveLayer:"Approve", byWhom:"by",
      newTitle:"Let's start a project", newIntro:"This folder is empty. Five questions and specgate prepares it: specification, tests and the assistant that codes.",
      q1:"1 · What is it called?", q2:"2 · What are you building?", q3:"3 · With which technology?", q4:"4 · Which assistant codes?",
      kWeb:"A website", kWebP:"Screens opened in the browser", kApi:"A service (API)", kApiP:"Data and rules for other apps", kMob:"A mobile app", kMobP:"For the phone",
      stNode:"Node.js + React (recommended for a website)", stJava:"Java + Spring Boot", stPy:"Python + FastAPI", stCustom:"Other… (you write it)",
      stackHint:"Decides the language and how it is tested.", customStack:"Technology", customTest:"How it is tested (command)",
      aClaude:"Claude Code", aCodex:"Codex CLI", aNone:"Choose it later", found:"found on this machine", notFound:"not found", liveTok:"live tokens and cost", stepsOnly:"steps only",
      create:"Create project", createP:"Creates the structure, an empty specification and a brief to fill.", creating:"Creating…",
      notEmpty:"This folder already holds files", notEmptyP:"To leave what is here untouched, adopt it from a terminal with this command and open studio again:",
      projReady:"Project ready", projReadyP:"Specgate is set up. These are the assistants it can use:", noProfiles:"No assistant is configured yet.",
      profilesHint:"They are added in .harness/profiles.yaml:", isDefault:"default", assistant:"Assistant",
      bTitleBrief:"The brief", bIntroBrief:"What the app has to do, in your words. The requirements come from it: what is not here is not built.",
      paste:"Have the client's text, an email or notes?", pasteP:"Paste it as it is: the assistant proposes product, users and modules. You correct it after.",
      pasteBtn:"Let the assistant structure it", replace:"Replace the current brief", fromScratch:"Start from scratch", fromScratchP:"An empty form: product, users and modules.",
      reading:"The assistant is reading the text…", stopIt:"Stop",
      product:"The product, in one sentence", who:"Who uses it", addActor:"+ Add another kind of user", actorName:"Kind of user",
      modsTitle:"Modules: the parts of the app", addModule:"+ Module", moduleName:"Module name", removeModule:"Remove this module",
      rules:"Rules", rulesP:"what always holds", examples:"Examples", examplesP:"a concrete situation, with names and numbers", doubts:"Open questions", doubtsP:"what you do not know yet; they become questions",
      addRule:"+ Rule", addExample:"+ Example", addDoubt:"+ Question", remove:"Remove",
      checksB:"Checks", checksBP:"Run each time you save", briefOk:"All in order", savedAt:"Saved", saving:"Saving…",
      toDrafts:"Next: draft the modules", formTab:"Form", mdTab:"Markdown", saveMd:"Save",
      dTitle:"Drafts", dIntro:"Each module of the brief becomes requirements with examples that can be tested. The assistant writes them; you review them before building.",
      noBrief:"Write the brief first.", nOfM:"N modules · D drafted", draftNext:"Draft the next one", draftIt:"Draft", retry:"Try again",
      stTodo:"Not drafted", stStopped:"Stopped without writing anything", stDrafting:"Drafting…", stReview:"N requirements · Q open questions", stApproved:"Approved · ready to build", stArchived:"Built",
      pRead:"Reads its part of the brief", pReqs:"Writes the requirements", pScn:"Writes the examples (Given / When / Then)", pNotes:"Notes assumptions and questions", pCheck:"Checks the draft",
      checkOf:"Check of M", toFix:"N things to resolve", lastRun:"Last run",
      qTitle:"Questions", qIntro:"What has to be decided before going on. Each answer is written down as a decision of the project.",
      fromAgent:"The assistant asked", fromDraft:"From the draft", fromProject:"From the project", blocks:"blocks", nothing:"nothing",
      yourAnswer:"Your answer", other:"Another answer…", answer:"Answer", optionsSeen:"Options specgate saw",
      toConfirm:"Answered, the spec still has to say it", inSpec:"The spec says it", noQuestions:"Nothing to decide right now.",
      rTitle:"Review", rIntro:"Read it as someone on your team would. If something is not what you wanted, ask for the change in your words.",
      checks:"Checks", allGood:"Ready to approve", approve:"Approve the draft", approveWhen:"It can be approved once nothing is pending.",
      ask:"Ask for a change", askBtn:"Ask for this change", notes:"Changes asked", noDrafts:"No draft to review.",
      given:"Given", when:"When", then:"Then", and:"And", waitsAnswer:"waits for an answer",
      bTitle:"Build", bIntro:"The assistant codes each requirement, tests it and only saves it when everything passes. You can close the page: it goes on.",
      whoCodes:"Who codes?", whoCodesP:"The assistants of this project. Your choice is remembered.", noEstimate:"No estimate yet", perRun:"per requirement",
      readyN:"Ready to build", minutes:"min approx.", perReq:"per requirement", buildN:"Build the N", build1:"Build this one", noAgent:"The assistant is not configured yet (agent in harness.config.yaml).",
      running:"Running", stP:"Codes", stT:"Tests", stQ:"Checks quality", stS:"Saves", watch:"Watch live", stop:"Stop after this one", stopAsked:"It will stop once this one ends.",
      doneToday:"Finished", nothingReady:"Nothing is ready to build.", started:"Started: ", savedGit:"the specification was committed to git (N files)", saved:"Saved.", err:"Could not: ",
      repTitle:"What is done", repIntro:"Each requirement was built and proven with the example that describes it. This report comes from the specification and the tests.",
      download:"Download the report", print:"Print / PDF", rBuilt:"Built", rExamples:"Examples proven", rGate:"Quality", rGateOk:"Passes", rGateBad:"Fails", rCost:"Assistant cost",
      byModule:"By module", colModule:"Module", colBuilt:"Built", colEx:"Examples", colState:"State", complete:"Complete", waitingN:"N wait for an answer", notBuilt:"Not built",
      whatDoes:"What the app does", provedBy:"Proven with: ", missing:"What is missing", missingNone:"Nothing.", waitsFor:"waits for the answer to: ", decisions:"Decisions and assumptions",
      decisionsP:"Q questions answered · A assumptions recorded.", nothingBuilt:"Nothing is built yet.",
      qualTitle:"Code quality", qualIntro:"Checks the assistant must pass on every requirement, all in Docker, no account needed.",
      qualNone:"No quality checks yet.", qualBasic:"Turn on the basic level", qualStrict:"Turn on the strict level",
      toBasic:"Switch to basic", toStrict:"Switch to strict", gates:"gates", advises:"advises", notRunnable:"cannot run here",
      dockerOn:"Docker answers", dockerOff:"Docker does not answer: start Docker Desktop", thresholds:"Thresholds: diff coverage C % · mutation M %",
      stAttempt:"every attempt", stEnd:"at the end", stCi:"in CI",
      q5:"5 · Which quality level?", qlBasic:"Basic (recommended)", qlBasicP:"Secrets, dependencies, tests that cover the change and static analysis. All in Docker.",
      qlStrict:"Strict", qlStrictP:"Also: mutation tests, complexity and SAST. Slower, stricter.", qlNone:"None for now", qlNoneP:"It can be turned on later in Project.",
      rQuality:"Code quality", rQualityP:"coverage C % · mutation M %", covShort:"coverage", mutShort:"mutation", rGaps:"Where it diverged", rGapsP:"spec → code S % · intent → spec I %"}
  };
  function load(k, d){ try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function save(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
  var STEPS = ["project", "brief", "drafts", "questions", "review", "build", "report"];
  var lang = load("sg-app-lang", "es"), mode = load("sg-app-mode", "simple"), view = load("sg-app-view", "route");
  if (view === "home") view = "route";
  var profile = load("sg-app-profile", "");
  var token = (document.querySelector('meta[name="specgate-token"]') || {}).content || "";
  var cache = {}, ui = {briefTab:"form", module:"", draftCheck:""};
  function t(k){ return (T[lang] && T[lang][k]) || T.es[k] || k; }
  function fill(k, map){ var s = t(k); Object.keys(map).forEach(function(x){ s = s.split(x).join(String(map[x])); }); return s; }
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
  function button(cls, text, on){ var b = el("button", cls, text); b.type = "button"; if (on) b.addEventListener("click", on); return b; }
  function dot(color){ var d = el("span", "dot"); d.style.background = color; d.setAttribute("aria-hidden", "true"); return d; }
  function cap(s){ s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  function flex(e, gap){ e.style.display = "flex"; e.style.flexWrap = "wrap"; e.style.alignItems = "center"; e.style.gap = (gap || 12) + "px"; return e; }
  function intro(m, h, p){ var s = el("section"); s.style.display = "flex"; s.style.flexDirection = "column"; s.style.gap = "6px"; s.append(el("h1", "", h), el("p", "muted", p)); m.appendChild(s); }
  var CHECK = "M5 12l5 5 9-10";
  function num(state, n){
    var s = el("span", "num " + state);
    if (state === "done") {
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("width", "12"); svg.setAttribute("height", "12"); svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "3"); svg.setAttribute("aria-hidden", "true");
      var p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", CHECK); svg.appendChild(p); s.appendChild(svg);
    } else s.textContent = String(n);
    return s;
  }
  function stepOf(k){ var r = cache.route; return r ? r.steps.filter(function(s){ return s.key === k; })[0] : null; }

  // ── The route's header: the seven steps (REQ-212) ──────────────────────
  function header(){
    var nav = $("nav"); nav.replaceChildren();
    var r = cache.route;
    var rb = button("", t("route"), function(){ go("route"); });
    if (view === "route") rb.setAttribute("aria-current", "page");
    rb.hidden = !!(r && !r.isProject);
    nav.append(rb, el("span", "sep"));
    STEPS.forEach(function(k, i){
      var s = stepOf(k) || {state:"locked", counts:{}};
      var b = button("", "", function(){ go(k); });
      b.append(num(s.state, i + 1), document.createTextNode(t(k)));
      if (view === k) b.setAttribute("aria-current", "page");
      if (s.state === "locked" && k !== "project") b.disabled = true;
      if (k === "questions" && s.counts.open) b.appendChild(el("span", "badge b-warn", String(s.counts.open)));
      if (k === "review" && s.counts.open) b.appendChild(el("span", "badge b-info", String(s.counts.open)));
      nav.appendChild(b);
    });
    $("mSimple").textContent = t("simple"); $("mAdv").textContent = t("adv");
    $("mSimple").setAttribute("aria-pressed", String(!adv())); $("mAdv").setAttribute("aria-pressed", String(adv()));
    $("lEs").setAttribute("aria-pressed", String(lang === "es")); $("lEn").setAttribute("aria-pressed", String(lang === "en"));
    document.documentElement.lang = lang;
  }

  function summary(s){
    var c = s.counts || {};
    if (s.key === "project") return s.state === "done" ? t("s_project_done") : t("s_project_todo");
    if (s.state === "locked") return s.key === "build" ? t("s_build_locked") : s.key === "report" ? t("s_report_locked") : t("s_locked");
    if (s.key === "brief") return s.state === "done" ? fill("s_brief_done", {N:c.modules}) : c.modules ? fill("s_brief_fix", {N:c.modules}) : t("s_brief_open");
    if (s.key === "drafts") return fill("s_drafts", {D:c.done, N:c.total});
    if (s.key === "questions") return c.open ? fill("s_questions_open", {N:c.open}) : t("s_questions_done");
    if (s.key === "review") return c.open ? fill("s_review_open", {N:c.open}) : t("s_review_done");
    if (s.key === "build") return fill("s_build", {R:c.ready, B:c.built, T:c.total});
    return fill("s_report", {B:c.built, T:c.total});
  }

  // ── Route (REQ-212) ─────────────────────────────────────────────────────
  function viewRoute(r, h){
    var m = $("view"); m.replaceChildren();
    intro(m, t("routeTitle"), t("routeIntro"));
    var n = el("section", "card next info"), tx = el("div", "t");
    if (r.next) {
      var at = STEPS.indexOf(r.next) + 1;
      tx.append(el("span", "eyebrow", t("next") + " · " + t("stepN") + " " + at), el("h2", "", t("nx_" + r.next)), el("p", "muted", t("nxp_" + r.next)));
      n.append(tx, button("go", t("go_" + r.next), function(){ go(r.next); }));
    } else { tx.append(el("h2", "", t("allDone")), el("p", "muted", t("allDoneP"))); n.appendChild(tx); }
    m.appendChild(n);
    var list = el("ol", "rows"); list.style.listStyle = "none"; list.style.margin = "0"; list.style.padding = "0";
    r.steps.forEach(function(s, i){
      var li = el("li", "line step" + (s.state === "current" ? " here" : ""));
      var g = el("div", "grow"); g.append(el("strong", "", (i + 1) + " · " + t(s.key)), el("span", "muted", summary(s)));
      if (s.key === "drafts" && s.counts.total) {
        var bar = el("div", "bar"); bar.style.maxWidth = "360px"; var a = el("i"); a.style.flex = String(s.counts.done); a.style.background = "var(--accent)";
        var rest = el("i"); rest.style.flex = String(Math.max(0, s.counts.total - s.counts.done)); bar.append(a, rest); g.appendChild(bar);
      }
      li.append(num(s.state, i + 1), g);
      if (s.state !== "locked") li.appendChild(button(s.state === "current" ? "go" : "ghost", t("open"), function(){ go(s.key); }));
      list.appendChild(li);
    });
    m.appendChild(list);
    m.appendChild(el("p", "small muted", t("repeat")));
    if (h && h.modules && h.modules.length) {
      var rows = el("section", "rows"), hd = el("div", "row"); hd.append(el("h2", "", t("modules"))); rows.appendChild(hd);
      h.modules.forEach(function(g){
        var row = el("div", "row"), bar = el("div", "bar");
        var a = el("i"); a.style.flex = String(g.done); a.style.background = "var(--pass)";
        var w = el("i"); w.style.flex = String(g.waiting); w.style.background = "#d4a72c";
        var rest = el("i"); rest.style.flex = String(Math.max(0, g.total - g.done - g.waiting));
        bar.append(a, w, rest);
        var label = g.draft ? t("draft") : g.waiting ? g.done + " " + t("sOf") + " " + g.total + " · " + g.waiting + " " + t("qWait") : g.done + " " + t("sOf") + " " + g.total + (g.done === g.total ? " · " + t("ready") : "");
        var lab = el("span", "small", label); lab.style.textAlign = "right"; lab.style.color = g.draft ? "var(--info)" : g.waiting ? "var(--warn)" : "var(--muted)";
        row.append(el("b", "", cap(g.name)), bar, lab); rows.appendChild(row);
      });
      m.appendChild(rows);
    }
    m.appendChild(cmd("specgate status · specgate propose --from-brief · specgate questions · specgate harness run"));
  }

  // ── Project (REQ-213) ───────────────────────────────────────────────────
  var np = {name:"", kind:"web", stack:"node-react", customStack:"", customTesting:"", agent:"", quality:"basic"};
  function viewProject(r, pr){
    var m = $("view"); m.replaceChildren(); m.className = "narrow";
    if (r.isProject) {
      intro(m, t("projReady"), t("projReadyP"));
      var c = el("section", "rows");
      if (!pr.profiles.length) c.appendChild(el("div", "empty", t("noProfiles")));
      pr.profiles.forEach(function(p){
        var l = el("div", "line"), g = el("div", "grow");
        g.append(el("strong", "", p.name), cmd(p.agent));
        l.appendChild(g);
        if (p.default) l.appendChild(el("span", "pill b-soft", t("isDefault")));
        l.appendChild(el("span", "pill " + (p.streams ? "b-pass" : "b-soft"), p.streams ? t("liveTok") : t("stepsOnly")));
        c.appendChild(l);
      });
      m.appendChild(c);
      var hint = el("div", "card"); hint.append(el("span", "small muted", t("profilesHint")), el("code", "cmd", ["profiles_version: 1", "profiles:", "  my-agent:", "    agent: " + String.fromCharCode(34) + "my-agent < {prompt_file}" + String.fromCharCode(34)].join(String.fromCharCode(10))));
      m.appendChild(hint);
      if (cache.quality) m.appendChild(qualityCard(cache.quality));
      return;
    }
    if (!r.empty) {
      intro(m, t("notEmpty"), t("notEmptyP"));
      var cc = el("section", "card"); cc.appendChild(el("code", "cmd", "specgate init")); m.appendChild(cc);
      return;
    }
    intro(m, t("newTitle"), t("newIntro"));
    var f = el("form", "form"); f.addEventListener("submit", function(e){ e.preventDefault(); });
    var f1 = el("div", "field"), name = el("input"); name.type = "text"; name.id = "np-name"; name.value = np.name;
    name.addEventListener("input", function(){ np.name = name.value; });
    var l1 = el("label", "", t("q1")); l1.htmlFor = "np-name"; f1.append(l1, name); f.appendChild(f1);
    var f2 = el("div", "field"); f2.appendChild(el("span", "lab", t("q2")));
    var ch = el("div", "choices");
    [["web", "kWeb", "kWebP"], ["api", "kApi", "kApiP"], ["mobile", "kMob", "kMobP"]].forEach(function(k){
      var l = el("label", "choice" + (np.kind === k[0] ? " on" : "")), rr = el("input"); rr.type = "radio"; rr.name = "np-kind"; rr.checked = np.kind === k[0];
      rr.addEventListener("change", function(){ np.kind = k[0]; render(); });
      var h = el("span", "h"); h.append(rr, document.createTextNode(t(k[1]))); l.append(h, el("span", "small muted", t(k[2]))); ch.appendChild(l);
    });
    f2.appendChild(ch); f.appendChild(f2);
    var f3 = el("div", "field"), sel = el("select"); sel.id = "np-stack";
    [["node-react", "stNode"], ["java-spring", "stJava"], ["python-fastapi", "stPy"], ["custom", "stCustom"]].forEach(function(o){ var op = el("option", "", t(o[1])); op.value = o[0]; op.selected = np.stack === o[0]; sel.appendChild(op); });
    sel.addEventListener("change", function(){ np.stack = sel.value; render(); });
    var l3 = el("label", "", t("q3")); l3.htmlFor = "np-stack"; f3.append(l3, sel, el("span", "small muted", t("stackHint")));
    if (np.stack === "custom") {
      var cs = el("input"); cs.type = "text"; cs.placeholder = t("customStack"); cs.value = np.customStack; cs.setAttribute("aria-label", t("customStack")); cs.addEventListener("input", function(){ np.customStack = cs.value; });
      var ct = el("input"); ct.type = "text"; ct.placeholder = t("customTest"); ct.value = np.customTesting; ct.setAttribute("aria-label", t("customTest")); ct.addEventListener("input", function(){ np.customTesting = ct.value; });
      f3.append(cs, ct);
    }
    f.appendChild(f3);
    var f4 = el("div", "field"); f4.appendChild(el("span", "lab", t("q4")));
    var inst = pr.installed || {};
    if (!np.agent) np.agent = inst.claude ? "claude" : inst.codex ? "codex" : "none";
    [["claude", "aClaude", inst.claude, true], ["codex", "aCodex", inst.codex, false], ["none", "aNone", null, false]].forEach(function(a){
      var l = el("label", "choice" + (np.agent === a[0] ? " on" : "")), rr = el("input"); rr.type = "radio"; rr.name = "np-agent"; rr.checked = np.agent === a[0];
      rr.addEventListener("change", function(){ np.agent = a[0]; render(); });
      var h = el("span", "h"); h.append(rr, document.createTextNode(t(a[1])));
      if (a[2] !== null) h.appendChild(el("span", "small muted", " · " + (a[2] ? t("found") : t("notFound"))));
      l.appendChild(h);
      if (a[0] !== "none") l.appendChild(el("span", "small " + (a[3] ? "" : "muted"), a[3] ? t("liveTok") : t("stepsOnly")));
      f4.appendChild(l);
    });
    f.appendChild(f4);
    var fq = el("div", "field"); fq.appendChild(el("span", "lab", t("q5")));
    var qch = el("div", "choices");
    [["basic", "qlBasic", "qlBasicP"], ["strict", "qlStrict", "qlStrictP"], ["none", "qlNone", "qlNoneP"]].forEach(function(k){
      var l = el("label", "choice" + (np.quality === k[0] ? " on" : "")), rr = el("input"); rr.type = "radio"; rr.name = "np-quality"; rr.checked = np.quality === k[0];
      rr.addEventListener("change", function(){ np.quality = k[0]; render(); });
      var h = el("span", "h"); h.append(rr, document.createTextNode(t(k[1]))); l.append(h, el("span", "small muted", t(k[2]))); qch.appendChild(l);
    });
    fq.appendChild(qch); f.appendChild(fq);
    var f5 = el("div", "field"); flex(f5); f5.style.justifyContent = "space-between";
    var m0 = msgEl();
    var b = button("go", t("create"), function(){
      b.disabled = true; m0.className = "msg"; m0.textContent = t("creating");
      post("api/project", {project:np}).then(function(res){
        b.disabled = false; say(m0, res);
        if (res.ok) { cache.route = null; go("brief"); }
      });
    });
    f5.append(el("span", "small muted", t("createP")), b);
    f.appendChild(f5);
    m.append(f, m0, cmd("specgate init --new · specgate harness init · specgate propose --from-brief --new-brief"));
  }

  // ── Quality: the checks configured, how each runs here (REQ-229) ──────────
  function qualityCard(q){
    var c = el("section", "card");
    c.append(el("h2", "", t("qualTitle")), el("span", "small muted", t("qualIntro")));
    var dk = el("span", "small"); dk.textContent = q.docker ? t("dockerOn") : t("dockerOff"); dk.style.color = q.docker ? "var(--pass)" : "var(--fail)";
    c.appendChild(dk);
    if (!q.checks.length) c.appendChild(el("span", "muted", t("qualNone")));
    else {
      var level = el("div"); flex(level, 8);
      if (q.level) level.appendChild(el("span", "pill b-info", q.level));
      level.appendChild(el("span", "small muted", fill("thresholds", {C: q.diffCoverage === null ? "—" : q.diffCoverage, M: q.mutationScore === null ? "—" : q.mutationScore})));
      c.appendChild(level);
      var rows = el("div", "rows");
      q.checks.forEach(function(k){
        var l = el("div", "line"), g = el("div", "grow");
        g.append(el("strong", "", k.name), el("span", "small muted", ({attempt:t("stAttempt"), end:t("stEnd"), ci:t("stCi")})[k.when] + " · " + (k.gate ? t("gates") : t("advises"))));
        l.appendChild(g);
        if (k.unavailable) { var u = el("span", "small", t("notRunnable")); u.style.color = "var(--fail)"; u.title = k.unavailable; l.appendChild(u); }
        else l.appendChild(el("span", "pill b-soft", k.runner));
        rows.appendChild(l);
      });
      c.appendChild(rows);
    }
    var acts = el("div"); flex(acts); var m0 = msgEl();
    var level0 = q.checks.length ? q.level : "";
    if (level0 !== "basic") acts.appendChild(button(level0 ? "ghost" : "go", level0 ? t("toBasic") : t("qualBasic"), function(){ post("api/quality/init", {level:"basic"}).then(function(r){ say(m0, r); if (r.ok) { cache.quality = r.view; render(); } }); }));
    if (level0 !== "strict") acts.appendChild(button("ghost", level0 ? t("toStrict") : t("qualStrict"), function(){ post("api/quality/init", {level:"strict"}).then(function(r){ say(m0, r); if (r.ok) { cache.quality = r.view; render(); } }); }));
    acts.appendChild(m0); c.append(acts, cmd("specgate quality init --level basic|strict · specgate quality doctor --pull · specgate quality baseline"));
    return c;
  }

  // ── Profiles: who works, picked once for Brief, Drafts and Build (REQ-211) ──
  function profileSelect(pr){
    var wrap = el("label", "small muted"); flex(wrap, 6); wrap.appendChild(document.createTextNode(t("assistant")));
    var s = el("select");
    (pr.profiles || []).forEach(function(p){
      var o = el("option", "", p.name + (p.default ? " · " + t("isDefault") : "")); o.value = p.name;
      o.selected = profile ? profile === p.name : p.default; s.appendChild(o);
    });
    s.addEventListener("change", function(){ profile = s.value; save("sg-app-profile", profile); render(); });
    if (!(pr.profiles || []).length) return el("span");
    wrap.appendChild(s); return wrap;
  }
  function chosenProfile(pr){
    var names = (pr.profiles || []).map(function(p){ return p.name; });
    if (profile && names.indexOf(profile) >= 0) return profile;
    var d = (pr.profiles || []).filter(function(p){ return p.default; })[0];
    return d ? d.name : "";
  }

  // ── Brief (REQ-214, REQ-215) ────────────────────────────────────────────
  var saveTimer = null;
  function saveForm(form, status){
    if (saveTimer) clearTimeout(saveTimer);
    status.className = "small muted"; status.textContent = t("saving");
    saveTimer = setTimeout(function(){
      post("api/brief", {form:{product:form.product, actors:form.actors, modules:form.modules}}).then(function(res){
        if (res.ok) { cache.brief.findings = res.brief.findings; cache.brief.markdown = res.brief.markdown; status.textContent = t("savedAt"); renderFindings(); }
        else { status.className = "msg err"; status.textContent = t("err") + (res.message || ""); }
      });
    }, 700);
  }
  var findingsBox = null, nextBtn = null;
  function renderFindings(){
    if (!findingsBox || !cache.brief) return;
    findingsBox.replaceChildren();
    // A draft is not opened over a brief with errors: the button says so first.
    if (nextBtn) nextBtn.disabled = cache.brief.findings.some(function(f){ return f.severity === "error"; });
    var shown = cache.brief.findings.filter(function(f){ return f.severity !== "info"; });
    if (!shown.length) { var ok = el("div", "check"); ok.append(dot("var(--pass)"), el("span", "", t("briefOk"))); findingsBox.appendChild(ok); }
    shown.forEach(function(f){ var x = el("div", "check"); x.append(dot(f.severity === "error" ? "var(--fail)" : "#d4a72c"), el("span", "small", f.message + (f.fix && adv() ? " — " + f.fix : ""))); findingsBox.appendChild(x); });
  }
  function pasteCard(b, pr, exists){
    var c = el("section", "card"), h = el("div"); flex(h);
    var g = el("div"); g.style.flex = "999 1 380px"; g.style.display = "flex"; g.style.flexDirection = "column"; g.style.gap = "2px";
    g.append(el("strong", "", t("paste")), el("span", "muted", t("pasteP")));
    h.append(g, profileSelect(pr)); c.appendChild(h);
    var ta = el("textarea"); ta.rows = exists ? 3 : 8; ta.setAttribute("aria-label", t("paste")); c.appendChild(ta);
    var row = el("div"); flex(row);
    var rep = null;
    if (exists) { var rl = el("label", "small"); rep = el("input"); rep.type = "checkbox"; rl.append(rep, document.createTextNode(" " + t("replace"))); row.appendChild(rl); }
    var m1 = msgEl();
    var btn = button(exists ? "ghost" : "go", t("pasteBtn"), function(){
      if (!ta.value.trim()) return;
      post("api/brief/fill", {text:ta.value, profile:chosenProfile(pr), replace: rep ? rep.checked : false}).then(function(res){ say(m1, res); if (res.ok) refresh(); });
    });
    btn.disabled = !(pr.profiles || []).length;
    row.append(btn, m1); c.append(row, cmd("specgate propose --from-brief --profile " + chosenProfile(pr)));
    return c;
  }
  function listEditor(box, form, mod, kind, label, hint, addLabel, status){
    var sec = el("div"); sec.style.display = "flex"; sec.style.flexDirection = "column"; sec.style.gap = "6px";
    var hd = el("span"); hd.append(el("strong", "", label), el("span", "muted", " · " + hint)); sec.appendChild(hd);
    mod[kind].forEach(function(text, i){
      var it = el("div", "item"), inp = el("input"); inp.type = "text"; inp.value = text; inp.setAttribute("aria-label", label + " " + (i + 1));
      inp.addEventListener("input", function(){ mod[kind][i] = inp.value; saveForm(form, status); });
      it.append(inp, button("x", "×", function(){ mod[kind].splice(i, 1); saveForm(form, status); render(); }));
      it.lastChild.setAttribute("aria-label", t("remove"));
      sec.appendChild(it);
    });
    sec.appendChild(button("link", addLabel, function(){
      mod[kind].push(""); render();
      var inputs = document.querySelectorAll(".cards input"); if (inputs.length) inputs[inputs.length - 1].focus();
    }));
    box.appendChild(sec);
  }
  function viewBrief(b, pr, job){
    var m = $("view"); m.replaceChildren();
    intro(m, t("bTitleBrief"), t("bIntroBrief"));
    if (job && job.kind === "brief") {
      var w = el("section", "card warn"), r0 = el("div"); flex(r0);
      r0.append(el("span", "pill b-warn", t("running")), el("strong", "", t("reading")), button("ghost", t("stopIt"), function(){ post("api/draft/stop", {}).then(refresh); }));
      w.appendChild(r0); if (cache.modules && cache.modules.step) w.appendChild(el("p", "small muted", cache.modules.step));
      m.appendChild(w); return;
    }
    if (!b.exists) {
      m.appendChild(pasteCard(b, pr, false));
      var sc = el("section", "card"); sc.append(el("strong", "", t("fromScratch")), el("span", "muted", t("fromScratchP")));
      sc.appendChild(button("ghost", t("fromScratch"), function(){
        post("api/brief", {form:{product:"", actors:[{name:"", surfaces:["web"]}], modules:[]}}).then(function(){ refresh(); });
      }));
      m.appendChild(sc); return;
    }
    m.appendChild(pasteCard(b, pr, true));
    if (adv()) {
      var tabs = el("div", "chips");
      [["form", "formTab"], ["md", "mdTab"]].forEach(function(x){ var c = button("chip", t(x[1]), function(){ ui.briefTab = x[0]; render(); }); c.setAttribute("aria-selected", String(ui.briefTab === x[0])); tabs.appendChild(c); });
      m.appendChild(tabs);
    }
    var split = el("div", "split"), main = el("div", "main"), aside = el("aside");
    var status = el("span", "small muted", "");
    if (adv() && ui.briefTab === "md") {
      var mdc = el("section", "card"), ta = el("textarea"); ta.rows = 28; ta.value = b.markdown; ta.style.fontFamily = "var(--mono)"; ta.style.fontSize = "12.5px"; ta.setAttribute("aria-label", "docs/brief.md");
      var m2 = msgEl();
      mdc.append(el("code", "cmd", "docs/brief.md"), ta, button("go", t("saveMd"), function(){
        post("api/brief", {markdown:ta.value}).then(function(res){ say(m2, res); if (res.ok) { cache.brief = res.brief; renderFindings(); } });
      }), m2);
      main.appendChild(mdc);
    } else {
      var form = b, f = el("form", "form"); f.addEventListener("submit", function(e){ e.preventDefault(); });
      var p1 = el("div", "field"), pi = el("input"); pi.type = "text"; pi.id = "bf-product"; pi.value = form.product;
      pi.addEventListener("input", function(){ form.product = pi.value; saveForm(form, status); });
      var lp = el("label", "", t("product")); lp.htmlFor = "bf-product"; p1.append(lp, pi); f.appendChild(p1);
      var p2 = el("div", "field"); p2.appendChild(el("span", "lab", t("who")));
      if (!form.actors.length) form.actors.push({name:"", surfaces:["web"]});
      form.actors.forEach(function(a, i){
        var row = el("div", "opt"); flex(row, 10);
        var n = el("input"); n.type = "text"; n.value = a.name; n.style.flex = "999 1 160px"; n.style.width = "auto"; n.setAttribute("aria-label", t("actorName"));
        n.addEventListener("input", function(){ a.name = n.value; saveForm(form, status); });
        row.appendChild(n);
        ["web", "api", "mobile"].forEach(function(sf){
          var l = el("label", "small"), cb = el("input"); cb.type = "checkbox"; cb.checked = a.surfaces.indexOf(sf) >= 0;
          cb.addEventListener("change", function(){ if (cb.checked) a.surfaces.push(sf); else a.surfaces = a.surfaces.filter(function(x){ return x !== sf; }); saveForm(form, status); });
          l.append(cb, document.createTextNode(" " + (sf === "api" ? "API" : cap(sf)))); row.appendChild(l);
        });
        var x = button("x", "×", function(){ form.actors.splice(i, 1); saveForm(form, status); render(); }); x.setAttribute("aria-label", t("remove"));
        row.appendChild(x); p2.appendChild(row);
      });
      p2.appendChild(button("link", t("addActor"), function(){ form.actors.push({name:"", surfaces:["web"]}); render(); }));
      f.appendChild(p2);
      var p3 = el("div", "field"); p3.appendChild(el("span", "lab", t("modsTitle")));
      var chips = el("div", "chips"); chips.setAttribute("role", "tablist");
      if (!ui.module || !form.modules.some(function(x){ return x.key === ui.module; })) ui.module = form.modules.length ? form.modules[0].key : "";
      form.modules.forEach(function(mo){
        var c = button("chip", cap(mo.name || mo.key), function(){ ui.module = mo.key; render(); }); c.setAttribute("role", "tab"); c.setAttribute("aria-selected", String(ui.module === mo.key));
        var issue = b.findings.some(function(fd){ return fd.severity !== "info" && fd.message.indexOf(mo.key) >= 0; });
        if (issue) c.appendChild(el("span", "", " ·  !"));
        chips.appendChild(c);
      });
      var addWrap = el("span"); flex(addWrap, 6);
      var newName = el("input"); newName.type = "text"; newName.placeholder = t("moduleName"); newName.style.width = "180px"; newName.setAttribute("aria-label", t("moduleName"));
      addWrap.append(newName, button("chip", t("addModule"), function(){
        var nm = newName.value.trim(); if (!nm) { newName.focus(); return; }
        var key = nm.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!key) return;
        form.modules.push({key:key, name:nm, prose:"", rules:[""], examples:[], questions:[]}); ui.module = key; saveForm(form, status); render();
      }));
      chips.appendChild(addWrap);
      p3.appendChild(chips);
      var mod = form.modules.filter(function(x){ return x.key === ui.module; })[0];
      if (mod) {
        var box = el("div", "cards");
        listEditor(box, form, mod, "rules", t("rules"), t("rulesP"), t("addRule"), status);
        listEditor(box, form, mod, "examples", t("examples"), t("examplesP"), t("addExample"), status);
        listEditor(box, form, mod, "questions", t("doubts"), t("doubtsP"), t("addDoubt"), status);
        var rm = button("link danger", t("removeModule"), function(){ form.modules = form.modules.filter(function(x){ return x !== mod; }); ui.module = ""; saveForm(form, status); render(); });
        box.appendChild(rm);
        p3.appendChild(box);
      }
      f.appendChild(p3);
      main.appendChild(f);
    }
    var ch = el("section", "card"); ch.append(el("strong", "", t("checksB")), el("span", "small muted", t("checksBP")));
    findingsBox = el("div"); findingsBox.style.display = "flex"; findingsBox.style.flexDirection = "column"; findingsBox.style.gap = "8px";
    ch.appendChild(findingsBox); aside.appendChild(ch);
    nextBtn = button("go", t("toDrafts"), function(){ go("drafts"); });
    var nx = el("section", "card"); nx.append(status, nextBtn, cmd("specgate propose --from-brief --check"));
    aside.appendChild(nx);
    split.append(main, aside); m.appendChild(split);
    renderFindings();
  }

  // ── Drafts (REQ-216) ────────────────────────────────────────────────────
  function viewDrafts(d, pr){
    var m = $("view"); m.replaceChildren();
    var top = el("section"); flex(top); top.style.alignItems = "flex-end"; top.style.justifyContent = "space-between";
    var g = el("div"); g.style.flex = "999 1 480px"; g.style.display = "flex"; g.style.flexDirection = "column"; g.style.gap = "6px";
    g.append(el("h1", "", t("dTitle")), el("p", "muted", t("dIntro"))); top.append(g, profileSelect(pr)); m.appendChild(top);
    if (!d.brief) { m.appendChild(el("div", "card empty", t("noBrief"))); return; }
    var drafted = d.modules.filter(function(x){ return x.stage !== "todo" && x.stage !== "stopped" && x.stage !== "drafting"; }).length;
    var sec = el("section", "rows"), hd = el("div", "line"); hd.style.justifyContent = "space-between";
    hd.appendChild(el("h2", "", fill("nOfM", {N:d.modules.length, D:drafted})));
    var nextMod = d.modules.filter(function(x){ return x.stage === "todo" || x.stage === "stopped"; })[0];
    var m0 = msgEl();
    function start(key){ post("api/draft", {module:key, profile:chosenProfile(pr)}).then(function(res){ m0.className = "msg " + (res.ok ? "ok" : "err"); m0.textContent = res.ok ? "" : t("err") + res.message; refresh(); }); }
    if (nextMod) { var nb = button("go", t("draftNext"), function(){ start(nextMod.key); }); nb.disabled = !!d.job; hd.appendChild(nb); }
    sec.appendChild(hd);
    d.modules.forEach(function(x){
      var line = el("div", "line" + (x.stage === "drafting" ? " here" : ""));
      var name = el("span", "name", cap(x.key)), state = el("div", "grow");
      if (x.stage === "todo") state.appendChild(el("span", "muted", t("stTodo")));
      else if (x.stage === "stopped") state.appendChild(el("span", "", t("stStopped")));
      else if (x.stage === "drafting") {
        state.appendChild(el("strong", "", t("stDrafting") + " " + Math.max(1, Math.round(x.progress.seconds / 60)) + " min"));
        var ol = el("ol", "progress"), p = x.progress;
        var items = [[t("pRead"), true], [t("pReqs") + (p.requirements ? " (" + p.requirements + ")" : ""), p.requirements > 0], [t("pScn") + (p.scenarios ? " (" + p.scenarios + ")" : ""), p.scenarios > 0], [t("pNotes"), p.notes], [t("pCheck"), false]];
        var nowAt = -1; items.forEach(function(it, i){ if (nowAt < 0 && !it[1]) nowAt = i; });
        items.forEach(function(it, i){ ol.appendChild(el("li", it[1] ? "ok" : i === nowAt ? "now" : "todo", (it[1] ? "✓ " : i === nowAt ? "● " : "○ ") + it[0])); });
        state.appendChild(ol);
        if (p.lastStep) state.appendChild(el("span", "small muted", p.lastStep));
      } else if (x.stage === "review") state.appendChild(el("span", "", fill("stReview", {N:x.requirements, Q:x.questions})));
      else state.appendChild(el("span", "muted", x.requirements + " " + t("reqs")));
      line.append(name, state);
      if (x.stage === "todo" || x.stage === "stopped") { var b0 = button("ghost", x.stage === "stopped" ? t("retry") : t("draftIt"), function(){ start(x.key); }); b0.disabled = !!d.job; line.appendChild(b0); }
      else if (x.stage === "drafting") line.appendChild(button("ghost danger", t("stopIt"), function(){ post("api/draft/stop", {}).then(refresh); }));
      else if (x.stage === "review") line.appendChild(button("ghost", t("review"), function(){ go("review"); }));
      else if (x.stage === "approved") line.appendChild(el("span", "pill b-pass", t("stApproved")));
      else line.appendChild(el("span", "pill b-soft", t("stArchived")));
      sec.appendChild(line);
    });
    sec.appendChild(m0);
    m.appendChild(sec);
    d.modules.filter(function(x){ return x.stage === "review" && x.findings.length; }).forEach(function(x){
      var c = el("section", "card"), h = el("div"); flex(h); h.style.justifyContent = "space-between";
      h.append(el("h2", "", fill("checkOf", {M:"«" + cap(x.key) + "»"})), el("span", "pill b-warn", fill("toFix", {N:x.findings.length})));
      c.appendChild(h);
      x.findings.forEach(function(f){ var r = el("div", "check"); r.append(dot(f.severity === "error" ? "var(--fail)" : "#d4a72c"), el("span", "small", f.message)); c.appendChild(r); });
      m.appendChild(c);
    });
    if (adv() && d.lastJob && d.lastJob.tail) { var lg = el("div", "log"); lg.textContent = t("lastRun") + " · " + (d.lastJob.module || d.lastJob.kind) + String.fromCharCode(10) + d.lastJob.tail; m.appendChild(lg); }
    m.appendChild(cmd("specgate propose --from-brief " + (nextMod ? nextMod.key : "<module>") + " --profile " + chosenProfile(pr)));
  }

  // ── Questions (REQ-210) ─────────────────────────────────────────────────
  function viewQuestions(q){
    var m = $("view"); m.replaceChildren();
    intro(m, t("qTitle"), t("qIntro"));
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
      var row = el("div"); flex(row);
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
        var r = el("div"); flex(r);
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
    intro(m, t("rTitle"), t("rIntro"));
    if (!list.length) { m.appendChild(el("div", "card empty", t("noDrafts"))); return; }
    list.forEach(function(d){
      var split = el("section", "split"), main = el("div", "main"), aside = el("aside");
      main.appendChild(el("h2", "", cap(d.module) + " · " + d.requirements.length + " " + t("reqs")));
      // REQ-289: the change's layers, each with its owner (ADR-0042); REQ-319:
      // who approved each, how many it needs, and a button for the layer the viewer owns.
      if (d.layers && d.layers.length) {
        var lys = el("div", "small muted");
        d.layers.forEach(function(l){
          var row = el("div"), mL = msgEl();
          var who = (l.approvals || []).map(function(a){ return a.by.name || a.by.email; }).join(", ");
          var state = !l.written ? t("layerTodo")
            : l.approved ? t("layerApproved") + (who ? " " + t("byWhom") + " " + who : "")
            : t("layerDone") + " · " + (l.approvals || []).length + "/" + (l.quorum || 1) + " " + t("layerWaits");
          row.appendChild(el("span", "", l.file + " · " + t("own_" + l.owner) + " · " + state));
          if (l.mine && l.written && !l.approved) {
            row.append(" ", button("ghost", t("approveLayer"), function(){
              post("api/approve", {change:d.change, layer:l.id}).then(function(res){ say(mL, res); if (res.ok) refresh(); });
            }), mL);
          }
          lys.appendChild(row);
        });
        main.appendChild(lys);
      }
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

  // ── Build (REQ-208, REQ-209, REQ-211) ───────────────────────────────────
  var picked = {};
  // REQ-275: Programa until the gate starts, Prueba for the specification,
  // architecture and tests, Revisa la calidad for a quality check, Guarda at the merge.
  function stageOf(r){
    var gates = r.steps.filter(function(e){ return e.type === "gate" || e.type === "gate-start" || e.type === "merge"; });
    if (r.steps.some(function(e){ return e.type === "merge"; })) return 3;
    if (gates.some(function(e){ return String(e.stage || "").indexOf("quality:") === 0; })) return 2;
    if (gates.length) return 1;
    return 0;
  }
  function viewBuild(b, live, pr){
    var m = $("view"); m.replaceChildren();
    intro(m, t("bTitle"), t("bIntro"));
    var cur = (live.requirements || []).filter(function(r){ return r.state === "running"; })[0];
    if (cur) {
      var rc = el("section", "card warn");
      var h = el("div"); flex(h, 10);
      h.append(el("span", "pill b-warn", t("running")), el("b", "", cur.title || cur.req), el("span", "small muted", Math.round(Math.max(0, Date.now() / 1000 - cur.started) / 60) + " min"));
      rc.appendChild(h);
      var stg = el("div", "stages"), at = stageOf(cur);
      [t("stP"), t("stT"), t("stQ"), t("stS")].forEach(function(name, i){
        var d = el("div"), bar = el("i"); if (i < at) bar.style.background = "var(--pass)"; if (i === at) bar.className = "run";
        d.append(bar, el("span", i === at ? "" : "muted", name)); stg.appendChild(d);
      });
      rc.appendChild(stg);
      if (cur.running) rc.appendChild(el("p", "small muted mono", cur.running.stage + " · " + Math.max(0, Math.round((Date.now() / 1000 - cur.running.since) / 60)) + " min"));
      var said = cur.steps.filter(function(e){ return e.type === "message"; })[0];
      if (said) { var p0 = el("p", "small", String(said.text || "")); p0.style.padding = "10px 12px"; p0.style.background = "var(--soft)"; p0.style.borderRadius = "6px"; rc.appendChild(p0); }
      var acts = el("div"); flex(acts);
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
    var who = chosenProfile(pr);
    if ((pr.profiles || []).length) {
      var ps = el("section", "card");
      ps.append(el("h2", "", t("whoCodes")), el("span", "small muted", t("whoCodesP")));
      var grid = el("div", "choices"); grid.setAttribute("role", "radiogroup"); grid.setAttribute("aria-label", t("whoCodes"));
      pr.profiles.forEach(function(p){
        var l = el("label", "choice" + (who === p.name ? " on" : "")), rr = el("input"); rr.type = "radio"; rr.name = "profile"; rr.checked = who === p.name;
        rr.addEventListener("change", function(){ profile = p.name; save("sg-app-profile", profile); render(); });
        var hh = el("span", "h"); hh.append(rr, document.createTextNode(p.name)); l.appendChild(hh);
        var cost = p.costHint !== null ? "≈ $" + Number(p.costHint).toFixed(2) + " " + t("perRun") : (p.default && b.estimate.costPerRequirement !== null ? "≈ $" + b.estimate.costPerRequirement.toFixed(2) + " " + t("perRun") : t("noEstimate"));
        l.appendChild(el("span", "small muted", cost));
        var tags = el("span"); flex(tags, 6);
        if (p.default) tags.appendChild(el("span", "pill b-soft", t("isDefault")));
        tags.appendChild(el("span", "pill " + (p.streams ? "b-pass" : "b-soft"), p.streams ? t("liveTok") : t("stepsOnly")));
        l.appendChild(tags); l.appendChild(cmd(p.agent));
        grid.appendChild(l);
      });
      ps.appendChild(grid); m.appendChild(ps);
    }
    var sec = el("section", "rows");
    var hd = el("div"); flex(hd); hd.style.justifyContent = "space-between"; hd.style.padding = "16px 20px"; hd.style.borderBottom = "1px solid var(--line)";
    var info = el("div"); info.append(el("h2", "", t("readyN") + " · " + b.ready.length));
    var est = [];
    if (b.estimate.minutes) est.push(b.estimate.minutes + " " + t("minutes"));
    if (b.estimate.costPerRequirement !== null) est.push("$" + b.estimate.costPerRequirement.toFixed(2) + " " + t("perReq"));
    if (est.length) info.appendChild(el("span", "small muted", est.join(" · ")));
    var m5 = msgEl();
    var chosen = function(){ return b.ready.filter(function(r){ return picked[r.id] !== false; }).map(function(r){ return r.id; }); };
    var label = function(){ var n = chosen().length; return n === 1 ? t("build1") : t("buildN").split("N").join(String(n)); };
    var hasAgent = b.agent || !!who;
    var go0 = button("go", label(), function(){
      post("api/build", {reqs:chosen(), profile:who}).then(function(res){ m5.className = "msg " + (res.ok ? "ok" : "err"); m5.textContent = res.ok ? t("started") + res.started.join(", ") + (res.saved && res.saved.length ? " · " + fill("savedGit", {N:res.saved.length}) : "") : t("err") + res.message; setTimeout(refresh, 1500); });
    });
    go0.disabled = !b.ready.length || !hasAgent || !!b.running;
    hd.append(info, go0); sec.appendChild(hd);
    if (!hasAgent) { var na = el("div", "msg err", t("noAgent")); na.style.padding = "10px 20px"; sec.appendChild(na); }
    m5.style.padding = "0 20px"; sec.appendChild(m5);
    if (!b.ready.length) sec.appendChild(el("div", "empty", t("nothingReady")));
    b.ready.forEach(function(r){
      var l = el("label", "pick"), cb = el("input"); cb.type = "checkbox"; cb.checked = picked[r.id] !== false;
      cb.addEventListener("change", function(){ picked[r.id] = cb.checked; go0.textContent = label(); go0.disabled = !chosen().length || !hasAgent || !!b.running; });
      var name = el("span", "pname"); name.append(cb, document.createTextNode(" " + r.title));
      var mod = el("span", "small muted", r.module); mod.style.textAlign = "right";
      l.append(name, el("span", "small muted", adv() ? r.id : ""), mod); sec.appendChild(l);
    });
    sec.appendChild(cmd("specgate harness run --chain " + chosen().map(function(x){ return "--req " + x; }).join(" ") + (who ? " --profile " + who : "")));
    m.appendChild(sec);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var done = (live.requirements || []).filter(function(r){ return r.state === "pass" && r.updated * 1000 >= today.getTime(); }).slice(0, 6);
    if (done.length) {
      var fin = el("section", "card"); fin.appendChild(el("h2", "", t("doneToday")));
      done.forEach(function(r){ var x = el("div", "check"); x.append(dot("var(--pass)"), el("span", "", r.title || r.req), el("span", "small muted", " " + Math.round(r.elapsed / 60) + " min")); fin.appendChild(x); });
      m.appendChild(fin);
    }
  }

  // ── Report (REQ-217) ────────────────────────────────────────────────────
  // REQ-304: the two gaps, as harness report computes them.
  function pctNum(v){ return v === null || v === undefined ? "—" : String(Math.round(v * 100)); }
  function pctOrDash(v){ return v === null || v === undefined ? "—" : Math.round(v * 100) + "%"; }
  function viewReport(r){
    var m = $("view"); m.replaceChildren();
    var top = el("section"); flex(top); top.style.alignItems = "flex-end"; top.style.justifyContent = "space-between";
    var g = el("div"); g.style.flex = "999 1 480px"; g.style.display = "flex"; g.style.flexDirection = "column"; g.style.gap = "6px";
    g.append(el("span", "small muted", r.date), el("h1", "", t("repTitle")), el("p", "muted", t("repIntro")));
    var acts = el("div"); flex(acts, 8);
    var pdf = el("a", "ghost", t("print")); pdf.href = "report"; pdf.target = "_blank"; pdf.rel = "noopener"; pdf.style.display = "inline-flex"; pdf.style.alignItems = "center";
    var dl = el("a", "go", t("download")); dl.href = "report.html"; dl.style.display = "inline-flex"; dl.style.alignItems = "center"; dl.style.color = "#fff";
    acts.append(pdf, dl); top.append(g, acts); m.appendChild(top);
    var s = el("section", "stats");
    [[t("rBuilt"), r.built + " " + t("sOf") + " " + r.total, t("reqs"), ""], [t("rExamples"), String(r.scenarios), "", "var(--pass)"], [t("rGate"), r.gate.ok ? t("rGateOk") : t("rGateBad"), r.gate.findings[0] || "", r.gate.ok ? "var(--pass)" : "var(--fail)"], [t("rCost"), r.cost === null ? "—" : "$" + r.cost.toFixed(2), r.minutes + " min", ""]].concat(r.quality && r.quality.measured ? [[t("rQuality"), (r.quality.coverage === null ? "—" : r.quality.coverage + "%"), fill("rQualityP", {C: r.quality.coverage === null ? "—" : r.quality.coverage, M: r.quality.mutation === null ? "—" : r.quality.mutation}), "var(--pass)"]] : []).concat(r.gaps ? [[t("rGaps"), pctOrDash(r.gaps.specImpl) + " · " + pctOrDash(r.gaps.intentSpec), fill("rGapsP", {S: pctNum(r.gaps.specImpl), I: pctNum(r.gaps.intentSpec)}), ""]] : []).forEach(function(x){
      var d = el("div", "stat"), b = el("b", "", x[1]); if (x[3]) b.style.color = x[3]; d.append(el("span", "muted small", x[0]), b); if (x[2]) d.appendChild(el("span", "small muted", x[2])); s.appendChild(d);
    });
    m.appendChild(s);
    var tb = el("section", "rows scroll"), hd = el("div", "line"); hd.appendChild(el("h2", "", t("byModule"))); tb.appendChild(hd);
    var table = el("table", "table"), thead = el("tr");
    [t("colModule"), t("colBuilt"), t("colEx"), t("colState")].forEach(function(x){ thead.appendChild(el("th", "", x)); });
    table.appendChild(thead);
    r.modules.forEach(function(mo){
      var tr = el("tr"), st = mo.waiting ? fill("waitingN", {N:mo.waiting}) : mo.built === mo.total ? t("complete") : mo.built ? mo.built + " " + t("sOf") + " " + mo.total : t("notBuilt");
      var sc = el("td", "", st); sc.style.color = mo.waiting ? "var(--warn)" : mo.built === mo.total ? "var(--pass)" : "var(--muted)";
      tr.append(el("td", "", cap(mo.name)), el("td", "", mo.built + " " + t("sOf") + " " + mo.total), el("td", "", String(mo.scenarios)), sc);
      tr.firstChild.style.fontWeight = "600"; table.appendChild(tr);
    });
    tb.appendChild(table); m.appendChild(tb);
    var mods = r.modules.filter(function(mo){ return mo.built; }).map(function(mo){ return mo.name; });
    if (!ui.repModule || mods.indexOf(ui.repModule) < 0) ui.repModule = mods[0] || "";
    var wd = el("section", "rows"), wh = el("div", "line"); wh.style.justifyContent = "space-between";
    wh.appendChild(el("h2", "", t("whatDoes")));
    var chips = el("div", "chips");
    mods.forEach(function(name){ var c = button("chip", cap(name), function(){ ui.repModule = name; render(); }); c.setAttribute("aria-selected", String(ui.repModule === name)); chips.appendChild(c); });
    wh.appendChild(chips); wd.appendChild(wh);
    if (!mods.length) wd.appendChild(el("div", "empty", t("nothingBuilt")));
    r.delivered.filter(function(d){ return d.module === ui.repModule; }).forEach(function(d){
      var line = el("div", "line"), gg = el("div", "grow");
      gg.appendChild(el("strong", "", d.title));
      d.scenarios.forEach(function(sc){ var sp = el("span", "small muted", t("provedBy") + (sc.title || sc.id)); sp.appendChild(el("span", "", " · ✓")); sp.lastChild.style.color = "var(--pass)"; gg.appendChild(sp); });
      if (d.quality && (d.quality.coverage !== null || d.quality.mutation !== null)) {
        var qs = [];
        if (d.quality.coverage !== null) qs.push(t("covShort") + " " + d.quality.coverage + "%");
        if (d.quality.mutation !== null) qs.push(t("mutShort") + " " + d.quality.mutation + "%");
        gg.appendChild(el("span", "small", qs.join(" · ")));
      }
      line.append(gg, el("span", "small muted", adv() ? d.id : "")); wd.appendChild(line);
    });
    m.appendChild(wd);
    var two = el("div", "stats");
    var ms = el("section", "card"); ms.appendChild(el("h2", "", t("missing")));
    if (!r.missing.length) ms.appendChild(el("span", "muted", t("missingNone")));
    r.missing.slice(0, 12).forEach(function(x){
      var row = el("div", "check"); row.append(dot(x.why === "waiting" ? "#d4a72c" : "var(--line)"), el("span", "small", cap(x.module) + " · " + x.title + (x.why === "waiting" ? " — " + t("waitsFor") + x.question : "")));
      ms.appendChild(row);
    });
    if (r.missing.some(function(x){ return x.why === "waiting"; })) ms.appendChild(button("link", t("go_questions"), function(){ go("questions"); }));
    var dc = el("section", "card"); dc.append(el("h2", "", t("decisions")), el("span", "", fill("decisionsP", {Q:r.answered, A:r.assumptions})));
    two.append(ms, dc); m.appendChild(two);
    m.appendChild(cmd("specgate report · specgate matrix · specgate check"));
  }

  function render(){
    header();
    var r = cache.route, m = $("view"); m.className = "";
    if (!r) { m.replaceChildren(el("div", "card empty", t("loading"))); return; }
    if (!r.isProject && view !== "project") view = "project";
    var pr = cache.profiles || {profiles:[], installed:{}};
    if (view === "route") viewRoute(r, cache.home);
    else if (view === "project" && cache.profiles) viewProject(r, pr);
    else if (view === "brief" && cache.brief) viewBrief(cache.brief, pr, cache.modules ? cache.modules.job : null);
    else if (view === "drafts" && cache.modules) viewDrafts(cache.modules, pr);
    else if (view === "questions" && cache.questions) viewQuestions(cache.questions);
    else if (view === "review" && cache.drafts) viewReview(cache.drafts);
    else if (view === "build" && cache.build) viewBuild(cache.build, cache.live || {}, pr);
    else if (view === "report" && cache.report) viewReport(cache.report);
    else m.replaceChildren(el("div", "card empty", t("loading")));
  }
  function refresh(){
    var reads = [get("api/route").then(function(x){ cache.route = x; })];
    var isProject = !cache.route || cache.route.isProject;
    if (!cache.profiles || view === "project") reads.push(get("api/profiles").then(function(x){ cache.profiles = x; }));
    if (view === "project" && isProject) reads.push(get("api/quality").then(function(x){ cache.quality = x; }));
    if (view === "route" && isProject) reads.push(get("api/home").then(function(x){ cache.home = x; }).catch(function(){}));
    if (view === "brief") { reads.push(get("api/modules").then(function(x){ cache.modules = x; })); if (!cache.brief || (cache.modules && cache.modules.job)) reads.push(get("api/brief").then(function(x){ cache.brief = x; })); }
    if (view === "drafts") reads.push(get("api/modules").then(function(x){ cache.modules = x; }));
    if (view === "questions") reads.push(get("api/questions").then(function(x){ cache.questions = x; }));
    if (view === "review") reads.push(get("api/drafts").then(function(x){ cache.drafts = x; }));
    if (view === "build") { reads.push(get("api/build").then(function(x){ cache.build = x; })); reads.push(get("live.json").then(function(x){ cache.live = x; })); }
    if (view === "report") reads.push(get("api/report").then(function(x){ cache.report = x; }));
    Promise.all(reads).then(render).catch(function(){});
  }
  function go(v){
    var k = {brief:"brief", drafts:"modules", questions:"questions", review:"drafts", build:"build", report:"report"}[v];
    if (k) cache[k] = null;
    view = v; save("sg-app-view", v); render(); refresh();
  }
  $("mSimple").addEventListener("click", function(){ mode = "simple"; save("sg-app-mode", mode); render(); });
  $("mAdv").addEventListener("click", function(){ mode = "adv"; save("sg-app-mode", mode); render(); });
  $("lEs").addEventListener("click", function(){ lang = "es"; save("sg-app-lang", lang); render(); });
  $("lEn").addEventListener("click", function(){ lang = "en"; save("sg-app-lang", lang); render(); });
  render();
  refresh();
  // The views that change on their own: the route, a build, a draft being written.
  setInterval(function(){
    var busy = cache.modules && cache.modules.job;
    if (view === "route" || view === "build" || view === "drafts" || (view === "brief" && busy)) refresh();
  }, 5000);
})();
</script>
</body></html>`;
}
