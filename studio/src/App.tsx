/** The studio's app (REQ-204): the shell, the section the address names, the viewer's preferences. */
import { useEffect, useState } from "preact/hooks";
import { Shell } from "./ui/Shell";
import { sectionOf, type Section } from "./core/routes";
import { readPrefs, writePrefs, type Prefs } from "./core/prefs";
import { t } from "./core/i18n";
import { useRead } from "./core/useRead";
import type { HomeData, RouteData } from "./core/route";
import { Home } from "./sections/Home";
import { Questions, type QuestionsData } from "./sections/Questions";
import { Changes, type DraftView, type ModulesData } from "./sections/Changes";
import {
  Build,
  type AgentKind,
  type BuildData,
  type LiveRequirement,
  type Profile,
} from "./sections/Build";
import { Brief, type BriefData, type Saved } from "./sections/Brief";
import { post } from "./core/api";
import type { Result } from "./ui/Busy";

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
  const [section, setSection] = useState<Section>(sectionOf(location.hash));
  const [prefs, setPrefs] = useState<Prefs>(readPrefs(storage()));
  useEffect(() => {
    const on = () => setSection(sectionOf(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => applyTheme(prefs), [prefs]);
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
  const onBuild = section === "build";
  const needsProfiles = onBuild || onBrief;
  const build = useRead<BuildData>(onBuild ? "/api/build" : null);
  const profiles = useRead<{ profiles: Profile[] }>(needsProfiles ? "/api/profiles" : null);
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
  /** A write, then what it changed read again so the page shows what the files now say. */
  const send = async (url: string, body: Record<string, unknown>): Promise<Result> => {
    const r = await post<Result>(url, body);
    if (r.ok) {
      route.reload();
      if (section === "questions") questions.reload();
      if (onBuild) {
        build.reload();
        live.reload();
      }
      if (onBrief) modules.reload();
      if (onChanges) {
        modules.reload();
        drafts.reload();
      }
    }
    return r;
  };
  const write = (body: Record<string, unknown>) => send("/api/answer", body);
  return (
    <Shell project={project} section={section} prefs={prefs} onPrefs={choose}>
      {section === "home" && route.data ? (
        <Home lang={prefs.lang} route={route.data} home={home.data} />
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
        />
      ) : onBrief && brief.data ? (
        <Brief
          key={`${brief.data.exists}-${modules.data?.job?.kind || ""}`}
          lang={prefs.lang}
          advanced={prefs.mode === "advanced"}
          data={brief.data}
          profile={(profiles.data?.profiles.find((p) => p.default) || { name: "" }).name}
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
      ) : (
        <h1>{t(prefs.lang, section)}</h1>
      )}
    </Shell>
  );
}
