/**
 * The exam's sandboxes (compat-sandboxed REQ-736, REQ-737): one Docker sandbox
 * per tool and kind — with Specgate, or bare — for a batch. Its only host
 * folder is the batch's own; its network is the tool's provider and the package
 * registry; what it has inside is put there, named.
 *
 * Measured with sbx on 2026-11-24, kit `opencode`: the sandbox sees no other
 * host folder, has the tool and no node; its kit allows other providers' hosts,
 * and its proxy fills in the Developer's secrets for them — so those are denied.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { sbxAllow, sbxBin, sbxCreate, sbxDeny, sbxExec, sbxKitHosts, sbxRemove, shq } from "./sbx";

export type SandboxKind = "specgate" | "bare";

export interface ExamSandbox {
  name: string;
  tool: string;
  kind: SandboxKind;
  /** The batch's folder: the same path on the host and in the sandbox. */
  workspace: string;
  /** The agent's home inside. */
  home: string;
  /** The hosts left open (REQ-737). */
  open: string[];
}

export const REGISTRY_HOST = "registry.npmjs.org";

/** Each tool's provider: the only hosts, with the registry, its sandbox reaches. */
export const PROVIDER_HOSTS: Readonly<Record<string, readonly string[]>> = {
  opencode: ["opencode.ai", "*.opencode.ai"],
  claude: ["api.anthropic.com", "claude.ai", "console.anthropic.com"],
  codex: ["api.openai.com", "chatgpt.com", "*.chatgpt.com", "auth.openai.com"],
};

/** Where each tool keeps the Developer's own session, under their home; where it goes in the sandbox's. */
const SESSION_FILE: Readonly<Record<string, string>> = {
  opencode: path.join(".local", "share", "opencode", "auth.json"),
};

const bare = (host: string) => host.replace(/:\d+$/, "");
const matches = (host: string, pattern: string) =>
  pattern.startsWith("*.") ? host === pattern.slice(2) || host.endsWith(pattern.slice(1)) : host === pattern;

/** REQ-737: of the kit's hosts, those to deny — every one that is not the tool's provider or the registry. */
export function hostsToDeny(kitHosts: readonly string[], tool: string): string[] {
  const keep = [...(PROVIDER_HOSTS[tool] || []), REGISTRY_HOST];
  return [...new Set(kitHosts.map(bare))].filter((h) => !keep.some((k) => matches(h, k))).sort();
}

/** What installs node, and Specgate from a tarball in the workspace when one is named. */
function setupScript(tarball: string | null): string {
  return [
    "#!/bin/sh",
    "# specgate compat: what an exam sandbox has inside.",
    "set -e",
    'mkdir -p "$HOME/.local/bin"',
    'export PATH="$HOME/.local/bin:$PATH"',
    // The registry is the one host the sandbox reaches besides its provider: node and npm come from it.
    "if ! command -v node >/dev/null 2>&1; then",
    '  case "$(uname -m)" in aarch64|arm64) A=arm64 ;; *) A=x64 ;; esac',
    `  curl -fsSL "https://${REGISTRY_HOST}/node-linux-$A/-/node-linux-$A-22.12.0.tgz" -o /tmp/node.tgz`,
    '  mkdir -p "$HOME/.local/node" && tar -xzf /tmp/node.tgz -C "$HOME/.local/node" --strip-components=1',
    '  ln -sf "$HOME/.local/node/bin/node" "$HOME/.local/bin/node"',
    "fi",
    "if ! command -v npm >/dev/null 2>&1; then",
    `  curl -fsSL "https://${REGISTRY_HOST}/npm/-/npm-10.9.2.tgz" -o /tmp/npm.tgz`,
    '  mkdir -p "$HOME/.local/npm" && tar -xzf /tmp/npm.tgz -C "$HOME/.local/npm" --strip-components=1',
    `  printf '#!/bin/sh\\nexec node "%s/.local/npm/bin/npm-cli.js" "$@"\\n' "$HOME" > "$HOME/.local/bin/npm" && chmod +x "$HOME/.local/bin/npm"`,
    "fi",
    tarball
      ? `npm install -g --silent --no-audit --no-fund --prefix "$HOME/.local" ${shq(tarball)} && specgate --version >/dev/null`
      : "# bare: no Specgate here",
    "",
  ].join("\n");
}

export function makeSandbox(
  tool: string,
  kind: SandboxKind,
  o: { tarball: string | null; auth: boolean; /** The provider whose session goes inside: the model's own, as `opencode-go`. */ provider?: string }
): ExamSandbox {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "specgate-compat-box-")));
  const name = `sgc-${tool}-${kind}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    sbxCreate(name, tool, workspace);
  } catch (e) {
    // No sandbox was made: its folder is not left behind either.
    fs.rmSync(workspace, { recursive: true, force: true });
    throw e;
  }
  try {
    // REQ-737: the provider and the registry, and nothing else the kit opens.
    const kit = sbxKitHosts(name);
    for (const host of hostsToDeny(kit, tool)) sbxDeny(name, host);
    const open = [...(PROVIDER_HOSTS[tool] || []), REGISTRY_HOST];
    for (const host of open) {
      try {
        sbxAllow(name, host);
      } catch {
        /* the kit allows it already */
      }
    }
    const home = sbxExec(name, workspace, 'printf %s "$HOME"').out.trim() || "/home/agent";

    const tgz = kind === "specgate" && o.tarball ? path.join(workspace, path.basename(o.tarball)) : null;
    if (tgz) fs.copyFileSync(o.tarball!, tgz);
    const setup = path.join(workspace, "setup.sh");
    fs.writeFileSync(setup, setupScript(tgz), { mode: 0o755 });
    const done = sbxExec(name, workspace, `sh ${shq(setup)}`);
    fs.rmSync(setup, { force: true });
    if (tgz) fs.rmSync(tgz, { force: true });
    if (!done.ok) throw new Error(`the sandbox ${name} could not be set up: ${(done.err || done.out).trim().split("\n").slice(-2).join(" ")}`);

    // REQ-736: the Developer's own session of the tool, for a model that needs an account — never a key.
    if (o.auth && SESSION_FILE[tool]) {
      const mine = path.join(os.homedir(), SESSION_FILE[tool]!);
      if (!fs.existsSync(mine)) throw new Error(`no stored ${tool} session at ${mine}: log in to ${tool} first`);
      // Only the provider asked for: the file holds every account the Developer is logged in to.
      const all = JSON.parse(fs.readFileSync(mine, "utf8")) as Record<string, unknown>;
      const provider = o.provider || tool;
      if (!all[provider]) throw new Error(`no stored session for ${provider} in ${mine} (it has ${Object.keys(all).join(", ") || "none"})`);
      const carried = path.join(workspace, ".session");
      fs.writeFileSync(carried, JSON.stringify({ [provider]: all[provider] }), { mode: 0o600 });
      const dest = `$HOME/${SESSION_FILE[tool]!.split(path.sep).join("/")}`;
      const put = sbxExec(name, workspace, `mkdir -p "$(dirname "${dest}")" && cp ${shq(carried)} "${dest}" && chmod 600 "${dest}"`);
      fs.rmSync(carried, { force: true });
      if (!put.ok) throw new Error(`the ${tool} session could not be put in the sandbox ${name}: ${(put.err || put.out).trim()}`);
    }
    return { name, tool, kind, workspace, home, open };
  } catch (e) {
    removeSandbox({ name, workspace });
    throw e;
  }
}

/**
 * The line that runs `command` in the sandbox from `cwd`. The agent's
 * environment is HOME, PATH and `env`: none of the host's variables and none
 * of the kit's, so no provider key reaches it by name (REQ-736).
 */
export function sandboxLine(box: ExamSandbox, cwd: string, command: string, env: Record<string, string> = {}): string {
  const named = Object.entries(env)
    .filter(([k]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  // The kit fills the sandbox's environment with its own: provider keys' placeholders its proxy completes,
  // and a tool configuration that points at them (measured: OPENCODE_API_KEY, OPENCODE_CONFIG_CONTENT).
  // The agent starts from an empty environment and gets what is named here, and nothing else.
  const given = [`HOME="$HOME"`, `PATH="$HOME/.local/bin:$PATH"`, "TERM=dumb", ...named.map(([k, v]) => shq(`${k}=${v}`))].join(" ");
  const inside = `exec env -i ${given} sh -c ${shq(command)}`;
  return [shq(sbxBin()), "exec", "-w", shq(cwd), shq(box.name), "sh", "-lc", shq(inside)].join(" ");
}

/** REQ-736: nothing left — the sandbox, and the batch's folder. */
export function removeSandbox(box: Pick<ExamSandbox, "name" | "workspace">): void {
  sbxRemove(box.name);
  fs.rmSync(box.workspace, { recursive: true, force: true });
}
