/**
 * A test that stands an agent, a sandbox or a principle in with a POSIX shell
 * script (`#!/bin/sh`, `! grep …`). Windows runs none of those, so there it is
 * skipped, saying why; Linux and macOS run it as `test` would.
 */
import { test as nodeTest } from "node:test";

const reason =
  process.platform === "win32" &&
  "its stand-ins are POSIX shell scripts, which Windows does not run";

type Fn = (t: any) => unknown;

export function posixTest(name: string, fn: Fn): void;
export function posixTest(name: string, options: object, fn: Fn): void;
export function posixTest(name: string, a: unknown, b?: unknown): void {
  if (typeof a === "function") void nodeTest(name, { skip: reason }, a as never);
  else
    void nodeTest(
      name,
      { ...(a as object), skip: reason || (a as { skip?: string | boolean }).skip },
      b as never
    );
}
