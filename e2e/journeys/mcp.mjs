/** The MCP integration: the config a client is given, and the server it starts. */
import * as fs from "node:fs";
import * as path from "node:path";

/** JSON-RPC responses out of the server's Content-Length-framed stdout. */
function responses(stdout) {
  const out = [];
  const re = /Content-Length: (\d+)\r\n\r\n/g;
  let m;
  while ((m = re.exec(stdout)) !== null) {
    const start = m.index + m[0].length;
    const body = Buffer.from(stdout.slice(start), "utf8")
      .subarray(0, Number(m[1]))
      .toString("utf8");
    out.push(JSON.parse(body));
  }
  return out;
}

export default [
  {
    name: "mcp install writes a config whose server actually starts and answers",
    covers: ["mcp install", "mcp serve"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      const home = path.join(path.dirname(dir), `home-${path.basename(dir)}`);
      fs.mkdirSync(home, { recursive: true });
      const env = { HOME: home, USERPROFILE: home, APPDATA: path.join(home, "AppData") };

      const install = t.sgEnv(dir, env, "mcp", "install", "--client", "claude", "--json");
      t.ok(install, "mcp install --client claude");
      const cfgPath = t.json(install).configPath;
      t.expect(cfgPath.startsWith(home), "it writes under the given HOME, nowhere else", install);
      const server = JSON.parse(fs.readFileSync(cfgPath, "utf8")).mcpServers["spec-driven"];
      // It pointed at @specgate/mcp-server, which was never published: every
      // client configured this way started nothing.
      t.expect(
        server.args.includes("@rsaglobaltech/specgate@latest") &&
          server.args.slice(-2).join(" ") === "mcp serve",
        `the config starts a package that exists (${server.args.join(" ")})`
      );

      // Over MCP an agent may not rewrite the specification it is measured
      // against unless a change is open or the team allows it (C10-04).
      const guarded = t.sgEnv(
        dir,
        {
          __stdin: `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "specgate_new", arguments: { projectDir: dir, title: "Not yet" } } })}\n`,
        },
        "mcp",
        "serve"
      );
      t.expect(
        /mcpAllowContractEdits/.test(responses(guarded.stdout)[0].result.content[0].text),
        "new over MCP is refused until the team allows contract edits",
        guarded
      );
      t.write(dir, ".csda/config.json", JSON.stringify({ mcpAllowContractEdits: true }));

      // Start what the config starts — from the installed package — and talk to it.
      const input = [
        { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
        { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "specgate_status", arguments: { projectDir: dir } },
        },
        {
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "csda_status", arguments: { projectDir: dir } },
        },
        // The daily loop, from an MCP-only client: `new` and `check` were not
        // tools at all, and `done` never said it needs a requirement.
        {
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: {
            name: "specgate_new",
            arguments: { projectDir: dir, title: "Invoices download as PDF" },
          },
        },
        {
          jsonrpc: "2.0",
          id: 6,
          method: "tools/call",
          params: { name: "specgate_check", arguments: { projectDir: dir } },
        },
        {
          jsonrpc: "2.0",
          id: 7,
          method: "tools/call",
          params: {
            name: "mark_requirement_done",
            arguments: { projectDir: dir, requirement: "REQ-002" },
          },
        },
      ]
        .map((m) => JSON.stringify(m))
        .join("\n");
      const r = t.sgEnv(dir, { __stdin: `${input}\n` }, "mcp", "serve");
      const byId = Object.fromEntries(responses(r.stdout).map((m) => [m.id, m]));
      t.expect(byId[1] && byId[1].result.protocolVersion, "initialize answers", r);
      t.expect(
        byId[1].result.serverInfo.version === t.version,
        `the server announces the CLI's version (${byId[1].result.serverInfo.version})`,
        r
      );
      const names = byId[2].result.tools.map((x) => x.name);
      t.expect(
        names.includes("specgate_status") && !names.some((n) => n.startsWith("csda_")),
        "tools are specgate_*",
        r
      );
      const status = JSON.parse(byId[3].result.content[0].text);
      t.expect(status.schemaVersion === 1, "a tool call runs the CLI and returns its JSON", r);
      t.expect(byId[4] && !byId[4].error, "an old csda_* name still resolves", r);

      const tool = (n) => byId[2].result.tools.find((x) => x.name === n);
      t.expect(
        tool("specgate_new").inputSchema.required.includes("title") &&
          tool("mark_requirement_done").inputSchema.required.includes("requirement"),
        "the schema names the argument each tool needs",
        r
      );
      const created = JSON.parse(byId[5].result.content[0].text);
      t.expect(created.requirement && created.requirement.id === "REQ-002", "new over MCP", r);
      const gate = JSON.parse(byId[6].result.content[0].text);
      t.expect(gate.check && gate.check.validate === "passed", "check over MCP", r);
      // A scenario of placeholders: done refuses, as it does from the terminal.
      const done = JSON.parse(byId[7].result.content[0].text);
      t.expect(
        JSON.stringify(done).includes("done_validate_failed"),
        "done over MCP runs the gate and refuses",
        r
      );
    },
  },
];
