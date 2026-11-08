/**
 * Home (REQ-205, REQ-212): the one thing to do now, the project's figures, the
 * route of seven steps, and each module's progress — the approved design's Inicio.
 */
import { t, type Key, type Lang } from "../core/i18n";
import { hrefOf } from "../core/routes";
import { STEP_SECTION, type HomeData, type RouteData } from "../core/route";

export interface HomeProps {
  lang: Lang;
  route: RouteData;
  home: HomeData | null;
}

export function Home({ lang, route, home }: HomeProps) {
  const next = route.next;
  return (
    <>
      <header class="head">
        <h1>{t(lang, "home")}</h1>
        <p class="lead">{t(lang, "homeIntro")}</p>
      </header>
      <section class="next" aria-label={t(lang, "nextStep")}>
        <div class="next-text">
          <span class="eyebrow">[ {t(lang, "nextStep").toUpperCase()} ]</span>
          <span class="next-title">{t(lang, next ? (`next_${next}` as Key) : "next_none")}</span>
        </div>
        {next ? (
          <a class="btn-primary" href={hrefOf(STEP_SECTION[next])}>
            {t(lang, "go")} →
          </a>
        ) : null}
      </section>
      {home ? (
        <section class="tiles" aria-label={t(lang, "home")}>
          <div class="tile">
            <span class="tile-label">{t(lang, "built")}</span>
            <b>
              {home.built}{" "}
              <small>
                {t(lang, "ofTotal")} {home.total}
              </small>
            </b>
          </div>
          <div class="tile">
            <span class="tile-label">{t(lang, "waiting")}</span>
            <b>{home.questions}</b>
          </div>
          <div class="tile">
            <span class="tile-label">{t(lang, "toReview")}</span>
            <b>{home.drafts}</b>
          </div>
          <div class="tile">
            <span class="tile-label">{t(lang, "ready")}</span>
            <b>{home.ready}</b>
          </div>
        </section>
      ) : null}
      <div class="cols">
        <section class="card route" aria-labelledby="route-h">
          <h2 id="route-h">{t(lang, "route")}</h2>
          <ol class="steps">
            {route.steps.map((s, i) => (
              <li class={`step step-${s.state}`} data-state={s.state} key={s.key}>
                <span class="step-n" aria-hidden="true">
                  {s.state === "done" ? "✓" : i + 1}
                </span>
                {s.state === "locked" ? (
                  <span class="step-name">{t(lang, `step_${s.key}` as Key)}</span>
                ) : (
                  <a class="step-name" href={hrefOf(STEP_SECTION[s.key])}>
                    {t(lang, `step_${s.key}` as Key)}
                  </a>
                )}
                <span class="step-state">{t(lang, `state_${s.state}` as Key)}</span>
              </li>
            ))}
          </ol>
        </section>
        {home && home.modules.length ? (
          <section class="card" aria-labelledby="mods-h">
            <h2 id="mods-h">{t(lang, "modules")}</h2>
            {home.modules.map((m) => {
              const pct = m.total ? Math.round((100 * m.done) / m.total) : 0;
              return (
                <div class="module" key={m.name}>
                  <div class="module-row">
                    <span class="module-name">{m.name}</span>
                    <span class="faint">
                      {m.done} {t(lang, "ofTotal")} {m.total}
                    </span>
                  </div>
                  <div
                    class="bar"
                    role="progressbar"
                    aria-label={m.name}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                  >
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </section>
        ) : null}
      </div>
    </>
  );
}
