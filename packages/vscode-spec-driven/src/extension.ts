import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";

import { validatePackYaml } from "./pack-validator";
import { findRequirementIds, findIdInTraceability, parseValidateOutput } from "./traceability";
import { runValidate } from "./validate-runner";
import { PackGraphAnalyzer } from "./pack-graph";

function nonce(): string {
  let s = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 24; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function packGraphHtml(webview: vscode.Webview): string {
  const n = nonce();
  const cdn = "https://cdn.jsdelivr.net";
  const csp =
    `default-src 'none'; ` +
    `img-src ${webview.cspSource} data:; ` +
    `style-src ${webview.cspSource} 'unsafe-inline'; ` +
    `script-src 'nonce-${n}' ${cdn};`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <style>
    body { font-family: var(--vscode-font-family); padding: 0; margin: 0; }
    #toolbar { padding: 6px 10px; font-size: 12px; opacity: 0.7; }
    #graph { padding: 10px; }
    .err { color: var(--vscode-errorForeground); padding: 10px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div id="toolbar">REQ → UC → CMD/QUERY/AGG/EVT — refreshes on save</div>
  <div id="graph">Loading…</div>
  <script nonce="${n}" src="${cdn}/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script nonce="${n}">
    const vscode = acquireVsCodeApi();
    let ready = false;
    if (window.mermaid) {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
      ready = true;
    }
    const graphEl = document.getElementById("graph");
    window.addEventListener("message", async (event) => {
      const msg = event.data;
      if (!msg || msg.type !== "update") return;
      if (!ready) { graphEl.innerHTML = '<div class="err">Mermaid failed to load (no network?).</div>'; return; }
      try {
        const { svg } = await mermaid.render("packGraph", msg.mermaid);
        graphEl.innerHTML = svg;
      } catch (e) {
        graphEl.innerHTML = '<div class="err">Could not render graph:\\n' + String(e && e.message || e) + '</div>';
      }
    });
    vscode.postMessage({ type: "ready" });
  </script>
</body>
</html>`;
}

class RequirementCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const cfg = vscode.workspace.getConfiguration("spec-driven");
    if (!cfg.get("codeLens")) return [];

    const lenses = findRequirementIds(document.getText()).map(({ id, line, col, endCol }) => {
      const range = new vscode.Range(line, col, line, endCol);
      return new vscode.CodeLens(range, {
        title: `$(link-external) Reveal ${id} in traceability`,
        command: "spec-driven.revealInTraceability",
        tooltip: `Open docs/specs/traceability.md at ${id}`,
      });
    });

    if (path.basename(document.fileName) === "pack.yaml") {
      const { refCounts } = PackGraphAnalyzer.analyzePackGraph(document.getText());
      const lines = document.getText().split("\n");
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/\bid:\s*["']?(REQ-\d+)\b/);
        if (!m) continue;
        const counts = refCounts.get(m[1]) || { useCases: 0, scenarios: 0 };
        const idCol = lines[i].indexOf(m[1]);
        const range = new vscode.Range(i, Math.max(0, idCol), i, idCol + m[1].length);
        lenses.push(
          new vscode.CodeLens(range, {
            title:
              `$(references) ${counts.useCases} use case(s) · ` + `${counts.scenarios} scenario(s)`,
            command: "",
            tooltip: `${m[1]} is referenced by ${counts.useCases} use case(s) and ${counts.scenarios} scenario(s) in this pack.`,
          })
        );
      }
    }

    return lenses;
  }
}

const KIND_DETAIL: Record<string, string> = {
  requirement: "requirement",
  command: "command",
  query: "query",
  aggregate: "aggregate",
  event: "event",
};

class PackReferenceCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] {
    if (path.basename(document.fileName) !== "pack.yaml") return [];

    const lines = document.getText().split("\n");
    const kind = PackGraphAnalyzer.referenceKindForLine(lines, position.line);
    if (!kind) return [];

    const { declared } = PackGraphAnalyzer.analyzePackGraph(document.getText());
    const candidates = declared[kind];
    if (!candidates || candidates.size === 0) return [];

    return [...candidates].sort().map((value) => {
      const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Reference);
      item.detail = `pack.yaml ${KIND_DETAIL[kind]}`;
      return item;
    });
  }
}

class PackReferenceDefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Location | null {
    if (path.basename(document.fileName) !== "pack.yaml") return null;

    const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z][A-Za-z0-9_-]*/);
    if (!wordRange) return null;

    const token = document.getText(wordRange);
    const decl = PackGraphAnalyzer.findDeclarationPosition(document.getText(), token);
    if (!decl) return null;

    if (decl.line === position.line) return null;

    return new vscode.Location(document.uri, new vscode.Position(decl.line, decl.col));
  }
}

export class ExtensionActivator {
  private packDiagnostics: vscode.DiagnosticCollection | undefined;
  private validateDiagnostics: vscode.DiagnosticCollection | undefined;
  private packGraphPanel: vscode.WebviewPanel | null = null;
  private packGraphFsPath: string | null = null;

  public activate(context: vscode.ExtensionContext): void {
    this.packDiagnostics = vscode.languages.createDiagnosticCollection("spec-driven-pack");
    this.validateDiagnostics = vscode.languages.createDiagnosticCollection("spec-driven-validate");

    context.subscriptions.push(this.packDiagnostics, this.validateDiagnostics);

    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (this.isPackYaml(doc)) this.lintPackDocument(doc);
      }),
      vscode.workspace.onDidChangeTextDocument((evt) => {
        if (this.isPackYaml(evt.document)) this.lintPackDocument(evt.document);
      }),
      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.packDiagnostics?.delete(doc.uri);
      })
    );

    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        this.refreshPackGraphFor(doc);
        const cfg = this.config();
        if (!cfg.get("validateOnSave")) return;
        const root = this.findProjectRoot(doc.uri.fsPath);
        if (root) this.triggerProjectValidate(root, cfg.get<string>("cliPath"));
      }),
      vscode.workspace.onDidChangeTextDocument((evt) => this.refreshPackGraphFor(evt.document))
    );

    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { scheme: "file" },
        new RequirementCodeLensProvider()
      )
    );

    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        { scheme: "file", language: "yaml" },
        new PackReferenceCompletionProvider()
      ),
      vscode.languages.registerDefinitionProvider(
        { scheme: "file", language: "yaml" },
        new PackReferenceDefinitionProvider()
      )
    );

    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand("spec-driven.revealInTraceability", (editor) =>
        this.cmdRevealInTraceability(editor)
      ),
      vscode.commands.registerCommand("spec-driven.validateProject", () =>
        this.cmdValidateProject()
      ),
      vscode.commands.registerCommand("spec-driven.showPackGraph", () => this.cmdShowPackGraph())
    );

    vscode.workspace.textDocuments.forEach((doc) => {
      if (this.isPackYaml(doc)) this.lintPackDocument(doc);
    });
  }

  public deactivate(): void {
    this.packDiagnostics?.dispose();
    this.validateDiagnostics?.dispose();
    this.packGraphPanel?.dispose();
  }

  private config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("spec-driven");
  }

  private isPackYaml(doc: vscode.TextDocument): boolean {
    return (
      path.basename(doc.fileName) === "pack.yaml" &&
      (doc.languageId === "yaml" || doc.languageId === "plaintext")
    );
  }

  private findProjectRoot(filePath: string): string | null {
    let dir = path.dirname(filePath);
    const { root } = path.parse(dir);
    while (dir !== root) {
      if (
        fs.existsSync(path.join(dir, "spec.md")) ||
        fs.existsSync(path.join(dir, "docs", "specs", "traceability.md"))
      ) {
        return dir;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  }

  private lintPackDocument(doc: vscode.TextDocument) {
    const cfg = this.config();
    const schemaPath =
      cfg.get<string>("schemaPath") ||
      path.resolve(__dirname, "../../../../schemas/pack.schema.json");

    const { parseError, errors } = validatePackYaml(doc.getText(), schemaPath);

    const diags: vscode.Diagnostic[] = [];

    if (parseError) {
      diags.push(
        this.makeDiag(parseError.line, parseError.col, parseError.message, parseError.severity)
      );
    }

    for (const e of errors) {
      diags.push(this.makeDiag(e.line, e.col, e.message, e.severity));
    }

    for (const d of PackGraphAnalyzer.analyzePackGraph(doc.getText()).dangling) {
      diags.push(this.makeDiag(d.line, d.col, d.message, d.severity));
    }

    this.packDiagnostics?.set(doc.uri, diags);
  }

  private makeDiag(
    line: number,
    col: number,
    message: string,
    severity: string
  ): vscode.Diagnostic {
    const l = Math.max(0, line);
    const c = Math.max(0, col);
    return new vscode.Diagnostic(
      new vscode.Range(l, c, l, Math.max(c + 1, c + 80)),
      message,
      severity === "error"
        ? vscode.DiagnosticSeverity.Error
        : severity === "warning"
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Information
    );
  }

  private triggerProjectValidate(projectDir: string, cliPath: string | undefined) {
    const result = runValidate(projectDir, cliPath);

    if (result.spawnError) {
      vscode.window.showErrorMessage(
        `Spec-Driven: could not run validate — ${result.spawnError}. ` +
          `Check the 'spec-driven.cliPath' setting.`
      );
      return;
    }

    const diags = parseValidateOutput(result.stdout, result.stderr);
    const errors = diags.filter((d) => d.severity === "error");
    const warnings = diags.filter((d) => d.severity === "warning");

    const anchorFile = fs.existsSync(path.join(projectDir, "spec.md"))
      ? path.join(projectDir, "spec.md")
      : projectDir;
    const anchorUri = vscode.Uri.file(anchorFile);

    this.validateDiagnostics?.set(
      anchorUri,
      diags
        .filter((d) => d.severity !== "info")
        .map((d) => this.makeDiag(0, 0, d.message, d.severity))
    );

    if (result.exitCode === 0) {
      vscode.window.setStatusBarMessage("$(check) Spec-Driven: validate passed", 5_000);
    } else {
      vscode.window
        .showWarningMessage(
          `Spec-Driven: ${errors.length} error(s), ${warnings.length} warning(s). See Problems panel.`,
          "Open Problems"
        )
        .then((choice) => {
          if (choice === "Open Problems") {
            vscode.commands.executeCommand("workbench.actions.view.problems");
          }
        });
    }
  }

  private async cmdRevealInTraceability(editor: vscode.TextEditor | undefined) {
    if (!editor) {
      vscode.window.showInformationMessage(
        "Open a file first, then place the cursor on a requirement ID."
      );
      return;
    }

    const wordRange = editor.document.getWordRangeAtPosition(
      editor.selection.active,
      /[A-Z]+-\d{3,}/
    );
    if (!wordRange) {
      vscode.window.showInformationMessage(
        "Place the cursor on a requirement ID (e.g. REQ-001, UC-003) then run this command."
      );
      return;
    }

    const id = editor.document.getText(wordRange);
    const root = this.findProjectRoot(editor.document.fileName);

    if (!root) {
      vscode.window.showWarningMessage(
        "Cannot find spec-driven project root (no spec.md found in parent directories)."
      );
      return;
    }

    const traceFile = path.join(root, "docs", "specs", "traceability.md");
    if (!fs.existsSync(traceFile)) {
      vscode.window.showWarningMessage(
        "docs/specs/traceability.md not found. Run 'init' to generate it."
      );
      return;
    }

    const content = fs.readFileSync(traceFile, "utf8");
    const targetLine = findIdInTraceability(content, id);

    const traceUri = vscode.Uri.file(traceFile);
    const doc = await vscode.workspace.openTextDocument(traceUri);
    const targetEditor = await vscode.window.showTextDocument(doc);

    if (targetLine >= 0) {
      const pos = new vscode.Position(targetLine, 0);
      targetEditor.selection = new vscode.Selection(pos, pos);
      targetEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    } else {
      vscode.window.showInformationMessage(`${id} is not yet listed in the traceability matrix.`);
    }
  }

  private async cmdValidateProject() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage("No workspace folder open.");
      return;
    }

    const cfg = this.config();
    const cliPath = cfg.get<string>("cliPath");

    for (const folder of folders) {
      this.triggerProjectValidate(folder.uri.fsPath, cliPath);
    }
  }

  private cmdShowPackGraph() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.isPackYaml(editor.document)) {
      vscode.window.showInformationMessage("Open a pack.yaml file, then run this command.");
      return;
    }
    const doc = editor.document;

    if (this.packGraphPanel) {
      this.packGraphFsPath = doc.fileName;
      this.packGraphPanel.title = `Pack Graph — ${path.basename(path.dirname(doc.fileName))}`;
      this.packGraphPanel.reveal(vscode.ViewColumn.Beside);
      this.postPackGraph(doc);
      return;
    }

    this.packGraphPanel = vscode.window.createWebviewPanel(
      "specDrivenPackGraph",
      `Pack Graph — ${path.basename(path.dirname(doc.fileName))}`,
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    this.packGraphFsPath = doc.fileName;
    this.packGraphPanel.webview.html = packGraphHtml(this.packGraphPanel.webview);
    this.packGraphPanel.onDidDispose(() => {
      this.packGraphPanel = null;
      this.packGraphFsPath = null;
    });
    this.packGraphPanel.webview.onDidReceiveMessage((msg: { type?: string } | undefined) => {
      if (msg && msg.type === "ready") this.postPackGraph(doc);
    });
  }

  private refreshPackGraphFor(doc: vscode.TextDocument) {
    if (!this.packGraphPanel || !this.packGraphFsPath) return;
    if (doc.fileName !== this.packGraphFsPath) return;
    this.postPackGraph(doc);
  }

  private postPackGraph(doc: vscode.TextDocument) {
    if (!this.packGraphPanel) return;
    this.packGraphPanel.webview.postMessage({
      type: "update",
      mermaid: PackGraphAnalyzer.renderPackMermaid(doc.getText()),
    });
  }
}

const activator = new ExtensionActivator();

export function activate(context: vscode.ExtensionContext): void {
  activator.activate(context);
}

export function deactivate(): void {
  activator.deactivate();
}
