/**
 * The tests that passed, kept beside the last gate result (REQ-516).
 *
 * `check --affected` still runs every selected test file, and re-running the
 * gate after fixing a typo in a spec ran them all again. A test file that
 * passed is kept with a fingerprint of everything it was judged on; while the
 * fingerprint holds, it is not run again.
 *
 * Conservative on purpose — a wrong skip is worse than a slow run:
 *
 * - The whole cache is keyed by the test command, the Node version and
 *   platform, and the content of every file each test can depend on (the
 *   lockfiles, package.json, harness.config.yaml, a tsconfig… and `full_on:`).
 * - A test's fingerprint holds its own content, the files its imports reach,
 *   and the code files the matrix links to its requirements.
 * - A test whose imports cannot all be followed, that is not JavaScript or
 *   TypeScript, or that reaches the file system, a process or the network
 *   also holds every source file of the project: any change re-runs it.
 * - A failed run forgets every file it ran. Only files run one by one through
 *   `{files}` are ever recorded.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  type MatrixLinks,
  globalFile,
  inertFile,
} from "../../packages/core/src/domain/AffectedTests";
import { isTestByName } from "../../packages/core/src/infrastructure/DerivedMatrixSources";
import type { ImportGraph } from "./import-graph";
import { stateFileFor, writeState } from "./last-check";

export const TEST_CACHE_FILE = "test-cache.json";

interface CacheDoc {
  schemaVersion: 1;
  /** What every entry was judged under. */
  key: string;
  tests: Record<string, { fingerprint: string; passedAt: string }>;
}

const sha = (data: string | Buffer) => crypto.createHash("sha256").update(data).digest("hex");

export class TestCache {
  private readonly hashes = new Map<string, string>();
  private everySource: string | null = null;
  private readonly codeOfRequirement = new Map<string, string[]>();
  private readonly requirementsOfTest = new Map<string, string[]>();
  private doc: CacheDoc;
  private readonly key: string;

  /**
   * `command`: the test command as written, placeholders and all.
   * `files`: every file of the project.
   */
  constructor(
    private readonly projectDir: string,
    command: string,
    private readonly files: ReadonlySet<string>,
    private readonly graph: ImportGraph,
    rows: readonly MatrixLinks[],
    fullOn: readonly string[]
  ) {
    for (const r of rows) {
      for (const t of r.tests) {
        this.requirementsOfTest.set(t, [...(this.requirementsOfTest.get(t) || []), r.requirement]);
      }
      this.codeOfRequirement.set(r.requirement, [
        ...(this.codeOfRequirement.get(r.requirement) || []),
        ...r.code,
      ]);
    }
    const globals = [...files].filter((f) => globalFile(f, fullOn)).sort();
    this.key = sha(
      [
        "specgate-test-cache 1",
        `command ${command}`,
        `node ${process.version} ${process.platform} ${process.arch}`,
        ...globals.map((f) => `global ${f} ${this.hash(f)}`),
      ].join("\n")
    );
    const stored = TestCache.read(projectDir);
    this.doc =
      stored && stored.key === this.key ? stored : { schemaVersion: 1, key: this.key, tests: {} };
  }

  private static read(projectDir: string): CacheDoc | null {
    try {
      const doc = JSON.parse(
        fs.readFileSync(stateFileFor(projectDir, TEST_CACHE_FILE).file, "utf8")
      ) as CacheDoc;
      return doc && doc.schemaVersion === 1 && typeof doc.tests === "object" ? doc : null;
    } catch {
      return null;
    }
  }

  /** A file's content hash, or `missing`. */
  private hash(rel: string): string {
    let h = this.hashes.get(rel);
    if (h === undefined) {
      try {
        h = sha(fs.readFileSync(path.join(this.projectDir, ...rel.split("/"))));
      } catch {
        h = "missing";
      }
      this.hashes.set(rel, h);
    }
    return h;
  }

  /** Every source file of the project but the other tests: what a test that cannot be followed may read. */
  private allSources(): string {
    if (this.everySource === null) {
      const lines = [...this.files]
        .filter((f) => !inertFile(f) && !isTestByName(f))
        .sort()
        .map((f) => `${f} ${this.hash(f)}`);
      this.everySource = sha(lines.join("\n"));
    }
    return this.everySource;
  }

  /** Everything `test` is judged on, as one hash. */
  fingerprint(test: string): string {
    const closure = this.graph.closure(test);
    const code = new Set<string>();
    for (const r of this.requirementsOfTest.get(test) || []) {
      for (const c of this.codeOfRequirement.get(r) || []) code.add(c);
    }
    const lines = [`test ${test} ${this.hash(test)}`];
    for (const f of closure.files) if (f !== test) lines.push(`import ${f} ${this.hash(f)}`);
    for (const c of [...code].sort()) lines.push(`code ${c} ${this.hash(c)}`);
    if (closure.opaque || closure.beyond) lines.push(`every-source ${this.allSources()}`);
    return sha(lines.join("\n"));
  }

  /** The tests among `tests` that passed before on what they are judged on now. */
  cached(tests: readonly string[]): string[] {
    return tests.filter((t) => this.doc.tests[t]?.fingerprint === this.fingerprint(t));
  }

  /** The fingerprints of `tests` now, to record once they have run. */
  snapshot(tests: readonly string[]): Map<string, string> {
    return new Map(tests.map((t) => [t, this.fingerprint(t)]));
  }

  /** Keep the outcome of a run of the files `ran`; a failure forgets them all. */
  record(ran: ReadonlyMap<string, string>, passed: boolean, now = new Date()): void {
    for (const [test, fingerprint] of ran) {
      if (passed) this.doc.tests[test] = { fingerprint, passedAt: now.toISOString() };
      else delete this.doc.tests[test];
    }
    try {
      writeState(this.projectDir, TEST_CACHE_FILE, `${JSON.stringify(this.doc, null, 2)}\n`);
    } catch {
      /* without the record, the next check runs them again: slower, never wrong */
    }
  }
}
