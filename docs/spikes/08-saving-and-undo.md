# Spike 8: Saving and undo

**Question:** Does the work survive a closed tab or a server restart?

**Answer: yes.**
- **Every change is saved straight away** to `projects/default/project.json`, and the server loads that file when it starts.
- **A closed tab never lost anything.** The project has always lived on the server; a tab only shows it.
- **Undo and redo work** for every change, as MCP tools, with results that say exactly what happened.

## Verified

- **On the real dev server:**
  1. The agent set the tempo to 100 BPM and added a Bass track. The saved file had both straight away.
  2. The server was stopped and started again. Its log said "Loaded the saved project from …/projects/default/project.json".
  3. `get_project` showed 100 BPM and the Bass track.
- **An end-to-end test does the same automatically.** It starts its own server on port 4750 with a temporary projects folder, makes changes, stops the server, checks the JSON on disk, starts it again, and checks `get_project`.
- **Another end-to-end test covers undo and redo:** undo two steps, redo one, and check that a new change clears redo. The open tab follows each step.

## How saving works

- **Saved after every change,** as readable, indented JSON.
- **Atomic:** the server writes `project.json.saving`, then renames it over `project.json`, so a crash partway through a save can't leave a half-written project.
- **Unreadable files are moved aside, not overwritten.** If the file can't be read, it's renamed to `project.json.unreadable-<time>`, the server starts a new demo project, and a warning is logged.
- **Saving doesn't restart the server.** `projects/` is outside the watched `server/` and `shared/` folders.
- **Kept out of git:** `projects/` is gitignored, because it's the user's own work.
- **Tests never touch it:** end-to-end tests use a new temporary projects folder each run, so they always start from the demo project.

## How undo works

- **Every command records a labelled snapshot of the project before it changes:** `set tempo to 100 BPM`, `add tracks "Bass", "Chords"`, `create clip "Verse" on Chords`, `replace clip "Arpeggio" on Lead`.
- **`undo` and `redo`** take `steps` (default 1) and say what they did and what's left:

  > Undid 2 changes: add track "Undo me"; set tempo to 111 BPM. History: 3 changes can be undone (latest: …); 2 changes can be redone (next: set tempo to 111 BPM).

- **`get_project` has a history line:** `History: nothing to undo; nothing to redo. Every change is saved automatically.`
- **A new change clears redo,** as in any editor.
- **History lives in memory,** up to 100 steps, and **starts empty when the server starts.** Each entry is a whole-project snapshot, and writing up to 100 snapshots of a big song to disk on every change would be heavy.

## Friction and findings

| # | Finding | Candidate fix |
|---|---|---|
| 1 | **Undo history is lost on restart,** and during development the server restarts whenever server code changes. | Save the history too, as small diffs rather than whole snapshots. |
| 2 | **New tools (`undo`, `redo`) needed a `/mcp` reconnect** before the agent could use them, again. | None for now (see spike 5). |
| 3 | **There's only one project,** with no "new project" or switching between projects. Clips still can't be renamed or removed (spike 5), so undo is currently the only way to take something back. | Project management and clip removal, when needed. |
| 4 | **`redo`'s `steps` description said "newest first"**, copied from `undo`, which is the opposite of what redo does. The agent spotted it while reading the tool's schema during the demo. | **Fixed in this spike:** each tool describes its own `steps`. |

## Left for later

- **Hand edits in the UI (spike 9)** must go through the same commands, so they're saved and undoable too. That's also the natural time to add Undo and Redo buttons and keyboard shortcuts.
- **Saving undo history** across restarts.
- **Multiple projects.**
