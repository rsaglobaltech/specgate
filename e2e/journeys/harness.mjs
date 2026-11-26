import { spawnSync } from "node:child_process";
/** Unattended delivery: the harness drives an agent through the gate. */
import * as path from "node:path";

export default [
  {
    name: "harness run delivers a requirement on a generated matrix",
    covers: ["harness run"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      const req = t.json(t.sg(dir, "new", "Totals are rounded to the cent", "--json")).requirement;
      t.fillScenario(dir, req.featureFile, [
        "an order totalling 10.005 EUR",
        "the total is computed",
        "the total is 10.01 EUR",
      ]);
      t.gitInit(dir);
      // An agent that does what the prompt asks: a test that names the
      // requirement, and the code. It is not allowed to edit the spec.
      const agent = path.join(path.dirname(dir), `agent-${path.basename(dir)}.js`);
      t.write(
        path.dirname(agent),
        path.basename(agent),
        [
          "const fs = require('node:fs');",
          // `harness run` asks each agent first (REQ-691): it answers.
          "if (/Reply with exactly: OK/.test(fs.readFileSync(process.argv[2], 'utf8'))) { console.log('OK'); process.exit(0); }",
          "fs.mkdirSync('test', { recursive: true });",
          `fs.writeFileSync('test/totals.test.js', '// ${req.id} ${req.scenarioId}\\n');`,
          "fs.appendFileSync('src/orders/index.js', '// rounding\\n');",
        ].join("\n")
      );
      const r = t.sg(
        dir,
        "harness",
        "run",
        "--agent",
        `node "${agent}" {prompt_file}`,
        "--max-attempts",
        "1"
      );
      t.ok(r, "harness run");
      t.expect(
        new RegExp(`✔  ${req.id}\\s+pass`).test(t.out(r)),
        "the requirement passes the gate",
        r
      );
      t.expect(
        !/req link/.test(t.out(r)),
        "nothing tells the user to req link on a generated matrix",
        r
      );
      const branchMatrix = t.git(
        dir,
        "show",
        `harness/${req.id}:docs/specs/traceability.md`
      ).stdout;
      t.expect(
        branchMatrix.includes("test/totals.test.js"),
        "the branch's matrix links the agent's test"
      );
    },
  },
  {
    name: "harness stop asks a run to stop, and says when there is none",
    covers: ["harness stop"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      const r = t.sg(dir, "harness", "stop", "--after-current", "--json");
      t.ok(r, "harness stop --after-current");
      const answer = t.json(r);
      t.expect(answer.stop.requested === false, "with no run, nothing is requested", r);
      t.expect(
        answer.status.some((s) => s.code === "harness_not_running"),
        "the answer says no run is working",
        r
      );
      t.usage(t.sg(dir, "harness", "stop", "--json"), "harness stop without --after-current");
    },
  },
  {
    // REQ-591: answering a paused run; with none paused, it says so.
    name: "harness continue answers a paused run, and says when there is none",
    covers: ["harness continue"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      const r = t.sg(dir, "harness", "continue", "--json");
      t.ok(r, "harness continue");
      const answer = t.json(r);
      t.expect(answer.pause === null, "with no run paused, nothing is answered", r);
      t.expect(
        answer.status.some((s) => s.code === "harness_not_paused"),
        "the answer says no run is paused",
        r
      );
    },
  },
  {
    name: "harness doctor: the agent that answers, and the one that is not installed (REQ-690)",
    covers: ["harness doctor"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      const agent = path.join(path.dirname(dir), `ok-${path.basename(dir)}.js`);
      t.write(path.dirname(agent), path.basename(agent), "console.log('OK');\n");
      t.write(dir, "harness.config.yaml", `agent: 'node "${agent}" {prompt_file}'\n`);
      const ok = t.sg(dir, "harness", "doctor", "--json");
      t.ok(ok, "doctor with an agent that answers");
      t.expect(t.json(ok).doctor.agents.every((a) => a.answered === true), "it answers", ok);
      t.write(dir, "harness.config.yaml", "agent: 'nosuchagent -p'\n");
      const missing = t.sg(dir, "harness", "doctor", "--no-probe", "--json");
      t.expect(missing.status === 1, "exits 1 when an agent is missing", missing);
      t.expect(/nosuchagent is not installed/.test(missing.stdout), "names the program", missing);
    },
  },
  {
    name: "harness sandboxes: a sandbox nobody recorded is listed, and --prune removes it (REQ-701)",
    covers: ["harness sandboxes"],
    run(dir, t) {
      // sbx is stood in for by a shell script; Docker Sandboxes on Windows are not proven yet.
      if (process.platform === "win32") t.skip("the sbx stand-in is a POSIX shell script");
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      // sbx stands in: one sandbox sg-stray until it is removed.
      const fake = path.join(path.dirname(dir), `sbx-${path.basename(dir)}`);
      const gone = `${fake}.gone`;
      t.write(
        path.dirname(fake),
        path.basename(fake),
        `#!/bin/sh\nif [ "$1" = ls ]; then if [ -f "${gone}" ]; then echo '[]'; else echo '[{"name":"sg-stray"}]'; fi; fi\nif [ "$1" = rm ]; then touch "${gone}"; fi\n`
      );
      spawnSync("chmod", ["+x", fake]);
      const list = t.sgEnv(dir, { SPECGATE_SBX: fake }, "harness", "sandboxes", "--json");
      t.ok(list, "harness sandboxes --json");
      t.expect(t.json(list).sandboxes.strays[0]?.name === "sg-stray", "the stray is listed", list);
      const pruned = t.sgEnv(dir, { SPECGATE_SBX: fake }, "harness", "sandboxes", "--prune", "--json");
      t.expect(t.json(pruned).sandboxes.removed.includes("sg-stray"), "--prune removes it", pruned);
    },
  },
];
