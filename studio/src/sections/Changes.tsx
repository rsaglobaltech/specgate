/**
 * Changes (REQ-206, REQ-207, REQ-216): the brief's modules on the left, each
 * with where it stands; on the right the chosen one — drafted, being drafted,
 * or a draft to review, with what stops its approval and the action that
 * clears each thing — the approved design's Cambios.
 */
import { useState } from "preact/hooks";
import { t, type Key, type Lang } from "../core/i18n";
import { Busy, type Result } from "../ui/Busy";

export type ModuleStage = "todo" | "drafting" | "review" | "approved" | "archived" | "stopped";

export interface ModuleView {
  key: string;
  stage: ModuleStage;
  requirements: number;
  scenarios: number;
  questions: number;
  findings: Array<{ severity: string; code: string; message: string }>;
  progress: null | {
    seconds: number;
    requirements: number;
    scenarios: number;
    notes: boolean;
    lastStep: string;
  };
}

export interface ModulesData {
  brief: boolean;
  modules: ModuleView[];
  job: { kind: string; module?: string } | null;
  step: string;
}

export interface BlockerAction {
  kind: "answer" | "confirm" | "open";
  question?: string;
  requirement?: string;
}

export interface DraftView {
  change: string;
  module: string;
  requirements: Array<{
    id: string;
    title: string;
    statement: string;
    status: string;
    scenarios: Array<{ id: string; title: string; steps: string[] }>;
  }>;
  blockers: Array<{ code: string; message: string; action?: BlockerAction }>;
  notes: Array<{ date: string; requirement: string; text: string }>;
  questions: Array<{ id: string; text: string; blocks: string[] }>;
}

export interface ChangesProps {
  lang: Lang;
  modules: ModulesData;
  drafts: DraftView[];
  onDraft: (module: string) => Promise<Result>;
  onStopDraft: () => Promise<Result>;
  onApprove: (change: string) => Promise<Result>;
  onNote: (change: string, requirement: string, text: string) => Promise<Result>;
  onConfirm: (change: string, question: string) => Promise<Result>;
}

const STAGE_KEY: Record<ModuleStage, Key> = {
  todo: "stTodo",
  stopped: "stStopped",
  drafting: "stDrafting",
  review: "stReview",
  approved: "stApproved",
  archived: "stArchived",
};

/** Where a change is in its cycle: drafted, approved, built, archived. */
const CYCLE: Record<ModuleStage, number> = {
  todo: -1,
  stopped: -1,
  drafting: 0,
  review: 0,
  approved: 1,
  archived: 3,
};

/** Text with `code` in back-ticks shown as code. */
function Inline({ text }: { text: string }) {
  return <>{text.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <code>{part}</code> : part))}</>;
}

/** `GIVEN a cart` → the keyword in the reader's language, and the rest. */
function Step({ lang, step }: { lang: Lang; step: string }) {
  const sp = step.indexOf(" ");
  const k = (sp > 0 ? step.slice(0, sp) : step).toUpperCase();
  const words: Record<string, Key> = {
    GIVEN: "kwGiven",
    WHEN: "kwWhen",
    THEN: "kwThen",
    AND: "kwAnd",
    DADO: "kwGiven",
    CUANDO: "kwWhen",
    ENTONCES: "kwThen",
    Y: "kwAnd",
  };
  return (
    <li>
      <b class="kw">{words[k] ? t(lang, words[k]) : k}</b>{" "}
      <Inline text={sp > 0 ? step.slice(sp + 1) : ""} />
    </li>
  );
}

function Said({ lang, r }: { lang: Lang; r: Result | null }) {
  if (!r) return null;
  return (
    <span role="status" class={r.ok ? "ok" : "err"}>
      {r.ok ? t(lang, "done") : `${t(lang, "errorPrefix")} ${r.message || ""}`}
    </span>
  );
}

function Requirement({
  lang,
  draft,
  r,
  onNote,
}: {
  lang: Lang;
  draft: DraftView;
  r: DraftView["requirements"][number];
  onNote: ChangesProps["onNote"];
}) {
  const [text, setText] = useState("");
  const [said, setSaid] = useState<Result | null>(null);
  const waits = draft.questions.filter((q) => q.blocks.includes(r.id)).map((q) => q.id);
  const field = `note-${draft.change}-${r.id}`;
  return (
    <article class="req">
      <div class="req-head">
        <span class="id">{r.id}</span>
        <h4>{r.title}</h4>
        {waits.length ? (
          <span class="chip warn">
            {t(lang, "waitsFor")} {waits.join(", ")}
          </span>
        ) : null}
      </div>
      {r.statement ? <p>{r.statement}</p> : null}
      {r.scenarios.map((s) => (
        <ol class="steps" aria-label={`${s.id} ${s.title}`}>
          {s.steps.map((x) => (
            <Step lang={lang} step={x} />
          ))}
        </ol>
      ))}
      <details>
        <summary>{t(lang, "askChange")}</summary>
        <label for={field} class="label">
          {t(lang, "askChangeLabel")} {r.id}
        </label>
        <textarea
          id={field}
          rows={2}
          value={text}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        />
        <div class="row">
          <Busy
            class="btn-ghost"
            busyLabel={t(lang, "saving")}
            disabled={!text.trim()}
            onRun={() => onNote(draft.change, r.id, text.trim())}
            onDone={(x) => {
              setSaid(x);
              if (x.ok) setText("");
            }}
          >
            {t(lang, "askChangeBtn")}
          </Busy>
          <Said lang={lang} r={said} />
        </div>
      </details>
    </article>
  );
}

function Review({
  lang,
  draft,
  onApprove,
  onNote,
  onConfirm,
}: {
  lang: Lang;
  draft: DraftView;
  onApprove: ChangesProps["onApprove"];
  onNote: ChangesProps["onNote"];
  onConfirm: ChangesProps["onConfirm"];
}) {
  const [said, setSaid] = useState<Result | null>(null);
  const [confirmed, setConfirmed] = useState<Result | null>(null);
  const n = draft.blockers.length;
  return (
    <>
      <div class="card">
        <h3>{t(lang, "toApprove")}</h3>
        {!n ? (
          <div class="check ok-line">
            <span aria-hidden="true">✓</span>
            <span>{t(lang, "allGood")}</span>
          </div>
        ) : null}
        {draft.blockers.map((b) => (
          <div class="check warn-line">
            <span aria-hidden="true">!</span>
            <span class="grow">{b.message}</span>
            {b.action?.kind === "answer" ? (
              <a class="btn-ghost" href="#/questions">
                {t(lang, "answerQ")} {b.action.question}
              </a>
            ) : b.action?.kind === "confirm" ? (
              <Busy
                class="btn-ghost"
                busyLabel={t(lang, "saving")}
                onRun={() => onConfirm(draft.change, b.action!.question!)}
                onDone={setConfirmed}
              >
                {t(lang, "inSpec")}
              </Busy>
            ) : b.action?.kind === "open" ? (
              <code class="where">
                {b.action.requirement} · docs/specs/changes/{draft.change}
              </code>
            ) : null}
          </div>
        ))}
        <Said lang={lang} r={confirmed} />
        <div class="row approve">
          <Busy
            busyLabel={t(lang, "approving")}
            disabled={n > 0}
            onRun={() => onApprove(draft.change)}
            onDone={setSaid}
          >
            {t(lang, "approve")}
          </Busy>
          {n ? (
            <span class="faint" id={`why-${draft.change}`}>
              {t(lang, n === 1 ? "missingOne" : "missingMany").replace("{N}", String(n))}
            </span>
          ) : null}
          <Said lang={lang} r={said} />
        </div>
      </div>
      <div class="card">
        <h3>{t(lang, "draftReqs")}</h3>
        {draft.requirements.map((r) => (
          <Requirement lang={lang} draft={draft} r={r} onNote={onNote} />
        ))}
      </div>
      {draft.notes.length ? (
        <div class="card">
          <h3>{t(lang, "notes")}</h3>
          {draft.notes.map((x) => (
            <p class="note">
              <span class="id">{x.date}</span> {x.requirement ? `${x.requirement} · ` : ""}
              {x.text}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}

function Drafting({
  lang,
  m,
  step,
  onStop,
}: {
  lang: Lang;
  m: ModuleView;
  step: string;
  onStop: ChangesProps["onStopDraft"];
}) {
  const p = m.progress;
  const items: Array<[string, boolean]> = [
    [t(lang, "pRead"), true],
    [
      `${t(lang, "pReqs")}${p?.requirements ? ` (${p.requirements})` : ""}`,
      (p?.requirements || 0) > 0,
    ],
    [`${t(lang, "pScn")}${p?.scenarios ? ` (${p.scenarios})` : ""}`, (p?.scenarios || 0) > 0],
    [t(lang, "pNotes"), !!p?.notes],
    [t(lang, "pCheck"), false],
  ];
  const now = items.findIndex(([, ok]) => !ok);
  return (
    <div class="card" aria-live="polite">
      <div class="row">
        <span class="spin" aria-hidden="true" />
        <strong>
          {t(lang, "stDrafting")} · {Math.max(1, Math.round((p?.seconds || 0) / 60))} min
        </strong>
      </div>
      <ol class="progress">
        {items.map(([name, ok], i) => (
          <li class={ok ? "done" : i === now ? "now" : "todo"}>
            <span aria-hidden="true">{ok ? "✓" : i === now ? "●" : "○"}</span> {name}
          </li>
        ))}
      </ol>
      {p?.lastStep || step ? <p class="faint">{p?.lastStep || step}</p> : null}
      <div class="row">
        <Busy class="btn-danger" busyLabel={t(lang, "stopping")} onRun={onStop}>
          {t(lang, "stopIt")}
        </Busy>
      </div>
    </div>
  );
}

export function Changes({
  lang,
  modules,
  drafts,
  onDraft,
  onStopDraft,
  onApprove,
  onNote,
  onConfirm,
}: ChangesProps) {
  const list = modules.modules;
  const first =
    list.find((m) => m.stage === "drafting") || list.find((m) => m.stage === "review") || list[0];
  const [chosen, setChosen] = useState<string>("");
  const [said, setSaid] = useState<Result | null>(null);
  const m = list.find((x) => x.key === chosen) || first;
  const draft = m ? drafts.find((d) => d.module === m.key) : undefined;
  const busy = !!modules.job;
  const next = list.find((x) => x.stage === "todo" || x.stage === "stopped");
  return (
    <>
      <header class="head head-row">
        <div>
          <h1>{t(lang, "changes")}</h1>
          <p class="lead">{t(lang, "changesIntro")}</p>
        </div>
        {next ? (
          <Busy
            busyLabel={t(lang, "starting")}
            disabled={busy}
            onRun={() => onDraft(next.key)}
            onDone={setSaid}
          >
            {t(lang, "draftNext")} →
          </Busy>
        ) : null}
      </header>
      <Said lang={lang} r={said && !said.ok ? said : null} />
      {!modules.brief ? (
        <div class="card empty">
          {t(lang, "noBrief")} <a href="#/brief">{t(lang, "brief")} →</a>
        </div>
      ) : (
        <div class="master">
          <nav class="list" aria-label={t(lang, "changesList")}>
            {list.map((x) => (
              <a
                href={`#/changes`}
                aria-current={m && x.key === m.key ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setChosen(x.key);
                }}
              >
                <span class="name">{x.key}</span>
                <span class={`faint stage-${x.stage}`}>
                  {t(lang, STAGE_KEY[x.stage])}
                  {x.stage === "review" && x.questions
                    ? ` · ${x.questions} ${t(lang, "questionsShort")}`
                    : ""}
                </span>
              </a>
            ))}
          </nav>
          {m ? (
            <section class="detail" aria-labelledby="change-h">
              <div class="detail-head">
                <h2 id="change-h">{m.key}</h2>
                <span class="faint">
                  {m.requirements} {t(lang, "reqs")} · {m.scenarios} {t(lang, "scenariosShort")}
                </span>
              </div>
              <ol class="cycle" aria-label={t(lang, "cycle")}>
                {(["cycDraft", "cycApproved", "cycBuilt", "cycArchived"] as const).map((k, i) => (
                  <li class={i < CYCLE[m.stage] ? "done" : i === CYCLE[m.stage] ? "now" : "todo"}>
                    <span aria-hidden="true" />
                    {t(lang, k)}
                  </li>
                ))}
              </ol>
              {m.stage === "drafting" ? (
                <Drafting lang={lang} m={m} step={modules.step} onStop={onStopDraft} />
              ) : m.stage === "todo" || m.stage === "stopped" ? (
                <div class="card">
                  <p>{t(lang, m.stage === "stopped" ? "stoppedHint" : "todoHint")}</p>
                  <div class="row">
                    <Busy
                      busyLabel={t(lang, "starting")}
                      disabled={busy}
                      onRun={() => onDraft(m.key)}
                      onDone={setSaid}
                    >
                      {t(lang, m.stage === "stopped" ? "retry" : "draftIt")}
                    </Busy>
                    {busy ? <span class="faint">{t(lang, "oneAtATime")}</span> : null}
                  </div>
                </div>
              ) : draft ? (
                <Review
                  lang={lang}
                  draft={draft}
                  onApprove={onApprove}
                  onNote={onNote}
                  onConfirm={onConfirm}
                />
              ) : (
                <div class="card">
                  <p>{t(lang, m.stage === "archived" ? "archivedHint" : "approvedHint")}</p>
                  {m.stage === "approved" ? (
                    <a class="btn-primary" href="#/build">
                      {t(lang, "build")} →
                    </a>
                  ) : null}
                </div>
              )}
              {m.findings.length && m.stage !== "drafting" ? (
                <div class="card">
                  <h3>{t(lang, "draftChecks")}</h3>
                  {m.findings.map((f) => (
                    <div class={`check ${f.severity === "error" ? "err-line" : "warn-line"}`}>
                      <span aria-hidden="true">!</span>
                      <span>{f.message}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
