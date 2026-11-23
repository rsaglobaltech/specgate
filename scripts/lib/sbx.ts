/**
 * The Docker Sandboxes adapter (sandbox-swarm, REQ-698…REQ-701): every call
 * to `sbx` the harness makes. `SPECGATE_SBX` names the binary — the tests
 * point it at a fake that records each call.
 */

import { spawnSync } from "node:child_process";

export function sbxBin(): string {
  return process.env.SPECGATE_SBX || "sbx";
}

function sbx(args: string[], input?: string) {
  const r = spawnSync(sbxBin(), args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: r.status === 0,
    status: r.status,
    out: `${r.stdout || ""}`,
    err: `${r.stderr || ""}${r.error ? String(r.error.message) : ""}`,
  };
}

/** `value` as one argument of a POSIX shell command line. */
export function shq(value: string): string {
  if (/^[A-Za-z0-9_./:@=,+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function sbxCreate(name: string, kit: string, workspace: string): void {
  const r = sbx(["create", "--name", name, kit, workspace]);
  if (!r.ok) {
    throw new Error(
      `sbx could not create the sandbox ${name}: ${(r.err || r.out).trim() || `exit ${r.status}`}`
    );
  }
}

/** Opens `host` for this sandbox alone; the rule's id, to remove it later. */
export function sbxAllow(name: string, host: string): string | null {
  const r = sbx(["policy", "allow", "network", "--sandbox", name, host]);
  if (!r.ok) {
    throw new Error(`sbx could not open ${host} for ${name}: ${(r.err || r.out).trim()}`);
  }
  const m = /rule\s+([0-9a-f-]{8,})/i.exec(r.out + r.err);
  return m ? m[1] : null;
}

/** The hosts the sandbox's kit allows: its `kit:<name>` network rules. */
export function sbxKitHosts(name: string): string[] {
  const r = sbx(["policy", "ls", name, "--json"]);
  if (!r.ok) return [];
  try {
    const doc = JSON.parse(r.out) as {
      rules?: Array<{
        name?: string;
        resource_type?: string;
        decision?: string;
        resources?: string[];
      }>;
    };
    const hosts = new Set<string>();
    for (const rule of doc.rules || []) {
      if (rule.resource_type !== "network" || rule.decision !== "allow") continue;
      if (!String(rule.name || "").startsWith("kit:")) continue;
      for (const h of rule.resources || []) hosts.add(h);
    }
    return [...hosts].sort();
  } catch {
    return [];
  }
}

/** Runs `command` in the sandbox, from `cwd`; its exit status and output. */
export function sbxExec(name: string, cwd: string, command: string) {
  return sbx(["exec", "-w", cwd, name, "sh", "-lc", command]);
}

/** The line that runs `command` in the sandbox from `cwd`, passing `env` through. */
export function sbxExecLine(name: string, cwd: string, command: string, env: string[] = []): string {
  const pass = [...new Set(env)]
    .filter((v) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(v))
    .sort()
    .map((v) => `-e "${v}=\${${v}}"`)
    .join(" ");
  return [shq(sbxBin()), "exec", pass, "-w", shq(cwd), shq(name), "sh", "-lc", shq(command)]
    .filter(Boolean)
    .join(" ");
}

export function sbxRemove(name: string): boolean {
  return sbx(["rm", "--force", name]).ok;
}

export function sbxRemoveRule(name: string, id: string): boolean {
  return sbx(["policy", "rm", "network", "--id", id, "--sandbox", name, "-f"]).ok;
}

/** The names of the sandboxes sbx has, or null when sbx cannot say. */
export function sbxList(): string[] | null {
  const r = sbx(["ls", "--format", "json"]);
  if (!r.ok) return null;
  try {
    const doc = JSON.parse(r.out || "[]") as Array<{ name?: string; Name?: string }>;
    return doc.map((d) => String(d.name || d.Name || "")).filter(Boolean);
  } catch {
    return null;
  }
}
