/**
 * The run as a matrix by module (REQ-181): a row per module, a segment per
 * requirement coloured by what the run did to it — or its status when the run
 * has not reached it — with its legend; a segment opens its requirement.
 */
import { t, type Key, type Lang } from "../../core/i18n";
import { dur, type ModuleRow, type SegState } from "./model";

const LEGEND: Array<[SegState, Key]> = [
  ["pass", "segPass"],
  ["running", "segRunning"],
  ["fail", "segFail"],
  ["question", "asks"],
  ["blocked", "segBlocked"],
  ["queued", "segQueued"],
];

export function Matrix({
  lang,
  rows,
  selected,
  onSelect,
}: {
  lang: Lang;
  rows: ModuleRow[];
  selected: string;
  onSelect: (req: string) => void;
}) {
  const word = (s: SegState) => t(lang, (LEGEND.find(([k]) => k === s) || LEGEND[5])[1]);
  return (
    <section class="card matrix" aria-labelledby="matrix-h">
      <h2 id="matrix-h">{t(lang, "byModule")}</h2>
      {!rows.length ? <p class="faint">{t(lang, "noEventsYet")}</p> : null}
      <div id="chain" role="group" aria-labelledby="matrix-h" class="mm">
        {rows.length ? (
          <div class="mm-row mm-head" aria-hidden="true">
            <span>{t(lang, "colModule")}</span>
            <span>{t(lang, "reqs")}</span>
            <span class="num">{t(lang, "segPass")}</span>
            <span class="num">{t(lang, "time")}</span>
          </div>
        ) : null}
        {rows.map((row) => (
          <div class="mm-row">
            <span class="mm-name">{row.group}</span>
            <span class="mm-bar">
              {row.reqs.map((q) => (
                <button
                  type="button"
                  class={`seg seg-${q.state}`}
                  aria-pressed={selected === q.req}
                  aria-label={`${q.req} — ${q.title} · ${word(q.state)}${q.elapsed ? ` · ${dur(q.elapsed)}` : ""}`}
                  title={`${q.req} — ${q.title} · ${word(q.state)}`}
                  onClick={() => onSelect(q.req)}
                />
              ))}
            </span>
            <span class="num">
              {row.passed}/{row.reqs.length}
            </span>
            <span class="num">{row.time ? dur(row.time) : "—"}</span>
          </div>
        ))}
      </div>
      <ul class="legend" aria-label={t(lang, "legend")}>
        {LEGEND.map(([k, w]) => (
          <li>
            <span class={`seg seg-${k}`} aria-hidden="true" /> {t(lang, w)}
          </li>
        ))}
      </ul>
    </section>
  );
}
