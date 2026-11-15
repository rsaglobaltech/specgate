/** A product in several repositories — a workspace over two real git repos. */
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const git = (dir, ...args) =>
  spawnSync(
    "git",
    ["-C", dir, "-c", "user.email=e2e@example.com", "-c", "user.name=E2E", ...args],
    { encoding: "utf8" }
  );

export default [
  {
    name: "workspace: init over two repositories, status, check, and a story split across them",
    covers: ["workspace"],
    run(dir, t) {
      const members = ["fleet", "web"];
      for (const name of members) {
        const repo = path.join(dir, name);
        t.nodeRepo(repo);
        git(repo, "init", "-q");
        t.ok(t.sg(repo, "init"), `init ${name}`);
        git(repo, "add", "-A");
        git(repo, "commit", "-qm", "start");
      }
      const ws = path.join(dir, "product");
      t.write(ws, "README.md", "# The product\n");
      git(ws, "init", "-q");

      t.ok(
        t.sg(
          ws,
          "workspace",
          "init",
          "--repo",
          "fleet=../fleet:service",
          "--repo",
          "web=../web:web"
        ),
        "workspace init"
      );
      t.expect(t.exists(ws, "specgate.workspace.yaml"), "the workspace file is written");

      const status = t.json(t.sg(ws, "workspace", "status", "--json")).workspace;
      t.expect(
        status && status.repos.map((r) => r.name).join(",") === "fleet,web",
        "status lists both repositories"
      );
      t.expect(
        status.repos.every((r) => r.exists),
        "both repositories are found"
      );

      // The client's brief, and the stories it holds (REQ-339).
      t.write(ws, "brief.md", "# The product\n\nThe client follows a shipment.\n");
      t.ok(t.sg(ws, "workspace", "draft"), "workspace draft");
      t.expect(
        /stories:/.test(t.read(ws, "docs/brief.md")),
        "the brief is below a front matter naming its stories"
      );
      t.ok(t.sg(ws, "status"), "status in the workspace repository");

      t.ok(
        t.sg(
          ws,
          "workspace",
          "propose",
          "follow-shipment",
          "--repos",
          "fleet,web",
          "--title",
          "The client follows a shipment"
        ),
        "workspace propose"
      );
      for (const name of members) {
        t.expect(
          t.exists(path.join(dir, name), "docs/specs/changes/follow-shipment"),
          `a sub-change opened in ${name}`
        );
      }
      const story = t
        .json(t.sg(ws, "workspace", "status", "--json"))
        .workspace.stories.find((s) => s.id === "follow-shipment");
      t.expect(story && !story.done, "the story is open until every sub-change is archived");

      const check = t.sg(ws, "workspace", "check");
      t.expect(
        check.status === 0 || check.status === 1,
        "workspace check runs each member's gate and answers",
        check
      );
    },
  },
];
