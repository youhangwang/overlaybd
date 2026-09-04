import * as path from "node:path";
import { readJSON, writeJSON, readTranscriptUsage, detectAgent } from "./shared.js";
import { withFileLock, HOOK_LOCK_BUDGET_MS } from "./anatomy-lock.js";
// ─────────────────────────────────────────────────────────────────────────────
// Token-ledger writer shared by the Stop and SessionEnd hooks.
//
// Stop fires at the end of EVERY turn, so the ledger write must be idempotent:
// the session entry is UPSERTED by session id (replaced, never appended), and
// lifetime totals are derived — archived baseline + fold over the retained
// sessions — rather than incremented. The old increment-on-every-Stop scheme
// re-added turns 1..N on turn N, quadratically inflating every lifetime metric
// and duplicating session entries.
// ─────────────────────────────────────────────────────────────────────────────
export const MAX_LEDGER_SESSIONS = 200;
export function emptyLedger() {
    return {
        version: 1,
        created_at: "",
        lifetime: {
            total_tokens_estimated: 0,
            total_reads: 0,
            total_writes: 0,
            total_sessions: 0,
            anatomy_hits: 0,
            anatomy_misses: 0,
            repeated_reads_blocked: 0,
            estimated_savings_vs_bare_cli: 0,
        },
        sessions: [],
        daemon_usage: [],
        waste_flags: [],
        optimization_report: { last_generated: null, patterns: [] },
    };
}
/** Build the ledger entry for the current session state (idempotent). */
export function buildSessionEntry(session, transcriptPath) {
    const reads = Object.entries(session.files_read).map(([file, data]) => ({
        file,
        tokens_estimated: data.tokens,
        was_repeated: data.count > 1,
        anatomy_had_description: data.anatomy_hit === true,
    }));
    const writes = session.files_written.map((w) => ({
        file: w.file,
        tokens_estimated: w.tokens,
        action: w.action,
    }));
    const entry = {
        id: session.session_id,
        agent: detectAgent(),
        started: session.started,
        ended: new Date().toISOString(),
        reads,
        writes,
        totals: {
            input_tokens_estimated: reads.reduce((sum, r) => sum + r.tokens_estimated, 0),
            output_tokens_estimated: writes.reduce((sum, w) => sum + w.tokens_estimated, 0),
            reads_count: reads.length,
            writes_count: writes.length,
            // Honest accounting: only reads the hook actually denied count as
            // blocked (warnings do not prevent the read from happening).
            repeated_reads_blocked: session.reads_denied ?? 0,
            anatomy_lookups: session.anatomy_hits,
            anatomy_misses: session.anatomy_misses,
            // Honest savings: tokens of reads that were denied, nothing else.
            savings_estimated: session.denied_tokens_saved ?? 0,
        },
    };
    if (transcriptPath) {
        // readTranscriptUsage dedupes by message id, so this is the cumulative
        // total for the whole session — correct to REPLACE, never to add.
        const real = readTranscriptUsage(transcriptPath);
        if (real)
            entry.real_usage = real;
    }
    return entry;
}
function addInto(target, key, value) {
    if (typeof value !== "number" || !isFinite(value))
        return;
    target[key] = (target[key] ?? 0) + value;
}
/** Copy only real numeric fields out of a possibly-partial totals object. */
function numericFields(source) {
    const out = {};
    for (const [k, v] of Object.entries(source ?? {})) {
        if (typeof v === "number" && isFinite(v))
            out[k] = v;
    }
    return out;
}
function foldEntry(acc, e) {
    addInto(acc, "total_tokens_estimated", e.totals.input_tokens_estimated + e.totals.output_tokens_estimated);
    addInto(acc, "total_reads", e.totals.reads_count);
    addInto(acc, "total_writes", e.totals.writes_count);
    addInto(acc, "anatomy_hits", e.totals.anatomy_lookups);
    addInto(acc, "anatomy_misses", e.totals.anatomy_misses);
    addInto(acc, "repeated_reads_blocked", e.totals.repeated_reads_blocked);
    addInto(acc, "estimated_savings_vs_bare_cli", e.totals.savings_estimated);
    if (e.real_usage) {
        addInto(acc, "real_input_tokens", e.real_usage.input_tokens);
        addInto(acc, "real_output_tokens", e.real_usage.output_tokens);
        addInto(acc, "real_cache_read_tokens", e.real_usage.cache_read_input_tokens);
        addInto(acc, "real_cache_creation_tokens", e.real_usage.cache_creation_input_tokens);
        addInto(acc, "real_api_calls", e.real_usage.api_calls);
    }
}
/**
 * Derive lifetime = baseline + fold(sessions). total_sessions is intentionally
 * NOT derived here — session-start counts it once per new session.
 */
export function recomputeLifetime(ledger) {
    const acc = numericFields(ledger.lifetime_baseline);
    delete acc.total_sessions;
    for (const e of ledger.sessions)
        foldEntry(acc, e);
    const totalSessions = ledger.lifetime?.total_sessions ?? 0;
    ledger.lifetime = {
        total_tokens_estimated: 0,
        total_reads: 0,
        total_writes: 0,
        anatomy_hits: 0,
        anatomy_misses: 0,
        repeated_reads_blocked: 0,
        estimated_savings_vs_bare_cli: 0,
        ...acc,
        total_sessions: totalSessions,
    };
}
/** Upsert the entry, roll old sessions into the baseline, derive lifetime. */
export function flushSessionToLedger(wolfDir, entry) {
    if (!entry.id)
        return;
    const ledgerPath = path.join(wolfDir, "token-ledger.json");
    // Locked read-modify-write: the daemon's report generator writes this file
    // too, and an unlocked interleave dropped whole sessions. On contention we
    // skip — the upsert is idempotent, so the next Stop converges the state.
    withFileLock(ledgerPath + ".lock", HOOK_LOCK_BUDGET_MS, () => {
        const ledger = readJSON(ledgerPath, emptyLedger());
        if (!Array.isArray(ledger.sessions))
            ledger.sessions = [];
        const idx = ledger.sessions.findIndex((s) => s && s.id === entry.id);
        if (idx >= 0)
            ledger.sessions[idx] = entry;
        else
            ledger.sessions.push(entry);
        while (ledger.sessions.length > MAX_LEDGER_SESSIONS) {
            const oldest = ledger.sessions.shift();
            const baseline = numericFields(ledger.lifetime_baseline);
            foldEntry(baseline, oldest);
            ledger.lifetime_baseline = baseline;
        }
        recomputeLifetime(ledger);
        writeJSON(ledgerPath, ledger);
    });
}
//# sourceMappingURL=ledger.js.map