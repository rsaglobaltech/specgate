/**
 * A change from a ticket, as `propose --from-ticket` opens it (REQ-446): the
 * ticket reviewed first with `--check --json` — ready or not, each finding
 * with its fix, the capability it goes into or the project's to choose from —
 * and only a ready one opened.
 */
import { useState } from "preact/hooks";
import { t, type Lang } from "../../core/i18n";
import { sayFinding } from "../../core/serverText";
import { Busy } from "../../ui/Busy";
import { Command } from "../../ui/Command";
import type { ActionProps } from "./ChangePanel";

export interface TicketReview {
  ticket: { key: string; summary: string; type: string; url?: string | null };
  ready: boolean;
  /** The capability its epic maps to, or null: then the person chooses one. */
  capability: string | null;
  errors: number;
  warnings: number;
  status: Array<{ severity: string; code: string; message: string; fix?: string }>;
  /** The branch and folder it would be opened on: the one that names the ticket, or the one created (REQ-447). */
  opens?: { branch: string; existing: boolean; folder: string };
}

export interface OpenChoice {
  /** The capability chosen, when the ticket has none. */
  capability: string;
  push: boolean;
}

/** The arguments `propose-ticket` is started with, for the ticket reviewed and what was chosen. */
export function ticketOpenArgs(review: TicketReview, choice: OpenChoice): Record<string, string> {
  const args: Record<string, string> = { ticket: review.ticket.key };
  if (!review.capability && choice.capability) args.capability = choice.capability;
  return args;
}

const MARK = { error: ["fail", "✗"], warning: ["warn", "!"] } as const;

export function FromTicket({
  lang,
  capabilities,
  review: given,
  run,
  output,
  json,
  onAction,
}: {
  lang: Lang;
  capabilities: string[];
  /** The review to show; else the one the last `ticket-check` printed. */
  review?: TicketReview | null;
} & ActionProps) {
  const [key, setKey] = useState("");
  const [chosen, setChosen] = useState("");
  const valid = /^[A-Z][A-Z0-9_]{0,19}-\d{1,9}$/.test(key);
  const checked = run?.action === "ticket-check" && run.exit !== null;
  const review =
    given ?? (checked && json && typeof json === "object" ? (json as TicketReview) : null);
  const capability = review?.capability || chosen;
  const mine =
    !!run && (run.action === "propose-ticket" || (run.action === "ticket-check" && !review));
  return (
    <div class="from-ticket">
      <label for="new-change-ticket" class="label">
        {t(lang, "fromTicket")}
      </label>
      <div class="row">
        <input
          id="new-change-ticket"
          class="text-plain grow"
          type="text"
          value={key}
          placeholder="KAN-13"
          onInput={(e) => setKey((e.target as HTMLInputElement).value.trim().toUpperCase())}
        />
        <Busy
          id="ticket-review"
          class="btn-ghost"
          busyLabel={t(lang, "starting")}
          disabled={!valid}
          onRun={() => onAction("ticket-check", { ticket: key })}
        >
          {t(lang, "ticketReview")}
        </Busy>
      </div>
      {review ? (
        <div class="ticket-review" aria-live="polite">
          <p>
            {review.ticket.url ? (
              <a href={review.ticket.url} target="_blank" rel="noopener noreferrer">
                <strong>{review.ticket.key}</strong>
              </a>
            ) : (
              <strong>{review.ticket.key}</strong>
            )}{" "}
            {review.ticket.summary}
            <span class="faint"> · {review.ticket.type || "issue"}</span>
          </p>
          <p class={review.ready ? "ok-line" : "warn-line"}>
            <span aria-hidden="true">{review.ready ? "✓" : "✗"}</span>{" "}
            <strong>{t(lang, review.ready ? "ticketReady" : "ticketNotReady")}</strong>
          </p>
          {review.status.length ? (
            <ul class="gate-list">
              {review.status.map((f) => {
                const [mark, icon] = MARK[f.severity as keyof typeof MARK] ?? ["skip", "·"];
                return (
                  <li class={`gate-item gate-${mark}`}>
                    <span aria-hidden="true">{icon}</span>
                    <strong>{sayFinding(lang, f.code, f.message)}</strong>
                    {f.fix ? <span class="fix">fix: {f.fix}</span> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {review.ready ? (
            <>
              {review.capability ? (
                <p>
                  {t(lang, "ticketCapability")} <code>{review.capability}</code>
                </p>
              ) : (
                <>
                  <label for="ticket-capability" class="label">
                    {t(lang, "ticketChooseCapability")}
                  </label>
                  <select
                    id="ticket-capability"
                    value={chosen}
                    onChange={(e) => setChosen((e.target as HTMLSelectElement).value)}
                  >
                    <option value="">{t(lang, "ticketChoose")}</option>
                    {capabilities.map((c) => (
                      <option value={c}>{c}</option>
                    ))}
                  </select>
                </>
              )}
              {review.opens ? (
                <p>
                  {review.opens.existing ? (
                    <>
                      {t(lang, "ticketOnBranch")} <code>{review.opens.branch}</code>
                      {t(lang, "ticketOnBranchWhy")}
                    </>
                  ) : (
                    <>
                      {t(lang, "ticketCreatesBranch")} <code>{review.opens.branch}</code>
                    </>
                  )}
                </p>
              ) : null}
              <div class="row">
                <Busy
                  id="ticket-open"
                  busyLabel={t(lang, "starting")}
                  disabled={!capability}
                  onRun={() =>
                    onAction("propose-ticket", ticketOpenArgs(review, { capability, push: true }))
                  }
                >
                  {t(lang, "ticketOpen")}
                </Busy>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {mine ? <Command lang={lang} run={run} output={output} /> : null}
    </div>
  );
}
