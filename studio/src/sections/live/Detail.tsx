/**
 * The selected requirement (REQ-181, REQ-182, REQ-274): its tabs — Steps, the
 * pipeline with the running step by its name and time and the agent's log;
 * Requirement; Tests and files; Attempts; Agent, its session and the prompt
 * it was given. Its details are read when it is opened.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import { t, type Key, type Lang } from "../../core/i18n";
import { Log } from "./Log";
import { dur, kt, pipeline, type LiveReq } from "./model";

export interface RequirementDetail {
  id: string;
  title: string;
  status: string;
  group: string;
  statement: string;
  source: { file: string; line: number } | null;
  scenarios: Array<{ id: string; title: string; steps: string[] }>;
  features: string[];
  tests: string[];
  assumptions: Array<{ id: string; text: string; status: string }>;
  attempts: Array<{
    attempt: number;
    result: "pass" | "fail" | "running";
    started: number;
    duration: number;
    failedAt: string | null;
    gates: Array<{ stage: string; result: string }>;
  }>;
  files: Array<{ path: string; added: number; removed: number }>;
}

export interface DetailProps {
  lang: Lang;
  id: string;
  r: LiveReq | null;
  now: number;
  /** Read when the requirement is opened, and again as its run moves on. */
  detailOf: (id: string) => Promise<RequirementDetail | null>;
  promptOf: (id: string, attempt: number) => Promise<string>;
  /** What a test gives instead of reading it. */
  initial?: RequirementDetail | null;
}

const TABS: Array<[string, Key]> = [
  ["steps", "tabSteps"],
  ["req", "tabRequirement"],
  ["files", "tabFiles"],
  ["attempts", "tabAttempts"],
  ["agent", "tabAgent"],
];

const STEP_WORD: Record<string, Key> = {
  Agent: "stepAgent",
  Specification: "stepSpec",
  Architecture: "stepArch",
  Tests: "stepTests",
  Merge: "stepMerge",
};

function Steps({ lang, r, now }: { lang: Lang; r: LiveReq | null; now: number }) {
  if (!r) return <p class="faint">{t(lang, "notRunYet")}</p>;
  const rows = pipeline(r, now);
  return (
    <>
      <ol class="pipeline" aria-label={t(lang, "tabSteps")}>
        {rows.map((x) => (
          <li class={`pl pl-${x.state}`} aria-current={x.state === "running" ? "step" : undefined}>
            <span class={`dot dot-${x.state === "idle" ? "queued" : x.state}`} aria-hidden="true" />
            <span class={x.name === x.kind ? "pl-name" : "pl-name mono"}>
              {x.name === x.kind ? t(lang, STEP_WORD[x.kind]) : x.name}
              {x.image ? <span class="faint"> · {x.image}</span> : null}
            </span>
            <span class="faint">{x.seconds === null ? "" : dur(x.seconds)}</span>
          </li>
        ))}
      </ol>
      <Log lang={lang} steps={r.steps} />
    </>
  );
}

function Agent({
  lang,
  r,
  promptOf,
}: {
  lang: Lang;
  r: LiveReq | null;
  promptOf: DetailProps["promptOf"];
}) {
  const [prompt, setPrompt] = useState<string | null>(null);
  if (!r) return <p class="faint">{t(lang, "notRunYet")}</p>;
  const u = r.usage;
  const rows: Array<[Key, string]> = [
    [
      "wqModel",
      r.agent
        ? `${r.agent.model}${r.agent.version ? ` · ${r.agent.version}` : ""}`
        : t(lang, "notReported"),
    ],
    ["permission", r.agent?.permission || "—"],
    ["tools", r.agent ? String(r.agent.tools) : "—"],
    [
      "wqContext",
      u && u.window ? `${kt(u.context)} / ${kt(u.window)} · ${t(lang, "peak")} ${kt(u.peak)}` : "—",
    ],
    ["tokensInOut", u ? `${kt(u.input + u.cacheRead + u.cacheWrite)} · ${kt(u.output)}` : "—"],
    ["costSoFar", u && u.cost !== null ? `$${u.cost.toFixed(2)}` : "—"],
    ["turns", u && u.turns !== null ? String(u.turns) : "—"],
  ];
  return (
    <>
      <dl class="kv">
        {rows.map(([k, v]) => (
          <>
            <dt>{t(lang, k)}</dt>
            <dd>{v}</dd>
          </>
        ))}
        {r.prompt ? (
          <>
            <dt>{t(lang, "prompt")}</dt>
            <dd>
              {r.prompt.role} · {r.prompt.lines} {t(lang, "lines")} · ~{kt(r.prompt.tokens)} tokens
            </dd>
          </>
        ) : null}
      </dl>
      {prompt === null ? (
        <button
          type="button"
          class="btn-ghost"
          onClick={() =>
            void promptOf(r.req, r.attempt).then(setPrompt, () => setPrompt(t(lang, "noPrompt")))
          }
        >
          {t(lang, "readPrompt")}
        </button>
      ) : (
        <pre class="cmd prompt">{prompt}</pre>
      )}
    </>
  );
}

export function Detail({ lang, id, r, now, detailOf, promptOf, initial = null }: DetailProps) {
  const [tab, setTab] = useState("steps");
  const [d, setD] = useState<RequirementDetail | null>(initial);
  const tabs = useRef<HTMLDivElement>(null);
  // Read again when another requirement is opened, or when its run moves on.
  const moment = r ? `${r.attempt}:${r.state}:${r.steps.length}` : "";
  useEffect(() => {
    let live = true;
    void detailOf(id).then(
      (x) => live && setD(x),
      () => undefined
    );
    return () => {
      live = false;
    };
  }, [id, moment]);
  const title = d?.title || r?.title || "";
  const panel = `live-tab-${tab}`;
  return (
    <section class="card detail-card" aria-labelledby="detail-h">
      <div class="row spread">
        <div>
          <span class="eyebrow">
            [ {id}
            {r ? ` · ${t(lang, "attemptN").replace("{N}", String(r.attempt))}` : ""} ]
          </span>
          <h2 id="detail-h">{title || id}</h2>
        </div>
        {r && r.state === "running" ? <span class="clock">{dur(now - r.started)}</span> : null}
      </div>
      <div
        class="tabs"
        role="tablist"
        aria-label={t(lang, "reqTabs")}
        ref={tabs}
        onKeyDown={(e) => {
          // Arrows move between the tabs, as a tab list does (REQ-435).
          const i = TABS.findIndex(([k]) => k === tab);
          const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          const next = TABS[(i + step + TABS.length) % TABS.length][0];
          setTab(next);
          tabs.current?.querySelector<HTMLElement>(`#tab-${next}`)?.focus();
        }}
      >
        {TABS.map(([k, w]) => (
          <button
            type="button"
            role="tab"
            id={`tab-${k}`}
            class="chip-btn"
            aria-selected={tab === k}
            aria-controls={`live-tab-${k}`}
            tabIndex={tab === k ? 0 : -1}
            onClick={() => setTab(k)}
          >
            {t(lang, w)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={panel} aria-labelledby={`tab-${tab}`} class="tab-panel">
        {tab === "steps" ? <Steps lang={lang} r={r} now={now} /> : null}
        {tab === "req" ? (
          d ? (
            <>
              <p>{d.statement}</p>
              <p class="faint">
                {d.status}
                {d.source ? ` · ${d.source.file}:${d.source.line}` : ""}
              </p>
              {d.scenarios.map((s) => (
                <div>
                  <strong>
                    {s.id} — {s.title}
                  </strong>
                  <ol class="steps">
                    {s.steps.map((x) => (
                      <li>{x}</li>
                    ))}
                  </ol>
                </div>
              ))}
              {d.assumptions.length ? (
                <ul>
                  {d.assumptions.map((a) => (
                    <li>
                      <span class="id">{a.id}</span> {a.text}{" "}
                      <span class="faint">· {a.status}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p class="faint">{t(lang, "loading")}</p>
          )
        ) : null}
        {tab === "files" ? (
          <>
            <h3>{t(lang, "colTests")}</h3>
            {d?.tests.length ? (
              <ul>
                {d.tests.map((x) => (
                  <li>
                    <code>{x}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p class="faint">{t(lang, "noTestsYet")}</p>
            )}
            {d?.features.length ? (
              <ul>
                {d.features.map((x) => (
                  <li>
                    <code>{x}</code>
                  </li>
                ))}
              </ul>
            ) : null}
            {r?.tests ? (
              <p>
                <span class="ok">{r.tests.pass} ✓</span>{" "}
                <span class={r.tests.fail ? "err" : "faint"}>{r.tests.fail} ✗</span>
              </p>
            ) : null}
            <h3>{t(lang, "filesTouchedTitle")}</h3>
            {d?.files.length ? (
              <ul class="files">
                {d.files.map((f) => (
                  <li>
                    <code>{f.path}</code> <span class="ok">+{f.added}</span>{" "}
                    <span class="err">−{f.removed}</span>
                  </li>
                ))}
              </ul>
            ) : r?.files.length ? (
              <ul class="files">
                {r.files.map((f) => (
                  <li>
                    <code>{f}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p class="faint">{t(lang, "noFilesYet")}</p>
            )}
          </>
        ) : null}
        {tab === "attempts" ? (
          d?.attempts.length ? (
            <ol class="attempts">
              {d.attempts.map((a) => (
                <li class={`att att-${a.result}`}>
                  <strong>{t(lang, "attemptN").replace("{N}", String(a.attempt))}</strong>{" "}
                  <span>
                    {t(
                      lang,
                      a.result === "pass"
                        ? "segPass"
                        : a.result === "fail"
                          ? "segFail"
                          : "segRunning"
                    )}
                  </span>{" "}
                  <span class="faint">· {dur(a.duration)}</span>
                  {a.failedAt ? <span class="err"> · {a.failedAt}</span> : null}
                  {a.gates.length ? (
                    <span class="faint">
                      {" "}
                      ·{" "}
                      {a.gates
                        .map((g) => `${g.stage} ${g.result === "pass" ? "✓" : "✗"}`)
                        .join(" · ")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p class="faint">{t(lang, "noAttempts")}</p>
          )
        ) : null}
        {tab === "agent" ? <Agent lang={lang} r={r} promptOf={promptOf} /> : null}
      </div>
    </section>
  );
}
