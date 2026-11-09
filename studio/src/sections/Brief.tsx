/**
 * Brief (REQ-214, REQ-215): what the product is, who uses it and its
 * modules, written in a form that saves itself, or pasted for the assistant
 * to fill; its checks beside it, and the way on to the drafts.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import { t, type Lang } from "../core/i18n";
import { Busy, type Result } from "../ui/Busy";
import { sayFinding } from "../core/serverText";

export interface BriefModule {
  key: string;
  name: string;
  prose: string;
  rules: string[];
  examples: string[];
  questions: string[];
}

export interface BriefForm {
  product: string;
  actors: Array<{ name: string; surfaces: string[] }>;
  modules: BriefModule[];
}

export interface Finding {
  severity: string;
  code: string;
  message: string;
  fix?: string;
}

export interface BriefData extends BriefForm {
  exists: boolean;
  markdown: string;
  findings: Finding[];
}

export type Saved = Result & { brief?: { findings: Finding[]; markdown: string } };

export interface BriefProps {
  lang: Lang;
  advanced: boolean;
  data: BriefData;
  /** The profile the assistant runs with, "" when none is set up. */
  profile: string;
  /** The agent command harness.config.yaml holds, used when there is no profile (REQ-431). */
  agent?: string;
  /** A brief being read by the assistant now, and what it did last. */
  job: { kind: string } | null;
  step: string;
  onSave: (body: { form: BriefForm } | { markdown: string }) => Promise<Saved>;
  onFill: (text: string, replace: boolean) => Promise<Result>;
  onStop: () => Promise<Result>;
  /** Wait before an edit is saved; 0 in tests. */
  delay?: number;
}

const SURFACES = ["web", "api", "mobile"];

/** `Pedidos y envíos` → `pedidos-y-envios`. */
export const keyOf = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function Said({ lang, r }: { lang: Lang; r: Result | null }) {
  if (!r) return null;
  return (
    <span class={r.ok ? "ok" : "err"}>
      {r.ok ? t(lang, "done") : `${t(lang, "errorPrefix")} ${r.message || ""}`}
    </span>
  );
}

function Paste({
  lang,
  exists,
  profile,
  onFill,
}: {
  lang: Lang;
  exists: boolean;
  profile: string;
  onFill: BriefProps["onFill"];
}) {
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(false);
  const [said, setSaid] = useState<Result | null>(null);
  return (
    <section class="card" aria-labelledby="paste-h">
      <div>
        <h2 id="paste-h">{t(lang, "paste")}</h2>
        <p class="faint">{t(lang, "pasteP")}</p>
      </div>
      <textarea
        rows={exists ? 3 : 8}
        aria-labelledby="paste-h"
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
      />
      <div class="row">
        {exists ? (
          <label class="inline">
            <input type="checkbox" checked={replace} onChange={() => setReplace(!replace)} />{" "}
            {t(lang, "replace")}
          </label>
        ) : null}
        <Busy
          class={exists ? "btn-ghost" : "btn-primary"}
          busyLabel={t(lang, "starting")}
          disabled={!text.trim() || !profile}
          onRun={() => onFill(text, replace)}
          onDone={setSaid}
        >
          {t(lang, "pasteBtn")}
        </Busy>
        {!profile ? (
          <span class="faint">
            {t(lang, "needsAgentBrief")} <a href="#/build">{t(lang, "build")} →</a>
          </span>
        ) : null}
        <Said lang={lang} r={said} />
      </div>
    </section>
  );
}

function ListEditor({
  lang,
  label,
  hint,
  add,
  items,
  onChange,
}: {
  lang: Lang;
  label: string;
  hint: string;
  add: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <fieldset class="list-editor">
      <legend>
        <strong>{label}</strong> <span class="faint">· {hint}</span>
      </legend>
      {items.map((text, i) => (
        <div class="item">
          <input
            class="text-plain"
            type="text"
            value={text}
            aria-label={`${label} ${i + 1}`}
            onInput={(e) =>
              onChange(items.map((x, j) => (j === i ? (e.target as HTMLInputElement).value : x)))
            }
          />
          <button
            type="button"
            class="x"
            aria-label={`${t(lang, "remove")} ${label} ${i + 1}`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" class="link" onClick={() => onChange([...items, ""])}>
        + {add}
      </button>
    </fieldset>
  );
}

export function Brief({
  lang,
  advanced,
  data,
  profile,
  agent = "",
  job,
  step,
  onSave,
  onFill,
  onStop,
  delay = 700,
}: BriefProps) {
  const [form, setForm] = useState<BriefForm>({
    product: data.product,
    actors: data.actors,
    modules: data.modules,
  });
  const [findings, setFindings] = useState<Finding[]>(data.findings);
  const [markdown, setMarkdown] = useState(data.markdown);
  const [status, setStatus] = useState<"" | "saving" | "saved" | string>("");
  const [tab, setTab] = useState<"form" | "md">("form");
  const [chosen, setChosen] = useState(data.modules[0]?.key || "");
  const [newName, setNewName] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const keep = (r: Saved) => {
    if (r.ok && r.brief) {
      setFindings(r.brief.findings);
      setMarkdown(r.brief.markdown);
    }
    setStatus(r.ok ? "saved" : `${t(lang, "errorPrefix")} ${r.message || ""}`);
  };
  /** Every edit is kept a moment after the last key, as the old page did. */
  const edit = (next: BriefForm) => {
    setForm(next);
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void onSave({ form: next }).then(keep), delay);
  };

  if (job && job.kind === "brief") {
    return (
      <>
        <header class="head">
          <h1>{t(lang, "brief")}</h1>
        </header>
        <section class="card running" aria-live="polite">
          <div class="row">
            <span class="chip warn">
              <span class="spin" aria-hidden="true" /> {t(lang, "running")}
            </span>
            <strong>{t(lang, "reading")}</strong>
          </div>
          {step ? <p class="faint">{step}</p> : null}
          <div class="row">
            <Busy class="btn-danger" busyLabel={t(lang, "stopping")} onRun={onStop}>
              {t(lang, "stopIt")}
            </Busy>
          </div>
        </section>
      </>
    );
  }

  const head = (
    <header class="head">
      <h1>{t(lang, "brief")}</h1>
      <p class="lead">{t(lang, "briefIntro")}</p>
    </header>
  );
  if (!data.exists) {
    return (
      <>
        {head}
        <Paste lang={lang} exists={false} profile={profile || agent} onFill={onFill} />
        <section class="card" aria-labelledby="scratch-h">
          <div>
            <h2 id="scratch-h">{t(lang, "fromScratch")}</h2>
            <p class="faint">{t(lang, "fromScratchP")}</p>
          </div>
          <Busy
            class="btn-ghost"
            busyLabel={t(lang, "saving")}
            onRun={() =>
              onSave({
                form: { product: "", actors: [{ name: "", surfaces: ["web"] }], modules: [] },
              })
            }
          >
            {t(lang, "fromScratch")}
          </Busy>
        </section>
      </>
    );
  }

  const errors = findings.some((f) => f.severity === "error");
  const shown = findings.filter((f) => f.severity !== "info");
  const mod = form.modules.find((m) => m.key === chosen) || form.modules[0];
  const setModule = (next: BriefModule) =>
    edit({ ...form, modules: form.modules.map((m) => (m.key === next.key ? next : m)) });
  const addModule = () => {
    const name = newName.trim();
    const key = keyOf(name);
    if (!key || form.modules.some((m) => m.key === key)) return;
    edit({
      ...form,
      modules: [
        ...form.modules,
        { key, name, prose: "", rules: [""], examples: [], questions: [] },
      ],
    });
    setChosen(key);
    setNewName("");
  };
  const actors = form.actors.length ? form.actors : [{ name: "", surfaces: ["web"] }];
  const setActor = (i: number, a: { name: string; surfaces: string[] }) =>
    edit({ ...form, actors: actors.map((x, j) => (j === i ? a : x)) });

  return (
    <>
      {head}
      <Paste lang={lang} exists profile={profile || agent} onFill={onFill} />
      {advanced ? (
        <div class="tabs">
          {(["form", "md"] as const).map((k) => (
            <button
              type="button"
              class="chip-btn"
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
            >
              {t(lang, k === "form" ? "formTab" : "mdTab")}
            </button>
          ))}
        </div>
      ) : null}
      <div class="split">
        <div class="split-main">
          {advanced && tab === "md" ? (
            <section class="card">
              <label for="brief-md" class="where">
                docs/brief.md
              </label>
              <textarea
                id="brief-md"
                class="mono"
                rows={24}
                value={markdown}
                onInput={(e) => setMarkdown((e.target as HTMLTextAreaElement).value)}
              />
              <div class="row">
                <Busy
                  busyLabel={t(lang, "saving")}
                  onRun={() => onSave({ markdown })}
                  onDone={keep}
                >
                  {t(lang, "saveMd")}
                </Busy>
              </div>
            </section>
          ) : (
            <form class="card form" onSubmit={(e) => e.preventDefault()}>
              <label for="bf-product" class="label">
                {t(lang, "product")}
              </label>
              <input
                id="bf-product"
                class="text-plain"
                type="text"
                value={form.product}
                onInput={(e) => edit({ ...form, product: (e.target as HTMLInputElement).value })}
              />
              <fieldset class="list-editor">
                <legend>
                  <strong>{t(lang, "who")}</strong>
                </legend>
                {actors.map((a, i) => (
                  <div class="item">
                    <input
                      class="text-plain"
                      type="text"
                      value={a.name}
                      aria-label={`${t(lang, "actorName")} ${i + 1}`}
                      onInput={(e) =>
                        setActor(i, { ...a, name: (e.target as HTMLInputElement).value })
                      }
                    />
                    {SURFACES.map((s) => (
                      <label class="inline">
                        <input
                          type="checkbox"
                          checked={a.surfaces.includes(s)}
                          onChange={(e) =>
                            setActor(i, {
                              ...a,
                              surfaces: (e.target as HTMLInputElement).checked
                                ? [...a.surfaces, s]
                                : a.surfaces.filter((x) => x !== s),
                            })
                          }
                        />{" "}
                        {s === "api" ? "API" : s[0].toUpperCase() + s.slice(1)}
                      </label>
                    ))}
                    <button
                      type="button"
                      class="x"
                      aria-label={`${t(lang, "remove")} ${a.name || i + 1}`}
                      onClick={() => edit({ ...form, actors: actors.filter((_, j) => j !== i) })}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  class="link"
                  onClick={() =>
                    edit({ ...form, actors: [...actors, { name: "", surfaces: ["web"] }] })
                  }
                >
                  + {t(lang, "addActor")}
                </button>
              </fieldset>
              <fieldset class="list-editor">
                <legend>
                  <strong>{t(lang, "modsTitle")}</strong>
                </legend>
                <div class="chips">
                  {form.modules.map((m) => (
                    <button
                      type="button"
                      class="chip-btn"
                      aria-pressed={mod?.key === m.key}
                      onClick={() => setChosen(m.key)}
                    >
                      {m.name || m.key}
                      {findings.some((f) => f.severity !== "info" && f.message.includes(m.key))
                        ? " · !"
                        : ""}
                    </button>
                  ))}
                  <span class="add-module">
                    <input
                      class="text-plain"
                      type="text"
                      value={newName}
                      placeholder={t(lang, "moduleName")}
                      aria-label={t(lang, "moduleName")}
                      onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addModule();
                        }
                      }}
                    />
                    <button
                      type="button"
                      class="btn-ghost"
                      disabled={!keyOf(newName)}
                      onClick={addModule}
                    >
                      + {t(lang, "addModule")}
                    </button>
                  </span>
                </div>
                {mod ? (
                  <div class="module-box">
                    <ListEditor
                      lang={lang}
                      label={t(lang, "rules")}
                      hint={t(lang, "rulesP")}
                      add={t(lang, "addRule")}
                      items={mod.rules}
                      onChange={(rules) => setModule({ ...mod, rules })}
                    />
                    <ListEditor
                      lang={lang}
                      label={t(lang, "examples")}
                      hint={t(lang, "examplesP")}
                      add={t(lang, "addExample")}
                      items={mod.examples}
                      onChange={(examples) => setModule({ ...mod, examples })}
                    />
                    <ListEditor
                      lang={lang}
                      label={t(lang, "doubts")}
                      hint={t(lang, "doubtsP")}
                      add={t(lang, "addDoubt")}
                      items={mod.questions}
                      onChange={(questions) => setModule({ ...mod, questions })}
                    />
                    <button
                      type="button"
                      class="link danger"
                      onClick={() => {
                        edit({ ...form, modules: form.modules.filter((m) => m.key !== mod.key) });
                        setChosen("");
                      }}
                    >
                      {t(lang, "removeModule")} {mod.name || mod.key}
                    </button>
                  </div>
                ) : null}
              </fieldset>
            </form>
          )}
        </div>
        <aside class="split-side">
          <section class="card" aria-labelledby="checks-h">
            <div>
              <h2 id="checks-h">{t(lang, "checksB")}</h2>
              <p class="faint">{t(lang, "checksBP")}</p>
            </div>
            {!shown.length ? (
              <div class="check ok-line">
                <span aria-hidden="true">✓</span>
                <span>{t(lang, "briefOk")}</span>
              </div>
            ) : null}
            {shown.map((f) => (
              <div class={`check ${f.severity === "error" ? "err-line" : "warn-line"}`}>
                <span aria-hidden="true">!</span>
                <span>
                  {sayFinding(lang, f.code, f.message)}
                  {advanced && f.fix ? ` — ${f.fix}` : ""}
                </span>
              </div>
            ))}
          </section>
          <section class="card">
            <span
              class={status === "saved" ? "ok" : status && status !== "saving" ? "err" : "faint"}
            >
              {status === "saving"
                ? t(lang, "saving")
                : status === "saved"
                  ? t(lang, "savedAt")
                  : status}
            </span>
            {errors ? (
              <span class="btn-primary is-disabled" aria-disabled="true">
                {t(lang, "toDrafts")} →
              </span>
            ) : (
              <a class="btn-primary" href="#/changes">
                {t(lang, "toDrafts")} →
              </a>
            )}
            {errors ? <span class="faint">{t(lang, "fixErrorsFirst")}</span> : null}
          </section>
        </aside>
      </div>
    </>
  );
}
