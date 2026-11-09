/**
 * What the unit tests reach of the studio: its pure core, and its views
 * rendered to text. Bundled by the build into dist/studio-test/, never shipped.
 */
import { render } from "preact-render-to-string";
import { Shell } from "./ui/Shell";
import type { Section } from "./core/routes";
import type { Prefs } from "./core/prefs";
import { Home, type BranchView } from "./sections/Home";
import { Questions, type QuestionsData } from "./sections/Questions";
import { Changes, type ChangeView, type DraftView, type ModulesData } from "./sections/Changes";
import { ChangePanel, NewChange } from "./sections/changes/ChangePanel";
import { FromTicket, type TicketReview } from "./sections/changes/FromTicket";
import { Notices, type Notice } from "./ui/Notices";
import { Offline, SectionError, Skeleton } from "./ui/States";
import {
  Live,
  logLine,
  type Connection,
  type LiveData,
  type MatrixRow,
  type RequirementDetail,
} from "./sections/Live";
export { matrixByModule, pipeline, summary, workQueue, dur } from "./sections/live/model";
export { stageOf } from "./sections/Build";
import { Trace } from "./sections/live/Trace";
import { Command } from "./ui/Command";
import { Gate } from "./ui/Gate";
import { Alm, type AlmData } from "./sections/settings/Alm";
import { Preferences, type Preference } from "./sections/settings/Preferences";
export { readCliResult } from "./core/cliResult";
import type { ActionRun } from "./core/useAction";
import { Settings, type QualityView, type SettingsProfile } from "./sections/Settings";
import { Report, type ReportData } from "./sections/Report";
import { Brief, type BriefData } from "./sections/Brief";
import { Build, type BuildData, type LiveRequirement, type Profile } from "./sections/Build";
import type { HomeData, RouteData } from "./core/route";
import type { Lang } from "./core/i18n";

export * from "./core/routes";
export * from "./core/i18n";
export * from "./core/prefs";
export { sayFinding } from "./core/serverText";

export function renderShell(section: Section, prefs: Prefs, project = "shop"): string {
  return render(
    <Shell project={project} section={section} prefs={prefs} onPrefs={() => undefined} />
  );
}

export function renderHome(
  lang: Lang,
  route: RouteData,
  home: HomeData | null,
  branch: BranchView | null = null
): string {
  return render(<Home lang={lang} route={route} home={home} branch={branch} />);
}

export function renderQuestions(lang: Lang, data: QuestionsData): string {
  const none = async () => ({ ok: true });
  return render(<Questions lang={lang} data={data} onAnswer={none} onConfirm={none} />);
}

export function renderChanges(
  lang: Lang,
  modules: ModulesData,
  drafts: DraftView[],
  extra: {
    changes?: ChangeView[];
    alm?: boolean;
    run?: ActionRun | null;
    output?: string;
    chosen?: string;
  } = {}
): string {
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
      changes={extra.changes || []}
      alm={!!extra.alm}
      action={{ run: extra.run || null, output: extra.output || "", onAction: none }}
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
  opts: { advanced?: boolean; profile?: string; agent?: string; job?: { kind: string } | null } = {}
): string {
  const none = async () => ({ ok: true });
  return render(
    <Brief
      lang={lang}
      advanced={!!opts.advanced}
      data={data}
      profile={opts.profile ?? "claude"}
      agent={opts.agent ?? ""}
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
  quality: QualityView | null = null,
  agent: string | null = null,
  action: { run: ActionRun | null; output: string } | null = null
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
      agent={agent}
      onAgent={none}
      preferences={{
        prefs: [],
        run: action?.run || null,
        output: action?.output || "",
        onAction: none,
      }}
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
  now = 1_800_000_000,
  matrix: MatrixRow[] = [],
  initial?: { id: string; detail: RequirementDetail | null }
): string {
  const none = async () => ({ ok: true });
  return render(
    <Live
      lang={lang}
      data={data}
      matrix={matrix}
      connection={connection}
      now={now}
      onAnswer={none}
      onReviewed={none}
      onStop={none}
      detailOf={async () => null}
      promptOf={async () => ""}
      initial={initial}
    />
  );
}

export function renderStates(lang: Lang, notices: Notice[] = [], error = ""): string {
  return render(
    <div>
      <Offline lang={lang} />
      <Skeleton lang={lang} />
      {error ? <SectionError lang={lang} message={error} onRetry={() => undefined} /> : null}
      <Notices lang={lang} list={notices} onClose={() => undefined} />
    </div>
  );
}

export function renderTrace(lang: Lang, rows: MatrixRow[]): string {
  return render(<Trace lang={lang} rows={rows} />);
}

export function renderCommand(lang: Lang, run: ActionRun | null, output: string): string {
  return render(<Command lang={lang} run={run} output={output} />);
}

export function renderChangePanel(
  lang: Lang,
  change: ChangeView,
  run: ActionRun | null = null,
  output = ""
): string {
  const none = async () => ({ ok: true });
  return render(
    <ChangePanel lang={lang} change={change} run={run} output={output} onAction={none} />
  );
}

export function renderNewChange(lang: Lang, alm: boolean): string {
  const none = async () => ({ ok: true });
  return render(<NewChange lang={lang} alm={alm} run={null} output="" onAction={none} />);
}

export { ticketOpenArgs } from "./sections/changes/FromTicket";

export function renderFromTicket(
  lang: Lang,
  opts: {
    review: TicketReview | null;
    capabilities?: string[];
    confirming?: boolean;
    push?: boolean;
  }
): string {
  const none = async () => ({ ok: true });
  return render(
    <FromTicket
      lang={lang}
      review={opts.review}
      confirming={opts.confirming}
      push={opts.push}
      capabilities={opts.capabilities || []}
      run={null}
      output=""
      onAction={none}
    />
  );
}

export function renderGate(lang: Lang, run: ActionRun | null, output: string): string {
  return render(<Gate lang={lang} run={run} output={output} />);
}

export function renderPreferences(lang: Lang, prefs: Preference[]): string {
  const none = async () => ({ ok: true });
  return render(<Preferences lang={lang} prefs={prefs} run={null} output="" onAction={none} />);
}

export function renderAlm(lang: Lang, alm: AlmData): string {
  const none = async () => ({ ok: true });
  return render(<Alm lang={lang} alm={alm} onAction={none} />);
}
