# Spike 5: Notes via MCP

**Question:** Is a bars-and-beats note format comfortable for an LLM to write?

**Answer: yes.** In the usability test, the agent (Claude, in Claude Code) wrote a 4-bar song from scratch: a melody, a bassline and chords at 100 BPM, 41 notes in total. It took 6 tool calls, every write worked first time, and the user heard it play. The friction was in *editing* and in *repetition*, not in the format itself.

## What worked

- **Note objects with sensible defaults.** `{pitch, bar, beat, lengthBeats, velocity}` needed no explanation. Omitting `lengthBeats` (1) and `velocity` (0.8) kept most notes short.
- **Musical units.** Off-beats as `2.5`, pitches as `"E5"`: no mental arithmetic.
- **Results that confirm the outcome**, e.g. `Replaced clip "Arpeggio" [clip-1] on Lead: bars 1–4, 14 notes (was 13), E4–E5. Song length: 4 bars.` They show at a glance that the right thing happened.
- **`get_clip`'s table** is compact and easy to scan, and uses the same field names `write_clip` takes.
- **Replacing a whole clip is safe to retry**, and edits made during playback are heard straight away.
- **Note errors** name each bad note, say what's wrong, and give the fix, all in one response.

## Friction, most costly first

| # | What happened | Cost | Candidate fix |
|---|---|---|---|
| 1 | Changing the last bar of the melody meant resending all 14 notes to change 2. | Grows with clip size; a long clip makes small edits expensive and error-prone. | Replace just a bar range within a clip, or an `edit_notes` tool that adds and removes notes. |
| 2 | Each chord took three near-identical note objects (12 objects for 4 chords). | About 3× the tokens for chords. | Let `pitch` take an array: `"pitch": ["A3", "C4", "E4"]`. |
| 3 | The bassline repeated one rhythm four times with different roots: 16 hand-written objects. | Verbose; typos are likely in longer songs. | A way to repeat bars or clips. Needs design. |
| 4 | Validation happened in stages. A call with bad notes *and* an overlapping position reported only the notes; the overlap surfaced on the retry. | An extra round trip. | **Fixed in this spike:** placement is checked alongside the notes, and every problem comes back in one response. |
| 5 | `"Bb"` was rejected as "isn't a pitch", without saying what was missing. | Minor: the agent has to work out that the octave is missing. | **Fixed in this spike:** the error says the octave number is missing and gives examples. |
| 6 | There's no way to rename or remove a clip, so the new melody still lives in a clip called "Arpeggio". | Misleading names build up; mistakes can't be undone. | `remove_clips`, and renaming. Partly covered by undo (spike 8). |
| 7 | After the server gained new tools, the connected Claude Code session didn't see them until `/mcp` → reconnect. | Development only: tools change only when the code does. | None for now; the server is stateless, so it can't notify clients. Reconnect after adding tools. |

## Not tested yet

- A **fresh session**: an agent with no conversation history, given only the task.
- A **smaller model**, to check the tool descriptions stand on their own.
