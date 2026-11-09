"use strict";
/**
 * What the agent guards need to know about a project, read from its files.
 *
 * The hooks run on every session start and every edit, so they read
 * `docs/specs/changes/` themselves rather than spawning the CLI: a guard that
 * costs a second per edit gets switched off. Like every plugin script, this
 * file imports nothing but Node's own modules — it is copied into the plugin
 * and has to work on a machine where the CLI is not installed.
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
exports.isSpecDriven = isSpecDriven;
exports.deltaRequirements = deltaRequirements;
exports.taskOrder = taskOrder;
exports.openChanges = openChanges;
exports.guardOff = guardOff;
exports.isTestFile = isTestFile;
exports.needsTest = needsTest;
exports.changedFiles = changedFiles;
exports.specgateCommand = specgateCommand;
exports.runSpecgate = runSpecgate;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_child_process_1 = require("node:child_process");
/** Statuses that mean a requirement is delivered. */
const DONE = new Set(["Implemented", "Verified", "Released", "Deprecated"]);
/** Is this folder a spec-driven project? The same test the gate hook makes. */
function isSpecDriven(root) {
    return fs.existsSync(path.join(root, "spec.md"));
}
/** Every `spec.md` under a folder, in a stable order. */
function deltaFiles(dir) {
    if (!fs.existsSync(dir))
        return [];
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory())
            out.push(...deltaFiles(full));
        else if (entry.name === "spec.md")
            out.push(full);
    }
    return out.sort();
}
/** The requirements a delta declares, each with the status of its trace comment. */
function deltaRequirements(text) {
    const out = [];
    for (const block of text.split(/^(?=### Requirement: )/m)) {
        const id = /^### Requirement: (REQ-\d+)/.exec(block)?.[1];
        if (!id)
            continue;
        const status = /<!--\s*specgate:trace[^>]*\bstatus=([A-Za-z]+(?: [A-Za-z]+)*?)(?=\s+\w+=|\s*-->)/.exec(block)?.[1];
        out.push({ id, status: status ?? "Draft" });
    }
    return out;
}
/** The requirements the unchecked lines of a change's `tasks.md` name, in the file's order (REQ-426). */
function taskOrder(text) {
    const out = [];
    for (const line of text.split(/\r?\n/)) {
        if (!/^\s*[-*]\s+\[ \]/.test(line))
            continue;
        for (const m of line.matchAll(/\bREQ-\d+\b/g))
            if (!out.includes(m[0]))
                out.push(m[0]);
    }
    return out;
}
/** `pending` as the tasks order it: those an unchecked task names first, the rest in the delta's order. */
function byTasks(pending, tasksFile) {
    let tasks = [];
    try {
        tasks = taskOrder(fs.readFileSync(tasksFile, "utf8"));
    }
    catch {
        return pending;
    }
    const first = tasks.filter((id) => pending.includes(id));
    return [...first, ...pending.filter((id) => !first.includes(id))];
}
/** The changes open under `docs/specs/changes/`, the archive left out. */
function openChanges(root) {
    const dir = path.join(root, "docs", "specs", "changes");
    if (!fs.existsSync(dir))
        return [];
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name !== "archive")
        .map((e) => e.name)
        .sort()
        .map((id) => {
        const reqs = deltaFiles(path.join(dir, id, "specs")).flatMap((f) => deltaRequirements(fs.readFileSync(f, "utf8")));
        return {
            id,
            requirements: reqs.map((r) => r.id),
            pending: byTasks(reqs.filter((r) => !DONE.has(r.status)).map((r) => r.id), path.join(dir, id, "tasks.md")),
        };
    });
}
/** Is the guard turned off — by `SPECGATE_GUARD=off`, or `agent_guard: off` in `.specgate/config.json`? */
function guardOff(root, env) {
    if ((env.SPECGATE_GUARD ?? "").toLowerCase() === "off")
        return true;
    try {
        const config = JSON.parse(fs.readFileSync(path.join(root, ".specgate", "config.json"), "utf8"));
        return String(config.agent_guard ?? "").toLowerCase() === "off";
    }
    catch {
        return false;
    }
}
/** Files a test runner picks up, in the conventions of the stacks Specgate serves. */
function isTestFile(rel) {
    const p = rel.replace(/\\/g, "/");
    const name = p.slice(p.lastIndexOf("/") + 1);
    return (/(^|\/)(tests?|__tests__|spec|e2e)\//.test(p) ||
        /\.(test|spec|e2e)\.[cm]?[jt]sx?$/.test(name) ||
        /(Test|Tests|IT|TestCase|Spec)\.(java|kt|scala|groovy|cs)$/.test(name) ||
        /^test_.*\.py$|_test\.py$/.test(name) ||
        /_test\.go$/.test(name) ||
        /_spec\.rb$/.test(name) ||
        /\.feature$/.test(name));
}
/** Code the guard holds back until a test names the requirement: these extensions, outside the docs. */
const SOURCE = /\.([cm]?[jt]sx?|java|kt|kts|scala|groovy|py|go|rb|cs|php|rs|swift|c|cc|cpp|h|hpp|vue|svelte)$/;
/** Does an edit to `rel` (from the project root) wait for a test? */
function needsTest(rel) {
    const p = rel.replace(/\\/g, "/");
    if (p === "spec.md" || /^(features|docs)\//.test(p) || /(^|\/)\./.test(p))
        return false;
    return SOURCE.test(p) && !isTestFile(p);
}
/**
 * The files new or modified in the working tree, from the project root — or
 * null when git cannot say (no repository, no git), and the guard stands aside.
 */
function changedFiles(root) {
    const r = (0, node_child_process_1.spawnSync)("git", ["status", "--porcelain", "--untracked-files=all", "-z"], {
        cwd: root,
        encoding: "utf8",
        timeout: 10_000,
    });
    if (r.error || r.status !== 0)
        return null;
    const prefix = (0, node_child_process_1.spawnSync)("git", ["rev-parse", "--show-prefix"], { cwd: root, encoding: "utf8" });
    const under = prefix.status === 0 ? (prefix.stdout ?? "").trim() : "";
    const out = [];
    const entries = r.stdout.split("\0").filter(Boolean);
    for (let i = 0; i < entries.length; i++) {
        const status = entries[i].slice(0, 2);
        const file = entries[i].slice(3);
        // A rename is followed by its old name, which is not a file any more.
        if (status.includes("R") || status.includes("C"))
            i++;
        if (status.includes("D"))
            continue;
        if (under && !file.startsWith(under))
            continue;
        out.push(file.slice(under.length));
    }
    return out;
}
/**
 * How to start the CLI on this platform (REQ-424). On Windows `npx` is
 * `npx.cmd`, which Node will only spawn through a shell (CVE-2024-27980);
 * the arguments are fixed words and the project goes in as the working
 * directory, so nothing from outside reaches that command line.
 */
function specgateCommand(platform = process.platform) {
    return platform === "win32"
        ? { command: "npx.cmd", shell: true }
        : { command: "npx", shell: false };
}
/** Run `specgate <args>` in `cwd`, as installed in the project or on the PATH. */
function runSpecgate(args, cwd, opts = {}) {
    const { command, shell } = specgateCommand(opts.platform);
    const spawn = opts.spawn ?? node_child_process_1.spawnSync;
    return spawn(command, ["--no-install", "specgate", ...args], {
        cwd,
        shell,
        encoding: "utf8",
        timeout: opts.timeout ?? 120_000,
        maxBuffer: 16 * 1024 * 1024,
    });
}
//# sourceMappingURL=project-state.js.map