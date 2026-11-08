/**
 * Settings (REQ-211, REQ-213, REQ-229): an empty folder becomes a project
 * with five questions; a folder with files is adopted from a terminal; a
 * project shows the assistants it can use and its code-quality checks.
 */
import { useState } from "preact/hooks";
import { t, type Key, type Lang } from "../core/i18n";
import { Busy, type Result } from "../ui/Busy";
import { AgentForm, type AgentKind } from "../ui/AgentForm";
import { Preferences, type PreferencesProps } from "./settings/Preferences";

export interface NewProject {
  name: string;
  kind: "web" | "api" | "mobile";
  stack: "node-react" | "java-spring" | "python-fastapi" | "custom";
  customStack?: string;
  customTesting?: string;
  agent: "claude" | "codex" | "none";
  quality?: "none" | "basic" | "strict";
}

export interface QualityView {
  level: string;
  diffCoverage: number | null;
  mutationScore: number | null;
  docker: boolean;
  checks: Array<{
    name: string;
    when: "attempt" | "end" | "ci";
    gate: boolean;
    runner: string;
    unavailable?: string;
  }>;
}

export interface SettingsProfile {
  name: string;
  agent: string;
  default: boolean;
  streams: boolean;
}

export interface SettingsProps {
  lang: Lang;
  isProject: boolean;
  empty: boolean;
  profiles: SettingsProfile[];
  installed: { claude: boolean; codex: boolean };
  quality: QualityView | null;
  /** The agent command harness.config.yaml holds, when it is not a profile (REQ-431). */
  agent?: string | null;
  onAgent?: (kind: AgentKind, command: string) => Promise<Result>;
  /** The preferences and the command runner (REQ-442); absent, the card is not shown. */
  preferences?: Omit<PreferencesProps, "lang">;
  onCreate: (p: NewProject) => Promise<Result>;
  onQuality: (level: "basic" | "strict") => Promise<Result & { view?: QualityView }>;
}

function Choice<T extends string>({
  name,
  value,
  current,
  title,
  hint,
  extra,
  onPick,
}: {
  name: string;
  value: T;
  current: T;
  title: string;
  hint?: string;
  extra?: string;
  onPick: (v: T) => void;
}) {
  return (
    <label class={`choice${current === value ? " on" : ""}`}>
      <input type="radio" name={name} checked={current === value} onChange={() => onPick(value)} />
      <span class="name">{title}</span>
      {extra ? <span class="faint">· {extra}</span> : null}
      {hint ? <span class="faint hint">{hint}</span> : null}
    </label>
  );
}

function Quality({
  lang,
  quality,
  onQuality,
}: {
  lang: Lang;
  quality: QualityView;
  onQuality: SettingsProps["onQuality"];
}) {
  const [q, setQ] = useState(quality);
  const [said, setSaid] = useState<Result | null>(null);
  const level = q.checks.length ? q.level : "";
  const when: Record<string, Key> = { attempt: "stAttempt", end: "stEnd", ci: "stCi" };
  const run = (l: "basic" | "strict") => async () => {
    const r = await onQuality(l);
    if (r.ok && r.view) setQ(r.view);
    return r;
  };
  return (
    <section class="card" aria-labelledby="quality-h">
      <div>
        <h2 id="quality-h">{t(lang, "qualTitle")}</h2>
        <p class="faint">{t(lang, "qualIntro")}</p>
      </div>
      <span class={q.docker ? "ok" : "err"}>{t(lang, q.docker ? "dockerOn" : "dockerOff")}</span>
      {!q.checks.length ? (
        <p class="faint">{t(lang, "qualNone")}</p>
      ) : (
        <>
          <div class="row">
            {q.level ? <span class="chip">{q.level}</span> : null}
            <span class="faint">
              {t(lang, "thresholds")
                .replace("{C}", q.diffCoverage === null ? "—" : String(q.diffCoverage))
                .replace("{M}", q.mutationScore === null ? "—" : String(q.mutationScore))}
            </span>
          </div>
          {q.checks.map((k) => (
            <div class="check">
              <span aria-hidden="true">{k.gate ? "■" : "□"}</span>
              <span>
                <strong>{k.name}</strong>{" "}
                <span class="faint">
                  · {t(lang, when[k.when])} · {t(lang, k.gate ? "gates" : "advises")}
                </span>
              </span>
              {k.unavailable ? (
                <span class="err" title={k.unavailable}>
                  {t(lang, "notRunnable")}
                </span>
              ) : (
                <span class="chip">{k.runner}</span>
              )}
            </div>
          ))}
        </>
      )}
      <div class="row">
        {level !== "basic" ? (
          <Busy
            class={level ? "btn-ghost" : "btn-primary"}
            busyLabel={t(lang, "saving")}
            onRun={run("basic")}
            onDone={setSaid}
          >
            {t(lang, level ? "toBasic" : "qualBasic")}
          </Busy>
        ) : null}
        {level !== "strict" ? (
          <Busy
            class="btn-ghost"
            busyLabel={t(lang, "saving")}
            onRun={run("strict")}
            onDone={setSaid}
          >
            {t(lang, level ? "toStrict" : "qualStrict")}
          </Busy>
        ) : null}
        {said && !said.ok ? (
          <span role="status" class="err">
            {t(lang, "errorPrefix")} {said.message}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function NewProjectForm({
  lang,
  installed,
  onCreate,
}: {
  lang: Lang;
  installed: SettingsProps["installed"];
  onCreate: SettingsProps["onCreate"];
}) {
  const [p, setP] = useState<NewProject>({
    name: "",
    kind: "web",
    stack: "node-react",
    agent: installed.claude ? "claude" : installed.codex ? "codex" : "none",
    quality: "none",
    customStack: "",
    customTesting: "",
  });
  const [said, setSaid] = useState<Result | null>(null);
  const set = (x: Partial<NewProject>) => setP({ ...p, ...x });
  const custom = p.stack === "custom";
  const ready =
    !!p.name.trim() && (!custom || (!!p.customStack?.trim() && !!p.customTesting?.trim()));
  return (
    <form class="card form" onSubmit={(e) => e.preventDefault()}>
      <label for="np-name" class="label">
        {t(lang, "q1")}
      </label>
      <input
        id="np-name"
        class="text-plain"
        type="text"
        value={p.name}
        onInput={(e) => set({ name: (e.target as HTMLInputElement).value })}
      />
      <fieldset class="list-editor">
        <legend>
          <strong>{t(lang, "q2")}</strong>
        </legend>
        <div class="choices" role="radiogroup">
          {(
            [
              ["web", "kWeb", "kWebP"],
              ["api", "kApi", "kApiP"],
              ["mobile", "kMob", "kMobP"],
            ] as const
          ).map(([v, title, hint]) => (
            <Choice
              name="np-kind"
              value={v}
              current={p.kind}
              title={t(lang, title)}
              hint={t(lang, hint)}
              onPick={(kind) => set({ kind })}
            />
          ))}
        </div>
      </fieldset>
      <label for="np-stack" class="label">
        {t(lang, "q3")}
      </label>
      <select
        id="np-stack"
        class="text-plain"
        value={p.stack}
        onChange={(e) =>
          set({ stack: (e.target as HTMLSelectElement).value as NewProject["stack"] })
        }
      >
        <option value="node-react">{t(lang, "stNode")}</option>
        <option value="java-spring">{t(lang, "stJava")}</option>
        <option value="python-fastapi">{t(lang, "stPy")}</option>
        <option value="custom">{t(lang, "stCustom")}</option>
      </select>
      <span class="faint">{t(lang, "stackHint")}</span>
      {custom ? (
        <div class="item">
          <input
            class="text-plain"
            type="text"
            aria-label={t(lang, "customStack")}
            placeholder={t(lang, "customStack")}
            value={p.customStack}
            onInput={(e) => set({ customStack: (e.target as HTMLInputElement).value })}
          />
          <input
            class="text-plain"
            type="text"
            aria-label={t(lang, "customTest")}
            placeholder={t(lang, "customTest")}
            value={p.customTesting}
            onInput={(e) => set({ customTesting: (e.target as HTMLInputElement).value })}
          />
        </div>
      ) : null}
      <fieldset class="list-editor">
        <legend>
          <strong>{t(lang, "q4")}</strong>
        </legend>
        <div class="choices" role="radiogroup">
          <Choice
            name="np-agent"
            value="claude"
            current={p.agent}
            title={t(lang, "aClaude")}
            extra={t(lang, installed.claude ? "found" : "notFound")}
            hint={t(lang, "liveTok")}
            onPick={(agent) => set({ agent })}
          />
          <Choice
            name="np-agent"
            value="codex"
            current={p.agent}
            title={t(lang, "aCodex")}
            extra={t(lang, installed.codex ? "found" : "notFound")}
            hint={t(lang, "stepsOnly")}
            onPick={(agent) => set({ agent })}
          />
          <Choice
            name="np-agent"
            value="none"
            current={p.agent}
            title={t(lang, "aNone")}
            onPick={(agent) => set({ agent })}
          />
        </div>
      </fieldset>
      <fieldset class="list-editor">
        <legend>
          <strong>{t(lang, "q5")}</strong>
        </legend>
        <div class="choices" role="radiogroup">
          {(
            [
              ["basic", "qlBasic", "qlBasicP"],
              ["strict", "qlStrict", "qlStrictP"],
              ["none", "qlNone", "qlNoneP"],
            ] as const
          ).map(([v, title, hint]) => (
            <Choice
              name="np-quality"
              value={v}
              current={p.quality || "none"}
              title={t(lang, title)}
              hint={t(lang, hint)}
              onPick={(quality) => set({ quality })}
            />
          ))}
        </div>
      </fieldset>
      <div class="row spread">
        <span class="faint">{t(lang, "createP")}</span>
        <Busy
          busyLabel={t(lang, "creating")}
          disabled={!ready}
          onRun={() => onCreate(p)}
          onDone={setSaid}
        >
          {t(lang, "create")} →
        </Busy>
      </div>
      {said && !said.ok ? (
        <span class="err">
          {t(lang, "errorPrefix")} {said.message}
        </span>
      ) : null}
    </form>
  );
}

export function Settings({
  lang,
  isProject,
  empty,
  profiles,
  installed,
  quality,
  agent = null,
  onAgent,
  preferences,
  onCreate,
  onQuality,
}: SettingsProps) {
  const [changing, setChanging] = useState(false);
  const none = !profiles.length && !agent;
  if (!isProject && !empty) {
    return (
      <>
        <header class="head">
          <h1>{t(lang, "notEmpty")}</h1>
          <p class="lead">{t(lang, "notEmptyP")}</p>
        </header>
        <section class="card">
          <code class="cmd">specgate init</code>
        </section>
      </>
    );
  }
  if (!isProject) {
    return (
      <>
        <header class="head">
          <h1>{t(lang, "newTitle")}</h1>
          <p class="lead">{t(lang, "newIntro")}</p>
        </header>
        <NewProjectForm lang={lang} installed={installed} onCreate={onCreate} />
      </>
    );
  }
  return (
    <>
      <header class="head">
        <h1>{t(lang, "settings")}</h1>
        <p class="lead">{t(lang, "projReadyP")}</p>
      </header>
      <section class="card" aria-labelledby="assistants-h">
        <h2 id="assistants-h">{t(lang, "assistants")}</h2>
        {none ? <p class="faint">{t(lang, "noProfiles")}</p> : null}
        {agent ? (
          <div class="check">
            <span aria-hidden="true">●</span>
            <span>
              <strong>agent</strong> <code class="where">{agent}</code>
            </span>
            <span class="faint">harness.config.yaml</span>
          </div>
        ) : null}
        {profiles.map((p) => (
          <div class="check">
            <span aria-hidden="true">●</span>
            <span>
              <strong>{p.name}</strong> <code class="where">{p.agent}</code>
            </span>
            <span class="row">
              {p.default ? <span class="chip">{t(lang, "isDefault")}</span> : null}
              <span class={`chip${p.streams ? " ok-chip" : ""}`}>
                {t(lang, p.streams ? "liveTok" : "stepsOnly")}
              </span>
            </span>
          </div>
        ))}
        {onAgent && (none || changing) ? (
          <AgentForm lang={lang} installed={installed} onAgent={onAgent} />
        ) : onAgent ? (
          <div class="row">
            <button type="button" class="btn-ghost" onClick={() => setChanging(true)}>
              {t(lang, "changeAgent")}
            </button>
          </div>
        ) : null}
        <p class="faint">{t(lang, "profilesHint")}</p>
        <pre class="cmd">
          {'profiles_version: 1\nprofiles:\n  my-agent:\n    agent: "my-agent < {prompt_file}"'}
        </pre>
      </section>
      {quality ? <Quality lang={lang} quality={quality} onQuality={onQuality} /> : null}
      {preferences ? <Preferences lang={lang} {...preferences} /> : null}
    </>
  );
}
