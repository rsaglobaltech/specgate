/**
 * The project's preferences and its agents, in Settings (REQ-442): each key
 * `specgate config` knows with its value, changed with `config set`; the
 * agent guards (`agents install`) and the agent integrations (`agents init`).
 */
import { useState } from "preact/hooks";
import { t, type Key, type Lang } from "../../core/i18n";
import type { ActionRun } from "../../core/useAction";
import { Busy, type Result } from "../../ui/Busy";
import { Command } from "../../ui/Command";

export interface Preference {
  key: string;
  value: string | null;
  options: string[] | null;
}

export interface PreferencesProps {
  lang: Lang;
  prefs: Preference[];
  run: ActionRun | null;
  output: string;
  onAction: (action: string, args: Record<string, unknown>) => Promise<Result>;
}

const WORDS: Record<string, [Key, Key]> = {
  test_cmd: ["prefTestCmd", "prefTestCmdHint"],
  arch_cmd: ["prefArchCmd", "prefArchCmdHint"],
  profile: ["prefProfile", "prefProfileHint"],
  language: ["prefLanguage", "prefLanguageHint"],
  pet: ["prefPet", "prefPetHint"],
  agent_guard: ["prefGuard", "prefGuardHint"],
};

function Row({
  lang,
  p,
  onAction,
}: {
  lang: Lang;
  p: Preference;
  onAction: PreferencesProps["onAction"];
}) {
  const [value, setValue] = useState(p.value ?? "");
  const id = `pref-${p.key}`;
  const [label, hint] = WORDS[p.key] || [null, null];
  return (
    <div class="pref">
      <label for={id} class="label">
        {label ? t(lang, label) : p.key} <code class="where">{p.key}</code>
      </label>
      <div class="row">
        {p.options ? (
          <select
            id={id}
            class="text-plain grow"
            value={value}
            onChange={(e) => setValue((e.target as HTMLSelectElement).value)}
          >
            <option value="" selected={!value}>
              {t(lang, "byDefault")}
            </option>
            {p.options.map((o) => (
              <option value={o} selected={value === o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            class="text-plain grow mono"
            type="text"
            value={value}
            aria-describedby={hint ? `${id}-hint` : undefined}
            onInput={(e) => setValue((e.target as HTMLInputElement).value)}
          />
        )}
        <Busy
          class="btn-ghost"
          busyLabel={t(lang, "saving")}
          disabled={!value.trim() || value === (p.value ?? "")}
          onRun={() => onAction("config-set", { key: p.key, value: value.trim() })}
        >
          {t(lang, "saveMd")}
        </Busy>
      </div>
      {hint ? (
        <span id={`${id}-hint`} class="faint hint">
          {t(lang, hint)}
        </span>
      ) : null}
    </div>
  );
}

export function Preferences({ lang, prefs, run, output, onAction }: PreferencesProps) {
  const mine = (actions: string[]) => !!run && actions.includes(run.action);
  return (
    <>
      <section class="card" aria-labelledby="prefs-h">
        <div>
          <h2 id="prefs-h">{t(lang, "prefsTitle")}</h2>
          <p class="faint">{t(lang, "prefsIntro")}</p>
        </div>
        {prefs.map((p) => (
          <Row key={`${p.key}:${p.value ?? ""}`} lang={lang} p={p} onAction={onAction} />
        ))}
        {mine(["config-set"]) ? <Command lang={lang} run={run} output={output} /> : null}
      </section>
      <section class="card" aria-labelledby="agents-h">
        <div>
          <h2 id="agents-h">{t(lang, "agentsTitle")}</h2>
          <p class="faint">{t(lang, "agentsIntro")}</p>
        </div>
        <div class="row">
          <Busy
            busyLabel={t(lang, "starting")}
            onRun={() => onAction("agents-guards", { tool: "claude-plugin" })}
          >
            {t(lang, "guardsClaude")}
          </Busy>
          <Busy
            class="btn-ghost"
            busyLabel={t(lang, "starting")}
            onRun={() => onAction("agents-guards", { tool: "opencode-plugin" })}
          >
            {t(lang, "guardsOpenCode")}
          </Busy>
        </div>
        <span class="faint">{t(lang, "installGuardsHint")}</span>
        <div class="row">
          <Busy
            class="btn-ghost"
            busyLabel={t(lang, "starting")}
            onRun={() => onAction("agents-init", {})}
          >
            {t(lang, "wireAgents")}
          </Busy>
          <span class="faint">{t(lang, "wireAgentsHint")}</span>
        </div>
        {mine(["agents-guards", "agents-init"]) ? (
          <Command lang={lang} run={run} output={output} />
        ) : null}
      </section>
    </>
  );
}
