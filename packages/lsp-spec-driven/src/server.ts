#!/usr/bin/env node
"use strict";

/**
 * Spec-Driven Language Server (LSP over stdio, JSON-RPC 2.0).
 *
 * A minimal, dependency-free server — same hand-rolled framing as the MCP
 * server — that publishes inline diagnostics for `traceability.md` using the
 * shared pure core in `diagnostics.ts` (the same rules as `validate
 * --strict-tdd`). One LSP feeds every editor: VS Code, IntelliJ (via LSP4IJ),
 * Neovim, etc. — instead of reimplementing the checks per IDE.
 *
 * Implemented: initialize, initialized, textDocument/{didOpen,didChange,didSave,
 * didClose}, shutdown, exit. Diagnostics are pushed via textDocument/publishDiagnostics.
 */

import { computeTraceabilityDiagnostics, SpecDiagnostic } from "./diagnostics";

export interface IServer {
  start(): void;
  stop(): void;
}

export interface LspMessage {
  jsonrpc: string;
  id?: number | string | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/** A zero-based position in a document, as LSP counts it. */
export interface LspPosition {
  line: number;
  character: number;
}

/** The LSP `Diagnostic` this server publishes. */
export interface LspDiagnostic {
  range: { start: LspPosition; end: LspPosition };
  severity: number;
  code: string;
  source: string;
  message: string;
}

// The params of the notifications this server reads. The client sends them;
// a field that is missing is skipped, as before, rather than validated.

interface DidOpenParams {
  textDocument?: { uri: string; text: string };
}

interface DidChangeParams {
  textDocument: { uri: string };
  contentChanges?: { text: string }[];
}

interface DidSaveParams {
  textDocument: { uri: string };
  text?: string;
}

interface DidCloseParams {
  textDocument?: { uri: string };
}

export class LspServer implements IServer {
  private buffer: string = "";
  private shuttingDown: boolean = false;

  public start(): void {
    process.stdin.on("data", (chunk: Buffer) => this.onChunk(chunk));
    process.stdin.on("end", () => this.stop());
  }

  public stop(): void {
    process.exit(0);
  }

  public send(message: LspMessage): void {
    const body = JSON.stringify(message);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
  }

  public isTraceability(uri: string): boolean {
    return uri.endsWith("/traceability.md") || uri.endsWith("traceability.md");
  }

  public toLspDiagnostics(diags: SpecDiagnostic[]): LspDiagnostic[] {
    return diags.map((d) => ({
      range: {
        start: { line: d.line, character: d.startCol },
        end: { line: d.line, character: d.endCol },
      },
      severity: d.severity,
      code: d.code,
      source: "spec-driven",
      message: d.message,
    }));
  }

  public publish(uri: string, text: string): void {
    if (!this.isTraceability(uri)) return;
    const diagnostics = this.toLspDiagnostics(computeTraceabilityDiagnostics(text));
    this.send({
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: { uri, diagnostics },
    });
  }

  public handle(msg: LspMessage): void {
    const { id = null, method, params } = msg;

    switch (method) {
      case "initialize":
        this.send({
          jsonrpc: "2.0",
          id,
          result: {
            capabilities: {
              // 1 = full document sync: client sends the whole text on each change.
              textDocumentSync: 1,
            },
            serverInfo: { name: "spec-driven-lsp", version: "0.1.0" },
          },
        });
        return;

      case "initialized":
        return; // notification, no response

      case "textDocument/didOpen": {
        const p = params as DidOpenParams | null | undefined;
        if (p && p.textDocument) {
          this.publish(p.textDocument.uri, p.textDocument.text);
        }
        return;
      }

      case "textDocument/didChange": {
        // Full sync → the last content change holds the entire document.
        const p = params as DidChangeParams | null | undefined;
        if (p && p.contentChanges) {
          const changes = p.contentChanges;
          const text = changes.length ? changes[changes.length - 1].text : "";
          this.publish(p.textDocument.uri, text);
        }
        return;
      }

      case "textDocument/didSave": {
        const p = params as DidSaveParams | null | undefined;
        if (p && p.text !== undefined) {
          this.publish(p.textDocument.uri, p.text);
        }
        return;
      }

      case "textDocument/didClose": {
        // Clear diagnostics for the closed document.
        const p = params as DidCloseParams | null | undefined;
        if (p && p.textDocument) {
          this.send({
            jsonrpc: "2.0",
            method: "textDocument/publishDiagnostics",
            params: { uri: p.textDocument.uri, diagnostics: [] },
          });
        }
        return;
      }

      case "shutdown":
        this.shuttingDown = true;
        this.send({ jsonrpc: "2.0", id, result: null });
        return;

      case "exit":
        process.exit(this.shuttingDown ? 0 : 1);
        return;

      default:
        // Respond to unknown *requests* (those with an id) with MethodNotFound;
        // ignore unknown notifications.
        if (id !== undefined && id !== null) {
          this.send({
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Unknown method: ${method}` },
          });
        }
    }
  }

  public onChunk(chunk: Buffer): void {
    this.buffer += chunk.toString("utf8");
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const headers = this.buffer.slice(0, headerEnd);
      const m = headers.match(/Content-Length:\s*(\d+)/i);
      if (!m) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }
      const length = parseInt(m[1], 10);
      const start = headerEnd + 4;
      if (this.buffer.length < start + length) break;
      const body = this.buffer.slice(start, start + length);
      this.buffer = this.buffer.slice(start + length);
      try {
        this.handle(JSON.parse(body));
      } catch {
        // Malformed message — skip it; LSP clients resend on the next change.
      }
    }
  }
}

if (require.main === module) {
  const server = new LspServer();
  server.start();
}

// Exports for tests
export const defaultServer = new LspServer();
export const handle = (msg: LspMessage) => defaultServer.handle(msg);
export const toLspDiagnostics = (diags: SpecDiagnostic[]) => defaultServer.toLspDiagnostics(diags);
export const isTraceability = (uri: string) => defaultServer.isTraceability(uri);
