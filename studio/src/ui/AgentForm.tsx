/**
 * Choose the agent that codes (REQ-431): Claude Code, Codex or a command of
 * one's own, the one found on this machine already chosen. Build offers it
 * when there is none; Settings, to change it.
 */
import { useState } from "preact/hooks";
import { t, type Lang } from "../core/i18n";
import { Busy, type Result } from "./Busy";

export type AgentKind = "claude" | "codex" | "custom";

function Said({ lang, r }: { lang: Lang; r: Result | null }) {
  if (!r) return null;
  return (
    <span class={r.ok ? "ok" : "err"}>
      {r.ok ? t(lang, "done") : `${t(lang, "errorPrefix")} ${r.message || ""}`}
    </span>
  );
}

export function AgentForm({
  lang,
  installed,
  onAgent,
}: {
  lang: Lang;
  installed?: { claude: boolean; codex: boolean };
  onAgent: (kind: AgentKind, command: string) => Promise<Result>;
}) {
  const found = installed || { claude: false, codex: false };
  const [kind, setKind] = useState<AgentKind>(
    found.claude ? "claude" : found.codex ? "codex" : "custom"
  );
  const [command, setCommand] = useState("");
  const [said, setSaid] = useState<Result | null>(null);
  const options: Array<[AgentKind, string, boolean]> = [
    ["claude", "Claude Code", found.claude],
    ["codex", "Codex", found.codex],
    ["custom", t(lang, "ownCommand"), false],
  ];
  return (
    <section class="card agent" aria-labelledby="agent-h">
      <div>
        <h2 id="agent-h">{t(lang, "chooseAgent")}</h2>
        <p class="faint">{t(lang, "chooseAgentHint")}</p>
      </div>
      <div class="choices" role="radiogroup" aria-labelledby="agent-h">
        {options.map(([k, name, on]) => (
          <label class={`choice${kind === k ? " on" : ""}`}>
            <input
              type="radio"
              name="agent-kind"
              checked={kind === k}
              onChange={() => setKind(k)}
            />
            <span class="name">{name}</span>
            {on ? <span class="chip ok-chip">{t(lang, "found")}</span> : null}
          </label>
        ))}
      </div>
      {kind === "custom" ? (
        <>
          <label for="agent-cmd" class="label">
            {t(lang, "ownCommand")}
          </label>
          <input
            id="agent-cmd"
            class="text"
            type="text"
            value={command}
            placeholder="my-agent run {prompt_file}"
            onInput={(e) => setCommand((e.target as HTMLInputElement).value)}
          />
        </>
      ) : null}
      <div class="row">
        <Busy
          busyLabel={t(lang, "saving")}
          disabled={kind === "custom" && !command.includes("{prompt_file}")}
          onRun={() => onAgent(kind, command)}
          onDone={setSaid}
        >
          {t(lang, "useAgent")}
        </Busy>
        <Said lang={lang} r={said} />
      </div>
    </section>
  );
}
