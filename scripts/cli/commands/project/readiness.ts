import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  readHarnessConfig,
  writeHarnessCommand,
} from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import { withAgentPermission, withLiveStream } from "../../../lib/agent-permission";
import * as ui from "../../../lib/ui";
import type { Capability } from "./OnboardCommand";

/**
 * What an adoption leaves ready, and what it does not (change onboarding-fixes):
 * the test command and the agent it detects are saved — asked first when a
 * person is at the terminal (REQ-470) — and the areas it reads off the code are
 * written down for a person to specify, never seeded as requirements (REQ-471).
 */

/** The agents whose CLI, when on the PATH, Build can run without a person (REQ-470, REQ-473). */
export const AGENT_COMMANDS: Record<string, string> = {
  claude: "claude -p < {prompt_file}",
};

/** Whether a program is on the PATH. */
export function onPath(program: string): boolean {
  const finder = process.platform === "win32" ? "where" : "which";
  return spawnSync(finder, [program], { stdio: "ignore", windowsHide: true }).status === 0;
}

/** Build's command for an agent, with the permission and live stream `config set agent` adds. */
export function agentCommand(tool: string): string | null {
  const bare = AGENT_COMMANDS[tool];
  return bare ? withLiveStream(withAgentPermission(bare).command) : null;
}

/** A person can answer: a terminal on both ends, not CI, not --yes. */
export function canAsk(yes: boolean): boolean {
  return !yes && !process.env.CI && !!process.stdin.isTTY && !!process.stdout.isTTY;
}

/** Asks a yes/no question at the terminal; Enter is yes. */
export function askYes(question: string): boolean {
  process.stdout.write(`  ${question} [Y/n] `);
  const buf = Buffer.alloc(256);
  let answer = "";
  try {
    for (;;) {
      const n = fs.readSync(0, buf, 0, buf.length, null);
      if (n <= 0) break;
      answer += buf.toString("utf8", 0, n);
      if (answer.includes("\n")) break;
    }
  } catch {
    return true;
  }
  return !/^\s*n/i.test(answer);
}

export interface ReadyItem {
  name: "Tests" | "Agent" | "Architecture" | "CI gate";
  ready: boolean;
  /** What is set, or how to set it. */
  detail: string;
}

/**
 * Saves the test command and the agent adoption detected, unless one is set
 * already — asking first when a person can answer — and says, for the tests,
 * the agent, the architecture check and the CI gate, what is ready.
 */
export function settle(
  dir: string,
  opts: { detectedTest: string | null; yes: boolean; dryRun: boolean; ci: string | null },
  say: (line: string) => void
): ReadyItem[] {
  const current = readHarnessConfig(dir) ?? {};
  const ask = canAsk(opts.yes);
  const set = (key: "test_cmd" | "agent", value: string, question: string): boolean => {
    if (opts.dryRun) {
      say(`[dry-run] would set ${key}: ${value}`);
      return false;
    }
    if (ask && !askYes(question)) return false;
    writeHarnessCommand(dir, key, value);
    say(`set ${key}: ${value}  (harness.config.yaml)`);
    return true;
  };

  let tests = current.testCmd ?? null;
  if (
    !tests &&
    opts.detectedTest &&
    set("test_cmd", opts.detectedTest, `Run \`${opts.detectedTest}\` as the project's tests?`)
  ) {
    tests = opts.detectedTest;
  }

  let agent = current.agent ?? null;
  if (!agent) {
    const tool = Object.keys(AGENT_COMMANDS).find(onPath);
    const command = tool ? agentCommand(tool) : null;
    if (tool && command && set("agent", command, `Let Build run ${tool} for each requirement?`)) {
      agent = command;
    }
  }

  const arch = current.archCmd ?? null;
  return [
    {
      name: "Tests",
      ready: !!tests,
      detail: tests ?? 'not set — specgate config set test_cmd "<command>"',
    },
    {
      name: "Agent",
      ready: !!agent,
      detail: agent
        ? agent.split(/\s/)[0]!.replace(/^.*[\\/]/, "")
        : "not set — specgate agents init --tool claude",
    },
    {
      name: "Architecture",
      ready: !!arch,
      detail: arch ?? 'not set — specgate config set arch_cmd "<command>"',
    },
    {
      name: "CI gate",
      ready: !!opts.ci,
      detail: opts.ci ?? "not installed — specgate ci init",
    },
  ];
}

/** The readiness list adoption ends with: one line each, ready or the command that makes it so. */
export function readinessText(items: ReadyItem[]): string {
  const width = Math.max(...items.map((i) => i.name.length));
  return (
    "\n  Ready ──────────────────────────────────────────────────\n" +
    items
      .map(
        (i) =>
          `  ${i.ready ? ui.c.green + "✔" + ui.c.reset : "·"}  ${i.name.padEnd(width)}  ${i.detail}`
      )
      .join("\n") +
    "\n"
  );
}

const TEST_FILE =
  /(\.|-|_)(test|spec)\.[cm]?[jt]sx?$|Test\.(java|kt)$|_test\.(go|py)$|^test_.*\.py$/;
const SKIP = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "target",
  "out",
  ".next",
  "coverage",
]);

/** The test files whose path has the area's folder name in it: `test/auth/…`, `src/auth/x.test.ts`. */
export function testsOf(dir: string, area: string, limit = 20): string[] {
  const found: string[] = [];
  const walk = (abs: string, rel: string, depth: number) => {
    if (found.length >= limit || depth > 8) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP.has(e.name)) walk(path.join(abs, e.name), r, depth + 1);
      } else if (TEST_FILE.test(e.name) && r.split("/").slice(0, -1).includes(area)) {
        found.push(r);
      }
    }
  };
  walk(dir, "", 0);
  return found;
}

/**
 * `docs/specs/adoption.md`: the areas adoption read off the code, each with
 * where it comes from, its size and its tests — to specify one at a time,
 * not requirements (REQ-471).
 */
export function adoptionAreas(dir: string, project: string, capabilities: Capability[]): string {
  const areas = capabilities
    .map((cap) => {
      const tests = testsOf(dir, cap.id);
      return (
        `## ${cap.title}\n\n` +
        `- Code: \`${cap.evidence}\` · ${cap.files} source file${cap.files === 1 ? "" : "s"}\n` +
        `- Tests: ${tests.length ? tests.map((t) => `\`${t}\``).join(", ") : "none found"}\n`
      );
    })
    .join("\n");
  return (
    `# Areas found in ${project}\n\n` +
    "`specgate adopt` read these areas off the code. They are not requirements: they say\n" +
    "where behaviour lives, not what it must do. Specify one behaviour you rely on at a time:\n\n" +
    '    specgate new "<a behaviour of the area, as the user sees it>"\n\n' +
    "then write the test that names its REQ id (or name it in an existing test) and\n" +
    "`specgate apply REQ-NNN`. Delete an area from this file once it is specified, or keep\n" +
    "the file as a map — the gate does not read it.\n\n" +
    areas
  );
}
