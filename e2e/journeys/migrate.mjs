/** A 0.27 project moved to the 1.0 layout — an open change becomes three layers. */
import { spawnSync } from "node:child_process";

const git = (dir, ...args) =>
  spawnSync(
    "git",
    ["-C", dir, "-c", "user.email=e2e@example.com", "-c", "user.name=E2E", ...args],
    { encoding: "utf8" }
  );

export default [
  {
    name: "migrate 1.0: a dry run first, then a 0.27 change gets its discover and design",
    covers: ["migrate"],
    run(dir, t) {
      t.nodeRepo(dir);
      git(dir, "init", "-q");
      t.ok(t.sg(dir, "init"), "init");
      t.ok(
        t.sg(dir, "change", "new", "invoices-pdf", "--schema", "spec-driven"),
        "a change as 0.27 opened it"
      );
      const change = "docs/specs/changes/invoices-pdf";
      t.expect(t.exists(dir, `${change}/proposal.md`), "the 0.27 change has a proposal");
      git(dir, "add", "-A");
      git(dir, "commit", "-qm", "a 0.27 project");

      t.ok(t.sg(dir, "migrate", "1.0", "--dry-run"), "migrate 1.0 --dry-run");
      t.expect(!t.exists(dir, `${change}/discover.md`), "a dry run writes nothing");

      t.ok(t.sg(dir, "migrate", "1.0"), "migrate 1.0");
      t.expect(t.exists(dir, `${change}/discover.md`), "the proposal is the Discover");
      t.expect(t.exists(dir, `${change}/design.md`), "a design is drafted");
      t.expect(
        /schema:\s*layered/.test(t.read(dir, `${change}/change.yaml`)),
        "the change is layered"
      );
    },
  },
];
