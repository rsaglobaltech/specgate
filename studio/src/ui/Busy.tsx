/**
 * A button that stays busy while its action runs: no second press, its words
 * say what it is doing, and the result is said beside it (REQ-430, REQ-434).
 */
import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";

export interface Result {
  ok: boolean;
  message?: string;
}

export interface BusyProps {
  id?: string;
  class?: string;
  busyLabel: string;
  disabled?: boolean;
  onRun: () => Promise<Result>;
  onDone?: (r: Result) => void;
  children: ComponentChildren;
}

export function Busy({
  id,
  class: cls = "btn-primary",
  busyLabel,
  disabled,
  onRun,
  onDone,
  children,
}: BusyProps) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      id={id}
      type="button"
      class={cls}
      disabled={disabled || busy}
      aria-busy={busy ? "true" : undefined}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        const r = await onRun().catch((e: Error) => ({ ok: false, message: e.message }));
        setBusy(false);
        onDone?.(r);
      }}
    >
      {busy ? <span class="spin" aria-hidden="true" /> : null}
      {busy ? busyLabel : children}
    </button>
  );
}
