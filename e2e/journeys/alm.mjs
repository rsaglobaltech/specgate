/** Requirements kept in step with a board — against a Jira stand-in. */
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { startFake } from "../lib.mjs";

const git = (dir, ...args) =>
  spawnSync(
    "git",
    ["-C", dir, "-c", "user.email=e2e@example.com", "-c", "user.name=E2E", ...args],
    {
      encoding: "utf8",
    }
  );

/** A Jira story as an export holds it: description with its acceptance criteria. */
const STORY = {
  key: "SHOP-42",
  fields: {
    summary: "Invoices as PDF",
    issuetype: { name: "Story" },
    labels: [],
    description: [
      "As an accountant, I want each invoice as a PDF so that I can archive it.",
      "",
      "Acceptance Criteria",
      "- Given invoice INV-7, when I download it, then I get a PDF named INV-7.pdf.",
    ].join("\n"),
  },
};

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
  {
    name: "alm pr opens one pull request per ticket, and updates it instead of opening a second",
    covers: ["alm pr"],
    async run(dir, t) {
      const github = await startFake("github");
      process.env.FAKE_GITHUB_TOKEN = "not-a-real-token";
      const origin = fs.mkdtempSync(path.join(path.dirname(dir), "origin-"));
      try {
        t.nodeRepo(dir);
        t.ok(t.sg(dir, "init"), "init");
        t.write(
          dir,
          "alm.config.yaml",
          [
            "provider: jira",
            "base_url: https://shop.atlassian.net",
            "project_key: SHOP",
            "token_env: FAKE_JIRA_TOKEN",
            "pr:",
            "  provider: github",
            "  repo: acme/shop",
            "  base: develop",
            "  token_env: FAKE_GITHUB_TOKEN",
            `  base_url: ${github.url}`,
            "",
          ].join("\n")
        );
        t.write(dir, "SHOP-42.json", JSON.stringify(STORY));
        git(dir, "init", "-q", "-b", "develop");
        git(dir, "add", "-A");
        git(dir, "commit", "-qm", "init");
        git(origin, "init", "-q", "--bare");
        git(dir, "remote", "add", "origin", origin);

        const opened = t.sg(
          dir,
          "propose",
          "--from-ticket",
          "SHOP-42.json",
          "--capability",
          "invoicing"
        );
        t.ok(opened, "propose --from-ticket");
        const branch = git(dir, "rev-parse", "--abbrev-ref", "HEAD").stdout.trim();
        t.expect(
          branch === "feature/SHOP-42-invoices-as-pdf",
          `the ticket's branch (${branch})`,
          opened
        );
        git(dir, "add", "-A");
        git(dir, "commit", "-qm", "SHOP-42 docs(spec): open the change");

        const change = "shop-42-invoices-as-pdf";
        const first = t.sg(dir, "alm", "pr", change, "--no-check");
        t.ok(first, "alm pr");
        let pulls = await github.json("/__pulls");
        t.expect(pulls.length === 1, "one pull request", first);
        t.expect(
          pulls[0].title === "SHOP-42 Invoices as PDF",
          `titled with the key (${pulls[0].title})`,
          first
        );
        t.expect(
          pulls[0].base === "develop" && pulls[0].head === branch,
          "from the ticket's branch into develop",
          first
        );
        t.expect(
          git(origin, "rev-parse", "--verify", branch).status === 0,
          "the branch was pushed",
          first
        );

        const again = t.sg(dir, "alm", "pr", change, "--no-check");
        t.ok(again, "alm pr, run again");
        pulls = await github.json("/__pulls");
        t.expect(
          pulls.length === 1,
          "the same pull request is updated, not a second opened",
          again
        );
      } finally {
        github.stop();
        fs.rmSync(origin, { recursive: true, force: true });
      }
    },
  },
  {
    name: "alm phase reads a change's phase offline, and alm move moves its ticket",
    covers: ["alm phase", "alm move"],
    async run(dir, t) {
      const jira = await startFake("jira");
      process.env.FAKE_JIRA_USER = "e2e@example.com";
      process.env.FAKE_JIRA_TOKEN = "not-a-real-token";
      try {
        t.nodeRepo(dir);
        t.ok(t.sg(dir, "init"), "init");
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
        const seeded = await jira.json("/__seed", {
          method: "POST",
          body: JSON.stringify({ summary: "Invoices as PDF", labels: [] }),
        });
        t.ok(t.sg(dir, "change", "new", "invoices-pdf"), "change new");
        const yaml = "docs/specs/changes/invoices-pdf/change.yaml";
        t.write(dir, yaml, t.read(dir, yaml).trimEnd() + `\nticket: ${seeded.key}\n`);

        const phase = t.sg(dir, "alm", "phase", "invoices-pdf", "--json");
        t.ok(phase, "alm phase");
        t.expect(
          phase.stdout.includes("proposed") && phase.stdout.includes(seeded.key),
          "an open change is proposed, with its ticket",
          phase
        );

        t.ok(t.sg(dir, "alm", "move", "invoices-pdf", "archived"), "alm move");
        const issue = (await jira.json("/__issues")).find((i) => i.key === seeded.key);
        t.expect(issue && issue.done, "the ticket is moved to done", phase);
      } finally {
        jira.stop();
      }
    },
  },
];
