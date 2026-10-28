/**
 * Conventional Commits 1.0.0 (https://www.conventionalcommits.org/en/v1.0.0/),
 * checked natively: the grammar is small and exact, so no tool is needed
 * (REQ-234, ADR-0040 point 10). Pure.
 */

/** commitlint's conventional types: feat and fix from the spec, the rest by convention. */
export const DEFAULT_TYPES = [
  "feat",
  "fix",
  "build",
  "chore",
  "ci",
  "docs",
  "perf",
  "refactor",
  "revert",
  "style",
  "test",
];

export interface ParsedCommit {
  type: string;
  scope: string;
  breaking: boolean;
  description: string;
  /** Each rule the message breaks, in words that say how to fix it. */
  problems: string[];
}

const HEADER = /^([A-Za-z]+)(?:\(([^()\r\n]*)\))?(!)?: (.*)$/;

/** A message parsed against the specification, with what it breaks. */
export function parseCommit(message: string, types: string[] = DEFAULT_TYPES): ParsedCommit {
  const lines = String(message || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n+$/, "")
    .split("\n");
  const header = lines[0] || "";
  const problems: string[] = [];
  const m = HEADER.exec(header);
  if (!m) {
    const loose = /^([A-Za-z]+)(\([^)]*\))?!?:(\S|$)/.exec(header);
    problems.push(
      loose
        ? "the colon must be followed by a space and a description — `type: description`"
        : `no type — start with ${types.slice(0, 3).join(":, ")}: or another of ${types.length} types, e.g. "feat: add the booking form"`
    );
    return { type: "", scope: "", breaking: false, description: header, problems };
  }
  const [, type, scope, bang, description] = m;
  const known = types.map((t) => t.toLowerCase());
  // The spec: units of information are not case sensitive, except BREAKING CHANGE.
  if (!known.includes(type.toLowerCase())) {
    problems.push(`"${type}" is not one of the types: ${types.join(", ")}`);
  }
  if (scope !== undefined && scope.trim() === "") {
    problems.push("an empty scope — write `type(scope):` with a noun, or no parentheses");
  }
  if (!description.trim()) problems.push("no description after `type:`");
  if (lines.length > 1 && lines[1].trim() !== "") {
    problems.push("the body must start after one blank line");
  }
  let breaking = Boolean(bang);
  for (const line of lines.slice(2)) {
    if (/^BREAKING[ -]CHANGE: \S/.test(line)) breaking = true;
    else if (/^breaking[ -]change\s*:/i.test(line)) {
      problems.push("`BREAKING CHANGE:` must be written in capitals");
    }
  }
  return { type: type.toLowerCase(), scope: scope || "", breaking, description, problems };
}

/** Commits git writes, or that disappear in a rebase: not judged (merges are left out by the caller). */
export function exempt(message: string, ci: boolean): boolean {
  const header = String(message || "").split("\n")[0];
  if (/^Merge (branch|pull request|remote-tracking branch|[0-9a-f]{7,}|harness\/)/.test(header))
    return true;
  return !ci && /^(fixup|squash|amend)! /.test(header);
}
