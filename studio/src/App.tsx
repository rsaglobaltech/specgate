/** The studio's app (REQ-204): the shell, the section the address names, the viewer's preferences. */
import { useEffect, useRef, useState } from "preact/hooks";
import { Shell } from "./ui/Shell";
import { sectionOf, type Section } from "./core/routes";
import { readPrefs, writePrefs, type Prefs } from "./core/prefs";
import { t, type Key } from "./core/i18n";
import { useRead } from "./core/useRead";
import type { HomeData, RouteData } from "./core/route";
import { Home } from "./sections/Home";
import { Questions, type QuestionsData } from "./sections/Questions";
import { Changes, type ChangeView, type DraftView, type ModulesData } from "./sections/Changes";
import { useAction } from "./core/useAction";
import { GateCard } from "./ui/Gate";
import {
  Build,
  type AgentKind,
  type BuildData,
  type LiveRequirement,
  type Profile,
} from "./sections/Build";
import { Brief, type BriefData, type Saved } from "./sections/Brief";
import { Report, type ReportData } from "./sections/Report";
import { Settings, type QualityView } from "./sections/Settings";
import { Live, type MatrixRow, type RequirementDetail } from "./sections/Live";
import { useLive } from "./core/useLive";
import { Notices, type Notice } from "./ui/Notices";
import { Offline, SectionError, Skeleton } from "./ui/States";
import { useConnection } from "./core/useConnection";
import { get, post } from "./core/api";
import type { Result } from "./ui/Busy";

/** What a write did, said in a notice once it is done (REQ-434). */
const DONE: Record<string, Key> = {
  "/api/answer": "didAnswer",
  "/api/approve": "didApprove",
  "/api/note": "didNote",
  "/api/build": "didBuild",
  "/api/stop": "didStop",
  "/api/project": "didProject",
  "/api/brief/fill": "didFill",
  "/api/draft": "didDraft",
  "/api/draft/stop": "didStop",
  "/api/agent": "didAgent",
};

/** The change an answer goes to: none for the project's own questions. */
const changeOf = (change: string): string | undefined =>
  change === "project" ? undefined : change;

const storage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Apply the theme to the page: the system's unless one was chosen. */
function applyTheme(p: Prefs): void {
  const root = document.documentElement;
  if (p.theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", p.theme);
  root.lang = p.lang;
}

export function App() {
  const project =
    document.querySelector('meta[name="specgate-project"]')?.getAttribute("content") || "";
  // `/live` serves this page opened on Live (REQ-433): that becomes its address.
  const opensOn =
    document.querySelector('meta[name="specgate-section"]')?.getAttribute("content") || "";
  const [section, setSection] = useState<Section>(sectionOf(location.hash, opensOn));
  useEffect(() => {
    if (!location.hash && opensOn) history.replaceState(null, "", `#/${sectionOf("", opensOn)}`);
  }, []);
  const [prefs, setPrefs] = useState<Prefs>(readPrefs(storage()));
  useEffect(() => {
    const on = () => setSection(sectionOf(location.hash, opensOn));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => applyTheme(prefs), [prefs]);
  // A new section takes the focus to its title, so a screen reader says where it is (REQ-435).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let tries = 0;
    const timer = setInterval(() => {
      const h1 = document.querySelector<HTMLElement>("#main h1");
      if (h1 || ++tries > 20) {
        clearInterval(timer);
        const target = h1 || document.getElementById("main");
        if (h1) h1.tabIndex = -1;
        target?.focus();
      }
    }, 50);
    return () => clearInterval(timer);
  }, [section]);
  const choose = (p: Prefs) => {
    setPrefs(p);
    writePrefs(storage(), p);
  };
  const route = useRead<RouteData>("/api/route");
  const home = useRead<HomeData>(section === "home" ? "/api/home" : null);
  const questions = useRead<QuestionsData>(section === "questions" ? "/api/questions" : null);
  const onChanges = section === "changes";
  const onBrief = section === "brief";
  const modules = useRead<ModulesData>(onChanges || onBrief ? "/api/modules" : null);
  const brief = useRead<BriefData>(onBrief ? "/api/brief" : null);
  const drafts = useRead<DraftView[]>(onChanges ? "/api/drafts" : null);
  const changes = useRead<{ changes: ChangeView[]; alm: boolean }>(
    onChanges ? "/api/changes" : null
  );
  // REQ-438: the command the studio runs; when it ends, what it changed is read again.
  const command = useAction((run) => {
    route.reload();
    if (section === "report") report.reload();
    if (section === "settings") {
      preferences.reload();
      profiles.reload();
    }
    if (onChanges) {
      modules.reload();
      drafts.reload();
      changes.reload();
    }
    notify({
      kind: run.exit === 0 ? "ok" : "err",
      text: `specgate ${run.argv.join(" ")} · ${t(prefs.lang, run.exit === 0 ? "cmdOk" : "cmdFailed").replace("{N}", String(run.exit))}`,
    });
  });
  useEffect(() => {
    void command.refresh();
  }, [section]);
  const runCommand = async (action: string, args: Record<string, unknown>) => {
    const r = await command.start(action, args);
    if (!r.ok) notify({ kind: "err", text: `${t(prefs.lang, "errorPrefix")} ${r.message || ""}` });
    return { ok: r.ok, message: r.message };
  };
  // While a module is being drafted, its progress is read again every few seconds.
  const drafting = (onChanges || onBrief) && !!modules.data?.job;
  useEffect(() => {
    if (!drafting) return;
    const timer = setInterval(() => {
      modules.reload();
      if (onChanges) drafts.reload();
    }, 3000);
    return () => clearInterval(timer);
  }, [drafting, onChanges]);
  // When the assistant ends reading a brief, the brief it wrote is read.
  const readingBrief = onBrief && modules.data?.job?.kind === "brief";
  useEffect(() => {
    if (onBrief && !readingBrief) brief.reload();
  }, [readingBrief]);
  const stream = useLive(section === "live");
  const liveMatrix = useRead<{ rows: MatrixRow[] }>(
    section === "live" ? "/live/matrix.json" : null
  );
  // The matrix is read again when a requirement of the run changes state, not on every push.
  const states = (stream.data?.requirements || []).map((r) => `${r.req}:${r.state}`).join(",");
  useEffect(() => {
    if (section === "live" && states) liveMatrix.reload();
  }, [states]);
  const report = useRead<ReportData>(section === "report" ? "/api/report" : null);
  const onBuild = section === "build";
  const onSettings = section === "settings";
  const needsProfiles = onBuild || onBrief || onSettings;
  const preferences = useRead<
    Array<{ key: string; value: string | null; options: string[] | null }>
  >(onSettings && route.data?.isProject ? "/api/preferences" : null);
  const alm = useRead<{
    configured: boolean;
    provider: string;
    project: string;
    tokenEnv: string;
    tokenSet: boolean;
  }>(onSettings && route.data?.isProject ? "/api/alm" : null);
  const quality = useRead<QualityView>(onSettings && route.data?.isProject ? "/api/quality" : null);
  const build = useRead<BuildData>(onBuild ? "/api/build" : null);
  const profiles = useRead<{
    profiles: Profile[];
    installed: { claude: boolean; codex: boolean };
    agent: string | null;
  }>(needsProfiles ? "/api/profiles" : null);
  const live = useRead<{ requirements: LiveRequirement[] }>(onBuild ? "/live.json" : null);
  // While something is built, what runs is read again every few seconds.
  const building = onBuild && !!build.data?.running;
  useEffect(() => {
    if (!building) return;
    const timer = setInterval(() => {
      build.reload();
      live.reload();
    }, 3000);
    return () => clearInterval(timer);
  }, [building]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const close = (id: number) => setNotices((l) => l.filter((n) => n.id !== id));
  const notify = (n: Omit<Notice, "id">) => {
    const id = Date.now() + Math.random();
    setNotices((l) => [...l.slice(-3), { ...n, id }]);
    // A success goes by itself; a failure stays until it is closed.
    if (n.kind !== "err") setTimeout(() => close(id), 5000);
  };
  /** A write, then what it changed read again so the page shows what the files now say. */
  const send = async (url: string, body: Record<string, unknown>): Promise<Result> => {
    const r = await post<Result>(url, body);
    const done: Key = url === "/api/answer" && body.reviewed ? "didConfirm" : DONE[url] || "done";
    if (r.ok) notify({ kind: "ok", text: t(prefs.lang, done) });
    else
      notify({
        kind: "err",
        text: `${t(prefs.lang, "errorPrefix")} ${r.message || ""}`,
        retry: () => void send(url, body),
      });
    if (r.ok) {
      route.reload();
      if (section === "questions") questions.reload();
      if (onBuild) {
        build.reload();
        live.reload();
      }
      if (onBrief) modules.reload();
      if (needsProfiles) profiles.reload();
      if (onChanges) {
        modules.reload();
        drafts.reload();
      }
    }
    return r;
  };
  const write = (body: Record<string, unknown>) => send("/api/answer", body);
  /** What each section reads: its shape until they answer, their failure inside it. */
  const reads: Record<Section, Array<{ error: string | null; reload: () => void }>> = {
    home: [route, home],
    brief: [brief, modules, profiles],
    changes: [modules, drafts],
    questions: [questions],
    build: [build, profiles, live],
    live: [],
    report: [report],
    settings: [route, profiles],
  };
  const online = useConnection(() => {
    notify({ kind: "ok", text: t(prefs.lang, "backOnline") });
    route.reload();
    for (const r of reads[section]) r.reload();
  });
  const failed = reads[section].find((r) => r.error);
  const retryAll = () => {
    for (const r of reads[section]) r.reload();
  };
  return (
    <Shell project={project} section={section} prefs={prefs} onPrefs={choose}>
      {!online ? <Offline lang={prefs.lang} /> : null}
      <Notices lang={prefs.lang} list={notices} onClose={close} />
      <div class={online ? "content" : "content stale"}>
        {failed && online ? (
          <SectionError lang={prefs.lang} message={failed.error || ""} onRetry={retryAll} />
        ) : null}
        {section === "home" && route.data ? (
          <>
            <Home lang={prefs.lang} route={route.data} home={home.data} />
            <GateCard
              lang={prefs.lang}
              run={command.view?.last || null}
              output={command.view?.output || ""}
              onAction={runCommand}
            />
          </>
        ) : onChanges && modules.data && drafts.data ? (
          <Changes
            lang={prefs.lang}
            modules={modules.data}
            drafts={drafts.data}
            onDraft={(module) => send("/api/draft", { module, profile: "" })}
            onStopDraft={() => send("/api/draft/stop", {})}
            onApprove={(change) => send("/api/approve", { change })}
            onNote={(change, req, text) => send("/api/note", { change, req, text })}
            onConfirm={(change, question) =>
              write({ question, change: changeOf(change), reviewed: true })
            }
            changes={changes.data?.changes || []}
            alm={!!changes.data?.alm}
            action={{
              run: command.view?.last || null,
              output: command.view?.output || "",
              onAction: runCommand,
            }}
          />
        ) : section === "live" && stream.data ? (
          <Live
            lang={prefs.lang}
            data={stream.data}
            connection={stream.connection}
            onAnswer={(question, change, answer) =>
              write({ question, change: changeOf(change), answer })
            }
            matrix={liveMatrix.data?.rows || []}
            onReviewed={(question, change) =>
              write({ question, change: changeOf(change), reviewed: true })
            }
            onStop={(now) => send("/api/stop", { now })}
            detailOf={(id) => get<RequirementDetail | null>(`/live/req/${id}.json`)}
            promptOf={async (id, attempt) => {
              const r = await fetch(`/live/req/${id}/prompt/${attempt}.txt`);
              if (!r.ok) throw new Error(String(r.status));
              return r.text();
            }}
          />
        ) : onSettings && route.data && profiles.data ? (
          <Settings
            lang={prefs.lang}
            isProject={route.data.isProject}
            empty={!!route.data.empty}
            profiles={profiles.data.profiles}
            installed={profiles.data.installed}
            quality={quality.data}
            agent={profiles.data.agent}
            alm={alm.data}
            preferences={{
              prefs: preferences.data || [],
              run: command.view?.last || null,
              output: command.view?.output || "",
              onAction: runCommand,
            }}
            onAgent={(kind, command) => send("/api/agent", { kind, command })}
            onCreate={async (project) => {
              const r = await send("/api/project", { project });
              if (r.ok) location.hash = "#/brief";
              return r;
            }}
            onQuality={(level) => post("/api/quality/init", { level })}
          />
        ) : section === "report" && report.data ? (
          <>
            <Report lang={prefs.lang} advanced={prefs.mode === "advanced"} data={report.data} />
            <GateCard
              lang={prefs.lang}
              run={command.view?.last || null}
              output={command.view?.output || ""}
              onAction={runCommand}
            />
          </>
        ) : onBrief && brief.data ? (
          <Brief
            key={`${brief.data.exists}-${modules.data?.job?.kind || ""}`}
            lang={prefs.lang}
            advanced={prefs.mode === "advanced"}
            data={brief.data}
            profile={(profiles.data?.profiles.find((p) => p.default) || { name: "" }).name}
            agent={profiles.data?.agent || ""}
            job={modules.data?.job || null}
            step={modules.data?.step || ""}
            onSave={async (body) => {
              const r = await post<Saved>("/api/brief", body);
              if (r.ok && !brief.data?.exists) brief.reload();
              if (r.ok) route.reload();
              return r;
            }}
            onFill={(text, replace) =>
              send("/api/brief/fill", {
                text,
                replace,
                profile: (profiles.data?.profiles.find((p) => p.default) || { name: "" }).name,
              })
            }
            onStop={() => send("/api/draft/stop", {})}
          />
        ) : onBuild && build.data ? (
          <Build
            lang={prefs.lang}
            advanced={prefs.mode === "advanced"}
            data={build.data}
            profiles={profiles.data?.profiles || []}
            live={live.data?.requirements || []}
            now={Date.now() / 1000}
            onBuild={(reqs, profile) => send("/api/build", { reqs, profile })}
            onStop={() => send("/api/stop", {})}
            onAgent={(kind: AgentKind, command) => send("/api/agent", { kind, command })}
          />
        ) : section === "questions" && questions.data ? (
          <Questions
            lang={prefs.lang}
            data={questions.data}
            onAnswer={(q, answer) => write({ question: q.id, change: changeOf(q.change), answer })}
            onConfirm={(change, question) =>
              write({ question, change: changeOf(change), reviewed: true })
            }
          />
        ) : failed ? null : (
          <Skeleton lang={prefs.lang} />
        )}
      </div>
    </Shell>
  );
}
