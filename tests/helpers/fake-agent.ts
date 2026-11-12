/**
 * agent-ask: a project in git and a fake agent for `specgate agent ask`
 * (REQ-520 … REQ-527). The agent is a Node script — never a paid one — that
 * reads the prompt on standard input, keeps a copy beside itself, edits the
 * scratch copy it runs in according to its mode, and prints its usage the way
 * `claude -p --output-format json` does.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { git, newProject, specRequirement, feature, write } from "./project";

export const AGENT = `const fs = require("fs");
const path = require("path");
const mode = process.argv[2] || "spec";
const here = __dirname;
let prompt = "";
process.stdin.on("data", (d) => (prompt += d));
process.stdin.on("end", () => {
  fs.writeFileSync(path.join(here, "prompt-" + mode + ".txt"), prompt);
  fs.appendFileSync(path.join(here, "runs.txt"), mode + "\\n");
  const answer = (o) => fs.writeFileSync(".specgate-ask.json", JSON.stringify(o));
  const usage = () =>
    console.log(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "done",
      usage: { input_tokens: 1200, output_tokens: 340 }, total_cost_usd: 0.0123 }));
  if (mode === "fail") {
    process.stderr.write("calling the model...\\nrate limited\\n");
    process.exit(1);
  }
  if (mode === "slow") {
    setTimeout(() => process.exit(0), 20000);
    return;
  }
  if (mode === "noop") {
    usage();
    return;
  }
  fs.appendFileSync("spec.md", "\\n- Orders can be cancelled up to 24 h before shipping.\\n");
  if (mode === "code") {
    fs.mkdirSync(path.join("features", "orders"), { recursive: true });
    fs.writeFileSync(path.join("features", "orders", "cancel.feature"), "Feature: Cancel\\n");
    fs.appendFileSync(path.join("src", "app.js"), "// cancel\\n");
  }
  answer({
    why: { "spec.md": "States the cancellation window." },
    then: mode === "rm" ? ["specgate validate", "rm -rf src"] : ["specgate validate"],
    read: ["spec.md"],
  });
  usage();
});
`;

export interface AgentProject {
  dir: string;
  /** Where the agent keeps the prompts it received: outside the project. */
  agentDir: string;
  /** The command that runs the fake agent in one of its modes. */
  agent(mode: string): string;
  /** What the agent received in that mode. */
  prompt(mode: string): string;
  /** How many times the agent ran. */
  runs(): number;
}

/** A project in git, one commit, with REQ-001 and its feature, and `src/app.js`. */
export function agentProject(configured: string | null = "spec"): AgentProject {
  const dir = newProject("sg-agent-ask-");
  const agentDir = path.join(path.dirname(dir), "fake-agent");
  fs.mkdirSync(agentDir, { recursive: true });
  fs.writeFileSync(path.join(agentDir, "agent.js"), AGENT, "utf8");
  const script = path.join(agentDir, "agent.js").split(path.sep).join("/");
  const agent = (mode: string) => `node "${script}" ${mode}`;
  specRequirement(dir, "REQ-001", "Orders can be cancelled");
  feature(dir, "features/orders/REQ-001.feature", "REQ-001", ["SCN-001a"]);
  write(dir, "docs/notes.md", "# Notes\n\nShipping leaves at 18:00.\n");
  write(dir, "src/app.js", "module.exports = {};\n");
  if (configured) {
    write(dir, "harness.config.yaml", `harness_version: 1\nagent: '${agent(configured)}'\n`);
  }
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  return {
    dir,
    agentDir,
    agent,
    prompt: (mode) => fs.readFileSync(path.join(agentDir, `prompt-${mode}.txt`), "utf8"),
    runs: () => {
      const f = path.join(agentDir, "runs.txt");
      return fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean).length : 0;
    },
  };
}

/** The file's text in the project. */
export function read(dir: string, rel: string): string {
  return fs.readFileSync(path.join(dir, ...rel.split("/")), "utf8");
}
