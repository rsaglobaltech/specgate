#!/usr/bin/env node
"use strict";
/**
 * The `Stop` hook: the spec gate, inside the agent's loop.
 *
 * `specgate validate --strict-tdd` has always run in CI — that is, *after* the
 * agent finished and left. This runs it when the agent is about to stop, while
 * it still has the context to fix what it broke, and refuses the stop while the
 * gate is red. It is the difference between a gate that reviews an agent's work
 * and one the agent cannot walk past.
 *
 * **The loop hazard is the whole design problem.** A `Stop` hook that blocks
 * whenever the gate fails can trap a session forever: the agent tries, fails,
 * is blocked, tries again. So this blocks **at most once per user prompt**,
 * keyed on the `prompt_id` the hook receives. The second time the same prompt
 * comes back it reports the findings and lets the session end, because at that
 * point the agent has already been told and a human needs to see the answer.
 *
 * Contract (verified against the hooks reference):
 *   - stdin: JSON with `cwd`, `prompt_id`, `hook_event_name`
 *   - exit 2: blocks the stop, and stderr is what Claude is told
 *   - exit 0: allows it
 * Anything unexpected exits 0. A hook that breaks a session because the CLI
 * was missing would be worse than no hook at all.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.alreadyBlocked = alreadyBlocked;
exports.renderFindings = renderFindings;
exports.decide = decide;
exports.main = main;
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const node_child_process_1 = require("node:child_process");
const MARKER_DIR = path.join(os.tmpdir(), "csda-gate-hook");
/**
 * Has this prompt already been blocked once?
 *
 * The marker is per prompt and lives in the temp directory: it must not touch
 * the project, because the harness refuses to start on a dirty tree and this
 * hook has no business dirtying anyone's repository.
 */
function alreadyBlocked(promptId) {
    if (!promptId)
        return false;
    const marker = path.join(MARKER_DIR, `${promptId.replace(/[^\w-]/g, "")}.blocked`);
    if (fs.existsSync(marker))
        return true;
    try {
        fs.mkdirSync(MARKER_DIR, { recursive: true });
        fs.writeFileSync(marker, "", "utf8");
    }
    catch {
        // If the marker cannot be written, err towards not blocking: a session that
        // cannot be ended is a worse failure than a gate finding that goes unsaid.
        return true;
    }
    return false;
}
/** Turn the validator's diagnostics into something an agent can act on. */
function renderFindings(diagnostics) {
    const lines = ["The spec gate is failing, so this work is not finished:", ""];
    for (const d of diagnostics.slice(0, 10)) {
        lines.push(`  • [${d.code ?? "error"}] ${d.message ?? ""}`);
        if (d.fix)
            lines.push(`    fix: ${d.fix}`);
    }
    if (diagnostics.length > 10)
        lines.push(`  … and ${diagnostics.length - 10} more.`);
    lines.push("", "Run `specgate validate . --strict` to see all of it.");
    return lines.join("\n");
}
/**
 * Run the gate and decide.
 *
 * @param runValidate injected so the decision is testable without a CLI
 */
function decide(input, runValidate, blockedAlready) {
    const cwd = input.cwd ?? process.cwd();
    let gate;
    try {
        gate = runValidate(cwd);
    }
    catch {
        // Not a spec-driven project, or no CLI on PATH. Say nothing.
        return { block: false, message: "" };
    }
    if (gate.ok)
        return { block: false, message: "" };
    const findings = renderFindings(gate.diagnostics);
    if (blockedAlready(input.prompt_id ?? "")) {
        // Told once already. Let the human see the answer rather than looping.
        return { block: false, message: findings };
    }
    return { block: true, message: findings };
}
function runValidate(cwd) {
    if (!fs.existsSync(path.join(cwd, "spec.md")))
        throw new Error("not a spec-driven project");
    const r = (0, node_child_process_1.spawnSync)("npx", ["--no-install", "specgate", "validate", cwd, "--strict", "--json"], {
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
    });
    if (r.error || typeof r.status !== "number")
        throw new Error("could not run specgate");
    let parsed;
    try {
        parsed = JSON.parse(r.stdout);
    }
    catch {
        throw new Error("specgate validate did not emit one JSON document");
    }
    const diagnostics = (parsed.status ?? []).filter((d) => d.severity === "error");
    return { ok: r.status === 0, diagnostics };
}
function main(raw) {
    let input;
    try {
        input = JSON.parse(raw);
    }
    catch {
        return 0;
    }
    const decision = decide(input, runValidate, alreadyBlocked);
    if (decision.message)
        process.stderr.write(`${decision.message}\n`);
    return decision.block ? 2 : 0;
}
if (require.main === module) {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => {
        raw += c;
    });
    process.stdin.on("end", () => process.exit(main(raw)));
}
//# sourceMappingURL=gate-hook.js.map