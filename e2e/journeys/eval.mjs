/** A skill examined: runs on clean copies, correct by the gate, kept per version (REQ-686, REQ-687). */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export default [
  {
    name: "eval: a skill's exam — one task correct in every run, its version kept",
    covers: ["eval"],
    run(dir, t) {
      t.nodeRepo(dir);
      spawnSync("git", ["-C", dir, "init", "-q"]);
      t.ok(t.sg(dir, "init"), "init");
      const fx = path.join(dir, "evals/orders/tasks/cancel");
      fs.mkdirSync(fx, { recursive: true });
      spawnSync("git", ["-C", fx, "init", "-q"]);
      t.ok(t.sg(fx, "init"), "init the fixture");
      t.write(fx, "test.js", 'process.exit(require("fs").existsSync("done.txt") ? 0 : 1);\n');
      t.ok(t.sg(fx, "config", "set", "test_cmd", "node test.js"), "fixture test_cmd");
      fs.rmSync(path.join(fx, ".git"), { recursive: true, force: true });
      t.write(dir, "skill.md", "Finish the task.\n");
      t.write(dir, "agent.js", 'require("fs").writeFileSync("done.txt", "ok");\n');
      t.write(
        dir,
        "evals/orders/eval.yaml",
        `skill: skill.md\nagent: "node ${path.join(dir, "agent.js")} {prompt_file}"\nruns: 2\ntasks:\n  - id: cancel\n    fixture: tasks/cancel\n    prompt: "Let the customer cancel"\n`
      );
      const r = t.sg(dir, "eval", "orders", "--json");
      t.ok(r, "eval --json");
      const e = t.json(r).eval;
      t.expect(e.correct === 1 && /^[0-9a-f]{12}$/.test(e.version), `correct ${e.correct}, version ${e.version}`, r);
      t.expect(fs.existsSync(path.join(dir, "evals/orders/history.jsonl")), "history kept", r);
    },
  },
];
