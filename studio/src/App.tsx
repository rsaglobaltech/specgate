/** The studio's app (REQ-204): the shell, the section the address names, the viewer's preferences. */
import { useEffect, useState } from "preact/hooks";
import { Shell } from "./ui/Shell";
import { sectionOf, type Section } from "./core/routes";
import { readPrefs, writePrefs, type Prefs } from "./core/prefs";
import { t } from "./core/i18n";
import { useRead } from "./core/useRead";
import type { HomeData, RouteData } from "./core/route";
import { Home } from "./sections/Home";

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
  return (
    <Shell project={project} section={section} prefs={prefs} onPrefs={choose}>
      {section === "home" && route.data ? (
        <Home lang={prefs.lang} route={route.data} home={home.data} />
      ) : (
        <h1>{t(prefs.lang, section)}</h1>
      )}
    </Shell>
  );
}
