/**
 * A command the studio runs (REQ-438): start it, and follow its output until
 * it ends. The server runs one at a time and only those it offers.
 */
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { get, post } from "./api";

export interface ActionRun {
  action: string;
  argv: string[];
  pid: number;
  started: number;
  exit: number | null;
}

export interface ActionView {
  running: ActionRun | null;
  last: ActionRun | null;
  output: string;
  /** What an action whose stdout is JSON printed, once it ended. */
  json?: unknown;
}

export interface Started {
  ok: boolean;
  message?: string;
  code?: string;
}

export function useAction(onEnd?: (run: ActionRun, output: string) => void) {
  const [view, setView] = useState<ActionView | null>(null);
  const end = useRef(onEnd);
  end.current = onEnd;
  const following = useRef(false);
  const refresh = useCallback(async () => {
    const v = await get<ActionView>("/api/action").catch(() => null);
    if (v) setView(v);
    return v;
  }, []);
  // While it runs, its output is read again; when it ends, the section hears it once.
  useEffect(() => {
    if (!view?.running) return;
    following.current = true;
    const timer = setInterval(async () => {
      const v = await refresh();
      if (v && !v.running && following.current) {
        following.current = false;
        if (v.last) end.current?.(v.last, v.output);
      }
    }, 700);
    return () => clearInterval(timer);
  }, [view?.running?.pid]);
  const start = useCallback(
    async (action: string, args: Record<string, unknown> = {}): Promise<Started> => {
      const r = await post<Started>("/api/action", { action, args });
      if (r.ok) await refresh();
      return r;
    },
    [refresh]
  );
  return { view, start, refresh };
}
