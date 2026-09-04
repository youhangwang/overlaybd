---
description: OpenWolf protocol enforcement — active on all files
globs: **/*
---

- Read .wolf/STATUS.md FIRST when resuming a session; update it (done / next quest) when a quest finishes or before suggesting /clear
- Before reading an unfamiliar project file, grep .wolf/anatomy.md for its path (one-line description + token estimate). Never read anatomy.md whole; it is an index.
- Check .wolf/cerebrum.md Do-Not-Repeat list before generating code
- Do NOT manually update .wolf/anatomy.md or .wolf/memory.md after writes; the OpenWolf hooks maintain them
- After a user correction, update .wolf/cerebrum.md immediately (Preferences, Learnings, or Do-Not-Repeat). Low threshold: when in doubt, log it.
- BEFORE fixing any bug or error: grep .wolf/buglog.json for the error message or filename
- AFTER fixing any bug, error, failed test, or failed build: log it to .wolf/buglog.json with error_message, root_cause, fix, and tags. Editing a file more than twice usually means a bug worth logging.
