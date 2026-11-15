/** An agent's change to the specification as a plan, applied on confirmation (REQ-520 … REQ-526). */

import * as fs from "node:fs";
import * as path from "node:path";

/** A fake agent: appends a line to spec.md in the copy it runs in, says why, prints its usage. */
const AGENT = `const fs = require("fs");
process.stdin.resume();
process.stdin.on("end", () => {
  fs.appendFileSync("spec.md", "\\n- Orders can be cancelled up to 24 h before shipping.\\n");
  fs.writeFileSync(".specgate-ask.json", JSON.stringify({ why: { "spec.md": "The cancellation window." }, then: ["specgate validate"] }));
  console.log(JSON.stringify({ type: "result", usage: { input_tokens: 10, output_tokens: 5 }, total_cost_usd: 0.001 }));
});
`;

const git = (t, dir, ...args) =>
  t.git(dir, "-c", "user.email=e2e@example.com", "-c", "user.name=E2E", ...args);

export default [
  {
    name: "ask the agent, read the plan, apply one and discard another; nothing is committed",
    covers: ["agent ask", "agent apply", "agent discard", "agent plans"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      const script = path.join(path.dirname(dir), `${path.basename(dir)}-agent.js`);
      fs.writeFileSync(script, AGENT);
      const agent = `node "${script.split(path.sep).join("/")}"`;
      git(t, dir, "init", "--quiet");
      git(t, dir, "add", "-A");
      git(t, dir, "commit", "-qm", "init");
      const before = t.read(dir, "spec.md");

      const asked = t.sg(
        dir,
        "agent",
        "ask",
        "cancel up to 24 h before shipping",
        "--agent",
        agent,
        "--plan",
        "--json"
      );
      t.ok(asked, "agent ask");
      const plan = t.json(asked).plan;
      t.expect(
        plan.files.length === 1 && plan.files[0].path === "spec.md",
        "the plan changes spec.md",
        asked
      );
      t.expect(
        plan.usage.input === 10 && plan.usage.cost === 0.001,
        "the plan says what it cost",
        asked
      );
      t.expect(t.read(dir, "spec.md") === before, "nothing is written by ask", asked);

      const second = t.json(
        t.sg(dir, "agent", "ask", "the same again", "--agent", agent, "--json")
      ).plan;
      const listed = t.sg(dir, "agent", "plans", "--json");
      t.ok(listed, "agent plans");
      t.expect(t.json(listed).plans.length === 2, "both plans are open", listed);

      const applied = t.sg(dir, "agent", "apply", plan.id, "--json");
      t.ok(applied, "agent apply");
      t.expect(
        t.read(dir, "spec.md").includes("24 h before shipping"),
        "apply wrote the plan",
        applied
      );
      t.expect(
        git(t, dir, "log", "--oneline").stdout.trim().split("\n").length === 1,
        "apply committed nothing",
        applied
      );

      const stale = t.sg(dir, "agent", "apply", second.id, "--json");
      t.fails(stale, "agent apply on a changed file");
      t.expect(t.json(stale).status[0].code === "plan_stale", "the second plan is stale", stale);
      t.ok(t.sg(dir, "agent", "discard", second.id, "--json"), "agent discard");
      t.expect(t.json(t.sg(dir, "agent", "plans", "--json")).plans.length === 0, "no plan is left");
    },
  },
];
