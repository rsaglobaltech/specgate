// REQ-436 SCN-436a: the studio's journey in a real browser — every section
// opens without a script error, and an open question goes all the way to a
// run followed in Live: answered, confirmed, the draft approved, an agent
// chosen, the build started, watched and stopped.
import { test, expect } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { CLI, makeProject } from "./fixture.mjs";

const SECTIONS = ["home", "brief", "changes", "questions", "build", "live", "report", "settings"];

let studio;
let base;
let dir;

test.beforeAll(async () => {
  dir = makeProject();
  const port = 47000 + Math.floor(Math.random() * 2000);
  studio = spawn(process.execPath, [CLI, "studio", "--port", String(port)], {
    cwd: dir,
    env: { ...process.env, NO_COLOR: "1", STUB_AGENT_MS: "30000" },
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
  if (!studio) return;
  // Stop the studio and the run it started, with every process under them.
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(studio.pid), "/T", "/F"]);
  else {
    try {
      process.kill(-studio.pid, "SIGTERM");
    } catch {
      /* gone */
    }
  }
});

test.describe.configure({ mode: "serial" });

/** Script errors on the page, kept so the test can say none happened. */
function watch(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

test("REQ-436 SCN-436a: each section opens without a script error", async ({ page }) => {
  const errors = watch(page);
  for (const s of SECTIONS) {
    await page.goto(`${base}/next#/${s}`);
    await expect(page.locator("#main h1").first()).toBeVisible();
    await expect(page.locator(".skeleton")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("REQ-436 SCN-436a: from an open question to a run followed in Live", async ({ page }) => {
  const errors = watch(page);
  const notice = (text) => expect(page.locator(".notice", { hasText: text }).last()).toBeVisible();

  // Answer both questions, one with an option, one typed and saved with Enter.
  await page.goto(`${base}/next#/questions`);
  const q1 = page.locator("article.question", { hasText: "From what amount is shipping free?" });
  await q1.getByRole("button", { name: "50 €" }).click();
  await q1.getByRole("button", { name: /Guardar respuesta/ }).click();
  await notice("Respuesta guardada");
  const q2 = page.locator("article.question", { hasText: "Until when can an order be cancelled?" });
  await q2.getByLabel("Respuesta").fill("before shipping");
  await q2.getByLabel("Respuesta").press("Enter");
  await expect(page.locator("article.question")).toHaveCount(0);

  // Confirm each answer: the spec says it.
  const rows = page.locator(".confirm-row");
  await expect(rows).toHaveCount(2);
  for (let i = 0; i < 2; i++) {
    await rows.first().getByRole("button", { name: "Ya está en la spec" }).click();
    await expect(rows).toHaveCount(1 - i);
  }

  // Approve the draft: nothing stops it now.
  await page.goto(`${base}/next#/changes`);
  await expect(page.getByText("Nada lo impide: se puede aprobar.")).toBeVisible();
  await page.getByRole("button", { name: "Aprobar el borrador" }).click();
  await notice("Borrador aprobado");
  await expect(page.locator(".list a", { hasText: "orders" })).toContainText("Aprobado");

  // Choose the agent in Build: the test's own command.
  await page.goto(`${base}/next#/build`);
  await page.getByRole("radio", { name: /Mi propio comando/ }).check();
  await page.locator("#agent-cmd").fill("node stub-agent.mjs {prompt_file}");
  await page.getByRole("button", { name: "Usar este asistente" }).click();
  await notice("Asistente guardado");

  // Build one requirement, and follow it in Live.
  const picks = page.locator(".picks input[type=checkbox]");
  const n = await picks.count();
  for (let i = 1; i < n; i++) await picks.nth(i).uncheck();
  await page.getByRole("button", { name: /Construir 1 requisito/ }).click();
  await notice("Construcción en marcha");
  await page.goto(`${base}/live`);
  await expect(page.locator(".conn")).toContainText("Conectado");
  await expect(page.locator(".now h2")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".term")).toContainText("src/orders.ts", { timeout: 60_000 });
  await expect(page.locator(".stages [aria-current=step]")).toBeVisible();

  // Stop it at once, and nothing runs any more.
  await page.getByRole("button", { name: "Parar ya" }).click();
  await expect(page.locator("#stop-now-sure")).toBeFocused();
  await page.locator("#stop-now-sure").click();
  await expect(page.getByText("No hay nada en marcha ahora.")).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});
