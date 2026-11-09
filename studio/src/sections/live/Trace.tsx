/**
 * The traceability matrix as it stands (REQ-181): one accordion per module,
 * each scenario with its feature, its tests and its status, delivered or still
 * in a change — filtered as the viewer types.
 */
import { useState } from "preact/hooks";
import { t, type Lang } from "../../core/i18n";
import type { MatrixRow } from "./model";

export function Trace({ lang, rows }: { lang: Lang; rows: MatrixRow[] }) {
  const [filter, setFilter] = useState("");
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter((r) => {
    const hay =
      `${r.requirement} ${r.scenario} ${r.title} ${r.group} ${r.feature} ${r.tests.join(" ")} ${r.status}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const groups = new Map<string, MatrixRow[]>();
  for (const r of shown)
    groups.set(r.group || "spec", [...(groups.get(r.group || "spec") || []), r]);
  return (
    <section class="card trace" aria-labelledby="trace-h">
      <div class="row spread">
        <h2 id="trace-h">{t(lang, "traceability")}</h2>
        <input
          class="text-plain trace-filter"
          type="search"
          value={filter}
          aria-label={t(lang, "traceFilter")}
          placeholder={t(lang, "traceFilter")}
          onInput={(e) => setFilter((e.target as HTMLInputElement).value)}
        />
      </div>
      {!shown.length ? <p class="faint">{t(lang, "traceNone")}</p> : null}
      {[...groups.entries()].map(([g, list]) => (
        <details open>
          <summary>
            <strong>{g}</strong> <span class="faint">· {list.length}</span>
          </summary>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">{t(lang, "colReq")}</th>
                  <th scope="col">{t(lang, "colScenario")}</th>
                  <th scope="col">{t(lang, "colFeature")}</th>
                  <th scope="col">{t(lang, "colTests")}</th>
                  <th scope="col">{t(lang, "colState")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr>
                    <th scope="row">
                      <span class="id">{r.requirement}</span> {r.title}
                    </th>
                    <td>{r.scenario || "—"}</td>
                    <td>{r.feature ? <code>{r.feature}</code> : "—"}</td>
                    <td>
                      {r.tests.length ? r.tests.map((x) => <code class="block">{x}</code>) : "—"}
                    </td>
                    <td>
                      {r.status}{" "}
                      <span class="faint">
                        · {t(lang, r.source === "spec" ? "inSpecShort" : "inChange")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </section>
  );
}
