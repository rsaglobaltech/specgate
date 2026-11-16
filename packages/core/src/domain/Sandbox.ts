/**
 * REQ-588: the agent run inside a container (`sandbox:` in harness.config.yaml).
 * Pure: the command line is built here and run by the harness like any other.
 *
 * The container sees the requirement's worktree, the folder of its prompt file
 * and the run's events folder — each at the path it has on the host, so the
 * agent command needs no rewriting — and nothing else of the machine. Its
 * network is off unless the project turns it on, and it gets only the
 * environment variables named (`agent_env:` and the harness's own).
 */

export type SandboxNetwork = "none" | "default";

export interface SandboxConfig {
  /** The image the agent runs in: it must hold the agent's CLI. */
  image: string;
  /** `none` (default): no network at all; `default`: the engine's own network. */
  network: SandboxNetwork;
  /** The container engine: `docker` (default) or `podman`. */
  engine: "docker" | "podman";
}

export interface SandboxInputs {
  /** The requirement's worktree: mounted read-write, the working directory. */
  worktree: string;
  /** Folders the agent reads or writes besides it: the prompt's, the events'. */
  mounts: string[];
  /** Names of the variables passed through (their values come from the harness's environment). */
  env: string[];
  /** `uid:gid` the container runs as, so the files it writes are the user's; null on Windows. */
  user: string | null;
}

/** `value` as one argument of a POSIX shell command line. */
function q(value: string): string {
  if (/^[A-Za-z0-9_./:@=,+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/** The command that runs `command` inside the sandbox. */
export function sandboxCommand(
  command: string,
  config: SandboxConfig,
  inputs: SandboxInputs
): string {
  const args: string[] = [config.engine, "run", "--rm", "-i"];
  if (config.network === "none") args.push("--network", "none");
  if (inputs.user) args.push("--user", inputs.user);
  const seen = new Set<string>();
  for (const dir of [inputs.worktree, ...inputs.mounts]) {
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    args.push("-v", q(`${dir}:${dir}`));
  }
  args.push("-w", q(inputs.worktree));
  for (const name of [...new Set(inputs.env)].sort()) args.push("-e", q(name));
  args.push(q(config.image), "sh", "-c", q(command));
  return args.join(" ");
}

/** `sandbox:` as harness.config.yaml writes it, checked; throws with the fix. */
export function readSandbox(value: unknown): SandboxConfig {
  const raw = (typeof value === "string" ? { image: value } : value) as Record<string, unknown>;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      "sandbox is an image name, or a mapping with image, network (none|default) and engine (docker|podman)"
    );
  }
  const image = String(raw.image || "").trim();
  if (!image) throw new Error("sandbox.image is required: the image that holds the agent's CLI");
  const network = String(raw.network || "none");
  if (network !== "none" && network !== "default") {
    throw new Error(`sandbox.network is none or default, not ${network}`);
  }
  const engine = String(raw.engine || "docker");
  if (engine !== "docker" && engine !== "podman") {
    throw new Error(`sandbox.engine is docker or podman, not ${engine}`);
  }
  return { image, network, engine };
}
