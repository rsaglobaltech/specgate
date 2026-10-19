"use strict";

/**
 * Pure module — no vscode dependency.
 * Validates pack.yaml content against the JSON Schema (draft 2020-12).
 * Returns structured diagnostic objects that extension.ts converts to
 * vscode.Diagnostic instances.
 */

import * as Ajv2020 from "ajv/dist/2020";
import type { AnySchemaObject, ErrorObject, ValidateFunction } from "ajv/dist/2020";
import * as yaml from "js-yaml";
import * as path from "node:path";
import * as fs from "node:fs";

type Ajv2020Class = typeof Ajv2020.default;

/** The part of a js-yaml `YAMLException` a parse diagnostic reads. */
interface YamlParseError {
  mark?: { line: number; column: number };
  message?: string;
}

export interface Diag {
  line: number;
  col: number;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  parseError: Diag | null;
  errors: Diag[];
}

export class PackValidator {
  private schemaPath: string;
  private ajv: InstanceType<Ajv2020Class> | null = null;
  private validateFn: ValidateFunction | null = null;

  constructor(schemaPath?: string) {
    this.schemaPath = schemaPath || path.resolve(__dirname, "../../../../schemas/pack.schema.json");
  }

  private loadAjv(): InstanceType<Ajv2020Class> {
    if (!this.ajv) {
      // Under CommonJS interop the namespace carries the class as `default`;
      // the fallback covers a build that exports the class itself.
      const Ajv: Ajv2020Class =
        (Ajv2020 as { default?: Ajv2020Class }).default || (Ajv2020 as unknown as Ajv2020Class);
      this.ajv = new Ajv({ allErrors: true, strict: false });
    }
    return this.ajv;
  }

  public validatePackYaml(content: string): ValidationResult {
    // 1. Parse YAML
    let parsed: unknown;
    try {
      parsed = yaml.load(content, { json: true });
    } catch (err: unknown) {
      const error = err as YamlParseError;
      return {
        parseError: {
          line: error.mark ? error.mark.line : 0,
          col: error.mark ? error.mark.column : 0,
          message: `YAML parse error: ${error.message}`,
          severity: "error",
        },
        errors: [],
      };
    }

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        parseError: {
          line: 0,
          col: 0,
          message: "pack.yaml root must be a YAML mapping (object), not a scalar or sequence.",
          severity: "error",
        },
        errors: [],
      };
    }

    // 2. Load schema
    let schema: AnySchemaObject;
    try {
      schema = JSON.parse(fs.readFileSync(this.schemaPath, "utf8"));
    } catch (err: unknown) {
      const error = err as Error;
      return {
        parseError: null,
        errors: [
          {
            line: 0,
            col: 0,
            message: `Cannot load pack schema from '${this.schemaPath}': ${error.message}`,
            severity: "warning",
          },
        ],
      };
    }

    // 3. Validate with AJV
    let ajv: InstanceType<Ajv2020Class>;
    try {
      ajv = this.loadAjv();
    } catch (err: unknown) {
      const error = err as Error;
      return {
        parseError: null,
        errors: [
          {
            line: 0,
            col: 0,
            message: `AJV not available: ${error.message}. Install ajv@^8 to enable schema validation.`,
            severity: "warning",
          },
        ],
      };
    }

    try {
      if (!this.validateFn) {
        this.validateFn = ajv.compile(schema);
      }
    } catch (err: unknown) {
      const error = err as Error;
      return {
        parseError: null,
        errors: [
          {
            line: 0,
            col: 0,
            message: `Schema compile error: ${error.message}`,
            severity: "warning",
          },
        ],
      };
    }

    const valid = this.validateFn(parsed);
    if (valid) return { parseError: null, errors: [] };

    // 4. Map AJV errors to approximate line numbers
    const lines = content.split("\n");
    const errors = (this.validateFn.errors || []).map((err): Diag => {
      const line = this.findApproximateLine(lines, err.instancePath, err.schemaPath);
      return {
        line,
        col: 0,
        message: this.formatAjvError(err),
        severity: "error",
      };
    });

    return { parseError: null, errors };
  }

  private formatAjvError(err: ErrorObject): string {
    const ptr = err.instancePath || "(root)";
    const schemaDesc =
      err.parentSchema && err.parentSchema.description ? ` (${err.parentSchema.description})` : "";
    return `${ptr}: ${err.message}${schemaDesc}`;
  }

  /**
   * Best-effort: scan the YAML lines for a key matching the last segment of the
   * JSON Pointer. Falls back to line 0.
   */
  public findApproximateLine(lines: string[], instancePath: string, _schemaPath?: string): number {
    const parts = (instancePath || "").split("/").filter(Boolean);
    if (parts.length === 0) return 0;

    // Try progressively shorter paths until a match is found
    for (let depth = parts.length; depth > 0; depth--) {
      const key = parts[depth - 1];
      // Skip numeric indices — look for their parent key
      if (/^\d+$/.test(key)) continue;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trimStart();
        if (
          trimmed.startsWith(key + ":") ||
          trimmed.startsWith('"' + key + '":') ||
          trimmed.startsWith("'" + key + "':")
        ) {
          return i;
        }
      }
    }
    return 0;
  }
}

// Legacy exports to avoid breaking other un-refactored files
const defaultValidator = new PackValidator();
export const validatePackYaml = (content: string, schemaPath?: string) => {
  const validator = schemaPath ? new PackValidator(schemaPath) : defaultValidator;
  return validator.validatePackYaml(content);
};
export const findApproximateLine = (lines: string[], instancePath: string, _schemaPath?: string) =>
  defaultValidator.findApproximateLine(lines, instancePath, _schemaPath);
