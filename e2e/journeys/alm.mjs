/** Requirements kept in step with a board — against a Jira stand-in. */
import * as fs from "node:fs";
import * as path from "node:path";
import { startFake } from "../lib.mjs";

export default [
  {
    name: "alm keeps Jira in step: sync creates and closes, link, status, drift, and pull opens a change",
    covers: ["alm sync", "alm link", "alm status", "alm pull"],
    async run(dir, t) {
      const jira = await startFake("jira");
      process.env.FAKE_JIRA_USER = "e2e@example.com";
      process.env.FAKE_JIRA_TOKEN = "not-a-real-token";
      try {
        t.nodeRepo(dir);
        t.ok(t.sg(dir, "init"), "init");
        const a = t.deliverable(dir, "Totals are rounded to the cent");
        const b = t.json(t.sg(dir, "new", "Gift wrapping is offered", "--json")).requirement;
        t.write(
          dir,
          "alm.config.yaml",
          [
            "provider: jira",
            `base_url: ${jira.url}`,
            "project_key: SHOP",
            "user_env: FAKE_JIRA_USER",
            "token_env: FAKE_JIRA_TOKEN",
            "",
          ].join("\n")
        );

        t.ok(t.sg(dir, "alm", "sync", "--dry-run"), "alm sync --dry-run");
        t.expect((await jira.json("/__issues")).length === 0, "a dry run creates nothing");

        const sync = t.sg(dir, "alm", "sync");
        t.ok(sync, "alm sync");
        let issues = await jira.json("/__issues");
        const keyOf = (id) => (issues.find((i) => i.labels.includes(id)) || {}).key;
        t.expect(
          keyOf(a.id) && keyOf(b.id),
          `an issue per requirement (${issues.map((i) => i.summary).join("; ")})`,
          sync
        );

        const status = t.sg(dir, "alm", "status");
        t.ok(status, "alm status");
        t.expect(
          status.stdout.includes(keyOf(a.id)),
          "status maps requirement to issue, offline",
          status
        );

        // Delivered requirement → its issue is closed on the next sync.
        t.ok(t.sg(dir, "done", a.id, "--strict"), "done");
        t.ok(t.sg(dir, "alm", "sync"), "alm sync after delivery");
        issues = await jira.json("/__issues");
        t.expect(
          issues.find((i) => i.key === keyOf(a.id)).done,
          "the delivered requirement's issue is closed"
        );

        // Someone closes the other one in Jira while the requirement is open.
        await jira.json(`/__close/${keyOf(b.id)}`, { method: "POST" });
        const drift = t.sg(dir, "alm", "sync");
        t.expect(
          /drift|done/i.test(t.out(drift)) && t.out(drift).includes(b.id),
          "drift is reported",
          drift
        );

        // A manual mapping.
        const seeded = await jira.json("/__seed", {
          method: "POST",
          body: JSON.stringify({ summary: "Existing ticket", labels: [] }),
        });
        const c = t.json(t.sg(dir, "new", "Invoices are numbered", "--json")).requirement;
        t.ok(t.sg(dir, "alm", "link", c.id, seeded.key), "alm link");
        t.expect(
          t.sg(dir, "alm", "status").stdout.includes(seeded.key),
          "the manual link is listed"
        );

        // A labelled ticket becomes a change, its scenario left to a person.
        await jira.json("/__seed", {
          method: "POST",
          body: JSON.stringify({
            summary: "Customers can download invoices as PDF",
            description: "Accounting needs PDFs.",
            labels: ["spec-request"],
          }),
        });
        const pull = t.sg(dir, "alm", "pull", "--label", "spec-request");
        t.ok(pull, "alm pull");
        const changes = fs
          .readdirSync(path.join(dir, "docs", "specs", "changes"))
          .filter((d) => d !== "archive");
        t.expect(changes.length === 1, `a change is opened (${changes.join(", ")})`, pull);
        const proposal = t.read(dir, `docs/specs/changes/${changes[0]}/proposal.md`);
        t.expect(
          /download invoices as PDF/i.test(proposal),
          "its proposal carries the ticket",
          pull
        );
      } finally {
        jira.stop();
      }
    },
  },
];
