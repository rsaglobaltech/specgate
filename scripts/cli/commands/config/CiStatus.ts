import * as fs from "node:fs";
import * as path from "node:path";

/**
 * What a project's CI checks, read back from its CI file (REQ-460): each
 * validation specgate knows, present or missing, and for a missing one how to
 * add it. `ci init` uses the same reading to say what its gate would add to an
 * old `specs.yml` (REQ-461).
 */
export interface CiCheck {
  id:
    "specification" | "tests" | "architecture" | "systems" | "base" | "quality" | "drift" | "plan";
  label: string;
  present: boolean;
  /** How to add it, when it is missing. */
  add?: string;
}

export interface CiStatus {
  /** The CI file read, relative to the project; null when there is none. */
  file: string | null;
  provider: string | null;
  checks: CiCheck[];
}

/** The `specs.yml` an older `specgate init` wrote. */
export const OLD_SPECS_YML = ".github/workflows/specs.yml";
export const GATE_FILE = ".github/workflows/spec-gate.yml";

const KNOWN: Array<{ id: CiCheck["id"]; label: string; found: (ci: string) => boolean }> = [
  {
    id: "specification",
    label: "the specification (validate --strict)",
    found: (ci) => /specgate\S*\s+(validate|check)\b/.test(ci),
  },
  {
    id: "tests",
    label: "the project's tests (check runs test_cmd)",
    found: (ci) => /specgate\S*\s+check\b/.test(ci),
  },
  {
    id: "architecture",
    label: "the architecture check (check runs arch_cmd)",
    found: (ci) => /specgate\S*\s+check\b/.test(ci),
  },
  {
    id: "systems",
    label: "Ubuntu, macOS and Windows",
    found: (ci) => /macos-latest/.test(ci) && /windows-latest/.test(ci),
  },
  {
    id: "base",
    label: "the requirement ids against the base branch (check --base)",
    found: (ci) => /\bcheck\b[^\n]*--base\b/.test(ci),
  },
  {
    id: "quality",
    label: "the quality checks (quality run)",
    found: (ci) => /\bquality run\b/.test(ci),
  },
  {
    id: "drift",
    label: "the pack drift (validate --against-lock)",
    found: (ci) => /--against-lock\b/.test(ci),
  },
  {
    id: "plan",
    label: "the pending-work plan (plan --format json)",
    found: (ci) => /\bplan\b[^\n]*--format json/.test(ci),
  },
];

/** The CI file to read: the gate first, then any file that runs specgate. */
function ciFile(projectDir: string): { rel: string; provider: string } | null {
  const has = (rel: string) => fs.existsSync(path.join(projectDir, rel));
  if (has(GATE_FILE)) return { rel: GATE_FILE, provider: "github" };
  const workflows = path.join(projectDir, ".github", "workflows");
  if (fs.existsSync(workflows)) {
    const files = fs
      .readdirSync(workflows)
      .filter((f) => /\.ya?ml$/.test(f))
      .sort();
    const runs = files.find((f) =>
      /specgate/.test(fs.readFileSync(path.join(workflows, f), "utf8"))
    );
    if (runs) return { rel: `.github/workflows/${runs}`, provider: "github" };
  }
  for (const [rel, provider] of [
    [".gitlab-ci.yml", "gitlab"],
    ["azure-pipelines.yml", "azure"],
    ["Jenkinsfile", "jenkins"],
  ] as const) {
    if (has(rel)) return { rel, provider };
  }
  return null;
}

export function ciStatus(projectDir: string): CiStatus {
  const found = ciFile(projectDir);
  const text = found ? fs.readFileSync(path.join(projectDir, found.rel), "utf8") : "";
  const provider = found?.provider ?? null;
  const fix = !found
    ? "specgate ci init"
    : found.rel === OLD_SPECS_YML
      ? `specgate ci init --provider ${provider} --replace`
      : `specgate ci init --provider ${provider} --force`;
  return {
    file: found?.rel ?? null,
    provider,
    checks: KNOWN.map(({ id, label, found: has }) =>
      has(text) ? { id, label, present: true } : { id, label, present: false, add: fix }
    ),
  };
}
