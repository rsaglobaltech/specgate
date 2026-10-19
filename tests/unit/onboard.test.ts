"use strict";

/**
 * `specgate onboard` — reading a repository that has code but no specs.
 *
 * The heuristic is deliberately conservative: it proposes capabilities from
 * directories a team already named, and says nothing when the layout implies
 * nothing. A confident wrong answer here is worse than silence, because the
 * whole point is to give someone something to argue with on day one.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import { cliFromRoot as cli } from "../helpers/cli";

const { proposeCapabilities, descendThroughWrappers, titleCase } = require("../../scripts/onboard");

/** A capability `onboard` proposes, with the directory that suggested it. */
interface Capability {
  id: string;
  evidence?: string;
  files?: number;
}

/** Build a fake repository from a map of path → contents. */
function repo(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "onboard-"));
  for (const [rel, contents] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents, "utf8");
  }
  return dir;
}

test("capabilities come from the directories a team already named", () => {
  const dir = repo({
    "domain/booking/Booking.ts": "export class Booking {}",
    "domain/booking/BookingRepo.ts": "export interface BookingRepo {}",
    "domain/billing/Invoice.ts": "export class Invoice {}",
    "domain/identity/User.ts": "export class User {}",
    "package.json": "{}",
  });
  try {
    const caps = proposeCapabilities(dir);
    assert.deepEqual(caps.map((c: Capability) => c.id).sort(), ["billing", "booking", "identity"]);
    // Ordered by weight, so the biggest area is the one to describe first.
    assert.equal(caps[0].id, "booking");
    // Every proposal names where it came from — it is an argument, not a verdict.
    assert.equal(caps[0].evidence, "domain/booking");
    assert.equal(caps[0].files, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("build and test directories are never proposed as capabilities", () => {
  const dir = repo({
    "src/modules/orders/Order.java": "class Order {}",
    "src/modules/shipping/Ship.java": "class Ship {}",
    "src/modules/config/Config.java": "class Config {}",
    "node_modules/left-pad/index.js": "module.exports = 1;",
    "dist/bundle.js": "//",
    "tests/OrderTest.java": "//",
  });
  try {
    const ids = proposeCapabilities(dir).map((c: Capability) => c.id);
    assert.deepEqual(ids.sort(), ["orders", "shipping"]);
    assert.ok(!ids.includes("config"));
    assert.ok(!ids.includes("node_modules"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a Java package root is walked through, not proposed", () => {
  // src/main/java/com/acme/ — stopping early would propose "com" as a capability.
  const dir = repo({
    "src/main/java/com/acme/billing/Invoice.java": "class Invoice {}",
    "src/main/java/com/acme/catalog/Item.java": "class Item {}",
    "pom.xml": "<project/>",
  });
  try {
    const caps = proposeCapabilities(dir);
    assert.deepEqual(caps.map((c: Capability) => c.id).sort(), ["billing", "catalog"]);
    assert.ok(!caps.some((c: Capability) => c.id === "com"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a layout that implies nothing proposes nothing", () => {
  // Silence beats a confident wrong answer.
  const dir = repo({ "index.js": "console.log(1);", "package.json": "{}" });
  try {
    assert.deepEqual(proposeCapabilities(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("descendThroughWrappers stops at the first meaningful level", () => {
  const dir = repo({ "a/b/c/billing/x.ts": "//", "a/b/c/orders/y.ts": "//" });
  try {
    const base = descendThroughWrappers(path.join(dir, "a"));
    assert.equal(path.basename(base), "c");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("titleCase reads directory names the way a person would", () => {
  assert.equal(titleCase("order-history"), "Order History");
  assert.equal(titleCase("user_accounts"), "User Accounts");
  assert.equal(titleCase("paymentGateway"), "Payment Gateway");
});

test("onboard runs on a repository that is not adopted yet", () => {
  // Every other command requires a spec-driven project. This one exists for
  // repositories that are not one, so it must not demand spec.md.
  const dir = repo({
    "domain/booking/Booking.ts": "//",
    "domain/billing/Invoice.ts": "//",
    "package.json": JSON.stringify({ name: "acme", dependencies: { react: "18" } }),
  });
  try {
    const r = cli("onboard", "--project-dir", dir, "--json");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const doc = JSON.parse(r.stdout);
    assert.equal(doc.onboarding.adopted, false);
    assert.equal(doc.onboarding.nextCommand, "specgate adopt");
    assert.equal(doc.onboarding.capabilities.length, 2);
    assert.match(doc.onboarding.stack.name, /Node\.js/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("once adopted, the next step is describing the largest capability", () => {
  const dir = repo({
    "spec.md": "# Spec\n",
    "domain/booking/a.ts": "//",
    "domain/booking/b.ts": "//",
    "domain/billing/c.ts": "//",
  });
  try {
    const doc = JSON.parse(cli("onboard", "--project-dir", dir, "--json").stdout);
    assert.equal(doc.onboarding.adopted, true);
    assert.equal(doc.onboarding.nextCommand, "specgate propose describe-booking");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an unreadable layout says so, with a way forward", () => {
  const dir = repo({ "index.js": "//" });
  try {
    const doc = JSON.parse(cli("onboard", "--project-dir", dir, "--json").stdout);
    const codes = doc.status.map((d: { code: string }) => d.code);
    assert.ok(codes.includes("capabilities_undetected"));
    for (const d of doc.status) assert.ok(d.fix, `${d.code} should carry a fix`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("onboard writes nothing", () => {
  const dir = repo({ "domain/a/x.ts": "//", "domain/b/y.ts": "//" });
  try {
    const before = fs.readdirSync(dir).sort();
    cli("onboard", "--project-dir", dir);
    assert.deepEqual(fs.readdirSync(dir).sort(), before);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a Gradle module is read through src/main/java, past its build output (H17)", () => {
  // `lixy-api/domain` proposed nothing at all: the single-child descent stopped
  // at `src` (two children, `main` and `test`), and `src`/`main`/`java` are all
  // in NOT_DOMAIN, so the filter emptied the list. A compiled `build/` made it
  // stop even earlier. 299 files of hexagonal Java read as an empty layout.
  const dir = repo({
    "domain/src/main/java/com/lixy/domain/booking/Booking.java": "class Booking {}",
    "domain/src/main/java/com/lixy/domain/booking/Slot.java": "class Slot {}",
    "domain/src/main/java/com/lixy/domain/wallet/Wallet.java": "class Wallet {}",
    "domain/src/test/java/com/lixy/domain/booking/BookingTest.java": "class BookingTest {}",
    "domain/build/classes/java/main/Booking.class": "binary",
    "build.gradle.kts": "plugins { java }",
  });
  try {
    const caps = proposeCapabilities(dir);
    assert.deepEqual(caps.map((c: Capability) => c.id).sort(), ["booking", "wallet"]);
    assert.equal(caps[0].evidence, "domain/src/main/java/com/lixy/domain/booking");
    // The proposal must not change once someone runs a build.
    assert.ok(!caps.some((c: Capability) => c.id === "build" || c.id === "classes"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("capability weight counts the code inside a JVM package (H14)", () => {
  // countFiles used to prune every NOT_DOMAIN name, `src`/`main`/`java`
  // included, so a JVM module never got descended into and every capability
  // weighed ~0. On `lakebase-platform` a 38-file module reported 1 — and since
  // the list is sorted by weight, the ranking came out inverted.
  const dir = repo({
    "services/platform/src/main/java/com/acme/A.java": "//",
    "services/platform/src/main/java/com/acme/B.java": "//",
    "services/platform/src/main/java/com/acme/C.java": "//",
    "services/catalog/src/main/java/com/acme/D.java": "//",
    "build.gradle": "apply plugin: 'java'",
  });
  try {
    const caps = proposeCapabilities(dir);
    assert.equal(caps[0].id, "platform", "the bigger module is proposed first");
    assert.equal(caps[0].files, 3);
    assert.equal(caps[1].files, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("onboard reads the directory it was given, not an adopted ancestor (H16)", () => {
  // Standing in a Java sub-project, onboard answered with the parent repo's
  // TypeScript — different stack, different capabilities, and "already
  // adopted". Analysing a different codebase in silence is worse than failing.
  const dir = repo({
    "spec.md": "# Parent spec\n",
    "package.json": JSON.stringify({ name: "parent", dependencies: { next: "15" } }),
    "domain/legacy-a/x.ts": "//",
    "domain/legacy-b/y.ts": "//",
    "api/src/main/java/com/acme/billing/Invoice.java": "class Invoice {}",
    "api/src/main/java/com/acme/catalog/Item.java": "class Item {}",
    "api/pom.xml": "<project/>",
  });
  try {
    const sub = path.join(dir, "api");
    const doc = JSON.parse(cli("onboard", "--project-dir", sub, "--json").stdout);

    assert.equal(doc.onboarding.adopted, false, "the sub-project is not adopted");
    assert.match(doc.onboarding.stack.name, /Java/, "its own stack, not the parent's");
    assert.deepEqual(doc.onboarding.capabilities.map((c: Capability) => c.id).sort(), [
      "billing",
      "catalog",
    ]);

    // The ancestor is reported, never substituted.
    assert.equal(doc.onboarding.adoptedAncestor, fs.realpathSync(dir));
    const advisory = doc.status.find((d: { code: string }) => d.code === "adopted_ancestor");
    assert.ok(advisory, "the parent project is worth mentioning");
    assert.ok(advisory.fix.includes("--project-dir"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a plain adopted project reports no ancestor (H16)", () => {
  const dir = repo({ "spec.md": "# Spec\n", "domain/a/x.ts": "//", "domain/b/y.ts": "//" });
  try {
    const doc = JSON.parse(cli("onboard", "--project-dir", dir, "--json").stdout);
    assert.equal(doc.onboarding.adopted, true);
    assert.equal(doc.onboarding.adoptedAncestor, null);
    assert.ok(!doc.status.some((d: { code: string }) => d.code === "adopted_ancestor"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
