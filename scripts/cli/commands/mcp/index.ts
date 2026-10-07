import * as path from "node:path";
import { findCliRoot } from "../../../lib/project-root";
import { McpInstallCommand } from "./McpInstallCommand";
import { BaseCommand } from "../../../lib/command";
import { agentIo } from "../../../lib/agent";

export class McpCommand extends BaseCommand {
  public execute(): void {
    const sub = this.args[0];
    if (sub === "--help" || sub === "-h") {
      process.stdout.write(
        "\n  specgate mcp install --client <claude|cursor|vscode|kiro> [--json]\n" +
          "  specgate mcp serve\n\n" +
          "  install writes the MCP server configuration for one AI client;\n" +
          "  serve runs the server over stdio, which is what that configuration starts.\n\n"
      );
      process.exit(0);
    }
    if (sub === "serve") {
      // `@specgate/mcp-server`, which every generated MCP config pointed at,
      // was never published: the server ships inside this package instead, and
      // its tools call the very CLI that is serving them rather than `npx`.
      const root = findCliRoot(__dirname);
      process.env.SPECGATE_CLI = `"${process.execPath}" "${path.join(root, "bin", "specgate.js")}"`;
      const { McpServer } = require(
        path.join(root, "dist", "packages", "mcp-spec-driven", "src", "server.js")
      );
      new McpServer().start();
      return;
    }
    if (sub === "install") {
      new McpInstallCommand(this.args.slice(1)).execute();
      return;
    }
    agentIo(this.args.includes("--json")).fail({ mcp: null }, [
      {
        code: "unknown_mcp_command",
        message: "Unknown subcommand for mcp.",
        severity: "error",
        fix: "Use 'specgate mcp install --client <client>'",
      },
    ]);
    process.exitCode = 2;
  }
}

if (require.main === module) {
  new McpCommand(process.argv.slice(2)).execute();
}
