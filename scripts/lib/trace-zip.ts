/**
 * The calls a test made to the project's service, read from a Playwright
 * `trace.zip` (REQ-816): its `*.trace.network` lines, each body from
 * `resources/`. A zip is read with zlib alone — Specgate has no dependency to
 * spare — and every value whose key names a secret is hidden before anything
 * is shown.
 */

import * as fs from "node:fs";
import * as zlib from "node:zlib";

/** The files of a zip, by name: stored or deflated entries, nothing else. */
export function readZip(file: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let buf: Buffer;
  try {
    buf = fs.readFileSync(file);
  } catch {
    return out;
  }
  // The end of central directory record: its signature, searched from the end.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return out;
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && at + 46 <= buf.length; n += 1) {
    if (buf.readUInt32LE(at) !== 0x02014b50) break;
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const nameLength = buf.readUInt16LE(at + 28);
    const extraLength = buf.readUInt16LE(at + 30);
    const commentLength = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString("utf8", at + 46, at + 46 + nameLength);
    at += 46 + nameLength + extraLength + commentLength;
    if (buf.readUInt32LE(local) !== 0x04034b50) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    try {
      if (method === 0) out.set(name, Buffer.from(data));
      else if (method === 8) out.set(name, zlib.inflateRawSync(data));
    } catch {
      /* a damaged entry: left out */
    }
  }
  return out;
}

export interface HttpCall {
  readonly method: string;
  /** The path and query, without the host. */
  readonly path: string;
  readonly status: number;
  readonly statusText: string;
  readonly ms: number;
  /** The bodies, secrets hidden; JSON pretty-printed; empty when there is none. */
  readonly request: string;
  readonly response: string;
}

const SECRET = /token|password|passwd|secret|cookie|authorization|api[-_]?key|session[-_]?id/i;
const STATIC = /\/_next\/|\.(?:js|mjs|css|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf)(?:\?|$)/i;
const MAX_BODY = 2000;

/** Every value whose key names a secret, written `«hidden»`, at any depth. */
export function hideSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(hideSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET.test(k) ? "«hidden»" : hideSecrets(v);
    }
    return out;
  }
  return value;
}

function body(files: Map<string, Buffer>, ref: unknown, text: unknown): string {
  const raw =
    typeof ref === "string" && files.has(ref)
      ? (files.get(ref) as Buffer).toString("utf8")
      : typeof text === "string"
        ? text
        : "";
  if (!raw.trim()) return "";
  let shown: string;
  try {
    shown = JSON.stringify(hideSecrets(JSON.parse(raw)), null, 2);
  } catch {
    // Not JSON: a secret in it cannot be found by its key, so only its kind is shown.
    shown = `(${raw.length} bytes, not JSON)`;
  }
  return shown.length > MAX_BODY ? `${shown.slice(0, MAX_BODY)}\n…` : shown;
}

/**
 * When the test ran, in epoch ms, from the test runner's own trace: its start
 * and its last step's end (REQ-824). Null when the trace does not say.
 */
export function traceWindow(traceZip: string): { from: number; to: number } | null {
  const text = readZip(traceZip).get("test.trace")?.toString("utf8") || "";
  let wall = 0;
  let mono = 0;
  let end = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as {
        type?: string;
        wallTime?: number;
        monotonicTime?: number;
        endTime?: number;
      };
      if (e.type === "context-options" && e.wallTime)
        [wall, mono] = [e.wallTime, e.monotonicTime || 0];
      if (typeof e.endTime === "number" && e.endTime > end) end = e.endTime;
    } catch {
      /* a line cut short: the others still say when */
    }
  }
  return wall ? { from: wall, to: wall + Math.max(0, end - mono) } : null;
}

/** The calls the project's server recorded in SPECGATE_HTTP_LOG (REQ-824), with when each was made. */
export function loggedCalls(file: string): Array<HttpCall & { at: number }> {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  return text.split(/\r?\n/).flatMap((line) => {
    try {
      const c = JSON.parse(line) as {
        at?: number;
        method?: string;
        path?: string;
        status?: number;
        ms?: number;
      };
      if (!c.method || !c.path || typeof c.status !== "number") return [];
      return [
        {
          at: c.at || 0,
          method: c.method.toUpperCase(),
          path: c.path,
          status: c.status,
          statusText: "",
          ms: c.ms || 0,
          request: "",
          response: "",
        },
      ];
    } catch {
      return [];
    }
  });
}

/** The calls to the service in one trace, in the order they were made. */
export function httpCalls(traceZip: string): HttpCall[] {
  const files = readZip(traceZip);
  const out: Array<HttpCall & { at: number }> = [];
  for (const [name, data] of files) {
    if (!/(?:^|\/)[^/]*trace\.network$/.test(name)) continue;
    for (const line of data.toString("utf8").split("\n")) {
      if (!line.trim()) continue;
      let entry: { type?: string; snapshot?: Record<string, any> };
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const s = entry.snapshot;
      if (entry.type !== "resource-snapshot" || !s?.request?.url) continue;
      let url: URL;
      try {
        url = new URL(s.request.url);
      } catch {
        continue;
      }
      const fromTest = typeof s._apiRequestRef === "string";
      if (STATIC.test(url.pathname) || (!fromTest && !url.pathname.startsWith("/api/"))) continue;
      out.push({
        at: Number(s._monotonicTime) || 0,
        method: String(s.request.method || "GET"),
        path: url.pathname + url.search,
        status: Number(s.response?.status) || 0,
        statusText: String(s.response?.statusText || ""),
        ms: Math.round(Number(s.time) || 0),
        request: body(files, s.request.postData?._file, s.request.postData?.text),
        response: body(files, s.response?.content?._file, s.response?.content?.text),
      });
    }
  }
  return out.sort((a, b) => a.at - b.at).map(({ at: _at, ...call }) => call);
}
