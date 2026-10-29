import * as fs from "node:fs";
import * as path from "node:path";
import { parseYamlLite } from "../../packages/core/src/domain/YamlLite";

/**
 * Role packages (REQ-316..318, ADR-0043): what security, performance,
 * infrastructure — any role — asks of the work, written once in
 * `harness/<role>.md` and given to the agent for the requirements it concerns.
 *
 *   ---
 *   role: security
 *   owner: sec@acme.eu
 *   version: 2
 *   applies-to:
 *     kind: [functional, business-rule]
 *     capability: [payments]
 *     tag: [pii]
 *   ---
 *   The constraints, in Markdown.
 *
 * A package applies when every dimension it lists matches the requirement (any
 * value of a list); with no `applies-to`, to every requirement.
 */

export const PACKAGES_DIR = "harness";

export interface RolePackage {
  /** `role@version`, as the prompt event, the run record and the report name it. */
  id: string;
  role: string;
  owner: string;
  version: string;
  appliesTo: { kind: string[]; capability: string[]; tag: string[] };
  body: string;
  file: string;
}

export interface RequirementFacts {
  kind: string;
  capability: string;
  tags: string[];
}

const list = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
    : v === undefined || v === null || v === ""
      ? []
      : String(v)
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean);

/** Every package of the project; one that cannot be read is left out, with why. */
export function readPackages(projectDir: string): {
  packages: RolePackage[];
  problems: string[];
} {
  const dir = path.join(projectDir, PACKAGES_DIR);
  const packages: RolePackage[] = [];
  const problems: string[] = [];
  let names: string[] = [];
  try {
    names = fs
      .readdirSync(dir)
      .filter((n) => n.endsWith(".md"))
      .sort();
  } catch {
    return { packages, problems };
  }
  for (const name of names) {
    const file = path.join(PACKAGES_DIR, name).split(path.sep).join("/");
    const text = fs.readFileSync(path.join(dir, name), "utf8").replace(/\r\n/g, "\n");
    const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
    if (!m) {
      problems.push(`${file}: no front matter (role, owner, version, applies-to)`);
      continue;
    }
    let meta: Record<string, unknown>;
    try {
      meta = (parseYamlLite(m[1]) || {}) as Record<string, unknown>;
    } catch (err) {
      problems.push(`${file}: ${(err as Error).message}`);
      continue;
    }
    const role = String(meta.role || name.replace(/\.md$/, "")).trim();
    const version = String(meta.version ?? "1").trim();
    const applies = (meta["applies-to"] || {}) as Record<string, unknown>;
    packages.push({
      id: `${role}@${version}`,
      role,
      owner: String(meta.owner || "").trim(),
      version,
      appliesTo: {
        kind: list(applies.kind),
        capability: list(applies.capability),
        tag: list(applies.tag ?? applies.tags),
      },
      body: m[2].trim(),
      file,
    });
  }
  return { packages, problems };
}

/** The requirement's kind, capability and tags, from where the specification states it. */
export function requirementFacts(projectDir: string, id: string): RequirementFacts | null {
  const specs: Array<{ file: string; capability: string }> = [
    { file: path.join(projectDir, "spec.md"), capability: "" },
  ];
  const caps = path.join(projectDir, "docs", "specs", "capabilities");
  try {
    for (const c of fs.readdirSync(caps)) {
      specs.push({ file: path.join(caps, c, "spec.md"), capability: c });
    }
  } catch {
    /* no capability specs */
  }
  const heading = new RegExp(`^###\\s+Requirement:\\s+${id}\\b`, "m");
  for (const s of specs) {
    let text: string;
    try {
      text = fs.readFileSync(s.file, "utf8");
    } catch {
      continue;
    }
    const at = text.search(heading);
    if (at < 0) continue;
    const rest = text.slice(at + 4);
    const next = rest.search(/^###\s+Requirement:/m);
    const block = next >= 0 ? rest.slice(0, next) : rest;
    const trace = /<!--\s*specgate:trace([^>]*)-->/.exec(block);
    const attr = (k: string) => {
      const m = trace ? new RegExp(`\\b${k}=(?:"([^"]*)"|(\\S+))`).exec(trace[1]) : null;
      return m ? (m[1] ?? m[2]) : "";
    };
    return {
      kind: attr("kind").toLowerCase(),
      capability: s.capability.toLowerCase(),
      tags: list(attr("tags")),
    };
  }
  return null;
}

function applies(p: RolePackage, facts: RequirementFacts): boolean {
  const { kind, capability, tag } = p.appliesTo;
  if (kind.length && !kind.includes(facts.kind)) return false;
  if (capability.length && !capability.includes(facts.capability)) return false;
  if (tag.length && !tag.some((t) => facts.tags.includes(t))) return false;
  return true;
}

/** The packages that apply to one requirement, in file order. */
export function packagesFor(projectDir: string, id: string): RolePackage[] {
  const { packages } = readPackages(projectDir);
  if (packages.length === 0) return [];
  const facts = requirementFacts(projectDir, id) || { kind: "", capability: "", tags: [] };
  return packages.filter((p) => applies(p, facts));
}

/** The prompt section the agent reads, or "" when no package applies (REQ-316). */
export function rolePromptSection(pkgs: RolePackage[]): string {
  if (pkgs.length === 0) return "";
  return [
    "## Role constraints",
    "",
    "Each package below is a role's constraints on this work. Meet them as you meet the " +
      "requirement: a change that breaks one is not done.",
    "",
    ...pkgs.flatMap((p) => [
      `### ${p.role} · v${p.version}${p.owner ? ` · owner ${p.owner}` : ""}`,
      "",
      p.body,
      "",
    ]),
  ].join("\n");
}

/** What the review check asks per package (REQ-318); "" when none applies. */
export function reviewAdvice(pkgs: RolePackage[]): string {
  if (pkgs.length === 0) return "";
  return [
    "",
    "Then, for each role package under Role constraints, add one line: " +
      pkgs.map((p) => `\`- ${p.role}: OK\``).join(", ") +
      " — or `- <role>: ADVICE — what to change`. This advice is for the person; it does " +
      "not decide the verdict.",
  ].join("\n");
}

/** Each package, with the number of distinct requirements it reached across the runs (REQ-317). */
export function packageUse(
  runs: Array<{ results?: Array<{ requirement?: string; packages?: string[] }> }>
): Array<{ id: string; requirements: number }> {
  const reached = new Map<string, Set<string>>();
  for (const run of runs) {
    for (const r of run.results || []) {
      for (const id of r.packages || []) {
        if (!reached.has(id)) reached.set(id, new Set());
        reached.get(id)!.add(String(r.requirement || ""));
      }
    }
  }
  return [...reached.entries()]
    .map(([id, reqs]) => ({ id, requirements: reqs.size }))
    .sort((a, b) => b.requirements - a.requirements || a.id.localeCompare(b.id));
}
