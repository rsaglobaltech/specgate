import * as fs from "node:fs";
import * as path from "node:path";
import type { QualityConfig } from "../../packages/core/src/domain/QualityChecks";

/**
 * What the harness needs from the machine before an agent runs (REQ-279).
 *
 * A stopped Docker Desktop cost the seventh truck-flote run three attempts on
 * its first requirement: the tests reached Testcontainers, failed in fifteen
 * seconds with "Could not find a valid Docker environment", and each failure
 * went back to the agent as a failing test (S61). Nothing in the code could
 * fix it. Asked once, before the first worktree, it costs one command.
 */

/** Build files that say the tests start containers. */
const BUILD_FILES = ["pom.xml", "build.gradle", "build.gradle.kts", "package.json"];
/** Never searched: dependencies and build output name Testcontainers too. */
const SKIP = new Set([".git", "node_modules", "target", "build", "dist", ".gradle", ".harness"]);

/** The build files of the project, at its root and up to two folders down (apps/api/pom.xml). */
function buildFiles(projectDir: string, depth = 2): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(projectDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(projectDir, e.name);
    if (e.isDirectory()) {
      if (depth > 0 && !SKIP.has(e.name) && !e.name.startsWith(".")) {
        out.push(...buildFiles(full, depth - 1));
      }
    } else if (BUILD_FILES.includes(e.name)) out.push(full);
  }
  return out;
}

/**
 * Why this project needs Docker to pass its gate, or null when it does not:
 * a quality check that runs in Docker or is given it, or Testcontainers in a
 * build file.
 */
export function dockerNeed(projectDir: string, quality: QualityConfig | null): string | null {
  const check = (quality?.checks || []).find((c) => c.runner === "docker" || c.docker);
  if (check) return `the quality check ${check.name} runs in Docker`;
  for (const file of buildFiles(projectDir)) {
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (/testcontainers/i.test(text)) {
      const rel = path.relative(projectDir, file).split(path.sep).join("/");
      return `the tests use Testcontainers (${rel})`;
    }
  }
  return null;
}

/** What a test command prints when the machine has no Docker to give it. */
const NO_DOCKER = [
  /Could not find a valid Docker environment/i,
  /Cannot connect to the Docker daemon/i,
  /error during connect:.*docker/i,
  /failed to connect to the docker API/i,
];

/**
 * The environment a failed test command could not reach, said for the
 * person, or null when the failure is the code's: Docker cannot be fixed by
 * the agent, and another attempt would meet it again.
 */
export function environmentFailure(output: string): string | null {
  if (NO_DOCKER.some((re) => re.test(output))) {
    return (
      "the tests need Docker, which they could not reach: start Docker Desktop (or the docker " +
      "daemon) and run it again"
    );
  }
  return null;
}
