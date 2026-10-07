#!/usr/bin/env node
"use strict";

/**
 * MCP server for create-spec-driven-app projects.
 *
 * Implements the Model Context Protocol over stdio (JSON-RPC 2.0).
 * Supported methods: initialize, tools/list, tools/call.
 *
 * This is a minimal hand-rolled implementation — no @modelcontextprotocol/sdk
 * dependency — to keep the install footprint small. It implements the subset
 * required by Claude Desktop, Cursor, Aider, and other MCP-aware clients.
 */

import { TOOLS } from "./tools";
import * as fs from "node:fs";
import * as path from "node:path";

const PROTOCOL_VERSION = "2024-11-05";

export interface IServer {
  start(): void;
  stop(): void;
}

export interface JsonRpcMessage {
  jsonrpc: string;
  id?: number | string | null;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * This file is compiled into two layouts: the repository's root `dist/` for the
 * test suite, and the package's own `dist/` for publishing. A fixed relative
 * path to package.json resolves in one and not the other, so walk up for it.
 */
function packageVersion(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, "utf8"));
        // This package's own manifest, whatever it is called. Matching on an
        // exact name is what made this announce 0.0.0 twice: once when a path
        // assumption broke, and again when the CLI package became
        // `@rsaglobaltech/specgate` and a hard-coded `"specgate"` stopped matching.
        // The shape of the tree is the stable signal, not the spelling.
        const sibling = path.join(dir, "packages", "mcp-spec-driven", "package.json");
        if (fs.existsSync(sibling)) {
          // Reached the repository root: the manifest is beside it, not above
          // the compiled file, because the root build flattens into dist/.
          return JSON.parse(fs.readFileSync(sibling, "utf8")).version;
        }
        // Shipped inside the CLI package and started by `specgate mcp serve`:
        // the server is that package's version.
        if (
          typeof pkg.name === "string" &&
          (pkg.name.endsWith("/mcp-server") || pkg.name === "@rsaglobaltech/specgate")
        ) {
          return pkg.version;
        }
      } catch {
        // Keep walking — a malformed manifest above us is not ours.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return "0.0.0";
}

const SERVER_INFO = {
  name: "mcp-spec-driven",
  version: packageVersion(),
};

// ── JSON-RPC framing over stdio ──────────────────────────────────────────────────

export class McpServer implements IServer {
  private buffer: string = "";

  public start(): void {
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: Buffer | string) => {
      const messages = this.readMessage(chunk);
      for (const msg of messages) {
        this.handleMessage(msg);
      }
    });
    process.stdin.on("end", () => {
      this.stop();
    });

    // Log activation to stderr so clients see it (stdout is reserved for JSON-RPC)
    process.stderr.write(`mcp-spec-driven ${SERVER_INFO.version} ready\n`);
  }

  public stop(): void {
    process.exit(0);
  }

  public readMessage(chunk: Buffer | string): JsonRpcMessage[] {
    this.buffer += chunk.toString();

    const messages: JsonRpcMessage[] = [];
    // Try Content-Length framing first (per LSP/MCP convention)
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const headers = this.buffer.slice(0, headerEnd);
      const lengthMatch = headers.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) {
        // Bad header — drop until next \r\n\r\n
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }
      const length = parseInt(lengthMatch[1], 10);
      const messageStart = headerEnd + 4;
      if (this.buffer.length < messageStart + length) break;
      const body = this.buffer.slice(messageStart, messageStart + length);
      this.buffer = this.buffer.slice(messageStart + length);
      try {
        messages.push(JSON.parse(body));
      } catch (err: unknown) {
        const error = err as Error;
        this.writeError(null, -32700, `Parse error: ${error.message}`);
      }
    }

    // Also try newline-delimited JSON (used by some clients)
    if (messages.length === 0 && this.buffer.includes("\n")) {
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          messages.push(JSON.parse(trimmed));
        } catch {
          // not JSON — ignore (probably a Content-Length header fragment)
        }
      }
    }

    return messages;
  }

  public writeMessage(message: JsonRpcMessage): void {
    const body = JSON.stringify(message);
    const out = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
    process.stdout.write(out);
  }

  private writeError(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown
  ): void {
    this.writeMessage({
      jsonrpc: "2.0",
      id,
      error: { code, message, ...(data !== undefined ? { data } : {}) },
    });
  }

  private writeResult(id: string | number | null, result: unknown): void {
    this.writeMessage({ jsonrpc: "2.0", id, result });
  }

  // ── Method dispatch ──────────────────────────────────────────────────────────────────────

  public handleMessage(msg: JsonRpcMessage): void {
    if (msg.jsonrpc !== "2.0") {
      this.writeError(msg.id || null, -32600, "Invalid request: missing jsonrpc=2.0");
      return;
    }

    const { id = null, method, params } = msg;

    try {
      switch (method) {
        case "initialize":
          this.writeResult(id, {
            protocolVersion: PROTOCOL_VERSION,
            serverInfo: SERVER_INFO,
            capabilities: { tools: {} },
          });
          break;

        case "initialized":
        case "notifications/initialized":
          // Notification — no response
          break;

        case "tools/list":
          this.writeResult(id, {
            tools: Object.entries(TOOLS).map(([name, t]: [string, any]) => ({
              name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          });
          break;

        case "tools/call": {
          const toolName = params && params.name;
          const args = (params && params.arguments) || {};
          // `csda_*` was the generated prefix until 0.12: an agent config
          // that allow-lists a tool by that name keeps resolving. The old
          // names are accepted here and never listed.
          const tool =
            TOOLS[toolName as keyof typeof TOOLS] ||
            (typeof toolName === "string" && toolName.startsWith("csda_")
              ? TOOLS[`specgate_${toolName.slice("csda_".length)}` as keyof typeof TOOLS]
              : undefined);
          if (!tool) {
            this.writeError(id, -32601, `Unknown tool: ${toolName}`);
            break;
          }
          try {
            const result = tool.handler(args);
            this.writeResult(id, {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
              isError: false,
            });
          } catch (err: unknown) {
            const error = err as Error;
            this.writeResult(id, {
              content: [{ type: "text", text: `Error: ${error.message}` }],
              isError: true,
            });
          }
          break;
        }

        case "ping":
          this.writeResult(id, {});
          break;

        case "shutdown":
          this.writeResult(id, null);
          this.stop();
          break;

        default:
          if (id !== undefined && id !== null) {
            this.writeError(id, -32601, `Method not found: ${method}`);
          }
        // else: notification — ignore unknown notifications
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.writeError(id, -32603, `Internal error: ${error.message}`);
    }
  }
}

if (require.main === module) {
  const server = new McpServer();
  server.start();
}

// Export a default instance for tests to bind to
export const defaultServer = new McpServer();
export const handleMessage = (msg: JsonRpcMessage) => defaultServer.handleMessage(msg);
export const readMessage = (chunk: Buffer | string) => defaultServer.readMessage(chunk);
export const writeMessage = (msg: JsonRpcMessage) => defaultServer.writeMessage(msg);
