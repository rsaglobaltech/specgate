/**
 * A sequence read from the code, checked against what the run did (REQ-824).
 *
 * The sequence diagrams are read from the source, not from the run: each new
 * shape of code is a chance to read it wrong — a GET drawn as a POST, a refusal
 * drawn as a success. The run's trace says what was actually called and what
 * came back, so every sequence on the page states where it stands: it matches
 * the run, it differs from it, it could not be checked and why, or it was drawn
 * from the steps alone. Never a reading presented as fact.
 */

import type { HttpCall } from "./trace-zip";

export interface SequenceCheck {
  /**
   * `matches`: the run called what the diagram draws and ended the same way;
   * `differs`: it did not; `unchecked`: the trace holds no call to compare;
   * `steps`: no endpoint in the code, the diagram is the steps themselves.
   */
  readonly state: "matches" | "differs" | "unchecked" | "steps";
  /** One line for the page. */
  readonly text: string;
}

const CALL = /->>\+?\w+: (GET|POST|PUT|PATCH|DELETE) (\/\S+)/;

/** The diagram's call into the service, and how its reply ends: `201 Created`, `422 x`, `too_many_photos`. */
function drawn(diagram: string): { method: string; route: string; reply: string } | null {
  const lines = diagram.split("\n");
  const at = lines.findIndex((l) => CALL.test(l));
  if (at < 0) return null;
  const [, method, route] = CALL.exec(lines[at]) as RegExpExecArray;
  const callee = (/->>\+?(\w+):/.exec(lines[at]) as RegExpExecArray)[1];
  // The service's last reply: from the lifeline the call went into, back to whoever called it.
  const reply = lines
    .map((l) => new RegExp(`^\\s*${callee}-->>-?\\w+: (.+)$`).exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => m[1].trim())
    .pop();
  return { method, route, reply: reply || "" };
}

const matches = (route: string, path: string) =>
  new RegExp(
    `^${route.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{[^/}]+\}/g, "[^/]+")}/?$`
  ).test(path.replace(/[?#].*$/, ""));

const succeeded = (reply: string) => /^2\d\d\b/.test(reply);

/** The diagram against the calls one scenario's run made to the service. */
export function checkSequence(diagram: string, calls: ReadonlyArray<HttpCall>): SequenceCheck {
  const d = drawn(diagram);
  if (!d)
    return { state: "steps", text: "Drawn from the steps: no endpoint in the code answers them." };
  const call = `\`${d.method} ${d.route}\``;
  if (calls.length === 0)
    return {
      state: "unchecked",
      text: `Read from the code, not checked against the run: its trace holds no call to the service — a call made from the server, out of the browser's sight, is not in it.`,
    };
  const same = calls.filter((c) => c.method === d.method && matches(d.route, c.path));
  if (same.length === 0) {
    const ran = [...new Set(calls.map((c) => `\`${c.method} ${c.path.replace(/[?#].*$/, "")}\``))];
    return {
      state: "differs",
      text: `Read from the code, and the run differs: it draws ${call}; the run called ${ran.slice(0, 3).join(", ")}${ran.length > 3 ? "…" : ""}.`,
    };
  }
  // The scenario's call: the last of them, as a scenario ends on what it did last.
  const last = same[same.length - 1];
  const ranOk = last.status >= 200 && last.status < 300;
  if (d.reply && succeeded(d.reply) !== ranOk)
    return {
      state: "differs",
      text: `Read from the code, and the run differs: it ends in \`${d.reply}\`; ${call} answered ${last.status}.`,
    };
  return { state: "matches", text: `Matches the run: ${call} answered ${last.status}.` };
}

/** The mark the page puts before the check's line. */
export const checkMark = (c: SequenceCheck) =>
  c.state === "matches" ? "✓" : c.state === "differs" ? "⚠" : "·";
