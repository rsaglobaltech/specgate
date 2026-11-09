/** A read of `/api/*` for a section: its data, whether it is loading, why it failed. */
import { useCallback, useEffect, useState } from "preact/hooks";
import { get } from "./api";

export interface Read<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useRead<T>(url: string | null): Read<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(url !== null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    if (url === null) return;
    let live = true;
    setLoading(true);
    get<T>(url)
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(null);
      })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [url, tick]);
  return { data, loading, error, reload };
}
