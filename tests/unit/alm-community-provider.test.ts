/**
 * Community ALM providers, resolved by package name (E2-04).
 *
 * The two-tier model exists because every connector is somebody else's API:
 * carrying six in this repository would tie its release cadence to six vendors,
 * and carrying none would make the tool useless to a team on YouTrack.
 *
 * It also means `alm.config.yaml` can cause third-party code to run, with the
 * ALM credential in reach — a connector cannot work without one. Most of what
 * is asserted here is about that: what it refuses, and what it will not do
 * silently.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const { getProvider, providerIds, isCommunityProvider } = require("../../scripts/alm/providers");

/** A project with `node_modules/<name>` containing the given module source. */
function withPackage(name: string, source: string, fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-community-"));
  try {
    const pkgDir = path.join(dir, "node_modules", ...name.split("/"));
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, "package.json"),
      JSON.stringify({ name, version: "1.0.0", main: "index.js" }),
      "utf8"
    );
    fs.writeFileSync(path.join(pkgDir, "index.js"), source, "utf8");
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const VALID_PROVIDER = `
class Client {
  constructor(cfg) { this.cfg = cfg; this.capabilities = MOD.capabilities; }
  async createIssue() { return { key: "YT-1", url: null }; }
  async getIssueStatus() { return "open"; }
  async closeIssue() {}
}
const MOD = {
  id: "youtrack",
  label: "YouTrack (community)",
  config: { required: ["base_url", "token_env"], optional: ["done_state"] },
  capabilities: { create: true, readStatus: true, close: true, listIssues: false },
  create: (cfg) => new Client(cfg),
};
module.exports = MOD;
`;

test("a core provider needs no project directory", () => {
  for (const id of providerIds()) {
    assert.equal(getProvider(id).id, id);
  }
  assert.equal(isCommunityProvider("jira"), false);
  assert.equal(isCommunityProvider("npm:whatever"), true);
});

test("a community provider is loaded from the project's node_modules", () => {
  withPackage("specgate-alm-youtrack", VALID_PROVIDER, (dir) => {
    const provider = getProvider("npm:specgate-alm-youtrack", dir);
    assert.equal(provider.id, "youtrack");
    assert.equal(provider.label, "YouTrack (community)");
    assert.deepEqual([...provider.config.required], ["base_url", "token_env"]);
    // It is a provider like any other: the same factory, the same contract.
    const client = provider.create({ provider: "npm:specgate-alm-youtrack" } as any);
    assert.equal(typeof client.createIssue, "function");
  });
});

test("a package name that is a path is refused", () => {
  // The guard that matters: without it, a committed config file could make the
  // CLI require any file on the disk.
  withPackage("specgate-alm-youtrack", VALID_PROVIDER, (dir) => {
    for (const bad of [
      "npm:../../../etc/passwd",
      "npm:/absolute/path",
      "npm:./relative",
      "npm:https://example.com/evil.js",
      "npm:",
    ]) {
      assert.throws(
        () => getProvider(bad, dir),
        /not a path or a URL|Invalid community provider/,
        `${bad} should be refused`
      );
    }
  });
});

test("a package that is not installed is never installed automatically", () => {
  // Installing on demand would turn editing a config file into running new
  // code. It stays a dependency decision, made deliberately and reviewed.
  withPackage("specgate-alm-youtrack", VALID_PROVIDER, (dir) => {
    assert.throws(
      () => getProvider("npm:specgate-alm-nowhere", dir),
      /is not installed in this project/
    );
    assert.throws(() => getProvider("npm:specgate-alm-nowhere", dir), /npm install --save-dev/);
    assert.equal(
      fs.existsSync(path.join(dir, "node_modules", "specgate-alm-nowhere")),
      false,
      "nothing may be fetched as a side effect of resolving a provider"
    );
  });
});

test("a package that is not a provider fails against the contract, not mid-sync", () => {
  withPackage("not-a-provider", 'module.exports = { hello: "world" };', (dir) => {
    assert.throws(
      () => getProvider("npm:not-a-provider", dir),
      /does not implement the ALM provider contract/
    );
    assert.throws(() => getProvider("npm:not-a-provider", dir), /declares no create\(\) factory/);
  });
});

test("a provider whose declaration lies about itself is refused", () => {
  // The declaration is not decoration: a provider claiming a capability it has
  // no method for would fail at the first request, in a stack trace, halfway
  // through a run.
  const LIAR = `
    module.exports = {
      id: "liar",
      label: "Liar",
      config: { required: [], optional: [] },
      capabilities: { create: true, readStatus: true, close: "yes", listIssues: false },
      create: () => ({}),
    };
  `;
  withPackage("specgate-alm-liar", LIAR, (dir) => {
    assert.throws(
      () => getProvider("npm:specgate-alm-liar", dir),
      /capability 'close' is not declared/
    );
  });
});

test("a scoped package name is accepted", () => {
  withPackage("@acme/specgate-alm-youtrack", VALID_PROVIDER, (dir) => {
    assert.equal(getProvider("npm:@acme/specgate-alm-youtrack", dir).id, "youtrack");
  });
});

test("an unknown core id points at both tiers", () => {
  assert.throws(() => getProvider("rally"), /Unknown ALM provider 'rally'/);
  assert.throws(() => getProvider("rally"), /npm:<package>/);
});
