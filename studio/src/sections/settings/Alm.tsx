/**
 * Jira and Azure Boards from the studio (REQ-444): the requirement ↔ issue
 * mapping, a sync previewed and then run. The token stays in the environment
 * studio was started from: the page names its variable and says whether it is
 * set — it never asks for it, shows it or keeps it.
 */
import { useState } from "preact/hooks";
import { t, type Lang } from "../../core/i18n";
import type { ActionRun } from "../../core/useAction";
import { Busy, type Result } from "../../ui/Busy";
import { Command } from "../../ui/Command";

export interface AlmData {
  configured: boolean;
  provider: string;
  project: string;
  tokenEnv: string;
  tokenSet: boolean;
}

export function Alm({
  lang,
  alm,
  run = null,
  output = "",
  onAction,
}: {
  lang: Lang;
  alm: AlmData;
  run?: ActionRun | null;
  output?: string;
  onAction: (action: string, args: Record<string, unknown>) => Promise<Result>;
}) {
  const [sure, setSure] = useState(false);
  if (!alm.configured) return null;
  const mine = !!run && run.action.startsWith("alm-");
  const previewed = !!run && run.action === "alm-sync-preview" && run.exit === 0;
  return (
    <section class="card" aria-labelledby="alm-h">
      <div>
        <h2 id="alm-h">{t(lang, "almTitle")}</h2>
        <p class="faint">
          {alm.provider} · {alm.project} · alm.config.yaml
        </p>
      </div>
      <p class={alm.tokenSet ? "ok" : "err"}>
        <code>{alm.tokenEnv || "token_env"}</code>{" "}
        {t(lang, alm.tokenSet ? "almTokenSet" : "almTokenMissing")}
      </p>
      <div class="row">
        <Busy
          class="btn-ghost"
          busyLabel={t(lang, "starting")}
          onRun={() => onAction("alm-status", {})}
        >
          {t(lang, "almMapping")}
        </Busy>
        <Busy
          class={previewed ? "btn-ghost" : "btn-primary"}
          busyLabel={t(lang, "starting")}
          disabled={!alm.tokenSet}
          onRun={() => onAction("alm-sync-preview", {})}
        >
          {t(lang, "almPreview")}
        </Busy>
        {previewed && !sure ? (
          <button type="button" class="btn-primary" onClick={() => setSure(true)}>
            {t(lang, "almSync")}
          </button>
        ) : null}
        {previewed && sure ? (
          <>
            <span class="faint">{t(lang, "almSure")}</span>
            <Busy busyLabel={t(lang, "almSyncing")} onRun={() => onAction("alm-sync", {})}>
              {t(lang, "almSyncNow")}
            </Busy>
            <button type="button" class="link" onClick={() => setSure(false)}>
              {t(lang, "cancel")}
            </button>
          </>
        ) : null}
      </div>
      {mine ? <Command lang={lang} run={run} output={output} /> : null}
    </section>
  );
}
