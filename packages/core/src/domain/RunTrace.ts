/**
 * REQ-590: a harness run as an OpenTelemetry trace — the run, each
 * requirement, each attempt and its agent session — in OTLP/JSON, built from
 * the run record the harness already writes. Pure: the harness sends it.
 *
 * Times are rebuilt from the record: a requirement starts where the previous
 * one in the record ended (one at a time) and lasts its `durationMs`; an
 * attempt lasts its `totalMs`, its agent session its `agentMs`.
 */

export interface TraceRecord {
  startedAt: string;
  finishedAt: string;
  baseRef?: string;
  results: unknown[];
}

interface ResultLike {
  requirement?: string;
  result?: string;
  durationMs?: number;
  attempts?: number;
  attemptLog?: Array<{
    attempt?: number;
    endedAt?: string;
    agentMs?: number;
    totalMs?: number;
    gateStage?: string;
    usage?: Array<{ profile?: string; input?: number; output?: number; cost?: number }>;
  }>;
}

type Attr = {
  key: string;
  value: { stringValue?: string; intValue?: string; doubleValue?: number };
};

export interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Attr[];
  status: { code: number; message?: string };
}

const attr = (key: string, v: string | number | undefined): Attr[] =>
  v === undefined || v === ""
    ? []
    : typeof v === "number"
      ? Number.isInteger(v)
        ? [{ key, value: { intValue: String(v) } }]
        : [{ key, value: { doubleValue: v } }]
      : [{ key, value: { stringValue: v } }];

const nanos = (ms: number) => `${Math.round(ms)}000000`;

/** `ids` makes the trace and span ids: random in the harness, fixed in a test. */
export function runTrace(
  record: TraceRecord,
  ids: { hex: (bytes: number) => string },
  serviceName = "specgate-harness"
): { resourceSpans: unknown[] } {
  const traceId = ids.hex(16);
  const runStart = Date.parse(record.startedAt) || 0;
  const runEnd = Math.max(Date.parse(record.finishedAt) || runStart, runStart);
  const runId = ids.hex(8);
  const spans: OtlpSpan[] = [];
  const results = (record.results || []) as ResultLike[];
  const failed = results.filter((r) => r.result && r.result !== "pass").length;
  spans.push({
    traceId,
    spanId: runId,
    name: "harness run",
    kind: 1,
    startTimeUnixNano: nanos(runStart),
    endTimeUnixNano: nanos(runEnd),
    attributes: [
      ...attr("specgate.base", record.baseRef),
      ...attr("specgate.requirements", results.length),
      ...attr("specgate.failed", failed),
    ],
    status: { code: failed > 0 ? 2 : 1 },
  });
  let cursor = runStart;
  for (const r of results) {
    if (!r.requirement) continue;
    const reqStart = cursor;
    const attempts = r.attemptLog || [];
    const total = attempts.reduce((n, a) => n + (a.totalMs || 0), 0);
    const reqEnd = reqStart + Math.max(r.durationMs || 0, total);
    cursor = reqEnd;
    const reqId = ids.hex(8);
    const cost = attempts
      .flatMap((a) => a.usage || [])
      .reduce((n, u) => n + (typeof u.cost === "number" ? u.cost : 0), 0);
    spans.push({
      traceId,
      spanId: reqId,
      parentSpanId: runId,
      name: r.requirement,
      kind: 1,
      startTimeUnixNano: nanos(reqStart),
      endTimeUnixNano: nanos(reqEnd),
      attributes: [
        ...attr("specgate.requirement", r.requirement),
        ...attr("specgate.result", r.result),
        ...attr("specgate.attempts", r.attempts),
        ...(cost > 0 ? attr("specgate.cost_usd", cost) : []),
      ],
      status: { code: r.result === "pass" ? 1 : 2 },
    });
    let at = reqStart;
    for (const a of attempts) {
      const attemptId = ids.hex(8);
      const end = at + (a.totalMs || 0);
      const tokens = (a.usage || []).reduce((n, u) => n + (u.input || 0) + (u.output || 0), 0);
      spans.push({
        traceId,
        spanId: attemptId,
        parentSpanId: reqId,
        name: `attempt ${a.attempt ?? ""}`.trim(),
        kind: 1,
        startTimeUnixNano: nanos(at),
        endTimeUnixNano: nanos(end),
        attributes: [
          ...attr("specgate.attempt", a.attempt),
          ...attr("specgate.ended_at", a.endedAt),
          ...attr("specgate.gate_stage", a.gateStage),
          ...(tokens > 0 ? attr("specgate.tokens", tokens) : []),
        ],
        status: {
          code: a.endedAt === "pass" ? 1 : 2,
          ...(a.gateStage ? { message: a.gateStage } : {}),
        },
      });
      if (a.agentMs) {
        spans.push({
          traceId,
          spanId: ids.hex(8),
          parentSpanId: attemptId,
          name: "agent",
          kind: 3,
          startTimeUnixNano: nanos(at),
          endTimeUnixNano: nanos(at + a.agentMs),
          attributes: [...attr("specgate.profile", (a.usage || [])[0]?.profile)],
          status: { code: 0 },
        });
      }
      at = end;
    }
  }
  return {
    resourceSpans: [
      {
        resource: { attributes: attr("service.name", serviceName) },
        scopeSpans: [{ scope: { name: "specgate" }, spans }],
      },
    ],
  };
}

/**
 * Where to send it, from the standard OpenTelemetry variables; null when
 * neither `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` nor `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
 */
export function otlpTarget(
  env: Record<string, string | undefined>
): { url: string; headers: Record<string, string>; service: string } | null {
  const traces = (env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || "").trim();
  const base = (env.OTEL_EXPORTER_OTLP_ENDPOINT || "").trim();
  if (!traces && !base) return null;
  const url = traces || `${base.replace(/\/+$/, "")}/v1/traces`;
  const headers: Record<string, string> = { "content-type": "application/json" };
  for (const pair of (env.OTEL_EXPORTER_OTLP_HEADERS || "").split(",")) {
    const i = pair.indexOf("=");
    if (i > 0) headers[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  }
  return { url, headers, service: (env.OTEL_SERVICE_NAME || "").trim() || "specgate-harness" };
}
