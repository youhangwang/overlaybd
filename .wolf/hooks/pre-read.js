import * as fs from "node:fs";
import * as path from "node:path";
import { getWolfDir, ensureWolfDir, readJSON, writeJSON, readStdin, normalizePath, getProjectDir, emitHookJSON } from "./shared.js";
import { lookupEntry } from "./anatomy-store.js";
function duplicateMode(wolfDir) {
    const cfg = readJSON(path.join(wolfDir, "config.json"), {});
    const mode = cfg.openwolf?.reads?.duplicate_mode;
    return mode === "deny" || mode === "off" ? mode : "warn";
}
async function main() {
    ensureWolfDir();
    const wolfDir = getWolfDir();
    const hooksDir = path.join(wolfDir, "hooks");
    const sessionFile = path.join(hooksDir, "_session.json");
    const raw = await readStdin();
    let input;
    try {
        input = JSON.parse(raw);
    }
    catch {
        process.exit(0);
        return;
    }
    const filePath = input.tool_input?.file_path ?? input.tool_input?.path ?? "";
    if (!filePath) {
        process.exit(0);
        return;
    }
    // Ranged reads (offset/limit) are exactly what the symbol hints steer the
    // model toward — never warn about, deny, or record them as full reads (a
    // ranged first contact must not make a later legitimate full read look like
    // a duplicate).
    const isRangedRead = input.tool_input?.offset !== undefined || input.tool_input?.limit !== undefined;
    // Subagents share this session file but not the main thread's context: a
    // file the main thread read is unseen by a fresh subagent, so duplicate
    // handling stays hands-off for them.
    const isSubagent = typeof input.agent_id === "string" && input.agent_id.length > 0;
    const normalizedFile = normalizePath(filePath);
    // Skip tracking for .wolf/ internal files — they're infrastructure, not project files.
    // Counting them inflates anatomy miss rates since .wolf/ is excluded from anatomy scanning.
    const projectDir = normalizePath(getProjectDir());
    const relToProject = normalizedFile.startsWith(projectDir)
        ? normalizedFile.slice(projectDir.length).replace(/^\//, "")
        : "";
    if (relToProject.startsWith(".wolf/") || relToProject.startsWith(".wolf\\")) {
        process.exit(0);
        return;
    }
    if (isRangedRead) {
        process.exit(0);
        return;
    }
    const session = readJSON(sessionFile, {
        session_id: "", files_read: {}, anatomy_hits: 0, anatomy_misses: 0,
        repeated_reads_warned: 0,
    });
    // Model-visible notes for this run — flushed as ONE additionalContext at exit.
    const notes = [];
    // Check if already read this session
    if (session.files_read[normalizedFile]) {
        const prev = session.files_read[normalizedFile];
        let modifiedSinceRead = true;
        try {
            const mtime = fs.statSync(filePath).mtimeMs;
            modifiedSinceRead = prev.read_mtime === undefined || mtime > prev.read_mtime;
        }
        catch { }
        if (!modifiedSinceRead) {
            const mode = duplicateMode(wolfDir);
            session.repeated_reads_warned++;
            // Denial is the only path that actually saves the tokens, but it must
            // never strand the model: full reads only (ranged reads exited above),
            // main thread only, only when the earlier read verifiably delivered
            // content (tokens > 0), never after a compaction evicted that content,
            // and only ONCE per file per session — the next attempt passes through.
            const denyEligible = mode === "deny" && !isSubagent && prev.tokens > 0 &&
                prev.denied_once !== true && prev.compacted !== true;
            if (denyEligible) {
                prev.denied_once = true;
                session.reads_denied = (session.reads_denied ?? 0) + 1;
                session.denied_tokens_saved = (session.denied_tokens_saved ?? 0) + prev.tokens;
                writeJSON(sessionFile, session);
                emitHookJSON("PreToolUse", {
                    permissionDecision: "deny",
                    permissionDecisionReason: `OpenWolf: ${path.basename(normalizedFile)} was already read this session (~${prev.tokens} tok) and is unchanged on disk. Reuse your earlier read, or use offset/limit for the exact lines you need. If you do need the full file again, a second attempt will pass through.`,
                });
                process.exit(0);
                return;
            }
            prev.count++;
            if (mode !== "off") {
                notes.push(`OpenWolf: ${path.basename(normalizedFile)} was already read this session (~${prev.tokens} tok), unchanged since. If you only need the gist, your earlier read may suffice; for exact text (edit anchors, line numbers), the re-read is fine.`);
            }
            writeJSON(sessionFile, session);
            if (notes.length > 0) {
                emitHookJSON("PreToolUse", { additionalContext: notes.join("\n") });
            }
            process.exit(0);
            return;
        }
        delete session.files_read[normalizedFile];
    }
    // Anatomy lookup: O(1) against the durable store, legacy md scan fallback.
    const entry = lookupEntry(wolfDir, projectDir, normalizedFile);
    const found = entry !== null;
    if (entry) {
        if (entry.description) {
            notes.push(`OpenWolf anatomy: ${entry.file}: ${entry.description} (~${entry.tokens} tok)`);
        }
        // Symbol hint (F2b Phase B): point at slices of big files. Suppressed if
        // the on-disk file no longer matches what was indexed — a stale line
        // range that misdirects an offset read is worse than no hint at all.
        if (entry.symbols && entry.symbols.length > 0) {
            let fresh = false;
            try {
                const st = fs.statSync(filePath);
                fresh = (entry.size === undefined || st.size === entry.size) &&
                    (entry.mtimeMs === undefined || Math.abs(st.mtimeMs - entry.mtimeMs) < 1);
            }
            catch { }
            if (fresh) {
                const top = [...entry.symbols].sort((a, b) => b.tokens - a.tokens).slice(0, 5);
                const list = top.map((s) => `${s.kind} ${s.name} L${s.startLine}-${s.endLine} ~${s.tokens} tok`).join("; ");
                notes.push(`Largest sections: ${list}. Read with offset/limit to fetch just the part you need.`);
            }
        }
    }
    if (found) {
        session.anatomy_hits++;
    }
    else {
        session.anatomy_misses++;
    }
    // Record initial read entry (tokens will be updated in post-read)
    let readMtime;
    try {
        readMtime = fs.statSync(filePath).mtimeMs;
    }
    catch { }
    session.files_read[normalizedFile] = {
        count: 1,
        tokens: 0,
        first_read: new Date().toISOString(),
        read_mtime: readMtime,
        anatomy_hit: found,
    };
    writeJSON(sessionFile, session);
    if (notes.length > 0) {
        emitHookJSON("PreToolUse", { additionalContext: notes.join("\n") });
    }
    process.exit(0);
}
main().catch(() => process.exit(0));
//# sourceMappingURL=pre-read.js.map