/**
 * Build (REQ-208, REQ-209, REQ-431): what is ready, picked and built by the
 * assistant chosen here; without one, the form that chooses it with the agent
 * found on this machine already picked; what runs now and what ended today —
 * the approved design's Construir.
 */
import { useState } from "preact/hooks";
import { t, type Key, type Lang } from "../core/i18n";
import { Busy, type Result } from "../ui/Busy";

export interface BuildData {
  ready: Array<{ id: string; title: string; module: string }>;
  agent: boolean;
  installed?: { claude: boolean; codex: boolean };
  running: { pid: number; reqs: string[] } | null;
  estimate: { minutes: number | null; costPerRequirement: number | null };
}

export interface Profile {
  name: string;
  agent: string;
  default: boolean;
  costHint: number | null;
  streams: boolean;
}

export interface LiveRequirement {
  req: string;
  title: string;
  state: "running" | "pass" | "fail" | "question";
  started: number;
  updated: number;
  elapsed: number;
  steps: Array<{ type?: string; stage?: string }>;
}

export type AgentKind = "claude" | "codex" | "custom";

export interface BuildProps {
  lang: Lang;
  advanced: boolean;
  data: BuildData;
  profiles: Profile[];
  live: LiveRequirement[];
  /** Seconds since the epoch, so a test can say what "today" is. */
  now: number;
  onBuild: (reqs: string[], profile: string) => Promise<Result & { started?: string[] }>;
  onStop: () => Promise<Result>;
  onAgent: (kind: AgentKind, command: string) => Promise<Result>;
}

/** Programa until the gate starts, Prueba for the gate, Revisa for a quality check, Guarda at the merge (REQ-275). */
export function stageOf(r: LiveRequirement): number {
  const gates = r.steps.filter(
    (e) => e.type === "gate" || e.type === "gate-start" || e.type === "merge"
  );
  if (r.steps.some((e) => e.type === "merge")) return 3;
  if (gates.some((e) => String(e.stage || "").startsWith("quality:"))) return 2;
  return gates.length ? 1 : 0;
}

const STAGES: Key[] = ["stProgram", "stTest", "stQuality", "stSave"];

function Said({ lang, r, ok }: { lang: Lang; r: Result | null; ok?: string }) {
  if (!r) return null;
  return (
    <span role="status" class={r.ok ? "ok" : "err"}>
      {r.ok ? ok || t(lang, "done") : `${t(lang, "errorPrefix")} ${r.message || ""}`}
    </span>
  );
}

function AgentForm({
  lang,
  installed,
  onAgent,
}: {
  lang: Lang;
  installed: BuildData["installed"];
  onAgent: BuildProps["onAgent"];
}) {
  const found = installed || { claude: false, codex: false };
  const [kind, setKind] = useState<AgentKind>(
    found.claude ? "claude" : found.codex ? "codex" : "custom"
  );
  const [command, setCommand] = useState("");
  const [said, setSaid] = useState<Result | null>(null);
  const options: Array<[AgentKind, string, boolean]> = [
    ["claude", "Claude Code", found.claude],
    ["codex", "Codex", found.codex],
    ["custom", t(lang, "ownCommand"), false],
  ];
  return (
    <section class="card agent" aria-labelledby="agent-h">
      <div>
        <h2 id="agent-h">{t(lang, "chooseAgent")}</h2>
        <p class="faint">{t(lang, "chooseAgentHint")}</p>
      </div>
      <div class="choices" role="radiogroup" aria-labelledby="agent-h">
        {options.map(([k, name, on]) => (
          <label class={`choice${kind === k ? " on" : ""}`}>
            <input
              type="radio"
              name="agent-kind"
              checked={kind === k}
              onChange={() => setKind(k)}
            />
            <span class="name">{name}</span>
            {on ? <span class="chip ok-chip">{t(lang, "found")}</span> : null}
          </label>
        ))}
      </div>
      {kind === "custom" ? (
        <>
          <label for="agent-cmd" class="label">
            {t(lang, "ownCommand")}
          </label>
          <input
            id="agent-cmd"
            class="text"
            type="text"
            value={command}
            placeholder="my-agent run {prompt_file}"
            onInput={(e) => setCommand((e.target as HTMLInputElement).value)}
          />
        </>
      ) : null}
      <div class="row">
        <Busy
          busyLabel={t(lang, "saving")}
          disabled={kind === "custom" && !command.includes("{prompt_file}")}
          onRun={() => onAgent(kind, command)}
          onDone={setSaid}
        >
          {t(lang, "useAgent")}
        </Busy>
        <Said lang={lang} r={said} />
      </div>
    </section>
  );
}

export function Build({
  lang,
  advanced,
  data,
  profiles,
  live,
  now,
  onBuild,
  onStop,
  onAgent,
}: BuildProps) {
  const [unpicked, setUnpicked] = useState<Record<string, boolean>>({});
  const [who, setWho] = useState<string>((profiles.find((p) => p.default) || { name: "" }).name);
  const [said, setSaid] = useState<(Result & { started?: string[] }) | null>(null);
  const [stopped, setStopped] = useState<Result | null>(null);
  const chosen = data.ready.filter((r) => !unpicked[r.id]).map((r) => r.id);
  const hasAgent = data.agent || !!who;
  const current = live.find((r) => r.state === "running");
  const midnight = new Date(now * 1000);
  midnight.setHours(0, 0, 0, 0);
  const today = live
    .filter((r) => r.state === "pass" && r.updated * 1000 >= midnight.getTime())
    .slice(0, 6);
  const estimate = [
    data.estimate.minutes ? `${data.estimate.minutes} ${t(lang, "minutes")}` : "",
    data.estimate.costPerRequirement !== null
      ? `$${data.estimate.costPerRequirement.toFixed(2)} ${t(lang, "perReq")}`
      : "",
  ].filter(Boolean);
  const label =
    chosen.length === 1
      ? t(lang, "build1")
      : t(lang, "buildN").replace("{N}", String(chosen.length));
  return (
    <>
      <header class="head">
        <h1>{t(lang, "build")}</h1>
        <p class="lead">{t(lang, "buildIntro")}</p>
      </header>
      {current || data.running ? (
        <section class="card running" aria-live="polite">
          <div class="row">
            <span class="chip warn">
              <span class="spin" aria-hidden="true" /> {t(lang, "running")}
            </span>
            <strong>
              {current ? current.title || current.req : (data.running?.reqs || []).join(", ")}
            </strong>
            {current ? (
              <span class="faint">{Math.round(Math.max(0, now - current.started) / 60)} min</span>
            ) : null}
          </div>
          {current ? (
            <ol class="stages" aria-label={t(lang, "stages")}>
              {STAGES.map((k, i) => {
                const at = stageOf(current);
                return (
                  <li
                    class={i < at ? "done" : i === at ? "now" : "todo"}
                    aria-current={i === at ? "step" : undefined}
                  >
                    <i />
                    {t(lang, k)}
                  </li>
                );
              })}
            </ol>
          ) : null}
          <div class="row">
            <a class="btn-ghost" href="#/live">
              {t(lang, "watch")} →
            </a>
            <Busy
              class="btn-danger"
              busyLabel={t(lang, "stopping")}
              onRun={onStop}
              onDone={setStopped}
            >
              {t(lang, "stopIt")}
            </Busy>
            <Said lang={lang} r={stopped} ok={t(lang, "stopAsked")} />
          </div>
        </section>
      ) : null}
      {!hasAgent ? <AgentForm lang={lang} installed={data.installed} onAgent={onAgent} /> : null}
      {profiles.length > 1 ? (
        <section class="card" aria-labelledby="who-h">
          <h2 id="who-h">{t(lang, "whoCodes")}</h2>
          <div class="choices" role="radiogroup" aria-labelledby="who-h">
            {profiles.map((p) => (
              <label class={`choice${who === p.name ? " on" : ""}`}>
                <input
                  type="radio"
                  name="profile"
                  checked={who === p.name}
                  onChange={() => setWho(p.name)}
                />
                <span class="name">{p.name}</span>
                <span class="faint">
                  {p.costHint !== null
                    ? `≈ $${p.costHint.toFixed(2)} ${t(lang, "perRun")}`
                    : t(lang, "noEstimate")}
                </span>
                {p.default ? <span class="chip">{t(lang, "isDefault")}</span> : null}
                {advanced ? <code class="where">{p.agent}</code> : null}
              </label>
            ))}
          </div>
        </section>
      ) : null}
      <section class="card" aria-labelledby="ready-h">
        <div class="row spread">
          <div>
            <h2 id="ready-h">
              {t(lang, "readyN")} · {data.ready.length}
            </h2>
            {estimate.length ? <span class="faint">{estimate.join(" · ")}</span> : null}
          </div>
          <Busy
            busyLabel={t(lang, "starting")}
            disabled={!chosen.length || !hasAgent || !!data.running}
            onRun={() => onBuild(chosen, who)}
            onDone={setSaid}
          >
            {label} →
          </Busy>
        </div>
        <Said
          lang={lang}
          r={said}
          ok={said?.started ? `${t(lang, "started")} ${said.started.join(", ")}` : undefined}
        />
        {!hasAgent ? <p class="faint">{t(lang, "needsAgent")}</p> : null}
        {!data.ready.length ? <p class="empty">{t(lang, "nothingReady")}</p> : null}
        <ul class="picks">
          {data.ready.map((r) => (
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={!unpicked[r.id]}
                  onChange={(e) =>
                    setUnpicked({ ...unpicked, [r.id]: !(e.target as HTMLInputElement).checked })
                  }
                />
                <span class="grow">{r.title}</span>
                {advanced ? <span class="id">{r.id}</span> : null}
                <span class="faint">{r.module}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
      {today.length ? (
        <section class="card" aria-labelledby="today-h">
          <h2 id="today-h">{t(lang, "doneToday")}</h2>
          {today.map((r) => (
            <div class="check ok-line">
              <span aria-hidden="true">✓</span>
              <span>{r.title || r.req}</span>
              <span class="faint">{Math.round(r.elapsed / 60)} min</span>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
