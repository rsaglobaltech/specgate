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
const person_acts_1 = require("./person-acts");
/** The tools that write a file, and where each names it. */
const WRITERS = {
    Write: "file_path",
    Edit: "file_path",
    MultiEdit: "file_path",
    NotebookEdit: "notebook_path",
};
/** The tools that run a command: they write files no hook sees (shortcut-proof REQ-742). */
const SHELLS = new Set(["Bash"]);
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
/**
 * Does any of these files, read from `root`, name one of the ids? The tests
 * offered are the ones new or changed in the working tree and — sealed-acceptance
 * REQ-760 — the acceptance tests a person sealed: they came first by design.
 */
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
/**
 * REQ-742: a shell call is judged by the working tree, not by its command — a
 * file written with `cat >` is written all the same. While the tree holds
 * changed source and no changed test names a requirement of the open change,
 * the shell waits; reading and writing the test do not come through here.
 */
function shellDecision(cwd, env) {
    if (!(0, project_state_1.isSpecDriven)(cwd) || (0, project_state_1.guardOff)(cwd, env))
        return ALLOW;
    const changed = (0, project_state_1.changedFiles)(cwd);
    if (changed === null)
        return ALLOW;
    const source = changed.filter(project_state_1.needsTest);
    if (!source.length)
        return ALLOW;
    const changes = (0, project_state_1.openChanges)(cwd);
    const owner = changes.find((c) => c.pending.length);
    if (!owner)
        return ALLOW;
    const next = owner.pending[0];
    // REQ-743: the code has begun, whatever wrote it.
    (0, project_state_1.recordSteps)(cwd, next, env);
    const ids = changes.flatMap((c) => c.requirements);
    if (namesAny(cwd, [...changed.filter(project_state_1.isTestFile), ...(0, project_state_1.sealedTests)(cwd)], ids))
        return ALLOW;
    return {
        allow: false,
        file: source[0],
        message: `specgate: ${source[0]} was written before its test — change \`${owner.id}\`, ${next} next in its tasks. ` +
            `Write the test that names ${next} with your file tool; until a test new or changed in the working tree names a requirement of \`${owner.id}\`, ` +
            "the shell waits: reading files and writing that test are allowed. ",
    };
}
/** Words of a shell command that write, move onto, remove or check out a file. */
const SHELL_WRITES = /(?:^|[\s;&|(`$])(?:rm|mv|cp|unlink|truncate|tee|chmod|touch|dd|install|ln|patch)(?=\s)|\bsed\s+(?:-[a-zA-Z]*i|--in-place)|\bperl\s+-[a-zA-Z]*i|\bgit\s+(?:checkout|restore|rm|stash|reset|apply|mv)\b|\b(?:rmSync|unlinkSync|writeFileSync|appendFileSync|renameSync|copyFileSync|os\.remove|os\.unlink|shutil\.move|shutil\.copy\w*|write_text)\b/;
/** sealed-acceptance REQ-760: the message for a sealed test. */
const sealedMessage = (file) => `specgate: acceptance_sealed — ${file} is an acceptance test a person approved and sealed: it is the contract, not the session's to write, move or remove. ` +
    "Make the code pass it. If the test itself is wrong, say so and stop: changing it is a change of contract, and a person approves it again (specgate change approve <id> --layer acceptance). Reading it is allowed.";
/** sealed-acceptance REQ-760: the call writes a sealed acceptance test — refused. */
function sealedWrite(input, env) {
    const cwd = input.cwd ?? process.cwd();
    const tool = input.tool_name ?? "";
    const args = (input.tool_input ?? {});
    const sealed = (0, project_state_1.sealedTests)(cwd);
    if (!sealed.length)
        return null;
    let file;
    if (SHELLS.has(tool)) {
        if (typeof args.command !== "string")
            return null;
        const command = args.command.replace(/\\/g, "/");
        for (const part of command.split(/\n|;|&&|\|\||\|/)) {
            const words = part.trim().split(/\s+/);
            const named = (f, text) => text.includes(f) || text.includes(path.basename(f));
            // A redirect onto it.
            file = sealed.find((f) => [...part.matchAll(/>>?\s*["']?([^\s"';|&]+)/g)].some((m) => named(f, m[1])));
            // A copy, a link or an install writes its last word only: copying the test away reads it.
            if (!file && /^(?:cp|install|ln)$/.test(words[0] ?? ""))
                file = sealed.find((f) => named(f, words[words.length - 1] ?? ""));
            else if (!file && SHELL_WRITES.test(part))
                file = sealed.find((f) => named(f, part));
            if (file)
                break;
        }
    }
    else {
        const key = WRITERS[tool];
        const target = key ? args[key] : undefined;
        if (typeof target !== "string" || !target)
            return null;
        const rel = path
            .relative(real(cwd), real(path.isAbsolute(target) ? target : path.join(cwd, target)))
            .replace(/\\/g, "/");
        file = sealed.find((f) => f === rel);
    }
    if (!file || (0, project_state_1.guardOff)(cwd, env))
        return null;
    return { allow: false, file, message: sealedMessage(file) };
}
/** outside-judge REQ-746: the call does what is a person's to do — refused, saying so. */
function personAct(input, env) {
    const cwd = input.cwd ?? process.cwd();
    const tool = input.tool_name ?? "";
    const args = (input.tool_input ?? {});
    let found = null;
    let file;
    if (SHELLS.has(tool)) {
        if (typeof args.command !== "string")
            return null;
        found = (0, person_acts_1.personActInShell)(args.command);
    }
    else {
        const key = WRITERS[tool];
        const target = key ? args[key] : undefined;
        if (typeof target !== "string" || !target)
            return null;
        const rel = path.relative(real(cwd), real(path.isAbsolute(target) ? target : path.join(cwd, target)));
        if (rel.startsWith("..") || path.isAbsolute(rel))
            return null;
        const text = ["content", "new_string", "newString", "patchText"]
            .map((k) => (typeof args[k] === "string" ? args[k] : ""))
            .join("\n");
        found = (0, person_acts_1.personActInWrite)(rel, text);
        file = rel;
    }
    if (!found || !(0, project_state_1.isSpecDriven)(cwd) || (0, project_state_1.guardOff)(cwd, env))
        return null;
    return { allow: false, file: file ?? found.what, message: (0, person_acts_1.personActMessage)(found) };
}
/** A patch: the first of its files that is refused answers for it. */
function patchDecision(input, env) {
    const args = (input.tool_input ?? {});
    const patch = [args.command, args.patch, args.input, args.patchText].find((v) => typeof v === "string");
    if (!patch)
        return ALLOW;
    for (const file of (0, project_state_1.patchFiles)(patch)) {
        const d = decide({ cwd: input.cwd, tool_name: "Write", tool_input: { file_path: file, patchText: patch } }, env);
        if (!d.allow)
            return { ...d, file: d.file ?? file };
    }
    return ALLOW;
}
/** Allow or refuse one tool call. `env` is injected so tests do not depend on the shell. */
function decide(input, env) {
    // codex-guard REQ-751: Codex's patch is a write to each file it adds, updates or moves to.
    if (input.tool_name === "apply_patch")
        return patchDecision(input, env);
    try {
        const act = personAct(input, env);
        if (act)
            return act;
        const sealed = sealedWrite(input, env);
        if (sealed)
            return sealed;
        if (SHELLS.has(input.tool_name ?? ""))
            return shellDecision(input.cwd ?? process.cwd(), env);
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
                    "Open one with `specgate propose <change-id>` and write its delta, then the test that names its first requirement, then this code. ",
            };
        }
        const ids = changes.flatMap((c) => c.requirements);
        if (ids.length && namesAny(cwd, [...changed.filter(project_state_1.isTestFile), ...(0, project_state_1.sealedTests)(cwd)], ids)) {
            // REQ-743: the first source write of the delivery — its steps as they are now.
            const first = changes.find((c) => c.pending.length)?.pending[0];
            if (first)
                (0, project_state_1.recordSteps)(cwd, first, env);
            return ALLOW;
        }
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
    const file = decision.file ??
        String(input.tool_input?.file_path ?? "");
    if (decision.allow) {
        // A shell call that is let through is not a write: nothing to record.
        if (!SHELLS.has(input.tool_name ?? ""))
            (0, project_state_1.hookLog)({ hook: "guard", decision: "allowed", file }, env);
        return 0;
    }
    (0, project_state_1.hookLog)({ hook: "guard", decision: "refused", file, reason: decision.message }, env);
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