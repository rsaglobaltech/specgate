/**
 * The pack tooling's two log lines.
 *
 * Prefixed and unstructured, unlike the `Diagnostic` envelope the newer
 * surfaces emit — kept as they are because the pack commands' output format is
 * part of what their tests assert. Stated once here so the adapters and the
 * command layer share one definition.
 */

export function logInfo(message: string): void {
  process.stdout.write(`  ℹ  ${message}\n`);
}

export function logError(message: string): void {
  process.stderr.write(`  ✖  ${message}\n`);
}
