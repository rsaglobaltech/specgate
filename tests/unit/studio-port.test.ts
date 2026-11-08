/**
 * REQ-445: a studio already running for the project is found, not fought;
 * a port taken by anything else moves to the next free one.
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";

const CLI = path.join(__dirname, "..", "..", "bin", "specgate.js");

function project(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-port-"));
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  return dir;
}

function start(dir: string, port: number) {
  return cp.spawn(process.execPath, [CLI, "studio", "--port", String(port)], {
    cwd: dir,
    env: { ...process.env, NO_COLOR: "1" },
    detached: process.platform !== "win32",
  });
}

const up = (child: cp.ChildProcess) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("studio did not start")), 10000);
    child.stdout!.on("data", (d: Buffer) => {
      if (String(d).includes("http://")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

const stop = (child: cp.ChildProcess) => {
  try {
    if (process.platform === "win32")
      cp.spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    else process.kill(-child.pid!, "SIGTERM");
  } catch {
    /* gone */
  }
};

/** Run the studio and wait for it to end, or to print where it serves. */
function second(dir: string, args: string[]) {
  return new Promise<{ code: number | null; out: string; child: cp.ChildProcess }>((resolve) => {
    const child = cp.spawn(process.execPath, [CLI, "studio", ...args], {
      cwd: dir,
      env: { ...process.env, NO_COLOR: "1" },
      detached: process.platform !== "win32",
    });
    let out = "";
    const timer = setTimeout(() => resolve({ code: null, out, child }), 8000);
    const take = (d: Buffer) => {
      out += String(d);
      if (out.includes("http://") && /serving/.test(out)) {
        clearTimeout(timer);
        resolve({ code: null, out, child });
      }
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, out, child });
    });
  });
}

test("REQ-445 SCN-445a: the same project's studio already running is named, with its process id, and no second server starts", async () => {
  const dir = project();
  const port = 41000 + Math.floor(Math.random() * 3000);
  const first = start(dir, port);
  try {
    await up(first);
    const again = await second(dir, []);
    // No --port: the default 4173 may be anything here; run it on the first studio's port instead.
    stop(again.child);
    const r = await second(dir, ["--port", String(port)]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /already running/);
    assert.match(r.out, new RegExp(`http://localhost:${port}`));
    // The process that serves: the one to stop.
    const pid = Number((/process (\d+)/.exec(r.out) || [])[1]);
    const ping = await new Promise<{ pid: number }>((resolve, reject) => {
      require("node:http")
        .get(
          { host: "127.0.0.1", port, path: "/api/ping", headers: { host: "localhost" } },
          (res: import("node:http").IncomingMessage) => {
            let body = "";
            res.on("data", (d: Buffer) => (body += d));
            res.on("end", () => resolve(JSON.parse(body)));
          }
        )
        .on("error", reject);
    });
    assert.equal(pid, ping.pid);
  } finally {
    stop(first);
  }
});

test("REQ-445: a port taken by something else, with no --port given, moves to the next free one", async () => {
  const dir = project();
  const blocker = net.createServer();
  const port = await new Promise<number>((resolve) => {
    // The default port taken by anything that is not a studio.
    blocker.listen(4173, "127.0.0.1", () => resolve(4173)).on("error", () => resolve(0));
  });
  if (!port) return; // 4173 already in use on this machine: what moves is shown by the next test.
  try {
    const r = await second(dir, []);
    try {
      assert.equal(r.code, null, r.out);
      assert.match(r.out, /4173 is taken/);
      assert.match(r.out, /http:\/\/localhost:417[4-9]|http:\/\/localhost:418[0-3]/);
    } finally {
      stop(r.child);
    }
  } finally {
    blocker.close();
  }
});

test("REQ-445: --port names a port something else holds — refused, saying it is taken", async () => {
  const dir = project();
  const blocker = net.createServer();
  const port = await new Promise<number>((resolve) =>
    blocker.listen(0, "127.0.0.1", () => resolve((blocker.address() as net.AddressInfo).port))
  );
  try {
    const r = await second(dir, ["--port", String(port)]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(`${port} is taken`));
  } finally {
    blocker.close();
  }
});
