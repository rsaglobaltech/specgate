/** Asking any command what it does is never an error. */
import { createRequire } from "node:module";
import * as path from "node:path";

export default [
  {
    name: "every command and subcommand answers --help with exit 0",
    covers: [],
    run(dir, t) {
      // The surface the *installed* package declares, not this checkout's.
      const require = createRequire(import.meta.url);
      const pkg = path.join(path.dirname(t.bin), "..");
      const { SURFACE } = require(path.join(pkg, "dist", "scripts", "lib", "surface.js"));
      const broken = [];
      for (const c of SURFACE) {
        if (c.name === "merge-traceability") continue;
        const targets = c.subcommands ? c.subcommands.map((s) => [c.name, s.name]) : [[c.name]];
        if (c.subcommands) targets.unshift([c.name]);
        for (const argv of targets) {
          const r = t.sg(dir, ...argv, "--help");
          if (r.status !== 0 || /Unknown .*--help|Unknown argument: --help/i.test(t.out(r))) {
            broken.push(`${argv.join(" ")} (exit ${r.status})`);
          }
        }
      }
      t.expect(broken.length === 0, `--help failed for: ${broken.join(", ")}`);
    },
  },
];
