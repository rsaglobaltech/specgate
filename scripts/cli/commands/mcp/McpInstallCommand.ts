import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { BaseCommand } from "../../../lib/command";
import { agentIo } from "../../../lib/agent";

export class McpInstallCommand extends BaseCommand {
  public execute(): void {
    if (this.args.includes("--help") || this.args.includes("-h")) {
      process.stdout.write(
        "\n  specgate mcp install --client <claude|cursor> [--json]\n\n" +
          "  Writes the MCP server configuration for one AI client, so the agent can\n" +
          "  read the spec tree and run the gate as tools.\n\n"
      );
      process.exit(0);
    }
    const isJson = this.args.includes("--json");
    const io = agentIo(isJson);
    const clientIdx = this.args.indexOf("--client");

    if (clientIdx === -1 || !this.args[clientIdx + 1]) {
      io.fail({ installed: false }, [
        {
          code: "missing_client",
          message: "Missing required flag: --client <claude|cursor>",
          severity: "error",
          fix: "Pass --client <client>",
        },
      ]);
      process.exitCode = 2;
      return;
    }
    const client = this.args[clientIdx + 1];

    let configPath = "";
    let configObj: any = {};
    const mcpConfig = {
      command: "npx",
      args: ["-y", "@rsaglobaltech/specgate@latest", "mcp", "serve"],
    };

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
          fix: "Use claude or cursor",
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
