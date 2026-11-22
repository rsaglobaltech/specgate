/** A DDD workshop's boards become the brief; its model read and exported (REQ-655 … REQ-659). */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const BOARDS = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "tests",
  "fixtures",
  "ddd"
);
const git = (dir, ...args) =>
  spawnSync(
    "git",
    ["-C", dir, "-c", "user.email=e2e@example.com", "-c", "user.name=E2E", ...args],
    { encoding: "utf8" }
  );

export default [
  {
    name: "brief import, model and export: the claims workshop's boards into the brief and back out",
    covers: ["brief import", "brief model", "brief export"],
    run(dir, t) {
      t.nodeRepo(dir);
      git(dir, "init", "-q");
      t.ok(t.sg(dir, "init"), "init");
      const boards = [
        "canvas-siniestros.json",
        "canvas-polizas.json",
        "siniestros-event-storming.json",
      ];
      for (const b of boards)
        t.write(dir, `workshop/${b}`, fs.readFileSync(path.join(BOARDS, b), "utf8"));
      const imported = t.sg(
        dir,
        "brief",
        "import",
        ...boards.map((b) => `workshop/${b}`),
        "--json"
      );
      t.ok(imported, "brief import");
      t.expect(t.exists(dir, "docs/brief.md"), "the brief is written", imported);
      const model = t.sg(dir, "brief", "model", "--json");
      t.ok(model, "brief model");
      const doc = t.json(model);
      t.expect(
        doc.model.source === "workshop" && doc.model.modules.some((m) => m.slug === "siniestros"),
        "the model comes from the workshop, Siniestros among its contexts",
        model
      );
      const exported = t.sg(dir, "brief", "export", "--json");
      t.ok(exported, "brief export");
      t.expect(
        t.json(exported).export.written.length > 0,
        "boards written for DDD Toolbox",
        exported
      );
    },
  },
];
