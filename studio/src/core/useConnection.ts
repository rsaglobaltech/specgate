/**
 * Whether the studio's server answers (REQ-434): a heartbeat every few
 * seconds; when it stops answering the page says so, and when it answers
 * again it says that too and reads its section again.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import { setToken } from "./api";

export function useConnection(onBack: () => void, every = 4000): boolean {
  const [online, setOnline] = useState(true);
  const was = useRef(true);
  const back = useRef(onBack);
  back.current = onBack;
  useEffect(() => {
    let live = true;
    const beat = async () => {
      let ok = false;
      try {
        const r = await fetch("/api/ping", { cache: "no-store" });
        ok = r.ok;
        if (ok) {
          const body = (await r.json()) as { token?: string };
          if (body.token) setToken(body.token);
        }
      } catch {
        ok = false;
      }
      if (!live) return;
      if (ok && !was.current) back.current();
      was.current = ok;
      setOnline(ok);
    };
    const timer = setInterval(beat, every);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [every]);
  return online;
}
