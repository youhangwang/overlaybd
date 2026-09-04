import * as path from "node:path";
import { getWolfDir, ensureWolfDir, readJSON, appendMarkdown, timeShort, readStdin } from "./shared.js";
import { buildSessionEntry, flushSessionToLedger } from "./ledger.js";
// SessionEnd hook: final ledger flush + the single "Session end" line in
// memory.md. Fires on clear/logout/exit (not on SIGKILL — the per-turn Stop
// upsert already left a correct ledger entry for that case). Writing the
// memory line here instead of on every Stop is what keeps memory.md from
// growing one summary line per turn.
async function main() {
    ensureWolfDir();
    const wolfDir = getWolfDir();
    const sessionFile = path.join(wolfDir, "hooks", "_session.json");
    let hookInput = {};
    try {
        hookInput = JSON.parse(await readStdin());
    }
    catch { }
    const session = readJSON(sessionFile, null);
    if (!session || !session.session_id) {
        process.exit(0);
        return;
    }
    const readCount = Object.keys(session.files_read ?? {}).length;
    const writeCount = (session.files_written ?? []).length;
    if (readCount === 0 && writeCount === 0) {
        process.exit(0);
        return;
    }
    const entry = buildSessionEntry(session, hookInput.transcript_path);
    flushSessionToLedger(wolfDir, entry);
    if (writeCount > 0) {
        try {
            const uniqueFiles = new Set(session.files_written.map((w) => path.basename(w.file)));
            const fileList = [...uniqueFiles].slice(0, 5).join(", ");
            const tokens = entry.totals.input_tokens_estimated + entry.totals.output_tokens_estimated;
            appendMarkdown(path.join(wolfDir, "memory.md"), `| ${timeShort()} | Session end: ${writeCount} writes across ${uniqueFiles.size} files (${fileList}) | ${readCount} reads | ~${tokens} tok |\n`);
        }
        catch { }
    }
    process.exit(0);
}
main().catch(() => process.exit(0));
//# sourceMappingURL=session-end.js.map