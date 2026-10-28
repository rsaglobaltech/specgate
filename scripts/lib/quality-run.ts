import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import {
  checksFor,
  expandRun,
  type CheckContext,
  type QualityCheck,
  type QualityConfig,
  type Stage,
} from "../../packages/core/src/domain/QualityChecks";
import {
  findingLine,
  newFindings,
  readSarif,
  type Finding,
} from "../../packages/core/src/domain/Sarif";
import { readBaseline } from "../../packages/core/src/infrastructure/QualityBaselineFile";
import { runSonar } from "./sonar-local";
import {
  DEFAULT_TYPES,
  exempt,
  parseCommit,
} from "../../packages/core/src/domain/ConventionalCommit";
import {
  changedLines,
  diffCoverage,
  mutationScore,
  readCobertura,
  readJacoco,
  readLcov,
  readPit,
  readStryker,
} from "../../packages/core/src/domain/ChangeMeasures";

/**
 * Runs the quality and security checks of a stage (ADR-0040): each in its
 * container or on this machine, within its time, its outcome kept for the
 * gate, the harness and the views.
 */

export interface CheckOutcome {
  name: string;
  when: Stage;
  gate: boolean;
  ok: boolean;
  /** Why it did not run, when it did not. */
  skipped: string;
  runner: "docker" | "local" | "";
  command: string;
  ms: number;
  exit: number | null;
  /** The last lines it printed, for a failure. */
  output: string;
  /** With SARIF: the findings this change adds, and how many the baseline holds back. */
  findings?: { fresh: string[]; freshCount: number; baselined: number; total: number };
  /** With a coverage or mutation report: the measure over the changed lines. */
  measure?: {
    kind: "coverage" | "mutation";
    value: number | null;
    threshold: number | null;
    total: number;
    passed: number;
    misses: string[];
  };
}

/** What a stage measures against: the thresholds of the configuration. */
export interface Thresholds {
  diffCoverage: number | null;
  mutationScore: number | null;
  /** Conventional Commits types beyond the defaults (REQ-234). */
  commitTypes?: string[];
  /** In CI fixup! and squash! commits are judged too: they should be gone by then. */
  ci?: boolean;
}

/**
 * The built-in `commits` check (REQ-234): every commit since the base, merges
 * left out, against Conventional Commits 1.0.0.
 */
export function commitsOutcome(
  projectDir: string,
  base: string,
  options: Thresholds
): { ok: boolean; output: string; checked: number } {
  if (!base || base === "HEAD")
    return { ok: true, output: "no commits since the base", checked: 0 };
  const r = git(projectDir, ["log", "--no-merges", "--format=%h%x00%B%x1e", `${base}..HEAD`]);
  if (r.status !== 0) return { ok: false, output: (r.stderr || "").trim(), checked: 0 };
  const types = [...DEFAULT_TYPES, ...(options.commitTypes || [])];
  const broken: string[] = [];
  let checked = 0;
  for (const entry of (r.stdout || "").split("\x1e")) {
    const [hash, body] = entry.replace(/^\s+/, "").split("\0");
    if (!hash || body === undefined) continue;
    if (exempt(body, Boolean(options.ci))) continue;
    checked += 1;
    const parsed = parseCommit(body, types);
    if (parsed.problems.length) {
      broken.push(`${hash} "${body.split("\n")[0]}": ${parsed.problems.join("; ")}`);
    }
  }
  return {
    ok: broken.length === 0,
    checked,
    output: broken.length
      ? [
          `${broken.length} of ${checked} commit(s) do not follow Conventional Commits 1.0.0:`,
          ...broken,
          "Reword them (git rebase -i) as type(scope): description — e.g. feat(REQ-012): cancel a booking.",
        ].join("\n")
      : `${checked} commit(s) follow Conventional Commits 1.0.0`,
  };
}

/** Lines changed since the base, per file; an untracked file counts whole. */
export function changedLineMap(
  projectDir: string,
  base: string,
  files: string[]
): Map<string, Set<number>> {
  const diff = base
    ? git(projectDir, ["diff", "--unified=0", "--no-color", base]).stdout || ""
    : "";
  const map = changedLines(diff);
  for (const f of files) {
    if (map.has(f)) continue;
    const tracked = git(projectDir, ["ls-files", "--error-unmatch", f]).status === 0;
    if (tracked) continue;
    try {
      const n = fs.readFileSync(path.join(projectDir, f), "utf8").split(/\r?\n/).length;
      map.set(f, new Set(Array.from({ length: n }, (_, i) => i + 1)));
    } catch {
      /* gone */
    }
  }
  return map;
}

/** The measure a report gives over the changed lines, or why there is none. */
export function measureReport(
  projectDir: string,
  check: QualityCheck,
  ctx: CheckContext,
  thresholds: Thresholds
): NonNullable<CheckOutcome["measure"]> | string {
  if (!check.report) return "no report";
  const file = path.join(projectDir, check.report.path);
  if (!fs.existsSync(file)) return `no report at ${check.report.path}`;
  const text = fs.readFileSync(file, "utf8");
  const changed = changedLineMap(projectDir, ctx.base === "HEAD" ? "" : ctx.base, ctx.changedFiles);
  const f = check.report.format;
  const coverage = f === "jacoco" || f === "lcov" || f === "cobertura";
  const m = coverage
    ? diffCoverage(
        changed,
        f === "jacoco" ? readJacoco(text) : f === "lcov" ? readLcov(text) : readCobertura(text)
      )
    : mutationScore(changed, f === "pit" ? readPit(text) : readStryker(text));
  return {
    kind: coverage ? "coverage" : "mutation",
    value: m.value,
    threshold: coverage ? thresholds.diffCoverage : thresholds.mutationScore,
    total: m.total,
    passed: m.passed,
    misses: m.misses.slice(0, 20),
  };
}

/** The lines of a project file, for fingerprints; null when it cannot be read. */
function linesOf(projectDir: string) {
  const cache = new Map<string, string[] | null>();
  return (rel: string) => {
    if (!cache.has(rel)) {
      try {
        cache.set(rel, fs.readFileSync(path.join(projectDir, rel), "utf8").split(/\r?\n/));
      } catch {
        cache.set(rel, null);
      }
    }
    return cache.get(rel)!;
  };
}

/** Every finding of a check's SARIF, or null when it wrote none. */
export function sarifFindings(projectDir: string, check: QualityCheck): Finding[] | null {
  if (!check.sarif) return null;
  const file = path.join(projectDir, check.sarif);
  if (!fs.existsSync(file)) return null;
  return readSarif(
    fs.readFileSync(file, "utf8"),
    projectDir,
    linesOf(projectDir),
    repositoryPath(projectDir)
  );
}

/**
 * A path a tool reported, as the repository file it is: itself when it
 * exists, else the one file that ends with it (`com/shop/Order.java` is
 * `src/main/java/com/shop/Order.java`); left as it is when none or several do.
 */
export function repositoryPath(projectDir: string): (p: string) => string {
  let files: string[] | null = null;
  return (p: string) => {
    if (fs.existsSync(path.join(projectDir, p))) return p;
    if (files === null) {
      const r = git(projectDir, ["ls-files", "--cached", "--others", "--exclude-standard"]);
      files = r.status === 0 ? (r.stdout || "").split("\n").filter(Boolean) : [];
    }
    const hits = files.filter((f) => f.endsWith(`/${p}`));
    return hits.length === 1 ? hits[0] : p;
  };
}

/** Where a check's reports go, inside the project and ignored by git. */
export const REPORTS = path.join(".specgate", "quality");

function git(projectDir: string, args: string[]) {
  return spawnSync("git", ["-C", projectDir, ...args], { encoding: "utf8" });
}

/**
 * The commit a change is measured from: the explicit base, else the first of
 * SPECGATE_BASE, origin's default branch, main, master or develop that HEAD
 * shares history with. Empty when none is found (no git, a first commit).
 */
export function baseOf(projectDir: string, explicit = ""): string {
  const candidates = [
    explicit,
    process.env.SPECGATE_BASE || "",
    (
      git(projectDir, ["symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD"]).stdout || ""
    ).trim(),
    "main",
    "master",
    "develop",
  ].filter(Boolean);
  for (const ref of candidates) {
    const r = git(projectDir, ["merge-base", "HEAD", ref]);
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return "";
}

/** Files changed since the base, committed or not, untracked included; repository-relative. */
export function changedFiles(projectDir: string, base: string): string[] {
  const out = new Set<string>();
  const add = (text: string) =>
    text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((l) => out.add(l));
  if (base) add(git(projectDir, ["diff", "--name-only", base]).stdout || "");
  add(git(projectDir, ["diff", "--name-only", "HEAD"]).stdout || "");
  add(git(projectDir, ["ls-files", "--others", "--exclude-standard"]).stdout || "");
  return [...out].filter((f) => fs.existsSync(path.join(projectDir, f))).sort();
}

let dockerAnswered: boolean | null = null;
/** Whether a Docker daemon answers; asked once per process. */
export function dockerAvailable(): boolean {
  if (dockerAnswered === null) {
    const r = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
      encoding: "utf8",
      timeout: 15000,
    });
    dockerAnswered = r.status === 0 && Boolean((r.stdout || "").trim());
  }
  return dockerAnswered;
}

/** Whether the command's program is on this machine's PATH. */
export function hasProgram(command: string): boolean {
  const program = (command.trim().split(/\s+/)[0] || "").replace(/^["']|["']$/g, "");
  if (!program) return false;
  if (/[\\/]/.test(program)) return fs.existsSync(program);
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [program], {
    encoding: "utf8",
  });
  return r.status === 0;
}

/** Which way the check runs here, or why it cannot. */
export function resolveRunner(
  check: QualityCheck
): { runner: "docker" | "local" } | { skip: string } {
  if (check.runner === "local") return { runner: "local" };
  if (check.runner === "docker") {
    return dockerAvailable()
      ? { runner: "docker" }
      : { skip: "Docker is not running here: start Docker Desktop (or the docker daemon)." };
  }
  if (hasProgram(check.run)) return { runner: "local" };
  if (check.image && dockerAvailable()) return { runner: "docker" };
  return {
    skip: check.image
      ? "the tool is not installed and Docker is not running: install it, or start Docker."
      : "the tool is not installed here, and the check names no image to run it in.",
  };
}

/** Split a command into arguments, honouring single and double quotes. */
export function splitArgs(command: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | null = null;
  let has = false;
  for (const ch of command) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (cur || has) out.push(cur);
      cur = "";
      has = false;
    } else cur += ch;
  }
  if (cur || has) out.push(cur);
  return out;
}

/**
 * `docker run` for a check: the project mounted at /src, its user on Linux and
 * macOS so reports are not root's, the environment names forwarded by name
 * only, the named volumes for caches.
 */
export function dockerArgs(
  check: QualityCheck,
  projectDir: string,
  command: string,
  container: string
): string[] {
  const posix = process.platform !== "win32" && typeof process.getuid === "function";
  const id = posix ? `${process.getuid!()}:${process.getgid ? process.getgid() : 0}` : "";
  // A cache volume belongs to root inside the container, so a check with one
  // runs as root and hands what it wrote back to the person afterwards;
  // without one it runs as the person from the start.
  const asRoot = posix && check.volumes.length > 0 && check.shell;
  // Run as the person, a check has no home of its own: HOME is "/", and a tool
  // that keeps a cache there (Semgrep) fails unless the uid happens to be the
  // image's own user.
  const user = posix && !asRoot ? ["--user", id, "-e", "HOME=/tmp"] : [];
  const script = asRoot
    ? `touch /tmp/.specgate-start; ${command}; s=$?; find /src -newer /tmp/.specgate-start -user 0 -exec chown ${id} {} + 2>/dev/null; exit $s`
    : command;
  return [
    "run",
    "--rm",
    "--name",
    container,
    "-v",
    `${path.resolve(projectDir)}:/src`,
    "-w",
    "/src",
    ...user,
    ...(check.network ? [] : ["--network", "none"]),
    ...check.env.flatMap((e) => ["-e", e]),
    ...check.volumes.flatMap((v) => ["-v", v]),
    // REQ-238: tests that start containers (Testcontainers) reach the host's
    // Docker, and the containers they start through the host's address.
    ...(check.docker
      ? [
          "-v",
          "/var/run/docker.sock:/var/run/docker.sock",
          "-e",
          "TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal",
          "-e",
          "TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock",
          "--add-host",
          "host.docker.internal:host-gateway",
        ]
      : []),
    ...(check.shell
      ? ["--entrypoint", "sh", check.image, "-c", script]
      : [check.image, ...splitArgs(command)]),
  ];
}

/** Pull the image when it is not here yet; the pull is not the check's time. */
export function ensureImage(image: string): { ok: true } | { ok: false; message: string } {
  if (spawnSync("docker", ["image", "inspect", image], { encoding: "utf8" }).status === 0) {
    return { ok: true };
  }
  const pull = spawnSync("docker", ["pull", "-q", image], { encoding: "utf8" });
  return pull.status === 0
    ? { ok: true }
    : {
        ok: false,
        message: `could not pull ${image}: ${(pull.stderr || pull.stdout || "").trim()}`,
      };
}

const tail = (text: string, lines = 60) => text.trim().split("\n").slice(-lines).join("\n");

/** Run one check and say how it ended. */
/** What the harness lends the checks only it can run: an agent reviewing or attacking the work. */
export type AgentChecks = Partial<
  Record<
    "builtin:review" | "builtin:adversary",
    (check: QualityCheck) => { ok: boolean; output: string }
  >
>;

export function runCheck(
  projectDir: string,
  check: QualityCheck,
  ctx: CheckContext,
  thresholds: Thresholds = { diffCoverage: null, mutationScore: null },
  agents: AgentChecks = {}
): CheckOutcome {
  const base: CheckOutcome = {
    name: check.name,
    when: check.when,
    gate: check.gate,
    ok: false,
    skipped: "",
    runner: "",
    command: expandRun(check.run, ctx),
    ms: 0,
    exit: null,
    output: "",
  };
  if (check.run === "builtin:review" || check.run === "builtin:adversary") {
    const perform = agents[check.run];
    if (!perform) {
      return {
        ...base,
        skipped: "an agent check runs inside the harness only (specgate harness run).",
      };
    }
    const started = Date.now();
    const done = perform(check);
    return {
      ...base,
      runner: "local",
      ms: Date.now() - started,
      exit: done.ok ? 0 : 1,
      ok: done.ok,
      output: done.output,
    };
  }
  if (check.run === "builtin:commits") {
    const started = Date.now();
    const c = commitsOutcome(projectDir, ctx.base, thresholds);
    return {
      ...base,
      runner: "local",
      ms: Date.now() - started,
      exit: c.ok ? 0 : 1,
      ok: c.ok,
      output: c.output,
    };
  }
  const missing = check.env.filter((e) => !process.env[e]);
  if (missing.length) {
    return { ...base, skipped: `set ${missing.join(", ")} in the environment (never in a file).` };
  }
  const how = resolveRunner(check);
  if ("skip" in how) return { ...base, skipped: how.skip };
  fs.mkdirSync(path.join(projectDir, ctx.reportDir), { recursive: true });
  const ignore = path.join(projectDir, REPORTS, ".gitignore");
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, "*\n", "utf8");
  const sonar = check.run === "builtin:sonar";
  if (how.runner === "docker" && !sonar) {
    const pulled = ensureImage(check.image);
    if (!pulled.ok) return { ...base, runner: "docker", skipped: pulled.message };
  }
  // A SARIF left by an earlier run must not speak for this one.
  if (check.sarif) fs.rmSync(path.join(projectDir, check.sarif), { force: true });
  const container = `specgate-${check.name}-${process.pid}-${Date.now()}`;
  const started = Date.now();
  const r = sonar
    ? runSonar(projectDir, check.timeout * 1000)
    : how.runner === "docker"
      ? spawnSync("docker", dockerArgs(check, projectDir, base.command, container), {
          cwd: projectDir,
          encoding: "utf8",
          timeout: check.timeout * 1000,
          maxBuffer: 64 * 1024 * 1024,
        })
      : spawnSync(base.command, {
          cwd: projectDir,
          encoding: "utf8",
          shell: true,
          timeout: check.timeout * 1000,
          maxBuffer: 64 * 1024 * 1024,
        });
  const ms = Date.now() - started;
  const timedOut = r.error && (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
  if (timedOut && how.runner === "docker") spawnSync("docker", ["rm", "-f", container]);
  const output = tail(`${r.stdout || ""}${r.stderr || ""}`);
  const ran = {
    ...base,
    runner: how.runner,
    ms,
    exit: r.status,
    ok: !timedOut && r.status === 0,
    output: timedOut ? `${output}\n(timed out after ${check.timeout} s)`.trim() : output,
  };
  if (timedOut) return ran;
  if (check.report) {
    // REQ-223, REQ-224: the report measures the lines this change touched.
    const m = measureReport(projectDir, check, ctx, thresholds);
    if (typeof m === "string") {
      return {
        ...ran,
        ok: false,
        output: `${ran.output}\n(${m}: the check cannot be measured)`.trim(),
      };
    }
    const below = m.value !== null && m.threshold !== null && m.value < m.threshold;
    const what = m.kind === "coverage" ? "diff coverage" : "mutation score";
    return {
      ...ran,
      measure: m,
      ok: ran.ok && !below,
      output: below
        ? [
            `${what} ${m.value}% is below ${m.threshold}% (${m.passed} of ${m.total} on the changed lines):`,
            ...m.misses,
          ].join("\n")
        : ran.output,
    };
  }
  if (!check.sarif) return ran;
  // With SARIF the findings judge, not the exit code: a tool exits 1 on debt
  // the baseline already holds. Only what this change adds fails it.
  let findings: Finding[] | null;
  try {
    findings = sarifFindings(projectDir, check);
  } catch (err) {
    return { ...ran, ok: false, output: `${ran.output}\n${(err as Error).message}`.trim() };
  }
  if (findings === null) {
    return {
      ...ran,
      output: `${ran.output}\n(no SARIF at ${check.sarif}: judged by the exit code)`.trim(),
    };
  }
  const { fresh, baselined } = newFindings(
    findings,
    readBaseline(projectDir),
    check.name,
    check.scope === "diff" && ctx.changedKnown !== false ? ctx.changedFiles : null
  );
  return {
    ...ran,
    ok: fresh.length === 0,
    findings: {
      fresh: fresh.slice(0, 50).map(findingLine),
      freshCount: fresh.length,
      baselined,
      total: findings.length,
    },
    output:
      fresh.length > 0
        ? [
            `${fresh.length} new finding(s)${baselined ? `, ${baselined} in the baseline` : ""}:`,
            ...fresh.slice(0, 20).map(findingLine),
            ...(fresh.length > 20 ? [`… and ${fresh.length - 20} more in ${check.sarif}`] : []),
          ].join("\n")
        : ran.output,
  };
}

/**
 * `arch_cmd` as a check named `arch` (REQ-231): with `arch_sarif` its findings
 * are judged against the baseline like any check's — only a violation the
 * change adds fails — instead of by the tool's exit code.
 */
export function archCheck(archCmd: string, archSarif: string): QualityCheck {
  return {
    name: "arch",
    run: archCmd,
    when: "attempt",
    gate: true,
    runner: "local",
    image: "",
    network: true,
    shell: true,
    volumes: [],
    env: [],
    timeout: 1800,
    sarif: archSarif,
    report: null,
    scope: "diff",
    profile: "",
    docker: false,
  };
}

/** `arch_cmd` judged through its SARIF, shaped like spawnSync's result for the gates that run it. */
export function archRun(
  projectDir: string,
  archCmd: string,
  archSarif: string,
  baseRef = "",
  req = ""
): { status: number; stdout: string; stderr: string } {
  const o = runCheck(
    projectDir,
    archCheck(archCmd, archSarif),
    gateContext(projectDir, req, baseRef)
  );
  return { status: o.ok ? 0 : 1, stdout: o.output, stderr: "" };
}

/** The context `check` and `done` measure from: the base branch, every file changed since. */
export function gateContext(projectDir: string, req = "", baseRef = ""): CheckContext {
  const base = baseOf(projectDir, baseRef);
  const inGit = git(projectDir, ["rev-parse", "--is-inside-work-tree"]).status === 0;
  return {
    req,
    base: base || "HEAD",
    changedFiles: changedFiles(projectDir, base),
    changedKnown: inGit,
    reportDir: path
      .join(REPORTS, req || "check")
      .split(path.sep)
      .join("/"),
  };
}

/** Run the checks of the stages given, in the file's order. */
export function runStages(
  projectDir: string,
  config: QualityConfig,
  stages: Stage[],
  ctx: CheckContext,
  onEach?: (check: QualityCheck, run: () => CheckOutcome) => CheckOutcome,
  agents: AgentChecks = {}
): CheckOutcome[] {
  return checksFor(config, stages).map((check) => {
    const run = () =>
      runCheck(
        projectDir,
        check,
        ctx,
        {
          diffCoverage: config.diffCoverage,
          mutationScore: config.mutationScore,
          commitTypes: config.commitTypes,
          ci: stages.includes("ci"),
        },
        agents
      );
    return onEach ? onEach(check, run) : run();
  });
}

/**
 * Whether the outcomes let the gate pass: a gating check that ran and failed
 * fails it; one that could not run fails it only in CI, where every tool is
 * expected to be there.
 */
export function stagesPassed(outcomes: CheckOutcome[], ci: boolean): boolean {
  return outcomes.every((o) => !o.gate || (o.skipped ? !ci : o.ok));
}

/** For tests: forget whether Docker answered. */
export function resetDockerProbe(value: boolean | null = null): void {
  dockerAnswered = value;
}
