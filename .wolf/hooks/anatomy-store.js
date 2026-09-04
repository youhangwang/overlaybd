import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
export const STORE_FILE = "anatomy-index.json";
export function sha256(text) {
    return crypto.createHash("sha256").update(text).digest("hex");
}
export function newStore() {
    return {
        version: 1,
        meta: {
            lastScanned: new Date().toISOString(),
            fileCount: 0,
            hits: 0,
            misses: 0,
            renderedHash: "",
            storeUpdatedAt: new Date().toISOString(),
        },
        files: {},
    };
}
export function loadStore(wolfDir) {
    try {
        const parsed = JSON.parse(fs.readFileSync(path.join(wolfDir, STORE_FILE), "utf-8"));
        if (parsed && parsed.version === 1 && parsed.files && parsed.meta)
            return parsed;
        return null; // unknown shape — caller falls back to md import / rescan
    }
    catch {
        return null;
    }
}
export function saveStore(wolfDir, store) {
    store.meta.fileCount = Object.keys(store.files).length;
    store.meta.storeUpdatedAt = new Date().toISOString();
    const filePath = path.join(wolfDir, STORE_FILE);
    const tmp = filePath + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
    const body = JSON.stringify(store, null, 2);
    try {
        fs.writeFileSync(tmp, body, "utf-8");
        fs.renameSync(tmp, filePath);
    }
    catch {
        try {
            fs.writeFileSync(filePath, body, "utf-8");
        }
        catch { }
        try {
            fs.unlinkSync(tmp);
        }
        catch { }
    }
}
// ── Markdown format (canonical — the legacy contract, unchanged) ────────────
// The auto-generated header block: never captured as preamble, or every
// import→render cycle would duplicate it.
const AUTO_HEADER = /^(?:# anatomy\.md\s*$|> Auto-maintained by OpenWolf\.|> Files:\s*\d+\s*tracked)/;
// Legacy symbol sub-bullets (2.0.0–2.0.3 renders): mechanical output, dropped
// rather than preserved. Any OTHER indented bullet is hand-written and kept.
const SYMBOL_SUBBULLET = /^ {2}- (?:fn|class|method|section) `[^`]+` L\d+-\d+ \(~\d+ tok\)$/;
/** Strip leading/trailing blank lines so preserved blocks don't grow by two lines per write. */
function trimBlankEdges(lines) {
    let start = 0;
    let end = lines.length;
    while (start < end && lines[start].trim() === "")
        start++;
    while (end > start && lines[end - 1].trim() === "")
        end--;
    return lines.slice(start, end);
}
export function parseAnatomyWithRaw(content) {
    const sections = new Map();
    const rawLines = new Map();
    const preamble = [];
    let currentSection = "";
    for (const raw of content.split("\n")) {
        const line = raw.replace(/\r$/, "");
        const sm = line.match(/^## (.+)/);
        if (sm) {
            currentSection = sm[1].trim();
            if (!sections.has(currentSection))
                sections.set(currentSection, []);
            continue;
        }
        if (!currentSection) {
            // Above the first section heading: preserve everything hand-written
            // (issue #61), skipping only our own generated header block.
            if (!AUTO_HEADER.test(line))
                preamble.push(line);
            continue;
        }
        const em = line.match(/^- `([^`]+)`(?:\s+—\s+(.+?))?\s*\(~(\d+)\s+tok\)$/);
        if (em) {
            sections.get(currentSection).push({
                file: em[1],
                description: em[2] || "",
                tokens: parseInt(em[3], 10),
            });
            continue;
        }
        if (line.trim() === "")
            continue;
        if (SYMBOL_SUBBULLET.test(line))
            continue;
        if (!rawLines.has(currentSection))
            rawLines.set(currentSection, []);
        rawLines.get(currentSection).push(line);
    }
    return { sections, rawLines, preamble: trimBlankEdges(preamble) };
}
export function parseAnatomy(content) {
    return parseAnatomyWithRaw(content).sections;
}
// serializeAnatomy was removed: it had no callers, could not carry rawLines or
// preamble, and every writer must go through renderStore so preserved content
// survives (issue #61).
/** Section key for a relpath: "src/hooks/" or "./" for root files. */
export function sectionKeyOf(relPath) {
    const dir = path.dirname(relPath).split(path.sep).join("/");
    return dir === "." ? "./" : dir + "/";
}
/**
 * Render the store to markdown, byte-identical to the legacy serializeAnatomy
 * format. Symbols deliberately do NOT render: they live in anatomy-index.json
 * and reach the model through the per-file pre-read hint. Rendering them
 * roughly 2.4x'd anatomy.md (59% of lines on a mid-size repo), and agents
 * instructed to consult anatomy.md paid that bill wholesale every session.
 */
export function renderStore(store) {
    const bySection = new Map();
    for (const [relPath, entry] of Object.entries(store.files)) {
        const key = sectionKeyOf(relPath);
        if (!bySection.has(key))
            bySection.set(key, []);
        bySection.get(key).push({ file: relPath.slice(relPath.lastIndexOf("/") + 1), entry });
    }
    const lines = [
        "# anatomy.md",
        "",
        `> Auto-maintained by OpenWolf. Last scanned: ${store.meta.lastScanned}`,
        `> Files: ${Object.keys(store.files).length} tracked | Anatomy hits: ${store.meta.hits} | Misses: ${store.meta.misses}`,
        "",
    ];
    const preamble = trimBlankEdges(store.preamble ?? []);
    if (preamble.length > 0) {
        lines.push(...preamble, "");
    }
    const rawBySection = store.rawLines ?? {};
    const keys = [...new Set([...bySection.keys(), ...Object.keys(rawBySection)])].sort();
    for (const key of keys) {
        lines.push(`## ${key}`);
        lines.push("");
        const raws = rawBySection[key] ?? [];
        for (const raw of raws) {
            lines.push(raw);
        }
        const entries = (bySection.get(key) ?? []).sort((a, b) => a.file.localeCompare(b.file));
        if (raws.length > 0 && entries.length > 0)
            lines.push("");
        for (const { file, entry } of entries) {
            const desc = entry.description ? ` — ${entry.description}` : "";
            lines.push(`- \`${file}\`${desc} (~${entry.tokens} tok)`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
/** Write the rendered markdown atomically and pin its hash in the store. */
export function renderToFile(wolfDir, store) {
    const content = renderStore(store);
    store.meta.renderedHash = sha256(content);
    const anatomyPath = path.join(wolfDir, "anatomy.md");
    const tmp = anatomyPath + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
    try {
        fs.writeFileSync(tmp, content, "utf-8");
        fs.renameSync(tmp, anatomyPath);
    }
    catch {
        try {
            fs.writeFileSync(anatomyPath, content, "utf-8");
        }
        catch { }
        try {
            fs.unlinkSync(tmp);
        }
        catch { }
    }
}
/**
 * Absorb out-of-band edits to anatomy.md (old compiled hooks, agent/human
 * hand-edits) into the store. ADDITIVE-ONLY:
 *  - md entry differs → md wins description/tokens (newer intent)
 *  - md entry absent from store → added (source "md-import")
 *  - store entry absent from md → KEPT unless the file is gone from disk
 *    (deletions are exclusively the full scanner's job)
 * Symbols always survive (they only flow store → render).
 */
export function importFromMarkdown(store, mdContent, projectRoot) {
    // Corruption guard: an empty/unreadable anatomy.md must never wipe the
    // preserved hand-written content in the store.
    if (!mdContent.trim())
        return;
    const { sections, rawLines, preamble } = parseAnatomyWithRaw(mdContent);
    if (rawLines.size > 0) {
        store.rawLines = Object.fromEntries(rawLines);
    }
    else {
        delete store.rawLines;
    }
    if (preamble.length > 0) {
        store.preamble = preamble;
    }
    else {
        delete store.preamble;
    }
    const seen = new Set();
    for (const [sectionKey, entries] of sections) {
        const dir = sectionKey === "./" ? "" : sectionKey;
        for (const e of entries) {
            const relPath = (dir + e.file).split("\\").join("/");
            seen.add(relPath);
            const existing = store.files[relPath];
            if (!existing) {
                store.files[relPath] = {
                    description: e.description,
                    tokens: e.tokens,
                    updatedAt: new Date().toISOString(),
                    source: "md-import",
                };
            }
            else if (existing.description !== e.description || existing.tokens !== e.tokens) {
                existing.description = e.description;
                existing.tokens = e.tokens;
                existing.updatedAt = new Date().toISOString();
                existing.source = "md-import";
            }
        }
    }
    // Entries the md no longer lists: keep unless the file is really gone.
    for (const relPath of Object.keys(store.files)) {
        if (seen.has(relPath))
            continue;
        if (!fs.existsSync(path.join(projectRoot, relPath))) {
            delete store.files[relPath];
        }
    }
}
/**
 * Read-side lookup: resolve a file to its anatomy entry. Store-first with an
 * O(1) relpath key; falls back to a suffix scan (paths outside the root) and
 * finally to parsing anatomy.md for projects that predate the store.
 * `normalizedFile` and `projectDir` use forward slashes.
 */
export function lookupEntry(wolfDir, projectDir, normalizedFile) {
    const rel = normalizedFile.startsWith(projectDir + "/")
        ? normalizedFile.slice(projectDir.length + 1)
        : normalizedFile.startsWith("/") ? null : normalizedFile;
    const store = loadStore(wolfDir);
    if (store) {
        const toResult = (rp, e) => ({
            file: rp.slice(rp.lastIndexOf("/") + 1),
            description: e.description,
            tokens: e.tokens,
            symbols: e.symbols,
            size: e.size,
            mtimeMs: e.mtimeMs,
        });
        const hit = rel ? store.files[rel] : undefined;
        if (hit)
            return toResult(rel, hit);
        for (const [rp, e] of Object.entries(store.files)) {
            if (normalizedFile === rp || normalizedFile.endsWith("/" + rp)) {
                return toResult(rp, e);
            }
        }
        return null;
    }
    // Pre-store project: legacy markdown scan.
    let md;
    try {
        md = fs.readFileSync(path.join(wolfDir, "anatomy.md"), "utf-8");
    }
    catch {
        return null;
    }
    for (const [sectionKey, entries] of parseAnatomy(md)) {
        const dir = sectionKey === "./" ? "" : sectionKey;
        for (const entry of entries) {
            const entryRelPath = (dir + entry.file).split("\\").join("/");
            if (normalizedFile === entryRelPath || normalizedFile.endsWith("/" + entryRelPath)) {
                return entry;
            }
        }
    }
    return null;
}
/**
 * Standard writer entry point: load the store (bootstrapping from anatomy.md
 * on first contact), and absorb any md-side divergence before the caller
 * mutates. Call ONLY while holding the anatomy lock.
 */
export function loadStoreReconciled(wolfDir, projectRoot) {
    let store = loadStore(wolfDir);
    let md = null;
    try {
        md = fs.readFileSync(path.join(wolfDir, "anatomy.md"), "utf-8");
    }
    catch { }
    if (!store) {
        store = newStore();
        if (md)
            importFromMarkdown(store, md, projectRoot);
        return store;
    }
    if (md !== null && sha256(md) !== store.meta.renderedHash) {
        importFromMarkdown(store, md, projectRoot);
    }
    return store;
}
//# sourceMappingURL=anatomy-store.js.map