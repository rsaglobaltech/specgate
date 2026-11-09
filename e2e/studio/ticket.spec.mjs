// REQ-446 SCN-446a + REQ-447 SCN-447a + REQ-448 SCN-448a: a change opened
// from a ticket in a real browser, against a Jira on 127.0.0.1 — the project on
// the branch agentkit made, the ticket reviewed, a capability chosen, opened
// without pushing once confirmed, and the ticket linked in Changes.
import { test, expect } from "@playwright/test";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { CLI, makeProject } from "./fixture.mjs";

const KAN_13 = {
  key: "KAN-13",
  fields: {
    summary: "Register vehicle entry",
    issuetype: { name: "Story" },
    labels: [],
    status: { name: "To Do" },
    description:
      "As an attendant, I want to register a vehicle's entry so that its stay is charged.\n\n" +
      "Acceptance Criteria\n" +
      "1. Given a free space, when a vehicle enters, then its entry time is kept.\n",
  },
};

let studio;
let jira;
let jiraUrl;
let base;
let dir;
let origin;
/** The branch the project was made on: main or master, as git defaults. */
let start;

const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();

test.beforeAll(async () => {
  jira = http.createServer((req, res) => {
    const found = (req.url || "").startsWith("/rest/api/3/issue/KAN-13");
    res.statusCode = found ? 200 : 404;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(found ? KAN_13 : { errorMessages: ["Issue does not exist"] }));
  });
  await new Promise((ok) => jira.listen(0, "127.0.0.1", ok));
  jiraUrl = `http://127.0.0.1:${jira.address().port}`;

  dir = makeProject();
  for (const capability of ["billing", "orders"]) {
    const where = path.join(dir, "docs", "specs", "capabilities", capability);
    fs.mkdirSync(where, { recursive: true });
    fs.writeFileSync(path.join(where, "spec.md"), `# ${capability}\n`);
  }
  fs.writeFileSync(
    path.join(dir, "alm.config.yaml"),
    [
      "alm_version: 1",
      "provider: jira",
      `base_url: ${jiraUrl}`,
      "project_key: KAN",
      "token_env: STUDIO_E2E_JIRA_TOKEN",
      "user_env: STUDIO_E2E_JIRA_USER",
      "",
    ].join("\n")
  );
  git("add", "-A");
  git("-c", "user.email=e2e@example.com", "-c", "user.name=E2E", "commit", "-q", "-m", "jira");
  origin = fs.mkdtempSync(path.join(os.tmpdir(), "sg-studio-origin-"));
  execFileSync("git", ["init", "-q", "--bare"], { cwd: origin });
  git("remote", "add", "origin", origin);
  start = git("rev-parse", "--abbrev-ref", "HEAD");
  // The branch agentkit makes for the ticket, before anything is opened.
  git("checkout", "-q", "-b", "feature/parking/KAN-13");

  const port = 49000 + Math.floor(Math.random() * 2000);
  studio = spawn(process.execPath, [CLI, "studio", "--port", String(port)], {
    cwd: dir,
    env: {
      ...process.env,
      NO_COLOR: "1",
      STUDIO_E2E_JIRA_TOKEN: "secret-token",
      STUDIO_E2E_JIRA_USER: "ba@example.com",
      GIT_AUTHOR_NAME: "E2E",
      GIT_AUTHOR_EMAIL: "e2e@example.com",
      GIT_COMMITTER_NAME: "E2E",
      GIT_COMMITTER_EMAIL: "e2e@example.com",
    },
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("the studio did not start")), 20_000);
    studio.stdout.on("data", (d) => {
      if (String(d).includes("http://")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  base = `http://127.0.0.1:${port}`;
});

test.afterAll(() => {
  jira?.close();
  if (!studio) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(studio.pid), "/T", "/F"]);
  else {
    try {
      process.kill(-studio.pid, "SIGTERM");
    } catch {
      /* gone */
    }
  }
});

test("REQ-446 SCN-446a + REQ-447 SCN-447a + REQ-448 SCN-448a: KAN-13 reviewed, opened on its branch without pushing, linked in Changes", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  // Home says whose branch it is.
  await page.goto(`${base}/#/home`);
  await expect(page.locator(".branch-line")).toContainText("feature/parking/KAN-13");
  await expect(page.locator(".branch-line")).toContainText("la rama de KAN-13, del equipo parking");

  // The ticket reviewed: ready, no epic, so a capability is chosen.
  await page.goto(`${base}/#/changes`);
  await page.getByRole("button", { name: "+ Nuevo cambio" }).click();
  await page.locator("#new-change-ticket").fill("KAN-13");
  await page.locator("#ticket-review").click();
  const review = page.locator(".ticket-review");
  await expect(review).toContainText("Listo para abrir", { timeout: 60_000 });
  await expect(review).toContainText("Sin capacidad para KAN-13: no tiene épica.");
  await expect(page.locator("#ticket-open")).toBeDisabled();
  await page.locator("#ticket-capability").selectOption("orders");

  // What it will do, said; nothing runs until it is confirmed.
  await expect(review).toContainText("En la rama feature/parking/KAN-13");
  await expect(review).toContainText(
    "Hace commit de docs/specs/changes/kan-13-register-vehicle-entry/ y nada más en feature/parking/KAN-13, y sube la rama a origin."
  );
  await page.locator("#ticket-no-push").check();
  await expect(review).toContainText("y no la sube");
  await page.locator("#ticket-open").click();
  await page.locator("#ticket-confirm").click();
  await expect(
    page
      .locator(".notice", {
        hasText: "specgate propose --from-ticket KAN-13 --capability orders --no-branch --no-push",
      })
      .last()
  ).toBeVisible({ timeout: 60_000 });

  // The change is listed, its ticket linked to Jira.
  await page.locator(".list a", { hasText: "kan-13-register-vehicle-entry" }).click();
  await expect(page.locator(".change-panel h3 a", { hasText: "KAN-13" })).toHaveAttribute(
    "href",
    `${jiraUrl}/browse/KAN-13`
  );
  expect(errors).toEqual([]);

  // On the branch agentkit made, the change's commit, and nothing pushed.
  expect(git("rev-parse", "--abbrev-ref", "HEAD")).toBe("feature/parking/KAN-13");
  expect(git("branch", "--format=%(refname:short)").split("\n").sort()).toEqual(
    ["feature/parking/KAN-13", start].sort()
  );
  for (const f of git("show", "--name-only", "--format=", "HEAD").split("\n")) {
    expect(f).toMatch(/^docs\/specs\/changes\/kan-13-register-vehicle-entry\//);
  }
  expect(
    execFileSync("git", ["for-each-ref", "refs/heads"], { cwd: origin, encoding: "utf8" }).trim()
  ).toBe("");
});
