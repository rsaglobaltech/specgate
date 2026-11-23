/** Where each requirement lives (REQ-678): the route an end-to-end test opens, the address from app_url. */
import { spawnSync } from "node:child_process";

const git = (dir, ...args) =>
  spawnSync(
    "git",
    ["-C", dir, "-c", "user.email=e2e@example.com", "-c", "user.name=E2E", ...args],
    { encoding: "utf8" }
  );

export default [
  {
    name: "map: a requirement's route from its e2e test, its address from app_url",
    covers: ["map"],
    run(dir, t) {
      t.nodeRepo(dir);
      git(dir, "init", "-q");
      t.ok(t.sg(dir, "init"), "init");
      t.write(
        dir,
        "spec.md",
        t.read(dir, "spec.md") +
          "\n## REQ-031 — Cancel an order\n\n<!-- specgate:trace uc='UC-002 Cancel an order' -->\n\nThe system SHALL let the customer cancel an order not shipped yet.\n"
      );
      t.write(dir, "e2e/cancel.spec.ts", '// REQ-031\nawait page.goto("/orders/A-1");\n');
      t.ok(t.sg(dir, "config", "set", "app_url", "http://localhost:5173"), "config set app_url");
      const r = t.sg(dir, "map", "REQ-031", "--json");
      t.ok(r, "map --json");
      const [entry] = t.json(r).map.requirements;
      t.expect(
        entry && entry.url === "http://localhost:5173/orders/A-1" && entry.routeFrom === "e2e",
        `REQ-031 reached at ${entry && entry.url}`,
        r
      );
    },
  },
];
