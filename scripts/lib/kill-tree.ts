import { spawnSync } from "node:child_process";

/**
 * A process and everything it started. Windows follows the tree itself. On
 * macOS and Linux the harness starts its agent in a process group of its own,
 * which a signal to the run's group does not reach: the descendants are read
 * from `ps` first — once the run is gone they belong to no one — and each is
 * ended with its group.
 */
export function killTree(pid: number): void {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
    return;
  }
  const children = new Map<number, number[]>();
  const ps = spawnSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" });
  for (const line of String(ps.stdout || "").split("\n")) {
    const [child, parent] = line.trim().split(/\s+/).map(Number);
    if (!child || !parent) continue;
    children.set(parent, [...(children.get(parent) || []), child]);
  }
  const tree: number[] = [];
  const walk = (p: number) => {
    tree.push(p);
    for (const c of children.get(p) || []) walk(c);
  };
  walk(pid);
  for (const p of tree) {
    for (const target of [-p, p]) {
      try {
        process.kill(target, "SIGTERM");
      } catch {
        /* not a group leader, or already gone */
      }
    }
  }
}
