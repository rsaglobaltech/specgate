/**
 * The ALM conformance kit.
 *
 * One suite, run against every registered provider. It is what makes "adding
 * a provider is a row" true rather than aspirational: a connector that does
 * not behave like the others fails here, before anyone points it at a real
 * Jira.
 *
 * Every provider brings a fixture in `tests/fixtures/alm/<id>.json` — its
 * config, the environment its credentials come from, the responses its API
 * returns, and what the port promises those responses mean. No network, and
 * no provider-specific assertions in this file: if a check has to know it is
 * talking to Jira, it belongs in `alm.test.ts`, not in the kit.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const { PROVIDERS, providerIds, getProvider } = require("../../scripts/alm/providers");
const { checkProviderDeclaration, CAPABILITY_METHOD } = require("../../scripts/alm/port");
const { lintAlmConfig, readAlmConfig, syncRequirements } = require("../../scripts/alm/core");

const FIXTURE_DIR = path.resolve(__dirname, "../../../tests/fixtures/alm");

function loadFixture(id: string) {
  const file = path.join(FIXTURE_DIR, `${id}.json`);
  assert.ok(
    fs.existsSync(file),
    `provider '${id}' is registered but brings no conformance fixture at tests/fixtures/alm/${id}.json`
  );
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Replay recorded responses. Unmatched requests come back as a 404 rather
 * than a throw, so a provider that calls an endpoint its fixture never
 * recorded fails on the assertion, not on a stack trace from the fake.
 */
function replay(routes: any[]) {
  const seen: any[] = [];
  const impl: any = async (url: string, init: any = {}) => {
    const method = init.method || "GET";
    seen.push({ url: String(url), method, body: init.body });
    for (const route of routes) {
      if (String(url).includes(route.match) && (route.method || "GET") === method) {
        return {
          ok: true,
          status: 200,
          json: async () => route.json,
          text: async () => JSON.stringify(route.json),
        };
      }
    }
    return {
      ok: false,
      status: 404,
      text: async () => `no recorded response for ${method} ${url}`,
    };
  };
  impl.seen = seen;
  return impl;
}

function withEnv(env: Record<string, string>, fn: () => Promise<void> | void) {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    previous[k] = process.env[k];
    process.env[k] = v;
  }
  const restore = () => {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  const out = fn();
  if (out && typeof (out as Promise<void>).finally === "function") {
    return (out as Promise<void>).finally(restore);
  }
  restore();
  return out;
}

/** Write a config object to a throwaway project root and hand back the path. */
function withConfigDir(cfg: Record<string, any>, fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-alm-conf-"));
  try {
    const yaml = Object.entries(cfg)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    fs.writeFileSync(path.join(dir, "alm.config.yaml"), `${yaml}\n`, "utf8");
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("the registry exposes at least the two providers the CLI documents", () => {
  assert.ok(providerIds().includes("jira"));
  assert.ok(providerIds().includes("azure"));
});

test("an unregistered provider is refused by name, with the list and a fix", () => {
  assert.throws(() => getProvider("rally"), /Unknown ALM provider 'rally'/);
  assert.throws(() => getProvider("rally"), /Available: jira, azure/);
  assert.throws(() => getProvider("rally"), /alm\.config\.yaml/);
});

for (const provider of PROVIDERS) {
  const id = provider.id;

  test(`${id}: the declaration is well formed`, () => {
    assert.deepEqual(checkProviderDeclaration(provider), []);
  });

  test(`${id}: every capability it claims is a method it has`, () => {
    const fixture = loadFixture(id);
    withEnv(fixture.env, () => {
      const client = provider.create(fixture.config, replay([]));
      for (const [capability, method] of Object.entries(CAPABILITY_METHOD)) {
        if (!provider.capabilities[capability]) continue;
        assert.equal(
          typeof client[method as string],
          "function",
          `${id} claims '${capability}' but has no ${method}()`
        );
      }
    });
  });

  test(`${id}: its own fixture config passes validation with nothing unread`, () => {
    const fixture = loadFixture(id);
    assert.deepEqual(
      lintAlmConfig(fixture.config),
      [],
      `${id}'s fixture config sets a key ${id} does not read`
    );
  });

  test(`${id}: creating an issue returns a key and a URL`, async () => {
    const fixture = loadFixture(id);
    await withEnv(fixture.env, async () => {
      const client = provider.create(fixture.config, replay(fixture.routes));
      const created = await client.createIssue("REQ-001", "Patient CRUD");
      assert.equal(created.key, fixture.expect.createdKey);
      assert.match(String(created.url), new RegExp(fixture.expect.createdUrlContains));
    });
  });

  test(`${id}: status is reported as exactly "open" or "done"`, async () => {
    const fixture = loadFixture(id);
    await withEnv(fixture.env, async () => {
      const client = provider.create(fixture.config, replay(fixture.routes));
      assert.equal(await client.getIssueStatus(fixture.expect.openIssue), "open");
      assert.equal(await client.getIssueStatus(fixture.expect.doneIssue), "done");
    });
  });

  test(`${id}: closing an issue writes to the ALM`, async () => {
    const fixture = loadFixture(id);
    await withEnv(fixture.env, async () => {
      const fetchImpl = replay(fixture.routes);
      const client = provider.create(fixture.config, fetchImpl);
      await client.closeIssue(fixture.expect.closeIssue);
      assert.ok(
        fetchImpl.seen.some((s: any) => s.method !== "GET"),
        `${id} closed an issue without writing anything`
      );
    });
  });

  test(`${id}: a trailing slash on base_url does not double up`, async () => {
    // Every fixture's base_url ends in "/" on purpose: the providers all strip
    // it, and a provider that forgets produces "//rest/api" against a real host.
    const fixture = loadFixture(id);
    assert.match(fixture.config.base_url, /\/$/, "the fixture must exercise the trailing slash");
    await withEnv(fixture.env, async () => {
      const fetchImpl = replay(fixture.routes);
      const client = provider.create(fixture.config, fetchImpl);
      await client.createIssue("REQ-001", "t");
      for (const call of fetchImpl.seen) {
        assert.doesNotMatch(
          call.url.replace(/^https?:\/\//, ""),
          /\/\//,
          `${id} built a URL with a doubled slash: ${call.url}`
        );
      }
    });
  });

  test(`${id}: a failed response is reported, never swallowed`, async () => {
    const fixture = loadFixture(id);
    await withEnv(fixture.env, async () => {
      // Nothing recorded, so every request 404s.
      const client = provider.create(fixture.config, replay([]));
      await assert.rejects(
        () => client.createIssue("REQ-001", "t"),
        /HTTP 404/,
        `${id} did not surface a failed create`
      );
    });
  });

  test(`${id}: a missing credential names the variable and how to set it`, () => {
    const fixture = loadFixture(id);
    // Deliberately do not set the environment the fixture declares.
    for (const key of Object.keys(fixture.env)) delete process.env[key];
    assert.throws(
      () => provider.create(fixture.config, replay([])),
      /Environment variable .* is not set/,
      `${id} built a client with no credential`
    );
  });

  test(`${id}: readAlmConfig accepts its required keys and rejects each omission`, () => {
    // Through the real on-disk reader, not a re-implementation of it: every
    // other check in this kit works on config objects, so a regression in the
    // reader would otherwise slip past the whole suite.
    const fixture = loadFixture(id);
    const minimal: any = { alm_version: 1, provider: id };
    for (const key of provider.config.required) minimal[key] = fixture.config[key];

    withConfigDir(minimal, (dir) => {
      assert.equal(readAlmConfig(dir).provider, id);
    });
    assert.deepEqual(lintAlmConfig(minimal), []);

    for (const key of provider.config.required) {
      const short = { ...minimal };
      delete short[key];
      withConfigDir(short, (dir) => {
        assert.throws(
          () => readAlmConfig(dir),
          new RegExp(`missing required key '${key}' for provider '${id}'`),
          `${id} accepts a config without its required '${key}'`
        );
      });
    }
  });
}

test("the documented config table matches what the providers declare", () => {
  // A table of keys is exactly the kind of prose that rots: the declarations
  // move and the doc does not. This reads the table back out of
  // docs/automation.md and compares it to the source.
  const doc = fs.readFileSync(path.resolve(__dirname, "../../../docs/alm.md"), "utf8");
  const marker = "<!-- specgate:alm-provider-table";
  assert.ok(doc.includes(marker), "the provider table lost its marker comment");

  const table = doc.slice(doc.indexOf(marker)).split("\n\n")[1];
  const documented: Record<string, { required: string[]; optional: string[] }> = {};
  for (const line of table.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    const id = (cells[1] || "").replace(/`/g, "");
    if (!providerIds().includes(id)) continue;
    const keys = (cell: string) =>
      cell
        .split(",")
        .map((k) => k.trim().replace(/`/g, ""))
        .filter(Boolean);
    documented[id] = { required: keys(cells[2]), optional: keys(cells[3]) };
  }

  assert.deepEqual(
    Object.keys(documented).sort(),
    providerIds().sort(),
    "the table lists a different set of providers than the registry"
  );
  for (const provider of PROVIDERS) {
    assert.deepEqual(
      documented[provider.id].required.sort(),
      [...provider.config.required].sort(),
      `${provider.id}: documented required keys differ from the declaration`
    );
    assert.deepEqual(
      documented[provider.id].optional.sort(),
      [...provider.config.optional].sort(),
      `${provider.id}: documented optional keys differ from the declaration`
    );
  }
});

test("nothing in the ALM subsystem writes to the spec tree (ADR-0021)", () => {
  // The rule the ADR exists to make permanent: the board is a mirror, so no
  // provider and no part of the sync core may write `spec.md`,
  // `docs/specs/**` or `features/**`. The one file it does write is the REQ ↔
  // issue mapping, which records a correspondence and asserts nothing about
  // the system.
  const dir = path.resolve(__dirname, "../../../scripts/alm");
  const sources: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts")) sources.push(full);
    }
  };
  walk(dir);
  assert.ok(sources.length > 0, "found no ALM sources to check");

  const WRITES =
    /\b(?:writeFileSync|appendFileSync|createWriteStream|rmSync|unlinkSync|renameSync|cpSync|copyFileSync)\s*\(/g;
  const offenders: string[] = [];
  for (const file of sources) {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      if (line.trim().startsWith("*") || line.trim().startsWith("//")) continue;
      WRITES.lastIndex = 0;
      if (!WRITES.test(line)) continue;
      // The mapping file is the one permitted destination.
      if (/mapPath|MAP_RELPATH/.test(line)) continue;
      offenders.push(`${path.relative(dir, file)}: ${line.trim()}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `ADR-0021: the ALM subsystem may only write .specops/alm-map.json:\n  ${offenders.join("\n  ")}`
  );
});

test("the sync core never advances a requirement from the board (ADR-0021)", async () => {
  // Status flows matrix → board and not back. A closed issue whose requirement
  // is still open must come back as a finding, not as a state change.
  const client = {
    capabilities: { create: true, readStatus: true, close: true },
    async createIssue() {
      throw new Error("not reached");
    },
    async getIssueStatus() {
      return "done";
    },
    async closeIssue() {
      throw new Error("not reached");
    },
  };
  const requirements = [{ id: "REQ-001", title: "t", status: "open" }];
  const map = { "REQ-001": { issue: "X-1" } };
  const actions = await syncRequirements(requirements, map, client, {});

  assert.equal(actions[0].action, "drift");
  assert.equal(requirements[0].status, "open", "the board changed the requirement");
  assert.deepEqual(map, { "REQ-001": { issue: "X-1" } }, "the mapping gained state from the board");
});
