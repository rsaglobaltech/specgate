import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { BaseCommand } from "../../../lib/command";
import { spawnSync } from "node:child_process";
import { agentIo, AgentIo } from "../../../lib/agent";

export class McpInstallCommand extends BaseCommand {
  public execute(): void {
    if (this.args.includes("--help") || this.args.includes("-h")) {
      process.stdout.write(
        "\n  specgate mcp install --client <claude|cursor|opencode|codex> [--json]\n\n" +
          "  Writes the MCP server configuration for one AI client, so the agent can\n" +
          "  read the spec tree and run the gate as tools. opencode: the project's\n" +
          "  opencode.json; codex: `codex mcp add`, your own Codex configuration.\n\n"
      );
      process.exit(0);
    }
    const isJson = this.args.includes("--json");
    const io: AgentIo = agentIo(isJson);
    const clientIdx = this.args.indexOf("--client");

    if (clientIdx === -1 || !this.args[clientIdx + 1]) {
      io.fail({ installed: false }, [
        {
          code: "missing_client",
          message: "Missing required flag: --client <claude|cursor|opencode|codex>",
          severity: "error",
          fix: "Pass --client <client>",
        },
      ]);
      process.exitCode = 2;
      return;
    }
    const client = this.args[clientIdx + 1];

    let configPath = "";
    // The client's own file: keep every key it has, add ours under mcpServers.
    let configObj: { mcpServers?: Record<string, unknown>; [key: string]: unknown } = {};
    const mcpConfig = {
      command: "npx",
      args: ["-y", "@rsaglobaltech/specgate@latest", "mcp", "serve"],
    };

    // harness-compat REQ-713: OpenCode reads the project's opencode.json.
    if (client === "opencode") {
      const file = path.join(process.cwd(), "opencode.json");
      let doc: { mcp?: Record<string, unknown>; [key: string]: unknown } = {};
      if (fs.existsSync(file)) {
        try {
          doc = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch {
          io.fail({ installed: false }, [
            {
              code: "invalid_config",
              message: `Could not parse ${file}`,
              severity: "error",
              fix: "Fix the JSON file",
            },
          ]);
          process.exitCode = 1;
          return;
        }
      }
      doc.mcp = {
        ...(doc.mcp || {}),
        specgate: { type: "local", command: [mcpConfig.command, ...mcpConfig.args], enabled: true },
      };
      fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
      io.emit({ installed: true, client, configPath: file }, () => {
        console.log(`✅ MCP server configured for opencode in ${file}`);
      });
      return;
    }
    // REQ-713: Codex reads no project MCP configuration (measured with 0.154),
    // so it goes into the Developer's own, through Codex itself — and says so.
    if (client === "codex") {
      const r = spawnSync(
        process.env.SPECGATE_CODEX || "codex",
        ["mcp", "add", "specgate", "--", mcpConfig.command, ...mcpConfig.args],
        { encoding: "utf8" }
      );
      if (r.status !== 0) {
        io.fail({ installed: false }, [
          {
            code: "codex_mcp_add_failed",
            message: `codex mcp add failed: ${(r.stderr || r.stdout || String(r.error || "")).trim()}`,
            severity: "error",
            fix: "Install Codex (codex --version), then run this again",
          },
        ]);
        process.exitCode = 1;
        return;
      }
      io.emit({ installed: true, client, configPath: "codex mcp (global)", global: true }, () => {
        console.log("✅ MCP server added to Codex with `codex mcp add specgate`");
        console.log(
          "   This is your own Codex configuration: it applies to every project, not only this one."
        );
        console.log(
          "   `codex exec` refuses MCP calls with nobody to approve them: to allow this server's there, add"
        );
        console.log(
          '   default_tools_approval_mode = "approve"  under [mcp_servers.specgate] in ~/.codex/config.toml'
        );
      });
      return;
    }
    if (client === "claude") {
      configPath = path.join(
        os.homedir(),
        process.platform === "win32"
          ? "AppData/Roaming/Claude/claude_desktop_config.json"
          : "Library/Application Support/Claude/claude_desktop_config.json"
      );
    } else if (client === "cursor") {
      configPath = path.join(os.homedir(), ".cursor/mcp.json");
    } else {
      io.fail({ installed: false }, [
        {
          code: "unsupported_client",
          message: `Client '${client}' is not supported yet.`,
          severity: "error",
          fix: "Use claude, cursor, opencode or codex",
        },
      ]);
      process.exitCode = 2;
      return;
    }

    if (fs.existsSync(configPath)) {
      try {
        configObj = JSON.parse(fs.readFileSync(configPath, "utf8"));
      } catch {
        io.fail({ installed: false }, [
          {
            code: "invalid_config",
            message: `Could not parse existing config at ${configPath}`,
            severity: "error",
            fix: "Fix the JSON file",
          },
        ]);
        process.exitCode = 1;
        return;
      }
    }

    if (!configObj.mcpServers) configObj.mcpServers = {};
    configObj.mcpServers["spec-driven"] = mcpConfig;

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(configObj, null, 2));

    io.emit({ installed: true, client, configPath }, () => {
      console.log(`✅ MCP server configured for ${client} at ${configPath}`);
    });
  }
}
