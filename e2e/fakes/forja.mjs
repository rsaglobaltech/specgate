#!/usr/bin/env node
/**
 * A forja stand-in for the front-door journey (ADR-0033): it records the
 * arguments and the directory it was run with in $FORJA_LOG, and for `init`
 * writes the forja.config.json a real one would, so `add` can find the project.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const argv = process.argv.slice(2);
fs.appendFileSync(process.env.FORJA_LOG, JSON.stringify({ argv, cwd: process.cwd() }) + "\n");
if (argv[0] === "init" && argv[1]) {
  fs.mkdirSync(argv[1], { recursive: true });
  fs.writeFileSync(path.join(argv[1], "forja.config.json"), JSON.stringify({ name: argv[1] }));
}
