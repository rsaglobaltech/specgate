"use strict";
/**
 * outside-judge REQ-746: the acts that are a person's — approving a change,
 * switching the guard, saying the steps were reviewed, writing the files the
 * controls keep. Pure: a shell command's text, or a written path, in; the act
 * out. A command can be disguised; the judge outside the session (REQ-747) is
 * the control that does not take its word.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.personActInShell = personActInShell;
exports.personActInWrite = personActInWrite;
exports.personActMessage = personActMessage;
/** The files the controls keep, as a path relative to the project. */
const CONTROL_FILE = /(?:^|[\s"'=/(])((?:\.\/)?\.specgate(?:\/(?:config\.json|gate\.yaml|evidence(?:\/[^\s"');|&]*)?))?|[^\s"');|&]*approvals\.json)(?=$|[\s"');|&])/;
/** Words that change a file: a command, an in-place edit, a call of a script's. */
const WRITES = /(?:^|[\s;&|(`$])(?:rm|mv|cp|unlink|truncate|rmdir|tee|chmod|touch|dd|install|ln)(?=\s)|\bsed\s+(?:-[a-zA-Z]*i|--in-place)|\bgit\s+(?:clean|checkout|restore|rm|stash|reset)\b|\b(?:rmSync|rmdirSync|unlinkSync|writeFileSync|appendFileSync|renameSync|rmtree|os\.remove|os\.unlink|shutil\.move)\b/;
/** A redirect whose target is one of the controls' files. */
const REDIRECT_TO_CONTROL = />>?\s*["']?(?:\.\/)?(?:[^\s"';|&]*\/)?(?:\.specgate(?:\/[^\s"';|&]*)?|approvals\.json)/;
/** One command of a line: what `;`, `&&`, `||`, `|` and a new line separate. */
function parts(command) {
    return command.split(/\n|;|&&|\|\||\|/).map((p) => p.trim()).filter(Boolean);
}
/** The act of a person's a shell command does, or null. */
function personActInShell(command) {
    const text = String(command || "");
    if (/\bchange\s+approve\b/.test(text))
        return { act: "approve", what: "change approve" };
    // The line a change with no layer written is approved by.
    if (/\bapproved\s*:/.test(text) && /change\.yaml\b/.test(text))
        return { act: "approve", what: "approved: in change.yaml" };
    if (/\bconfig\s+set\s+agent_guard\b/.test(text))
        return { act: "guard", what: "config set agent_guard" };
    if (/\bSPECGATE_GUARD\s*=/.test(text))
        return { act: "guard", what: "SPECGATE_GUARD" };
    if (/\b(?:apply|done)\b[^\n;|&]*--steps-reviewed\b/.test(text))
        return { act: "steps-review", what: "--steps-reviewed" };
    if (/\bSPECGATE_ASSUME_TTY\s*=/.test(text))
        return { act: "steps-review", what: "SPECGATE_ASSUME_TTY" };
    for (const part of parts(text)) {
        const named = CONTROL_FILE.exec(part);
        if (named && WRITES.test(part))
            return { act: "controls-file", what: named[1].replace(/^\.\//, "") };
        const to = REDIRECT_TO_CONTROL.exec(part);
        if (to)
            return { act: "controls-file", what: to[0].replace(/^>>?\s*["']?(?:\.\/)?/, "") };
    }
    return null;
}
/** The act of a person's writing this file is, or null. `text` is what the call writes, when it says. */
function personActInWrite(relPath, text = "") {
    const p = String(relPath || "").replace(/\\/g, "/").replace(/^\.\//, "");
    if (/^\.specgate\/(config\.json|gate\.yaml)$/.test(p) || /^\.specgate\/evidence\//.test(p))
        return { act: "controls-file", what: p };
    if (/(^|\/)docs\/specs\/changes\/[^/]+\/approvals\.json$/.test(p))
        return { act: "approve", what: p };
    if (/(^|\/)docs\/specs\/changes\/[^/]+\/change\.yaml$/.test(p) && /^\s*approved\s*:/m.test(text))
        return { act: "approve", what: p };
    return null;
}
/** What the session is told: the act is a person's, and what to do instead. */
function personActMessage(found) {
    switch (found.act) {
        case "approve":
            return `specgate: approving a change is a person's, not the session's (${found.what}). Say what waits for approval and stop: the person approves it themselves.`;
        case "guard":
            return `specgate: switching the guard is a person's, not the session's (${found.what}). Do what the guard asked for, or say why you cannot and stop.`;
        case "steps-review":
            return `specgate: saying the steps were reviewed is a person's, not the session's (${found.what}). Put the steps back and make the code pass them, or say what changed and stop: the person reads them.`;
        default:
            return `specgate: ${found.what} is kept by the controls, and is not the session's to write, move or remove. Reading it is allowed.`;
    }
}
//# sourceMappingURL=person-acts.js.map