/**
 * Report (REQ-217): what is built and proven, by module; what the app does
 * already, what is missing and why, the decisions taken — and the page to
 * print or download for the client.
 */
import { useState } from "preact/hooks";
import { t, type Lang } from "../core/i18n";

export interface ReportData {
  project: string;
  date: string;
  built: number;
  total: number;
  scenarios: number;
  gate: { ok: boolean; findings: string[] };
  cost: number | null;
  minutes: number;
  modules: Array<{
    name: string;
    built: number;
    total: number;
    waiting: number;
    scenarios: number;
  }>;
  delivered: Array<{
    id: string;
    title: string;
    module: string;
    scenarios: Array<{ id: string; title: string }>;
    quality?: { coverage: number | null; mutation: number | null } | null;
  }>;
  missing: Array<{ id: string; title: string; module: string; why: string; question?: string }>;
  answered: number;
  assumptions: number;
  quality: { measured: number; coverage: number | null; mutation: number | null };
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const pct = (n: number | null) => (n === null ? "—" : `${n} %`);

export function Report({
  lang,
  advanced,
  data,
}: {
  lang: Lang;
  advanced: boolean;
  data: ReportData;
}) {
  const built = data.modules.filter((m) => m.built).map((m) => m.name);
  const [chosen, setChosen] = useState("");
  const shown = built.includes(chosen) ? chosen : built[0] || "";
  const stats: Array<[string, string, string, string]> = [
    [t(lang, "rBuilt"), `${data.built} ${t(lang, "sOf")} ${data.total}`, t(lang, "reqs"), ""],
    [t(lang, "rExamples"), String(data.scenarios), "", "good"],
    [
      t(lang, "rGate"),
      data.gate.ok ? t(lang, "rGateOk") : t(lang, "rGateBad"),
      data.gate.findings[0] || "",
      data.gate.ok ? "good" : "bad",
    ],
    [
      t(lang, "rCost"),
      data.cost === null ? "—" : `$${data.cost.toFixed(2)}`,
      `${data.minutes} min`,
      "",
    ],
  ];
  if (data.quality.measured) {
    stats.push([
      t(lang, "rQuality"),
      pct(data.quality.coverage),
      `${t(lang, "covShort")} ${pct(data.quality.coverage)} · ${t(lang, "mutShort")} ${pct(data.quality.mutation)}`,
      "good",
    ]);
  }
  return (
    <>
      <header class="head head-row">
        <div>
          <span class="eyebrow">[ {data.date} ]</span>
          <h1>{t(lang, "repTitle")}</h1>
          <p class="lead">{t(lang, "repIntro")}</p>
        </div>
        <div class="row">
          <a class="btn-ghost" href="/report" target="_blank" rel="noopener">
            {t(lang, "print")}
          </a>
          <a class="btn-primary" href="/report.html" download>
            {t(lang, "download")}
          </a>
        </div>
      </header>
      <section class="stats" aria-label={t(lang, "summary")}>
        {stats.map(([label, value, sub, tone]) => (
          <div class="stat">
            <span class="faint">{label}</span>
            <b class={tone || undefined}>{value}</b>
            {sub ? <span class="faint">{sub}</span> : null}
          </div>
        ))}
      </section>
      <section class="card" aria-labelledby="by-module-h">
        <h2 id="by-module-h">{t(lang, "byModule")}</h2>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">{t(lang, "colModule")}</th>
                <th scope="col">{t(lang, "colBuilt")}</th>
                <th scope="col">{t(lang, "colEx")}</th>
                <th scope="col">{t(lang, "colState")}</th>
              </tr>
            </thead>
            <tbody>
              {data.modules.map((m) => (
                <tr>
                  <th scope="row">{cap(m.name)}</th>
                  <td>
                    {m.built} {t(lang, "sOf")} {m.total}
                  </td>
                  <td>{m.scenarios}</td>
                  <td class={m.waiting ? "warn-text" : m.built === m.total ? "ok" : "faint"}>
                    {m.waiting
                      ? t(lang, "waitingN").replace("{N}", String(m.waiting))
                      : m.built === m.total
                        ? t(lang, "complete")
                        : m.built
                          ? `${m.built} ${t(lang, "sOf")} ${m.total}`
                          : t(lang, "notBuilt")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section class="card" aria-labelledby="does-h">
        <div class="row spread">
          <h2 id="does-h">{t(lang, "whatDoes")}</h2>
          {built.length > 1 ? (
            <div class="chips">
              {built.map((name) => (
                <button
                  type="button"
                  class="chip-btn"
                  aria-pressed={shown === name}
                  onClick={() => setChosen(name)}
                >
                  {cap(name)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {!built.length ? <p class="empty">{t(lang, "nothingBuilt")}</p> : null}
        {data.delivered
          .filter((d) => d.module === shown)
          .map((d) => (
            <div class="delivered">
              <strong>{d.title}</strong>
              {advanced ? <span class="id">{d.id}</span> : null}
              {d.scenarios.map((s) => (
                <span class="faint">
                  {t(lang, "provedBy")} {s.title || s.id} <span class="ok">· ✓</span>
                </span>
              ))}
              {d.quality && (d.quality.coverage !== null || d.quality.mutation !== null) ? (
                <span class="faint">
                  {[
                    d.quality.coverage !== null
                      ? `${t(lang, "covShort")} ${d.quality.coverage} %`
                      : "",
                    d.quality.mutation !== null
                      ? `${t(lang, "mutShort")} ${d.quality.mutation} %`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </div>
          ))}
      </section>
      <div class="two">
        <section class="card" aria-labelledby="missing-h">
          <h2 id="missing-h">{t(lang, "missing")}</h2>
          {!data.missing.length ? <p class="faint">{t(lang, "missingNone")}</p> : null}
          {data.missing.slice(0, 12).map((x) => (
            <div class={`check ${x.why === "waiting" ? "warn-line" : ""}`}>
              <span aria-hidden="true">{x.why === "waiting" ? "?" : "·"}</span>
              <span>
                {cap(x.module)} · {x.title}
                {x.why === "waiting" && x.question ? ` — ${t(lang, "waitsFor")} ${x.question}` : ""}
              </span>
            </div>
          ))}
          {data.missing.some((x) => x.why === "waiting") ? (
            <a class="btn-ghost" href="#/questions">
              {t(lang, "answerThem")} →
            </a>
          ) : null}
        </section>
        <section class="card" aria-labelledby="decisions-h">
          <h2 id="decisions-h">{t(lang, "decisions")}</h2>
          <p>
            {t(lang, "decisionsP")
              .replace("{Q}", String(data.answered))
              .replace("{A}", String(data.assumptions))}
          </p>
        </section>
      </div>
    </>
  );
}
