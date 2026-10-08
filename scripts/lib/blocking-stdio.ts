/**
 * Make stdout and stderr blocking when they are pipes, so `process.exit()`
 * can never cut a document short.
 *
 * Node writes to a pipe asynchronously on macOS (and on Linux for some
 * handles), and `process.exit()` does not wait for the queue to drain. A
 * command that printed a large JSON document and then called
 * `process.exit(0)` reached the reader cut at exactly 65,536 bytes — the
 * harness failed with "plan produced invalid JSON" on a 99-row plan
 * (golden_app finding #33). Twenty-eight more commands exit the same way.
 *
 * Rewriting each exit to wait for a drain would change control flow in every
 * one of them: code after `process.exit()` relies on never running. Making the
 * writes synchronous fixes all of them at once and changes nothing else. It is
 * what a terminal already does — TTY writes are synchronous on POSIX.
 *
 * Loaded with `--require` for every command the dispatcher runs, and imported
 * by the shared command modules for scripts invoked directly.
 */

for (const stream of [process.stdout, process.stderr]) {
  const handle = (stream as unknown as { _handle?: { setBlocking?: (b: boolean) => void } })
    ._handle;
  if (handle && typeof handle.setBlocking === "function") {
    try {
      handle.setBlocking(true);
    } catch {
      // A handle that refuses is left as Node configured it.
    }
  }
}

export {};
