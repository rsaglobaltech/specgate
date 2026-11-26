/** The compatibility exam: a tool at a level, judged by the gate and a hidden check (harness-compat REQ-711…REQ-716). */
import * as fs from "node:fs";
import * as path from "node:path";

export default [
  {
    name: "compat: a tool that implements REQ-002 passes, and the matrix says so",
    covers: ["compat"],
    run(dir, t) {
      // The exam runs the real agents on the Developer's macOS or Linux machine; on Windows it is not proven yet.
      if (process.platform === "win32") t.skip("the compatibility exam is not proven on Windows yet");
      fs.mkdirSync(dir, { recursive: true });
      const agent = path.join(path.dirname(dir), `codex-${path.basename(dir)}.js`);
      t.write(
        path.dirname(agent),
        path.basename(agent),
        [
          'const fs = require("node:fs");',
          'fs.mkdirSync("src", { recursive: true });',
          'fs.writeFileSync("src/fees.js", "exports.lateFee = (d) => Math.min(10, Math.max(0, d) * 0.5);\\n");',
          'fs.writeFileSync("test/fees.test.js", "// REQ-002\\nrequire(\\"node:test\\")(\\"REQ-002\\", () => {});\\n");',
          "",
        ].join("\n")
      );
      const r = t.sg(
        dir,
        "compat",
        "run",
        "--tool",
        "codex",
        "--level",
        "L0",
        "--runs",
        "1",
        "--agent-codex",
        `node "${agent}" {prompt_file}`,
        "--project-dir",
        dir,
        "--json"
      );
      t.ok(r, "compat run --json");
      const runs = t.json(r).compat.runs;
      t.expect(runs.length === 1, `one line, ${runs.length}`, r);
      t.expect(runs[0].check && runs[0].hidden && runs[0].testNamesReq, "L0 passed both checks", r);
      const m = t.sg(dir, "compat", "report", "--project-dir", dir, "--json");
      t.ok(m, "compat report --json");
      t.expect(t.json(m).compat.rows[0].cells.L0.colour === "green", "L0 green", m);
      t.expect(fs.existsSync(path.join(dir, ".specgate/compat/matrix.md")), "matrix.md written", m);
    },
  },
];
