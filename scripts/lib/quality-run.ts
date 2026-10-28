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
  const user =
    process.platform !== "win32" && typeof process.getuid === "function"
      ? ["--user", `${process.getuid()}:${process.getgid ? process.getgid() : 0}`]
      : [];
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
    ...(check.shell
      ? ["--entrypoint", "sh", check.image, "-c", command]
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
export function runCheck(projectDir: string, check: QualityCheck, ctx: CheckContext): CheckOutcome {
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
  const missing = check.env.filter((e) => !process.env[e]);
  if (missing.length) {
    return { ...base, skipped: `set ${missing.join(", ")} in the environment (never in a file).` };
  }
  const how = resolveRunner(check);
  if ("skip" in how) return { ...base, skipped: how.skip };
  fs.mkdirSync(path.join(projectDir, ctx.reportDir), { recursive: true });
  const ignore = path.join(projectDir, REPORTS, ".gitignore");
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, "*\n", "utf8");
  if (how.runner === "docker") {
    const pulled = ensureImage(check.image);
    if (!pulled.ok) return { ...base, runner: "docker", skipped: pulled.message };
  }
  const container = `specgate-${check.name}-${process.pid}-${Date.now()}`;
  const started = Date.now();
  const r =
    how.runner === "docker"
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
  return {
    ...base,
    runner: how.runner,
    ms,
    exit: r.status,
    ok: !timedOut && r.status === 0,
    output: timedOut ? `${output}\n(timed out after ${check.timeout} s)`.trim() : output,
  };
}

/** The context `check` and `done` measure from: the base branch, every file changed since. */
export function gateContext(projectDir: string, req = "", baseRef = ""): CheckContext {
  const base = baseOf(projectDir, baseRef);
  return {
    req,
    base: base || "HEAD",
    changedFiles: changedFiles(projectDir, base),
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
  onEach?: (check: QualityCheck, run: () => CheckOutcome) => CheckOutcome
): CheckOutcome[] {
  return checksFor(config, stages).map((check) => {
    const run = () => runCheck(projectDir, check, ctx);
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
