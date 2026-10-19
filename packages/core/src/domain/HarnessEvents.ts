/**
 * The harness event line (ADR-0037).
 *
 * One JSON line per event in `.harness/events/<REQ>.jsonl`, written by the
 * harness itself and by agent adapters alike: `t` (epoch seconds), `req`,
 * `attempt`, `type`, and for a step `kind`, `target` and its result. The live
 * view in studio reads nothing else.
 *
 * An event never carries file contents, tool output, environment values or
 * tokens: commands are masked for token-like values, and the value of any
 * environment variable whose name says it is a secret is masked wherever it
 * appears.
 */

export type StepKind = "read" | "search" | "edit" | "write" | "test" | "gate" | "shell" | "other";

export type HarnessEvent = Record<string, unknown> & { type: string };

/** The variables the harness hands an agent. Tool-neutral on purpose. */
export const EVENTS_FILE_VAR = "AGENT_EVENTS_FILE";
export const EVENTS_REQ_VAR = "AGENT_EVENTS_REQ";
export const EVENTS_ATTEMPT_VAR = "AGENT_EVENTS_ATTEMPT";

/** The messages an event keeps, at most. */
export const MESSAGE_LIMIT = 600;

/** A value up to the next space, quote or query separator. */
const VALUE = String.raw`[^\s'"&]+`;
/** Names that say a value is a secret, as in GITHUB_TOKEN= or ?api_key=. */
const SECRET_PARAM = String.raw`[\w.-]*(?:token|secret|password|passwd|pwd|api[_-]?key|access[_-]?key|private[_-]?key|credential)[\w-]*`;

/** Token-like values in a command, each with what to keep around its mask. */
const TOKEN_LIKE: Array<[RegExp, string]> = [
  // Authorization: Bearer xyz, Basic dXNlcjpwYXNz
  [new RegExp(String.raw`\b(Bearer|Basic)(\s+)${VALUE}`, "gi"), "$1$2***"],
  // X-Api-Key: k, Private-Token: t
  [
    new RegExp(
      String.raw`\b((?:X-[\w-]*)?(?:Api-?Key|Token|Secret|Private-Token)\s*:\s*)${VALUE}`,
      "gi"
    ),
    "$1***",
  ],
  // https://user:password@host
  [/(\b[a-z][\w+.-]*:\/\/[^\s/:@'"]+:)[^\s/@'"]+@/gi, "$1***@"],
  // curl -u user:password
  [/((?:^|\s)(?:-u|--user)\s+['"]?[^\s:'"]+:)[^\s'"]+/g, "$1***"],
  // GITHUB_TOKEN=abc, --password=abc, ?api_key=abc
  [new RegExp(String.raw`\b(${SECRET_PARAM}=)${VALUE}`, "gi"), "$1***"],
  // --token abc
  [new RegExp(String.raw`((?:^|\s)--?${SECRET_PARAM}\s+)(?!-)${VALUE}`, "gi"), "$1***"],
  // Values that look like a token whatever surrounds them.
  [
    /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|sk-[\w-]{16,}|xox[abprs]-[\w-]{10,}|glpat-[\w-]{20,}|AKIA[0-9A-Z]{16}|eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,})/g,
    "***",
  ],
];

/** A command with every token-like value in it replaced by "***". */
export function maskCommand(command: string): string {
  return TOKEN_LIKE.reduce((out, [pattern, keep]) => out.replace(pattern, keep), command);
}

/** Environment variables whose names say they hold a secret. */
const SECRET_NAME =
  /TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|AUTH|CREDENTIAL/i;

/** The secret environment values, longest first, long enough not to mask by accident. */
export function secretValues(env: Record<string, string | undefined>): string[] {
  return Object.entries(env)
    .filter(([name, value]) => SECRET_NAME.test(name) && (value?.length ?? 0) >= 6)
    .map(([, value]) => value as string)
    .sort((a, b) => b.length - a.length);
}

/** An event with every secret value in any of its strings replaced by "***". */
export function scrub(event: HarnessEvent, secrets: string[]): HarnessEvent {
  if (secrets.length === 0) return event;
  const mask = (s: string) => secrets.reduce((out, v) => out.split(v).join("***"), s);
  return JSON.parse(
    JSON.stringify(event, (_key, value) => (typeof value === "string" ? mask(value) : value))
  ) as HarnessEvent;
}

const GATE = /\b(specgate\s+(check|apply|done|validate)|agentkit\s+verify)\b/;
const TEST =
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|\b(vitest|jest|mocha|pytest)\b|\b(go|cargo|mvn|gradle|dotnet)\s+test\b|\bnode\s+--test\b|\bmvnw?\b.*\b(test|verify)\b/;

/** What kind of step a tool call is: by its tool, and for a shell call by its command. */
export function stepKind(tool: string, command = ""): StepKind {
  const t = tool.toLowerCase();
  if (["read", "notebookread"].includes(t)) return "read";
  if (["grep", "glob", "list", "ls", "codesearch", "websearch"].includes(t)) return "search";
  if (["edit", "multiedit", "patch", "apply_patch", "notebookedit"].includes(t)) return "edit";
  if (t === "write") return "write";
  if (t === "bash" || t === "shell") {
    if (GATE.test(command)) return "gate";
    if (TEST.test(command)) return "test";
    return "shell";
  }
  return "other";
}

/** The last count a runner's summary gives for a label, as in node's "ℹ pass 64" or TAP's "# fail 0". */
function lastCount(output: string, label: "pass" | "fail"): number | undefined {
  const matches = [...output.matchAll(new RegExp(`^\\s*(?:ℹ|#)\\s*${label}\\s+(\\d+)\\s*$`, "gm"))];
  const last = matches[matches.length - 1];
  return last ? Number(last[1]) : undefined;
}

/** Passing and failing test counts read from a test run's output — the numbers only. */
export function testCounts(output: string): { pass?: number; fail?: number } {
  const pass = lastCount(output, "pass");
  const fail = lastCount(output, "fail");
  if (pass === undefined && fail === undefined) return {};
  return { pass: pass ?? 0, fail: fail ?? 0 };
}

/** A message shortened to the limit, on one line. */
export function shorten(text: string, limit = MESSAGE_LIMIT): string {
  const flat = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
}

/** The fields every line carries, then the event's own, type first. */
export function eventLine(
  event: HarnessEvent,
  req: string | undefined,
  attempt: number | undefined,
  t = Math.floor(Date.now() / 1000)
): HarnessEvent {
  return {
    t,
    ...(req ? { req } : {}),
    ...(Number.isInteger(attempt) ? { attempt } : {}),
    ...event,
  } as HarnessEvent;
}
