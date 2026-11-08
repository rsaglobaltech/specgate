/**
 * The gate and the doctor, run from the studio (REQ-440): each stage or
 * finding with its mark and, under what failed, the fix it ships.
 */
import { t, type Key, type Lang } from "../core/i18n";
import { readCliResult } from "../core/cliResult";
import type { ActionRun } from "../core/useAction";
import { Busy, type Result } from "./Busy";

const STAGES: Record<string, Key> = {
  Specification: "stageSpec",
  Tests: "stageTests",
  Architecture: "stageArch",
  Quality: "stageQuality",
  Ids: "stageIds",
};

const ICON = { pass: "✓", fail: "✗", warn: "!", skip: "·" } as const;

/** What the last check or doctor found. */
export function Gate({ lang, run, output }: { lang: Lang; run: ActionRun | null; output: string }) {
  if (!run || (run.action !== "check" && run.action !== "doctor")) return null;
  const { items, summary } = readCliResult(output);
  const running = run.exit === null;
  return (
    <div class="gate" aria-live="polite">
      <p class={running ? "faint" : run.exit === 0 ? "ok" : "err"} role="status">
        {running ? <span class="spin" aria-hidden="true" /> : null}{" "}
        {running
          ? t(lang, run.action === "check" ? "gateRunning" : "doctorRunning")
          : run.action === "check"
            ? t(lang, run.exit === 0 ? "gatePasses" : "gateFails")
            : t(lang, run.exit === 0 ? "doctorOk" : "doctorFound")}
        {summary ? <span class="faint"> · {summary}</span> : null}
      </p>
      <ul class="gate-list">
        {items.map((x) => (
          <li class={`gate-item gate-${x.mark}`}>
            <span aria-hidden="true">{ICON[x.mark]}</span>
            <strong>{STAGES[x.name] ? t(lang, STAGES[x.name]) : x.name}</strong>
            {x.detail ? (
              <>
                {" "}
                <code>{x.detail}</code>
              </>
            ) : null}
            {x.fix ? <span class="fix">fix: {x.fix}</span> : null}
          </li>
        ))}
      </ul>
      {!running && !items.length ? <pre class="term term-out">{output}</pre> : null}
    </div>
  );
}

/** The card that runs them: on Home and in Report. */
export function GateCard({
  lang,
  run,
  output,
  onAction,
}: {
  lang: Lang;
  run: ActionRun | null;
  output: string;
  onAction: (action: string, args: Record<string, unknown>) => Promise<Result>;
}) {
  return (
    <section class="card" aria-labelledby="gate-h">
      <div class="row spread">
        <div>
          <h2 id="gate-h">{t(lang, "gateTitle")}</h2>
          <p class="faint">{t(lang, "gateIntro")}</p>
        </div>
        <div class="row">
          <Busy
            busyLabel={t(lang, "starting")}
            disabled={!!run && run.exit === null}
            onRun={() => onAction("check", {})}
          >
            {t(lang, "runGate")}
          </Busy>
          <Busy
            class="btn-ghost"
            busyLabel={t(lang, "starting")}
            disabled={!!run && run.exit === null}
            onRun={() => onAction("doctor", {})}
          >
            {t(lang, "runDoctor")}
          </Busy>
        </div>
      </div>
      <Gate lang={lang} run={run} output={output} />
    </section>
  );
}
