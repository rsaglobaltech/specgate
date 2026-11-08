/**
 * What the unit tests reach of the studio: its pure core, and its views
 * rendered to text. Bundled by the build into dist/studio-test/, never shipped.
 */
import { render } from "preact-render-to-string";
import { Shell } from "./ui/Shell";
import type { Section } from "./core/routes";
import type { Prefs } from "./core/prefs";
import { Home } from "./sections/Home";
import { Questions, type QuestionsData } from "./sections/Questions";
import { Changes, type DraftView, type ModulesData } from "./sections/Changes";
import { Live, logLine, type Connection, type LiveData } from "./sections/Live";
import { Settings, type QualityView, type SettingsProfile } from "./sections/Settings";
import { Report, type ReportData } from "./sections/Report";
import { Brief, type BriefData } from "./sections/Brief";
import { Build, type BuildData, type LiveRequirement, type Profile } from "./sections/Build";
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

export function renderQuestions(lang: Lang, data: QuestionsData): string {
  const none = async () => ({ ok: true });
  return render(<Questions lang={lang} data={data} onAnswer={none} onConfirm={none} />);
}

export function renderChanges(lang: Lang, modules: ModulesData, drafts: DraftView[]): string {
  const none = async () => ({ ok: true });
  return render(
    <Changes
      lang={lang}
      modules={modules}
      drafts={drafts}
      onDraft={none}
      onStopDraft={none}
      onApprove={none}
      onNote={none}
      onConfirm={none}
    />
  );
}

export function renderBuild(
  lang: Lang,
  data: BuildData,
  profiles: Profile[] = [],
  live: LiveRequirement[] = [],
  now = 1_800_000_000
): string {
  const none = async () => ({ ok: true });
  return render(
    <Build
      lang={lang}
      advanced={false}
      data={data}
      profiles={profiles}
      live={live}
      now={now}
      onBuild={none}
      onStop={none}
      onAgent={none}
    />
  );
}

export { keyOf } from "./sections/Brief";

export function renderBrief(
  lang: Lang,
  data: BriefData,
  opts: { advanced?: boolean; profile?: string; job?: { kind: string } | null } = {}
): string {
  const none = async () => ({ ok: true });
  return render(
    <Brief
      lang={lang}
      advanced={!!opts.advanced}
      data={data}
      profile={opts.profile ?? "claude"}
      job={opts.job ?? null}
      step=""
      onSave={none}
      onFill={none}
      onStop={none}
    />
  );
}

export function renderReport(lang: Lang, data: ReportData, advanced = false): string {
  return render(<Report lang={lang} advanced={advanced} data={data} />);
}

export function renderSettings(
  lang: Lang,
  state: { isProject: boolean; empty: boolean },
  profiles: SettingsProfile[] = [],
  installed = { claude: true, codex: false },
  quality: QualityView | null = null
): string {
  const none = async () => ({ ok: true });
  return render(
    <Settings
      lang={lang}
      isProject={state.isProject}
      empty={state.empty}
      profiles={profiles}
      installed={installed}
      quality={quality}
      onCreate={none}
      onQuality={none}
    />
  );
}

export { logLine };

export function renderLive(
  lang: Lang,
  data: LiveData,
  connection: Connection = "open",
  now = 1_800_000_000
): string {
  const none = async () => ({ ok: true });
  return render(
    <Live lang={lang} data={data} connection={connection} now={now} onAnswer={none} onStop={none} />
  );
}
