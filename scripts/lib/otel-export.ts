import * as crypto from "node:crypto";
import { otlpTarget, runTrace, type TraceRecord } from "../../packages/core/src/domain/RunTrace";

/**
 * REQ-590: send a finished run to an OpenTelemetry collector, when the
 * standard `OTEL_EXPORTER_OTLP_*` variables name one. OTLP/HTTP with JSON,
 * through Node's own `fetch`: no dependency. Never fails the run — a collector
 * that is down is said, once, and the run's result stands.
 */
export async function exportRunTrace(
  record: TraceRecord,
  env: Record<string, string | undefined> = process.env,
  timeoutMs = 5000
): Promise<{ sent: boolean; url?: string; error?: string }> {
  const target = otlpTarget(env);
  if (!target) return { sent: false };
  const body = JSON.stringify(
    runTrace(record, { hex: (n) => crypto.randomBytes(n).toString("hex") }, target.service)
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(target.url, {
      method: "POST",
      headers: target.headers,
      body,
      signal: controller.signal,
    });
    if (!res.ok) return { sent: false, url: target.url, error: `HTTP ${res.status}` };
    return { sent: true, url: target.url };
  } catch (e) {
    return { sent: false, url: target.url, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}
