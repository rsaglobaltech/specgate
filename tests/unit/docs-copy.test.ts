"use strict";

/**
 * The Copy button on every code block of the site (docs/assets/docs.js).
 *
 * It looked for the code inside the button's own header and found nothing, so
 * every Copy on the site did nothing at all. These run the real script against
 * a minimal stand-in for the page: a block, its header with the button, and the
 * `pre` beside it — the shape build-site.ts writes.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const SCRIPT = fs.readFileSync(path.join(ROOT_DIR, "docs", "assets", "docs.js"), "utf8");

/** Run docs.js on one code block; click its Copy; say what reached the clipboard. */
async function clickCopy(text: string, { term = false, clipboard = true } = {}) {
  const copied: string[] = [];
  const code = { textContent: text };
  const box: any = {
    classList: { contains: (c: string) => (c === "code--term" ? term : c === "code") },
    querySelector: (sel: string) => (sel === "pre code" || sel === "code" ? code : null),
  };
  const listeners: Record<string, () => void> = {};
  const btn: any = {
    textContent: "Copy",
    classList: { toggle() {}, remove() {}, add() {} },
    addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
    closest: (sel: string) => (sel === ".code" ? box : null),
    parentNode: { parentNode: box },
  };
  let execCopied = "";
  const textarea: any = { value: "", style: {}, setAttribute() {}, select() {} };
  const document: any = {
    documentElement: { getAttribute: () => null, setAttribute() {} },
    querySelector: () => null,
    querySelectorAll: (sel: string) => (sel === ".code__copy" ? [btn] : []),
    createElement: () => textarea,
    body: { appendChild() {}, removeChild() {} },
    execCommand: (cmd: string) => {
      if (cmd === "copy") execCopied = textarea.value;
      return true;
    },
    addEventListener() {},
  };
  const navigator: any = clipboard
    ? { clipboard: { writeText: (t: string) => (copied.push(t), Promise.resolve()) } }
    : {};
  const window: any = {
    isSecureContext: clipboard,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {},
  };
  const sandbox: any = {
    document,
    navigator,
    window,
    localStorage: { getItem: () => null, setItem() {} },
    setTimeout: () => 0,
    clearTimeout() {},
    location: { pathname: "/", hash: "" },
    fetch: () => Promise.reject(new Error("offline")),
    IntersectionObserver: function () {
      return { observe() {}, disconnect() {} };
    },
    console,
  };
  sandbox.window.document = document;
  vm.runInNewContext(SCRIPT, sandbox);
  assert.ok(listeners.click, "docs.js wires a click handler on the Copy button");
  listeners.click();
  await new Promise((r) => setImmediate(r));
  return { clipboard: copied[0], fallback: execCopied, label: btn.textContent };
}

test("Copy puts the block's code on the clipboard", async () => {
  const r = await clickCopy("npm install -g @rsaglobaltech/specgate\nspecgate init\n");
  assert.equal(r.clipboard, "npm install -g @rsaglobaltech/specgate\nspecgate init");
  assert.equal(r.label, "Copied");
});

test("on a terminal block it copies the commands, not what they printed", async () => {
  const out = "$ specgate status\n  ◆ specgate · status\n  ➜  specgate done REQ-002\n";
  const r = await clickCopy(out, { term: true });
  assert.equal(r.clipboard, "specgate status");
});

test("without the Clipboard API it still copies, the old way", async () => {
  const r = await clickCopy("specgate check", { clipboard: false });
  assert.equal(r.fallback, "specgate check");
  assert.equal(r.label, "Copied");
});
