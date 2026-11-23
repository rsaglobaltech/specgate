/** What keeps coming back becomes a rule a person approves (REQ-684, REQ-685). */
import { spawnSync } from "node:child_process";

const git = (dir, ...args) =>
  spawnSync(
    "git",
    ["-C", dir, "-c", "user.email=e2e@example.com", "-c", "user.name=E2E", ...args],
    { encoding: "utf8" }
  );

const review = (text) =>
  `# Review\n\n| Date | Requirement | Request | Status |\n|---|---|---|---|\n| 2026-11-20 | — | ${text} | open |\n`;
const yaml = "specgate_change_version: 1\nschema: layered\ncreated: 2026-11-20\nrigor: lite\n";

export default [
  {
    name: "learn: two alike review notes become a lesson, then a principle once approved",
    covers: ["learn"],
    run(dir, t) {
      t.nodeRepo(dir);
      git(dir, "init", "-q");
      t.ok(t.sg(dir, "init"), "init");
      t.write(dir, "docs/specs/changes/draft-a/change.yaml", yaml);
      t.write(dir, "docs/specs/changes/draft-a/review.md", review("Prices always with their currency"));
      t.write(dir, "docs/specs/changes/draft-b/change.yaml", yaml);
      t.write(dir, "docs/specs/changes/draft-b/review.md", review("Every price with its currency"));
      const r = t.sg(dir, "learn", "--json");
      t.ok(r, "learn --json");
      t.expect(t.json(r).learn.lessons[0]?.kind === "review", "L1 is the repeated note", r);
      t.ok(t.sg(dir, "learn", "promote", "L1", "--title", "Prices carry their currency"), "learn promote");
      t.ok(t.sg(dir, "change", "approve", "learn-prices-carry-their-currency"), "change approve");
      t.expect(/## P1 — Prices carry their currency/.test(t.read(dir, "docs/specs/principles.md")), "principle written", r);
    },
  },
];
