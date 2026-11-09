/**
 * The studio's reads and writes: `/api/*` as before. Writes carry the page's
 * token (REQ-201); a failed request says why instead of failing in silence.
 */
let current = "";

/** The token a reconnected page was given: a studio started again has a new one (REQ-434). */
export function setToken(t: string): void {
  current = t;
}

const token = (): string =>
  current ||
  (typeof document !== "undefined" &&
    document.querySelector('meta[name="specgate-token"]')?.getAttribute("content")) ||
  "";

export async function get<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(`${url} · ${body.message || r.status}`);
  }
  return (await r.json()) as T;
}

export async function post<T extends { ok: boolean }>(url: string, body: unknown): Promise<T> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-specgate-token": token() },
      body: JSON.stringify(body ?? {}),
    });
    return (await r.json()) as T;
  } catch (e) {
    return { ok: false, message: String((e as Error).message || e) } as unknown as T;
  }
}
