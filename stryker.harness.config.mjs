/** @type {import('@stryker-mutator/core').PartialStrykerOptions} */

/*
 * Mutation testing over the harness's decisions: the rules that say whether a
 * requirement gets another attempt, whether a run may start one more, and what
 * a ceiling on cost means. These are pure functions of the domain, and a wrong
 * one spends money or stops a run that should go on — so their tests have to
 * fail when the rule changes.
 *
 * Over the compiled output, as stryker.config.mjs is and for the same reason.
 *
 * Run with: npm run mutation:harness  (builds first)
 */
export default {
  mutate: [
    "dist/packages/core/src/domain/AttemptBudget.js",
    "dist/packages/core/src/domain/RunBudget.js",
    "dist/packages/core/src/domain/RetryPolicy.js",
  ],

  testRunner: "command",
  commandRunner: {
    command:
      "node --test dist/packages/core/test/unit/attempt-budget.test.js dist/packages/core/test/unit/run-budget.test.js dist/packages/core/test/unit/retry-policy.test.js dist/packages/core/test/unit/harness-decisions.test.js dist/tests/unit/measured-cost.test.js",
  },

  mutator: {
    plugins: [],
    // Messages are asserted where they matter (the budget's); elsewhere a
    // changed word is not a changed rule.
    excludedMutations: ["StringLiteral"],
  },

  coverageAnalysis: "off",

  // A number to watch, not a gate to pass — as the pilot.
  thresholds: { high: 80, low: 60, break: 0 },

  reporters: ["html", "clear-text", "progress"],
  htmlReporter: { fileName: "reports/mutation/harness.html" },

  cleanTempDir: "always",
  timeoutMS: 30000,
  timeoutFactor: 1.5,
  concurrency: 4,
};
