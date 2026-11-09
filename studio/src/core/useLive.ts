/**
 * The run as it happens (REQ-433): `/live/stream` pushes the live model on
 * every change; the browser reconnects by itself, and the page says whether
 * it is connected.
 */
import { useEffect, useState } from "preact/hooks";
import type { Connection, LiveData } from "../sections/Live";

export function useLive(on: boolean): { data: LiveData | null; connection: Connection } {
  const [data, setData] = useState<LiveData | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  useEffect(() => {
    if (!on || typeof EventSource === "undefined") return;
    const stream = new EventSource("/live/stream");
    stream.onopen = () => setConnection("open");
    stream.onerror = () => setConnection("lost");
    stream.addEventListener("live", (e) => {
      try {
        setData(JSON.parse((e as MessageEvent<string>).data) as LiveData);
        setConnection("open");
      } catch {
        /* a partial message: the next one is whole */
      }
    });
    return () => stream.close();
  }, [on]);
  return { data, connection };
}
