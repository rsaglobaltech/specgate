/**
 * A stand-in for Docker Sandboxes' `sbx` (sandbox-swarm REQ-698…REQ-701): it
 * keeps its sandboxes and rules in a JSON file, logs each call, gives every
 * kit 29 hosts of its own, and runs `exec` on the host in the folder asked.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

export interface FakeSbx {
  /** What SPECGATE_SBX points at. */
  bin: string;
  calls: () => string[][];
  state: () => { sandboxes: Record<string, { kit: string; workspace: string }>; rules: Array<{ id: string; sandbox: string; host: string }> };
  /** A sandbox sbx has that nobody recorded. */
  add: (name: string) => void;
}

const SCRIPT = String.raw`
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const dir = __dirname;
const stateFile = dir + "/state.json";
const st = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : { sandboxes: {}, rules: [], n: 0 };
const save = () => fs.writeFileSync(stateFile, JSON.stringify(st));
const a = process.argv.slice(2);
fs.appendFileSync(dir + "/calls.jsonl", JSON.stringify(a) + "\n");
const KIT = process.env.FAKE_SBX_KIT ? process.env.FAKE_SBX_KIT.split(",") : Array.from({ length: 29 }, (_, i) => "kit-host-" + i + ".example:443");
if (a[0] === "create") {
  const name = a[a.indexOf("--name") + 1];
  if (process.env.FAKE_SBX_FAIL_CREATE) { console.error("ERROR: " + process.env.FAKE_SBX_FAIL_CREATE); process.exit(1); }
  // As sbx: a name taken is refused; making one takes a moment.
  if (st.sandboxes[name]) { console.error("ERROR: sandbox " + name + " already exists"); process.exit(1); }
  const until = Date.now() + Number(process.env.FAKE_SBX_CREATE_MS || 0); while (Date.now() < until) {}
  const again = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : st;
  if (again.sandboxes[name]) { console.error("ERROR: sandbox " + name + " already exists"); process.exit(1); }
  Object.assign(st, again);
  const rest = a.filter((x, i) => x !== "create" && x !== "--name" && a[i - 1] !== "--name");
  st.sandboxes[name] = { kit: rest[0], workspace: rest[1] };
  save();
  console.log("  ✓ Created sandbox " + name);
} else if (a[0] === "policy" && a[1] === "allow") {
  const sb = a[a.indexOf("--sandbox") + 1];
  const id = "00000000-0000-4000-8000-" + String(++st.n).padStart(12, "0");
  st.rules.push({ id, sandbox: sb, host: a[a.length - 1] });
  save();
  console.log("Added rule " + id + " to policy local (scope: sandbox:" + sb + "): " + a[a.length - 1] + " [tcp]");
} else if (a[0] === "policy" && a[1] === "deny") {
  const sb = a[a.indexOf("--sandbox") + 1];
  st.denied = (st.denied || []).concat([{ sandbox: sb, host: a[a.length - 1] }]);
  save();
  console.log("Added rule to policy local (scope: sandbox:" + sb + "): " + a[a.length - 1] + " [tcp,udp]");
} else if (a[0] === "policy" && a[1] === "ls") {
  const sb = a[2];
  const rules = [{ name: "kit:" + sb, resource_type: "network", decision: "allow", resources: KIT }]
    .concat(st.rules.filter((r) => r.sandbox === sb).map((r) => ({ name: r.id, resource_type: "network", decision: "allow", resources: [r.host] })));
  console.log(JSON.stringify({ rules }));
} else if (a[0] === "policy" && a[1] === "rm") {
  const id = a[a.indexOf("--id") + 1];
  st.rules = st.rules.filter((r) => r.id !== id);
  save();
} else if (a[0] === "rm") {
  const name = a[a.length - 1];
  delete st.sandboxes[name];
  save();
} else if (a[0] === "ls") {
  console.log(JSON.stringify(Object.keys(st.sandboxes).map((name) => ({ name, workspaces: [st.sandboxes[name].workspace] }))));
} else if (a[0] === "exec") {
  const env = { ...process.env };
  let i = 1, cwd = process.cwd();
  while (a[i] && a[i].startsWith("-")) {
    if (a[i] === "-e") { const [k, ...v] = a[i + 1].split("="); env[k] = v.join("="); i += 2; }
    else if (a[i] === "-w") { cwd = a[i + 1]; i += 2; }
    else i++;
  }
  const name = a[i];
  if (!st.sandboxes[name]) { console.error("no sandbox " + name); process.exit(125); }
  const cmd = a.slice(i + 1);
  // What a sandbox installs inside is not installed on the machine that runs the tests.
  if (process.env.FAKE_SBX_NO_SETUP && cmd.join(" ").includes("setup.sh")) process.exit(0);
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd, env, stdio: "inherit" });
  process.exit(r.status === null ? 1 : r.status);
} else { console.error("fake sbx: " + a.join(" ")); process.exit(2); }
`;

export function fakeSbx(): FakeSbx {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-fake-sbx-"));
  fs.writeFileSync(path.join(dir, "sbx.js"), SCRIPT);
  const bin = path.join(dir, "sbx");
  fs.writeFileSync(bin, `#!/bin/sh\nexec "${process.execPath}" "${path.join(dir, "sbx.js")}" "$@"\n`, { mode: 0o755 });
  const state = () => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf8"));
    } catch {
      return { sandboxes: {}, rules: [] };
    }
  };
  return {
    bin,
    calls: () => {
      try {
        return fs
          .readFileSync(path.join(dir, "calls.jsonl"), "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((l: string) => JSON.parse(l));
      } catch {
        return [];
      }
    },
    state,
    add: (name: string) => {
      const st = state();
      st.sandboxes[name] = { kit: "shell", workspace: "" };
      st.n = st.n || 0;
      fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(st));
    },
  };
}
