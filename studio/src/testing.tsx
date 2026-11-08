/**
 * What the unit tests reach of the studio: its pure core, and its views
 * rendered to text. Bundled by the build into dist/studio-test/, never shipped.
 */
import { render } from "preact-render-to-string";
import { Shell } from "./ui/Shell";
import type { Section } from "./core/routes";
import type { Prefs } from "./core/prefs";
import { Home } from "./sections/Home";
import type { HomeData, RouteData } from "./core/route";
import type { Lang } from "./core/i18n";

export * from "./core/routes";
export * from "./core/i18n";
export * from "./core/prefs";

export function renderShell(section: Section, prefs: Prefs, project = "shop"): string {
  return render(
    <Shell project={project} section={section} prefs={prefs} onPrefs={() => undefined} />
  );
}

export function renderHome(lang: Lang, route: RouteData, home: HomeData | null): string {
  return render(<Home lang={lang} route={route} home={home} />);
}
