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
    await page.goto(`${base}/#/${s}`);
    await expect(page.locator("#main h1").first()).toBeVisible();
    await expect(page.locator(".skeleton")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("REQ-436 SCN-436a: from an open question to a run followed in Live", async ({ page }) => {
  const errors = watch(page);
  const notice = (text) => expect(page.locator(".notice", { hasText: text }).last()).toBeVisible();

  // Answer both questions, one with an option, one typed and saved with Enter.
  await page.goto(`${base}/#/questions`);
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
  await page.goto(`${base}/#/changes`);
  await expect(page.getByText("Nada lo impide: se puede aprobar.")).toBeVisible();
  await page.getByRole("button", { name: "Aprobar el borrador" }).click();
  await notice("Borrador aprobado");
  await expect(page.locator(".list a", { hasText: "orders" })).toContainText("Aprobado");

  // Choose the agent in Build: the test's own command.
  await page.goto(`${base}/#/build`);
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
  await expect(page.locator(".run-badge")).toContainText("En marcha", { timeout: 60_000 });
  await expect(page.locator(".term")).toContainText("src/orders.ts", { timeout: 60_000 });
  await expect(page.locator(".pipeline [aria-current=step]")).toBeVisible();
  await expect(page.locator(".mm .seg-running")).toHaveCount(1);
  await page.getByRole("tab", { name: "Agente" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Modelo");
  await page.getByRole("button", { name: "Trazabilidad" }).click();
  await expect(page.locator(".trace")).toContainText("REQ-002");
  await page.getByRole("button", { name: "Ejecución" }).click();

  // Stop it at once, and nothing runs any more.
  await page.getByRole("button", { name: "Parar ya" }).click();
  await expect(page.locator("#stop-now-sure")).toBeFocused();
  await page.locator("#stop-now-sure").click();
  await expect(page.locator(".run-badge")).not.toContainText("En marcha", { timeout: 30_000 });
  await expect(page.locator(".wq[aria-label=Ahora]")).toContainText("No hay nada en marcha ahora.");
  expect(errors).toEqual([]);
});

// studio-cli-parity: what the CLI does, from the studio (REQ-438 … REQ-443).
test("REQ-439 SCN-439a + REQ-440 + REQ-441 + REQ-442: the gate, a new change, a delivery refused, a preference — from the studio", async ({
  page,
}) => {
  const errors = watch(page);
  const notice = (text) =>
    expect(page.locator(".notice", { hasText: text }).last()).toBeVisible({ timeout: 60_000 });

  // The gate from Home: its stages, said.
  await page.goto(`${base}/#/home`);
  await page.getByRole("button", { name: "Comprobar ahora" }).click();
  await expect(page.locator(".gate p.ok, .gate p.err")).toBeVisible({ timeout: 120_000 });
  await expect(page.locator(".gate-list")).toContainText("Especificación");

  // A new change from an idea: it is listed among the other changes.
  await page.goto(`${base}/#/changes`);
  await page.getByRole("button", { name: "+ Nuevo cambio" }).click();
  await page.locator("#new-change-id").fill("add-coupons");
  await page.getByRole("button", { name: "Proponer", exact: true }).click();
  await notice("specgate propose add-coupons");
  await expect(page.locator(".list a", { hasText: "add-coupons" })).toBeVisible();

  // Delivering a requirement no test names: refused, and why.
  await page.locator(".list a", { hasText: "orders" }).click();
  await page.locator(".change-panel").getByRole("button", { name: "Entregar" }).first().click();
  await expect(page.locator(".change-panel .gate")).toContainText(
    "todavía no tiene una prueba que lo nombre",
    { timeout: 120_000 }
  );

  // A preference changed in Settings.
  await page.goto(`${base}/#/settings`);
  await page.locator("#pref-pet").selectOption("off");
  await page
    .locator(".pref", { has: page.locator("#pref-pet") })
    .getByRole("button", { name: "Guardar" })
    .click();
  await notice("specgate config set pet off");
  expect(errors).toEqual([]);
  // A command the list does not name is refused by the server, even with the page's token.
  const refused = await page.evaluate(async () => {
    const token = (await (await fetch("/api/ping")).json()).token;
    const r = await fetch("/api/action", {
      method: "POST",
      headers: { "content-type": "application/json", "x-specgate-token": token },
      body: JSON.stringify({ action: "rm -rf .", args: {} }),
    });
    return r.status;
  });
  expect(refused).toBe(422);
});
