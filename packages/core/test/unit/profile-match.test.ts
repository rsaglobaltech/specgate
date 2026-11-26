/**
 * Which agent profile a requirement gets (D1).
 *
 * `agent_profile` resolved one profile for the whole run, so the allowed tools
 * had to be the greatest common denominator of everything in the plan — a
 * domain requirement carrying `Bash(terraform:*)` because some other
 * requirement needed it.
 *
 * The criterion took measuring. The proposal named the bounded context, "which
 * is already in the model": it is in the *pack* model and was not reachable
 * from a requirement — zero of the twenty-seven scenarios across the curated
 * packs link to an aggregate. Matching on it would have matched nothing, every
 * time, and quietly used the default. So `expand` derives it now and these
 * rules match what is written.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import { MATCHABLE_KEYS, ruleMatches, selectProfile } from "../../src/domain/ProfileMatch";

const infra = { name: "infra", match: { bounded_context: "Platform" } };
const domain = { name: "domain", match: { bounded_context: "*" } };

test("a rule matches the context it names", () => {
  assert.equal(ruleMatches(infra, { boundedContext: "Platform" }), true);
  assert.equal(ruleMatches(infra, { boundedContext: "Billing" }), false);
});

test("first match wins, so order in the file is the priority", () => {
  assert.equal(selectProfile([infra, domain], { boundedContext: "Platform" }), "infra");
  assert.equal(selectProfile([infra, domain], { boundedContext: "Billing" }), "domain");
  // Reversed, the catch-all swallows everything — which is what "first match
  // wins" means, and why it is stated rather than left to be discovered.
  assert.equal(selectProfile([domain, infra], { boundedContext: "Platform" }), "domain");
});

test("no match is not an error — the run's default applies", () => {
  assert.equal(selectProfile([infra], { boundedContext: "Billing" }), null);
  assert.equal(selectProfile([], { boundedContext: "Platform" }), null);
});

test("a requirement with no context matches only nothing, never the catch-all", () => {
  // `*` means "any context", not "no context". A requirement the tool could not
  // place must fall through to the default rather than be handed the tools of
  // whichever profile happened to be last.
  assert.equal(ruleMatches(domain, {}), false);
  assert.equal(selectProfile([domain], {}), null);
});

test("a profile with no match: never matches", () => {
  // An ordinary profile, named by `agent_profile`, is not a rule. Treating an
  // absent `match:` as "matches everything" would make the first profile in the
  // file swallow every requirement the moment somebody adds a rule to another.
  assert.equal(ruleMatches({ name: "plain" }, { boundedContext: "Platform" }), false);
  assert.equal(ruleMatches({ name: "plain", match: {} }, { boundedContext: "Platform" }), false);
});

test("every criterion has to hold, not just one", () => {
  const rule = {
    name: "narrow",
    match: { bounded_context: "Billing", category: "NEEDS_TEST" },
  };
  assert.equal(ruleMatches(rule, { boundedContext: "Billing", category: "NEEDS_TEST" }), true);
  assert.equal(ruleMatches(rule, { boundedContext: "Billing", category: "DONE" }), false);
});

test("an unknown key matches nothing rather than being ignored", () => {
  // Ignoring it would make `match: { bounded_contex: "Platform" }` — one letter
  // short — a rule that matches everything.
  assert.equal(
    ruleMatches(
      { name: "typo", match: { bounded_contex: "Platform" } },
      { boundedContext: "Platform" }
    ),
    false
  );
  assert.deepEqual([...MATCHABLE_KEYS].sort(), [
    "bounded_context",
    "category",
    "feature",
    "module",
    "requirement",
  ]);
});

test("`*` works inside a pattern, and matching is case-insensitive", () => {
  const rule = { name: "billing", match: { feature: "features/billing/*" } };
  assert.equal(ruleMatches(rule, { featureFile: "features/billing/invoice.feature" }), true);
  assert.equal(ruleMatches(rule, { featureFile: "features/auth/login.feature" }), false);
  assert.equal(
    ruleMatches(
      { name: "x", match: { bounded_context: "platform" } },
      { boundedContext: "Platform" }
    ),
    true
  );
});

test("a dot in a pattern is a dot, not any character", () => {
  const rule = { name: "x", match: { feature: "a.feature" } };
  assert.equal(ruleMatches(rule, { featureFile: "a.feature" }), true);
  assert.equal(ruleMatches(rule, { featureFile: "axfeature" }), false);
});
