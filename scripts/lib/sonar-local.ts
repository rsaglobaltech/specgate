import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * SonarQube Community, run locally in Docker, as one more check (REQ-226):
 * no account and no server to host. The first run starts the server in a
 * named container on a private network, bound to 127.0.0.1 only; a token for
 * analysis is created once with the server's own default login and kept in
 * `.specgate/sonar.local`, git-ignored — the person's admin password is never
 * changed or stored, so they log in with admin/admin and choose their own.
 * Each run analyses the project with the scanner image and writes the open
 * issues as SARIF, so the baseline judges them like any other check's.
 */

export const SONAR = {
  image: "sonarqube:25.9.0.112764-community",
  scanner: "sonarsource/sonar-scanner-cli:11.4",
  container: "specgate-sonarqube",
  network: "specgate-sonar",
  port: 9123,
};
const BASE = `http://127.0.0.1:${SONAR.port}`;
const LOCAL = path.join(".specgate", "sonar.local");
export const SONAR_SARIF = ".specgate/quality/sonar.sarif";

const docker = (args: string[], timeout = 120000) =>
  spawnSync("docker", args, { encoding: "utf8", timeout });

/**
 * One HTTP call, synchronously: the checks run in spawnSync's world, so a
 * short Node child does the fetch and prints the JSON.
 */
function http(
  method: string,
  url: string,
  auth: string,
  form?: Record<string, string>
): { status: number; body: unknown } {
  const script = [
    "(async () => {",
    "  try {",
    "    const [method, url, auth, form] = JSON.parse(process.argv[1]);",
    "    const r = await fetch(url, {",
    "      method,",
    "      headers: Object.assign(auth ? { Authorization: 'Basic ' + Buffer.from(auth).toString('base64') } : {},",
    "        form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),",
    "      body: form ? new URLSearchParams(form).toString() : undefined,",
    "    });",
    "    const text = await r.text();",
    "    let body = null; try { body = JSON.parse(text); } catch { body = text; }",
    "    process.stdout.write(JSON.stringify({ status: r.status, body }));",
    "  } catch (e) { process.stdout.write(JSON.stringify({ status: 0, body: String(e) })); }",
    "})();",
  ].join("\n");
  const r = spawnSync(
    process.execPath,
    ["-e", script, JSON.stringify([method, url, auth, form || null])],
    {
      encoding: "utf8",
      timeout: 60000,
    }
  );
  try {
    return JSON.parse(r.stdout || "");
  } catch {
    return { status: 0, body: r.stderr || "" };
  }
}

const sleep = (ms: number) => spawnSync(process.execPath, ["-e", `setTimeout(() => {}, ${ms})`]);

/** The server, started if it is not, and answering UP. */
export function ensureServer(
  timeoutMs = 5 * 60 * 1000
): { ok: true } | { ok: false; message: string } {
  docker(["network", "create", SONAR.network]);
  const state = (
    docker(["inspect", "-f", "{{.State.Running}}", SONAR.container]).stdout || ""
  ).trim();
  if (state === "false") docker(["start", SONAR.container]);
  else if (state !== "true") {
    const run = docker(
      [
        "run",
        "-d",
        "--name",
        SONAR.container,
        "--network",
        SONAR.network,
        "-p",
        `127.0.0.1:${SONAR.port}:9000`,
        // Its Elasticsearch asks the host for vm.max_map_count; Docker Desktop
        // does not let a container set it, and one local instance does not need it.
        "-e",
        "SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true",
        "-v",
        "specgate-sonar-data:/opt/sonarqube/data",
        "-v",
        "specgate-sonar-extensions:/opt/sonarqube/extensions",
        SONAR.image,
      ],
      15 * 60 * 1000
    );
    if (run.status !== 0) {
      return { ok: false, message: `could not start SonarQube: ${(run.stderr || "").trim()}` };
    }
  }
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const r = http("GET", `${BASE}/api/system/status`, "");
    if (r.status === 200 && (r.body as { status?: string }).status === "UP") return { ok: true };
    sleep(3000);
  }
  return {
    ok: false,
    message: `SonarQube did not come up at ${BASE} within ${timeoutMs / 60000} min`,
  };
}

/** The analysis token: SONAR_TOKEN, else the one kept, else one created with the default login. */
export function analysisToken(
  projectDir: string
): { ok: true; token: string } | { ok: false; message: string } {
  if (process.env.SONAR_TOKEN) return { ok: true, token: process.env.SONAR_TOKEN };
  const file = path.join(projectDir, LOCAL);
  try {
    const kept = JSON.parse(fs.readFileSync(file, "utf8")).token;
    const checked = kept ? http("GET", `${BASE}/api/authentication/validate`, `${kept}:`) : null;
    if (checked && checked.status === 200 && (checked.body as { valid?: boolean }).valid) {
      return { ok: true, token: kept };
    }
  } catch {
    /* none kept yet */
  }
  const made = http("POST", `${BASE}/api/user_tokens/generate`, "admin:admin", {
    name: `specgate-${path.basename(projectDir)}-${Date.now()}`,
    type: "GLOBAL_ANALYSIS_TOKEN",
  });
  const token = (made.body as { token?: string }).token;
  if (made.status !== 200 || !token) {
    return {
      ok: false,
      message:
        "SonarQube's default login no longer works (its password was changed, as it should be). " +
        `Create a token at ${BASE}/account/security and set it as SONAR_TOKEN in the environment.`,
    };
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ token }, null, 2) + "\n", "utf8");
  ensureIgnored(projectDir, ".specgate/sonar.local");
  return { ok: true, token };
}

/** A line in the project's .gitignore, added once. */
function ensureIgnored(projectDir: string, entry: string): void {
  const file = path.join(projectDir, ".gitignore");
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (!text.split(/\r?\n/).includes(entry)) {
    fs.writeFileSync(file, `${text.replace(/\n?$/, "\n")}${entry}\n`, "utf8");
  }
}

/** The project key: the folder's name, as SonarQube accepts it. */
export function projectKey(projectDir: string): string {
  return (
    path
      .basename(path.resolve(projectDir))
      .replace(/[^A-Za-z0-9_.:-]+/g, "-")
      .replace(/^-|-$/g, "") || "project"
  );
}

/** The scanner's properties for this project: Java sources and classes when it has them. */
export function scannerProperties(projectDir: string, key: string): string[] {
  const has = (rel: string) => fs.existsSync(path.join(projectDir, rel));
  const props = [
    `-Dsonar.projectKey=${key}`,
    "-Dsonar.scm.disabled=true",
    "-Dsonar.working.directory=.specgate/quality/sonar",
  ];
  if (has("src/main/java")) {
    props.push("-Dsonar.sources=src/main/java");
    if (has("src/test/java")) props.push("-Dsonar.tests=src/test/java");
    props.push(
      `-Dsonar.java.binaries=${has("target/classes") ? "target/classes" : has("build/classes") ? "build/classes" : "."}`
    );
  } else {
    props.push(
      "-Dsonar.sources=.",
      "-Dsonar.exclusions=**/node_modules/**,**/dist/**,**/build/**,**/coverage/**,**/.specgate/**,**/.harness/**"
    );
  }
  return props;
}

interface SonarIssue {
  rule: string;
  component: string;
  line?: number;
  severity?: string;
  message: string;
  hash?: string;
}

/** SonarQube's open issues as SARIF 2.1.0, its line hash as the fingerprint. */
export function issuesToSarif(issues: SonarIssue[], key: string): string {
  const level = (s?: string) =>
    s === "BLOCKER" || s === "CRITICAL" ? "error" : s === "MAJOR" ? "warning" : "note";
  return JSON.stringify(
    {
      version: "2.1.0",
      runs: [
        {
          tool: { driver: { name: "SonarQube Community" } },
          results: issues.map((i) => ({
            ruleId: i.rule,
            level: level(i.severity),
            message: { text: i.message },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: i.component.replace(new RegExp(`^${key}:`), "") },
                  region: { startLine: i.line || 1 },
                },
              },
            ],
            ...(i.hash ? { partialFingerprints: { sonarLineHash: i.hash } } : {}),
          })),
        },
      ],
    },
    null,
    2
  );
}

/** Analyse the project and write its open issues as SARIF; shaped like spawnSync's result. */
export function runSonar(
  projectDir: string,
  timeoutMs: number
): { status: number | null; stdout: string; stderr: string; error?: Error } {
  const fail = (message: string) => ({ status: 1, stdout: "", stderr: message });
  const up = ensureServer();
  if (!up.ok) return fail(up.message);
  const tok = analysisToken(projectDir);
  if (!tok.ok) return fail(tok.message);
  const key = projectKey(projectDir);
  const posix = process.platform !== "win32" && typeof process.getuid === "function";
  const scan = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "--network",
      SONAR.network,
      "-v",
      `${path.resolve(projectDir)}:/usr/src`,
      "-w",
      "/usr/src",
      ...(posix ? ["--user", `${process.getuid!()}:${process.getgid ? process.getgid() : 0}`] : []),
      "-e",
      "SONAR_TOKEN",
      "-e",
      `SONAR_HOST_URL=http://${SONAR.container}:9000`,
      "-e",
      "SONAR_USER_HOME=/tmp/.sonar",
      SONAR.scanner,
      ...scannerProperties(projectDir, key),
    ],
    {
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, SONAR_TOKEN: tok.token },
    }
  );
  if (scan.status !== 0) {
    return {
      status: scan.status,
      stdout: scan.stdout || "",
      stderr: scan.stderr || "",
      error: scan.error,
    };
  }
  // The analysis is processed on the server after the scanner ends.
  const report = path.join(projectDir, ".specgate", "quality", "sonar", "report-task.txt");
  const task = (/ceTaskId=(\S+)/.exec(
    fs.existsSync(report) ? fs.readFileSync(report, "utf8") : ""
  ) || [])[1];
  if (task) {
    for (let i = 0; i < 120; i += 1) {
      const t = http("GET", `${BASE}/api/ce/task?id=${task}`, `${tok.token}:`).body as {
        task?: { status?: string };
      };
      const status = t && t.task ? t.task.status : "";
      if (status && status !== "PENDING" && status !== "IN_PROGRESS") break;
      sleep(2000);
    }
  }
  const issues: SonarIssue[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const r = http(
      "GET",
      `${BASE}/api/issues/search?componentKeys=${encodeURIComponent(key)}&resolved=false&ps=500&p=${page}`,
      `${tok.token}:`
    );
    const body = r.body as { issues?: SonarIssue[]; total?: number };
    if (r.status !== 200 || !body.issues)
      return fail(`could not read the issues: HTTP ${r.status}`);
    issues.push(...body.issues);
    if (issues.length >= (body.total || 0) || body.issues.length === 0) break;
  }
  const out = path.join(projectDir, SONAR_SARIF);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, issuesToSarif(issues, key), "utf8");
  return {
    status: 0,
    stdout: `SonarQube analysed ${key}: ${issues.length} open issue(s). ${BASE}/dashboard?id=${encodeURIComponent(key)}`,
    stderr: "",
  };
}
