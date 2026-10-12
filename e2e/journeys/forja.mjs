/** One front door, two engines (ADR-0033): Specgate hands generation to forja. */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fakes", "forja.mjs");

export default [
  {
    name: "init --forja generates with forja, and add reaches it from inside the project",
    covers: ["add"],
    run(dir, t) {
      const log = path.join(dir, "forja.log");
      const env = { SPECGATE_FORJA_CMD: `"${process.execPath}" "${FAKE}"`, FORJA_LOG: log };
      t.ok(t.sgEnv(dir, env, "init", "--forja", "shop", "--backend", "spring"), "init --forja");
      const inside = path.join(dir, "shop");
      t.ok(
        t.sgEnv(inside, env, "add", "usecase", "orders/PlaceOrder", "--req", "REQ-001"),
        "add usecase"
      );
      const calls = fs
        .readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      t.expect(
        calls[0].argv.join(" ") === "init shop --backend spring",
        "forja init got the name and the flags"
      );
      t.expect(
        calls[1].argv.join(" ") === "add usecase orders/PlaceOrder --req REQ-001",
        "forja add got the arguments as given"
      );
      const outside = t.sgEnv(dir, env, "add", "usecase", "orders/X", "--json");
      t.expect(outside.status === 1, "add outside a forja project fails", outside);
      t.expect(
        t.json(outside).status[0].code === "add_needs_forja",
        "and says why, with a fix",
        outside
      );
    },
  },
];
