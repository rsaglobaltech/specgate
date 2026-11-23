/** A bug is fixed only once it has been seen failing (REQ-681, REQ-682). */
import { spawnSync } from "node:child_process";

const git = (dir, ...args) =>
  spawnSync(
    "git",
    ["-C", dir, "-c", "user.email=e2e@example.com", "-c", "user.name=E2E", ...args],
    { encoding: "utf8" }
  );

export default [
  {
    name: "reproduce: a bug opened, its scenario run red and kept, a green one refused",
    covers: ["reproduce"],
    run(dir, t) {
      t.nodeRepo(dir);
      git(dir, "init", "-q");
      t.ok(t.sg(dir, "init"), "init");
      t.write(dir, "scenarios.js", "process.exit(Number(require('fs').readFileSync('exit.txt','utf8')));\n");
      t.write(dir, "exit.txt", "1");
      t.ok(t.sg(dir, "config", "set", "bdd_cmd", "node scenarios.js {tags}"), "config set bdd_cmd");
      const opened = t.sg(dir, "reproduce", "fix-precio", "--capability", "catalogo", "--title", "Price without discount", "--json");
      t.ok(opened, "reproduce");
      const req = t.json(opened).reproduce.requirement;
      t.ok(t.sg(dir, "reproduce", "run", req), "reproduce run: red");
      t.expect(/"exitCode": 1/.test(t.read(dir, `.specgate/evidence/${req}/red.json`)), "red kept", opened);
      t.write(dir, "exit.txt", "0");
      const green = t.sg(dir, "reproduce", "run", req, "--json");
      t.expect(green.status !== 0 && /repro_not_red/.test(t.out(green)), "green refused", green);
    },
  },
];
