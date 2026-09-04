import * as path from "node:path";
import { getWolfDir, ensureWolfDir, readJSON, writeJSON, emitHookJSON } from "./shared.js";
function main() {
    ensureWolfDir();
    const sessionFile = path.join(getWolfDir(), "hooks", "_session.json");
    const session = readJSON(sessionFile, {});
    const pending = session.pending_reminders ?? [];
    if (pending.length === 0) {
        process.exit(0);
        return;
    }
    session.pending_reminders = [];
    writeJSON(sessionFile, session);
    emitHookJSON("UserPromptSubmit", { additionalContext: pending.join("\n\n") });
    process.exit(0);
}
try {
    main();
}
catch {
    process.exit(0);
}
//# sourceMappingURL=user-prompt-submit.js.map