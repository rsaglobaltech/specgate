"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Ajv = require("ajv/dist/2020");
import type { ErrorObject } from "ajv";

const ROOT = path.resolve(__dirname, "../../..");
const schemaPath = path.join(ROOT, "schemas", "pack.schema.json");
const FIXTURE_ROOT = path.join(ROOT, "tests/fixtures/domain-packs");
const FIXTURE_ID = "parking-management/backend";

const { loadPack } = require("../../packages/core/src/infrastructure/DiskPackRepository");

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const ajv = new Ajv({ strict: false, allErrors: true });
const validate = ajv.compile(schema);

function fixture() {
  return loadPack(FIXTURE_ROOT, FIXTURE_ID).pack;
}

// --- Happy path ---

test("parking-management fixture passes the JSON Schema", () => {
  const pack = fixture();
  const valid = validate(pack);
  if (!valid) {
    assert.fail(
      "Schema errors:\n" +
        validate.errors.map((e: ErrorObject) => `  ${e.instancePath} ${e.message}`).join("\n")
    );
  }
  assert.ok(valid);
});

// --- schema_version ---

test("rejects pack with missing schema_version", () => {
  const pack = fixture();
  delete pack.schema_version;
  assert.equal(validate(pack), false);
});

test("rejects pack with non-SemVer schema_version", () => {
  const pack = fixture();
  pack.schema_version = "v1";
  assert.equal(validate(pack), false);
});

// --- metadata ---

test("rejects unsupported project_type", () => {
  const pack = fixture();
  pack.metadata.project_type = "mobile";
  assert.equal(validate(pack), false);
});

test("rejects missing metadata.name", () => {
  const pack = fixture();
  delete pack.metadata.name;
  assert.equal(validate(pack), false);
});

// --- requirements ---

test("rejects requirement with invalid priority", () => {
  const pack = fixture();
  pack.requirements[0].priority = "Nice to have";
  assert.equal(validate(pack), false);
});

test("rejects requirement with invalid status", () => {
  const pack = fixture();
  pack.requirements[0].status = "Unknown";
  assert.equal(validate(pack), false);
});

test("rejects requirement id not matching REQ-NNN pattern", () => {
  const pack = fixture();
  pack.requirements[0].id = "R-1";
  assert.equal(validate(pack), false);
});

// --- events ---

test("rejects event with invalid type", () => {
  const pack = fixture();
  pack.events[0].type = "external";
  assert.equal(validate(pack), false);
});

test("rejects event with empty payload", () => {
  const pack = fixture();
  pack.events[0].payload = [];
  assert.equal(validate(pack), false);
});

// --- commands ---

test("rejects command name not ending in Command", () => {
  const pack = fixture();
  pack.commands[0].name = "CheckCapacityThreshold";
  assert.equal(validate(pack), false);
});

// --- scenarios ---

test("rejects scenario id not matching SCN-NNN pattern", () => {
  const pack = fixture();
  pack.scenarios[0].id = "SCEN-001";
  assert.equal(validate(pack), false);
});

// --- bounded_contexts ---

test("rejects bounded context with invalid type", () => {
  const pack = fixture();
  pack.bounded_contexts[0].type = "Peripheral";
  assert.equal(validate(pack), false);
});

// --- contracts project_type ---

function minimalContractsPack(): any {
  return {
    schema_version: "1.2.0",
    metadata: {
      name: "API Contracts",
      version: "0.1.0",
      language: "en",
      project_type: "contracts",
    },
    variables: { required: ["PROJECT_NAME"] },
    requirements: [
      {
        id: "REQ-001",
        title: "Define API",
        priority: "Must",
        description: "Publish OpenAPI spec",
        status: "Draft",
      },
    ],
    api_contracts: [
      {
        id: "AC-001",
        title: "Provider REST API",
        type: "REST",
        provider: "provider-service",
        consumers: ["consumer-service"],
        schema_ref: "contracts/openapi/v1.yaml",
        requirement: "REQ-001",
      },
    ],
    outputs: {
      files: [{ target: "docs/contract.md", template: "contracts/contract.md.tpl" }],
    },
    rules: {
      traceability: {
        target: "docs/traceability.md",
        include_existing_rows: true,
        default_status: "Draft",
      },
    },
  };
}

test("accepts a minimal contracts pack", () => {
  const pack = minimalContractsPack();
  const valid = validate(pack);
  if (!valid) {
    assert.fail(
      "Schema errors:\n" +
        validate.errors.map((e: ErrorObject) => `  ${e.instancePath} ${e.message}`).join("\n")
    );
  }
  assert.ok(valid);
});

test("rejects contracts pack missing api_contracts", () => {
  const pack = minimalContractsPack();
  delete pack.api_contracts;
  assert.equal(validate(pack), false);
});

test("rejects contracts pack with AC id not matching AC-NNN pattern", () => {
  const pack = minimalContractsPack();
  pack.api_contracts[0].id = "ACT-001";
  assert.equal(validate(pack), false);
});

test("rejects contracts api_contract with unsupported type", () => {
  const pack = minimalContractsPack();
  pack.api_contracts[0].type = "SOAP";
  assert.equal(validate(pack), false);
});

test("rejects contracts api_contract with empty consumers array", () => {
  const pack = minimalContractsPack();
  pack.api_contracts[0].consumers = [];
  assert.equal(validate(pack), false);
});

test("accepts contracts pack with consumer_driven_tests", () => {
  const pack = minimalContractsPack();
  pack.consumer_driven_tests = [
    {
      id: "CDT-001",
      consumer: "svc-a",
      provider: "svc-b",
      pact_file: "pacts/a-b.json",
      requirement: "REQ-001",
    },
  ];
  assert.ok(validate(pack));
});

test("rejects CDT with id not matching CDT-NNN pattern", () => {
  const pack = minimalContractsPack();
  pack.consumer_driven_tests = [
    { id: "CT-001", consumer: "a", provider: "b", pact_file: "p.json", requirement: "REQ-001" },
  ];
  assert.equal(validate(pack), false);
});

test("rejects backend pack that lacks required DDD sections", () => {
  const pack = minimalContractsPack();
  pack.metadata.project_type = "backend";
  assert.equal(validate(pack), false);
});

test("accepts 'contracts' as a valid project_type", () => {
  const pack = fixture();
  pack.metadata.project_type = "contracts";
  // contracts type requires api_contracts not DDD sections — just verify enum passes
  validate(pack);
  // may fail on missing api_contracts (from else branch), but NOT on enum
  const enumError = (validate.errors || []).find((e: ErrorObject) => e.keyword === "enum");
  assert.equal(enumError, undefined, "should not fail on enum for 'contracts'");
});
