/**
 * The agent's log as it streams (REQ-433): one line per event, when, what kind
 * and what it did; it follows the end until the viewer scrolls up.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import { t, type Lang } from "../../core/i18n";
import type { LiveStep } from "./model";

const stamp = (t: number) => (t ? new Date(t * 1000).toTimeString().slice(0, 8) : "");
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** One event as one log line: when, what kind, what it did. */
export function logLine(e: LiveStep): { ts: string; kind: string; what: string; tone: string } {
  const kind =
    e.type === "step"
      ? String(e.kind || "")
      : e.type === "message"
        ? "agent"
        : String(e.type || "");
  const what =
    e.type === "message"
      ? String(e.text || "")
      : e.type === "gate-start"
        ? `started  ${e.stage || ""}`
        : e.type === "gate"
          ? `${e.result === "pass" ? "passed" : "failed"}  ${e.stage || ""}${
              e.pass !== undefined || e.fail !== undefined
                ? `  (${e.pass || 0} ✓ ${e.fail || 0} ✗)`
                : ""
            }`
          : e.type === "merge"
            ? `merged into ${e.into || "HEAD"}`
            : String(e.target || e.tool || "");
  const tone =
    e.type === "message"
      ? "say"
      : e.type === "gate"
        ? e.result === "pass"
          ? "ok"
          : "bad"
        : e.type === "merge"
          ? "ok"
          : "";
  return { ts: stamp(Number(e.ended || e.t) || 0), kind, what: clip(what, 400), tone };
}

export function Log({ lang, steps }: { lang: Lang; steps: LiveStep[] }) {
  const box = useRef<HTMLOListElement>(null);
  const [follow, setFollow] = useState(true);
  // The model keeps the newest first; the log reads top to bottom.
  const lines = steps.slice(0, 200).slice().reverse();
  useEffect(() => {
    const el = box.current;
    if (el && follow) el.scrollTop = el.scrollHeight;
  }, [lines.length, follow]);
  return (
    <div class="term-wrap">
      <ol
        class="term"
        ref={box}
        tabIndex={0}
        aria-label={t(lang, "logLabel")}
        aria-live="polite"
        aria-relevant="additions"
        onScroll={(e) => {
          const el = e.target as HTMLOListElement;
          setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
        }}
      >
        {!lines.length ? <li class="term-empty">{t(lang, "logEmpty")}</li> : null}
        {lines.map((e) => {
          const l = logLine(e);
          return (
            <li class={l.tone}>
              <span class="t-ts">{l.ts}</span>
              <span class="t-k">{l.kind}</span>
              <span class="t-x">{l.what}</span>
            </li>
          );
        })}
      </ol>
      {!follow ? (
        <button type="button" class="btn-ghost follow" onClick={() => setFollow(true)}>
          ↓ {t(lang, "followLog")}
        </button>
      ) : null}
    </div>
  );
}
