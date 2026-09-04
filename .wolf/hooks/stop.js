import * as fs from "node:fs";
import * as path from "node:path";
import { getWolfDir, ensureWolfDir, readJSON, writeJSON, countSemanticEntries, readStdin } from "./shared.js";
import { buildSessionEntry, flushSessionToLedger } from "./ledger.js";
async function main() {
    ensureWolfDir();
    const wolfDir = getWolfDir();
    const hooksDir = path.join(wolfDir, "hooks");
    const sessionFile = path.join(hooksDir, "_session.json");
    // Stop payload → transcript path for real usage measurement (F1)
    let hookInput = {};
    try {
        hookInput = JSON.parse(await readStdin());
    }
    catch { }
    const session = readJSON(sessionFile, {
        session_id: "",
        started: "",
        files_read: {},
        files_written: [],
        edit_counts: {},
        anatomy_hits: 0,
        anatomy_misses: 0,
        repeated_reads_warned: 0,
        cerebrum_warnings: 0,
        stop_count: 0,
        reminders_sent: {},
    });
    session.stop_count++;
    // Only write to ledger if there's been activity
    const readCount = Object.keys(session.files_read).length;
    const writeCount = session.files_written.length;
    if (readCount === 0 && writeCount === 0) {
        writeJSON(sessionFile, session);
        process.exit(0);
        return;
    }
    // Collect end-of-turn reminders. Each fires at most ONCE per session, and
    // they are QUEUED rather than emitted: Stop additionalContext forces a full
    // continuation turn (the model re-sends the whole conversation to respond),
    // so the UserPromptSubmit hook drains the queue into the next user turn's
    // context instead — same visibility, zero extra turns.
    if (!session.reminders_sent)
        session.reminders_sent = {};
    const reminderChecks = [
        ["buglog", checkForMissingBugLogs(wolfDir, session)],
        ["cerebrum", checkCerebrumFreshness(wolfDir, session)],
        ["semantic", checkSemanticSummaries(wolfDir, session)],
        ["status", checkStatusFreshness(wolfDir, session)],
    ];
    const reminders = [];
    for (const [key, message] of reminderChecks) {
        if (message === null)
            continue;
        const sent = session.reminders_sent[key] ?? 0;
        if (sent >= 1)
            continue;
        session.reminders_sent[key] = sent + 1;
        reminders.push(message);
    }
    if (reminders.length > 0) {
        if (!session.pending_reminders)
            session.pending_reminders = [];
        session.pending_reminders.push(`OpenWolf end-of-turn reminders:\n${reminders.map((r) => `- ${r}`).join("\n")}`);
    }
    // Idempotent ledger write: the entry for this session id is REPLACED, not
    // appended — Stop fires every turn, and appending per turn is what used to
    // duplicate sessions and quadratically inflate lifetime totals.
    const entry = buildSessionEntry(session, hookInput.transcript_path);
    flushSessionToLedger(wolfDir, entry);
    writeJSON(sessionFile, session);
    process.exit(0);
}
/**
 * Check if files were edited multiple times but buglog.json wasn't updated.
 * Returns a reminder string if action is needed, otherwise null.
 */
function checkForMissingBugLogs(wolfDir, session) {
    if (!session.edit_counts)
        return null;
    const multiEditFiles = Object.entries(session.edit_counts)
        .filter(([, count]) => count >= 3)
        .map(([file]) => path.basename(file));
    if (multiEditFiles.length === 0)
        return null;
    let buglogWritten = false;
    try {
        const stat = fs.statSync(path.join(wolfDir, "buglog.json"));
        const sessionStartMs = session.started ? Date.parse(session.started) : 0;
        buglogWritten = sessionStartMs > 0 && stat.mtimeMs >= sessionStartMs;
    }
    catch { }
    if (!buglogWritten) {
        return `ACTION REQUIRED: Files edited 3+ times this session (${multiEditFiles.join(", ")}) but buglog.json was not updated. Log the bug fixes to .wolf/buglog.json now.`;
    }
    return null;
}
/**
 * Check if STATUS.md is older than the session start AND there was meaningful
 * code activity (3+ writes outside .wolf/). If so, nudge Claude to update
 * STATUS.md so the next /clear has fresh handoff context.
 */
function checkStatusFreshness(wolfDir, session) {
    const statusPath = path.join(wolfDir, "STATUS.md");
    const codeWrites = session.files_written.filter((w) => !w.file.includes("/.wolf/") && !w.file.endsWith(".tmp"));
    if (codeWrites.length < 3)
        return null;
    try {
        const stat = fs.statSync(statusPath);
        const sessionStartMs = session.started ? Date.parse(session.started) : 0;
        if (!sessionStartMs)
            return null;
        if (stat.mtimeMs < sessionStartMs) {
            return `STATUS.md not updated this session despite ${codeWrites.length} code writes. Update .wolf/STATUS.md (done / next quest) so the next session resumes in one read.`;
        }
        return null;
    }
    catch {
        // STATUS.md doesn't exist yet.
        return `.wolf/STATUS.md missing. Create it with the current quest summary and next steps so /clear stays cheap.`;
    }
}
/**
 * Check if cerebrum.md was updated recently. If it hasn't been updated in
 * a while and there was significant activity, return a reminder.
 */
function checkCerebrumFreshness(wolfDir, session) {
    const cerebrumPath = path.join(wolfDir, "cerebrum.md");
    try {
        const stat = fs.statSync(cerebrumPath);
        const hoursSinceUpdate = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);
        if (hoursSinceUpdate > 24 && session.files_written.length >= 3) {
            return `ACTION REQUIRED: cerebrum.md hasn't been updated in ${Math.floor(hoursSinceUpdate)}h and ${session.files_written.length} files were modified. Update .wolf/cerebrum.md with any new user preferences, conventions, or gotchas discovered this session.`;
        }
    }
    catch {
        // cerebrum.md doesn't exist, that's ok
    }
    return null;
}
/**
 * Check if a semantic summary was written to memory.md this session.
 * Returns a reminder string if action is needed, otherwise null.
 */
function checkSemanticSummaries(wolfDir, session) {
    const writeCount = session.files_written.length;
    if (writeCount < 2)
        return null;
    const semanticCount = countSemanticEntries(wolfDir);
    if (semanticCount === 0) {
        return `ACTION REQUIRED: ${writeCount} files were modified this session but no semantic summary was written to memory.md. Append a one-line summary: | HH:MM | description | file(s) | outcome | ~tokens |`;
    }
    return null;
}
// Run only when executed as a hook script — never on import (tests import
// from this module, and main() exits the process).
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(() => process.exit(0));
}
//# sourceMappingURL=stop.js.map