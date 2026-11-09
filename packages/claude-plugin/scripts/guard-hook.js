#!/usr/bin/env node
"use strict";
/**
 * The `PreToolUse` hook: an edit to source code waits for a test that names
 * the requirement (REQ-421).
 *
 * The loop says the test comes first, and `AGENTS.md` says so in words. Words
 * did not stop an agent on 2026-11-07 from writing the implementation right
 * after `specgate propose`. This does: while no change is open, or no test new
 * or modified in the working tree names one of its requirements, a write to a
 * source file is refused, with the step to take instead.
 *
 * Contract: stdin is JSON with `cwd`, `tool_name` and `tool_input`; exit 2
 * refuses the tool call and stderr is what the agent reads; exit 0 allows it.
 * Anything unexpected allows it — a guard that breaks a session over a
 * missing file is worse than none.
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
exports.decide = decide;
exports.main = main;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const project_state_1 = require("./project-state");
/** The tools that write a file, and where each names it. */
const WRITERS = {
    Write: "file_path",
    Edit: "file_path",
    MultiEdit: "file_path",
    NotebookEdit: "notebook_path",
};
const ALLOW = { allow: true, message: "" };
/** A path with its symlinks resolved as far as it exists (`/var` is `/private/var` on macOS). */
function real(p) {
    let dir = path.resolve(p);
    const rest = [];
    while (!fs.existsSync(dir) && path.dirname(dir) !== dir) {
        rest.unshift(path.basename(dir));
        dir = path.dirname(dir);
    }
    return path.join(fs.realpathSync.native(dir), ...rest);
}
/** Does any of these files, read from `root`, name one of the ids? */
function namesAny(root, files, ids) {
    // Requirement ids are `REQ-` and digits: nothing in them needs escaping, and
    // anything else is not a requirement id.
    const valid = ids.filter((i) => /^REQ-\d+$/.test(i));
    if (!valid.length)
        return false;
    const pattern = new RegExp(`\\b(${valid.join("|")})\\b`);
    return files.some((f) => {
        try {
            return pattern.test(fs.readFileSync(path.join(root, f), "utf8"));
        }
        catch {
            return false;
        }
    });
}
/** Allow or refuse one tool call. `env` is injected so tests do not depend on the shell. */
function decide(input, env) {
    try {
        const key = WRITERS[input.tool_name ?? ""];
        const target = key ? input.tool_input?.[key] : undefined;
        if (typeof target !== "string" || !target)
            return ALLOW;
        const cwd = input.cwd ?? process.cwd();
        if (!(0, project_state_1.isSpecDriven)(cwd) || (0, project_state_1.guardOff)(cwd, env))
            return ALLOW;
        const root = real(cwd);
        const rel = path.relative(root, real(path.isAbsolute(target) ? target : path.join(cwd, target)));
        if (rel.startsWith("..") || path.isAbsolute(rel) || !(0, project_state_1.needsTest)(rel))
            return ALLOW;
        const changed = (0, project_state_1.changedFiles)(cwd);
        if (changed === null)
            return ALLOW;
        const changes = (0, project_state_1.openChanges)(cwd);
        if (!changes.length) {
            return {
                allow: false,
                message: `specgate: No change is open, so ${rel} has no requirement to answer to. ` +
                    "Open one with `specgate propose <change-id>` and write its delta, then the test that names its first requirement, then this code. " +
                    "(Turn the guard off for this project with `specgate config set agent_guard off`.)",
            };
        }
        const ids = changes.flatMap((c) => c.requirements);
        if (ids.length && namesAny(cwd, changed.filter(project_state_1.isTestFile), ids))
            return ALLOW;
        const owner = changes.find((c) => c.pending.length) ?? changes[0];
        // The next requirement as the change's tasks order it (REQ-426).
        const next = owner.pending[0];
        if (!next && owner.requirements.length) {
            // Everything applied: no requirement to name (REQ-427).
            return {
                allow: false,
                message: `specgate: every requirement of \`${owner.id}\` is applied, so ${rel} has no requirement to answer to. ` +
                    `The change is ready for its reviewer: \`specgate archive ${owner.id}\` once they agree. ` +
                    "New work opens a change: `specgate propose <change-id>`, its delta, then the test, then this code.",
            };
        }
        return {
            allow: false,
            message: next
                ? `specgate: write the test for ${next} first — change \`${owner.id}\`, next in its tasks. ` +
                    `The link is a test that names any requirement of \`${owner.id}\`, new or changed in the working tree; then ${rel} is allowed, then \`specgate apply\` for that requirement.`
                : `specgate: change \`${owner.id}\` has no requirement yet. Write its delta first (\`specgate change instructions specs ${owner.id}\`), then the test, then ${rel}.`,
        };
    }
    catch {
        return ALLOW;
    }
}
function main(raw, env = process.env) {
    let input;
    try {
        input = JSON.parse(raw);
    }
    catch {
        return 0;
    }
    const decision = decide(input, env);
    if (decision.allow)
        return 0;
    process.stderr.write(`${decision.message}\n`);
    return 2;
}
if (require.main === module) {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => {
        raw += c;
    });
    process.stdin.on("end", () => process.exit(main(raw)));
}
//# sourceMappingURL=guard-hook.js.map