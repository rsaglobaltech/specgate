/**
 * A change as Specgate keeps it (REQ-439): its progress, its requirements and
 * their status, its proposal and tasks; validated; archived once every
 * requirement in it is delivered — after a preview of what archive writes.
 */
import { useState } from "preact/hooks";
import { t, type Lang } from "../../core/i18n";
import type { ActionRun } from "../../core/useAction";
import { FromTicket } from "./FromTicket";
import { Busy, type Result } from "../../ui/Busy";
import { Command } from "../../ui/Command";
import { Gate } from "../../ui/Gate";

export interface ChangeView {
  id: string;
  module: string | null;
  approved: string;
  requirements: Array<{ id: string; title: string; status: string }>;
  delivered: number;
  tasks: { done: number; total: number; items: Array<{ text: string; done: boolean }> };
  proposal: string;
  canArchive: boolean;
  /** The ticket it was opened from, and its address on the ALM (REQ-447). */
  ticket?: string | null;
  ticketUrl?: string | null;
}

export interface ActionProps {
  /** The command the studio ran last, and its output. */
  run: ActionRun | null;
  output: string;
  /** What the last command printed on stdout, when it prints JSON. */
  json?: unknown;
  onAction: (action: string, args: Record<string, unknown>) => Promise<Result>;
}

const DONE = new Set(["Implemented", "Verified", "Released"]);

/** Whether the command ran last is this one, for this change. */
const about = (run: ActionRun | null, actions: string[], id: string) =>
  !!run && actions.includes(run.action) && run.argv.includes(id);

export function ChangePanel({
  lang,
  change,
  run,
  output,
  onAction,
}: { lang: Lang; change: ChangeView } & ActionProps) {
  const [sure, setSure] = useState(false);
  const previewed = about(run, ["archive-preview"], change.id) && run!.exit === 0;
  const mine = about(run, ["change-validate", "archive-preview", "archive"], change.id);
  // apply names the requirement, not the change: it is this change's when it is one of its own.
  const applied =
    !!run && run.action === "apply" && change.requirements.some((r) => run.argv.includes(r.id));
  return (
    <div class="card change-panel" aria-labelledby={`chg-${change.id}`}>
      <div class="row spread">
        <h3 id={`chg-${change.id}`}>
          {t(lang, "theChange")} <code class="where">{change.id}</code>
          {change.ticket ? (
            <>
              {" · "}
              {change.ticketUrl ? (
                <a href={change.ticketUrl} target="_blank" rel="noopener noreferrer">
                  {change.ticket}
                </a>
              ) : (
                <span>{change.ticket}</span>
              )}
            </>
          ) : null}
        </h3>
        <span class="faint">
          {t(lang, "reqsDelivered")
            .replace("{D}", String(change.delivered))
            .replace("{T}", String(change.requirements.length))}
          {change.tasks.total
            ? ` · ${t(lang, "tasksDone").replace("{D}", String(change.tasks.done)).replace("{T}", String(change.tasks.total))}`
            : ""}
        </span>
      </div>
      {change.requirements.length ? (
        <ul class="req-states">
          {change.requirements.map((r) => (
            <li>
              <span class="id">{r.id}</span> {r.title}{" "}
              <span
                class={`chip${DONE.has(r.status) ? " ok-chip" : r.status === "Needs Clarification" ? " warn" : ""}`}
              >
                {r.status}
              </span>
              {!DONE.has(r.status) ? (
                <>
                  {" "}
                  <Busy
                    class="btn-ghost btn-small"
                    busyLabel={t(lang, "applying")}
                    onRun={() => onAction("apply", { req: r.id })}
                  >
                    {t(lang, "deliver")}
                  </Busy>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {change.proposal ? (
        <details>
          <summary>{t(lang, "proposal")}</summary>
          <pre class="doc-text">{change.proposal}</pre>
        </details>
      ) : null}
      {change.tasks.total ? (
        <details>
          <summary>{t(lang, "tasks")}</summary>
          <ul class="task-list">
            {change.tasks.items.map((x) => (
              <li class={x.done ? "done" : ""}>
                <span aria-hidden="true">{x.done ? "☑" : "☐"}</span> {x.text}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div class="row">
        <Busy
          class="btn-ghost"
          busyLabel={t(lang, "starting")}
          onRun={() => onAction("change-validate", { change: change.id })}
        >
          {t(lang, "validate")}
        </Busy>
        {change.canArchive ? (
          <Busy
            class="btn-ghost"
            busyLabel={t(lang, "starting")}
            onRun={() => onAction("archive-preview", { change: change.id })}
          >
            {t(lang, "archivePreview")}
          </Busy>
        ) : (
          <span class="faint">{t(lang, "archiveWhen")}</span>
        )}
        {change.canArchive && previewed && !sure ? (
          <button type="button" class="btn-primary" onClick={() => setSure(true)}>
            {t(lang, "archive")}
          </button>
        ) : null}
        {change.canArchive && previewed && sure ? (
          <>
            <span class="faint">{t(lang, "archiveSure")}</span>
            <Busy
              busyLabel={t(lang, "archiving")}
              onRun={() => onAction("archive", { change: change.id })}
            >
              {t(lang, "archiveNow")}
            </Busy>
            <button type="button" class="link" onClick={() => setSure(false)}>
              {t(lang, "cancel")}
            </button>
          </>
        ) : null}
      </div>
      {mine ? <Command lang={lang} run={run} output={output} /> : null}
      {applied ? <Gate lang={lang} run={run} output={output} /> : null}
    </div>
  );
}

/** A new change: from an idea, by its id; or from a ticket, when an ALM is configured. */
export function NewChange({
  lang,
  alm,
  capabilities = [],
  run,
  output,
  json,
  onAction,
}: { lang: Lang; alm: boolean; capabilities?: string[] } & ActionProps) {
  const [id, setId] = useState("");
  const slug = /^[a-z0-9][a-z0-9-]{1,63}$/.test(id);
  const mine = !!run && run.action === "propose-idea";
  return (
    <section class="card" aria-labelledby="new-change-h">
      <h2 id="new-change-h">{t(lang, "newChange")}</h2>
      <label for="new-change-id" class="label">
        {t(lang, "newChangeId")}
      </label>
      <div class="row">
        <input
          id="new-change-id"
          class="text-plain grow"
          type="text"
          value={id}
          placeholder="add-dynamic-pricing"
          aria-describedby="new-change-hint"
          onInput={(e) => setId((e.target as HTMLInputElement).value.trim())}
        />
        <Busy
          busyLabel={t(lang, "starting")}
          disabled={!slug}
          onRun={() => onAction("propose-idea", { change: id })}
        >
          {t(lang, "propose")}
        </Busy>
      </div>
      <span id="new-change-hint" class="faint hint">
        {t(lang, "newChangeHint")}
      </span>
      {mine ? <Command lang={lang} run={run} output={output} /> : null}
      {alm ? (
        <FromTicket
          lang={lang}
          capabilities={capabilities}
          run={run}
          output={output}
          json={json}
          onAction={onAction}
        />
      ) : null}
    </section>
  );
}
