// The studio guide's screenshots (docs/studio.md, the landing page): the test
// project driven through the studio as a person would, each section captured
// as WebP. Run after `npm run build`: node e2e/studio/screenshots.mjs [--lang es|en] [--quality]
// (--quality also captures the quality card, which needs Docker running).
import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLI, makeProject } from "./fixture.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "..", "docs", "assets", "img");
const lang = process.argv.includes("--lang")
  ? process.argv[process.argv.indexOf("--lang") + 1]
  : "en";

const dir = makeProject();
const port = 49000 + Math.floor(Math.random() * 500);
const studio = spawn(process.execPath, [CLI, "studio", "--port", String(port)], {
  cwd: dir,
  env: { ...process.env, NO_COLOR: "1", STUB_AGENT_MS: "60000" },
  detached: process.platform !== "win32",
  stdio: ["ignore", "pipe", "pipe"],
});
await new Promise((resolve) =>
  studio.stdout.on("data", (d) => String(d).includes("http://") && resolve())
);
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const page = await browser.newPage({
  viewport: { width: 1280, height: 820 },
  colorScheme: "light",
});
await page.addInitScript((l) => {
  if (!localStorage.getItem("sg-studio-prefs"))
    localStorage.setItem(
      "sg-studio-prefs",
      JSON.stringify({ mode: "simple", lang: l, theme: "light", folded: false })
    );
}, lang);
const cdp = await page.context().newCDPSession(page);
const shot = async (name) => {
  await page.waitForTimeout(600);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "webp", quality: 82 });
  fs.writeFileSync(path.join(out, `studio-${name}.webp`), Buffer.from(data, "base64"));
  console.log("studio-" + name + ".webp");
};
/** One card, cut out of the page. */
const shotOf = async (locator, name) => {
  // A notice is a moment, not part of the card.
  await page.evaluate(() => document.querySelectorAll(".notice").forEach((n) => n.remove()));
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const box = await locator.boundingBox();
  // The box is measured from the viewport; the capture takes page coordinates.
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  box.x += scroll.x;
  box.y += scroll.y;
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "webp",
    quality: 82,
    captureBeyondViewport: true,
    clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 },
  });
  fs.writeFileSync(path.join(out, `studio-${name}.webp`), Buffer.from(data, "base64"));
  console.log("studio-" + name + ".webp");
};
const go = async (hash) => {
  await page.goto(`${base}/#/${hash}`);
  await page.locator("#main h1").first().waitFor();
  await page.waitForTimeout(400);
};
const t = (es, en) => (lang === "es" ? es : en);

await go("home");
await shot("home");
await go("brief");
await shot("brief");
await go("changes");
await shot("changes");
await go("questions");
await shot("questions");
// Answer and confirm both, approve, as the journey does.
const q1 = page.locator("article.question").first();
await q1.locator(".chip-btn").first().click();
await q1.locator(".btn-primary").click();
await page.waitForFunction(() => document.querySelectorAll("article.question").length === 1);
await page
  .locator("article.question")
  .first()
  .locator("textarea")
  .fill(t("antes del envío", "before shipping"));
await page.locator("article.question").first().locator("textarea").press("Enter");
await page.locator(".confirm-row").nth(1).waitFor();
await shot("questions-confirm");
for (let i = 0; i < 2; i++) {
  await page.locator(".confirm-row").first().locator("button").click();
  await page.waitForTimeout(800);
}
await go("changes");
await page.locator(".approve .btn-primary").click();
await page.waitForTimeout(800);
await go("build");
await shot("build-agent");
await page.locator('input[name="agent-kind"]').nth(2).check();
await page.locator("#agent-cmd").fill("node stub-agent.mjs {prompt_file}");
await page.locator(".agent .btn-primary").click();
await page.waitForTimeout(800);
const picks = page.locator(".picks input[type=checkbox]");
for (let i = 1; i < (await picks.count()); i++) await picks.nth(i).uncheck();
await shot("build");
await page.locator(".spread .btn-primary").click();
await page.setViewportSize({ width: 1280, height: 1100 });
await page.goto(`${base}/live`);
await page.locator(".term li").nth(1).waitFor({ timeout: 60_000 });
await page.waitForTimeout(1500);
await shot("live");
await page.getByRole("button", { name: t("Trazabilidad", "Traceability") }).click();
await shot("live-trace");
await page.getByRole("button", { name: t("Ejecución", "Run") }).click();
await page.emulateMedia({ colorScheme: "dark" });
await page.evaluate(() => {
  localStorage.setItem(
    "sg-studio-prefs",
    JSON.stringify({
      ...JSON.parse(localStorage.getItem("sg-studio-prefs")),
      theme: "dark",
      folded: true,
    })
  );
});
await page.reload();
await page.locator(".term li").first().waitFor();
await page.waitForTimeout(1200);
await shot("live-dark");
await page.locator(".fold").click();
await page.getByRole("button", { name: t("Parar ya", "Stop now") }).click();
await page.locator("#stop-now-sure").click();
await page.waitForTimeout(1500);
await page.emulateMedia({ colorScheme: "light" });
await page.evaluate(() => {
  localStorage.setItem(
    "sg-studio-prefs",
    JSON.stringify({
      ...JSON.parse(localStorage.getItem("sg-studio-prefs")),
      theme: "light",
      folded: false,
    })
  );
});
await page.setViewportSize({ width: 1280, height: 820 });
await go("report");
await shot("report");
// The gate, run from the studio (REQ-440).
await page.getByRole("button", { name: t("Comprobar ahora", "Check now") }).click();
await page.locator(".gate p.ok, .gate p.err").waitFor({ timeout: 120_000 });
await shotOf(page.locator("section", { has: page.locator("#gate-h") }), "gate");
// The change of a module, with its requirements and actions (REQ-439, REQ-441).
await go("changes");
await page.locator(".list a").first().click();
await shotOf(page.locator(".change-panel"), "change-panel");
await go("settings");
await shot("settings");
await shotOf(page.locator("section", { has: page.locator("#prefs-h") }), "preferences");
// The quality card with the basic level on, for docs/quality.md: it needs Docker running.
if (process.argv.includes("--quality")) {
  await page
    .getByRole("button", { name: t("Activar el nivel básico", "Turn on the basic level") })
    .click();
  await page
    .locator("section", { has: page.locator("#quality-h") })
    .locator(".check")
    .first()
    .waitFor({ timeout: 120_000 });
  await shotOf(page.locator("section", { has: page.locator("#quality-h") }), "quality");
}

await browser.close();
if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(studio.pid), "/T", "/F"]);
else process.kill(-studio.pid, "SIGTERM");
fs.rmSync(path.dirname(dir), { recursive: true, force: true });
