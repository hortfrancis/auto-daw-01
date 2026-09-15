# Agentic Usability

**Agentic usability** is how easily an LLM agent can use a piece of software to get a job done: first time, with no help, no wasted calls, and no wrong guesses.

Auto DAW is MCP-first, so the agent is our primary user. We design for it the way good product teams design for people: we borrow proven usability principles (Krug, Nielsen, Norman) and rework them for a user who reads tool descriptions instead of screens.

When the agent's needs and the UI's needs pull in different directions, the **MCP interface follows this doc**, and the UI is designed for the human. Both share the same vocabulary: tracks, clips, bars, beats, notes.

## Know your user

An LLM agent is an unusual user. Its traits drive every principle below.

| Trait | What it means for design |
|---|---|
| **Its attention is its context window.** Every tool description and every result uses up space that the rest of the task needs. | Brevity is a feature. Verbose output is a usability bug. |
| **It only knows what it's been shown.** It can't see the UI, hover for a tooltip, or explore by clicking. | Tool names, descriptions, results and errors are the entire interface. |
| **It reads literally and guesses confidently.** An ambiguous parameter gets a plausible-looking wrong value, not a question. | Remove ambiguity: state units, ranges and whether a call replaces or adds. |
| **It already knows the world's conventions.** MIDI, scientific pitch notation, bars and beats, dB, BPM. | Use those. Every invented format is something it must learn and can get wrong. |
| **It's weak at bookkeeping.** Long arithmetic, counting, and remembering IDs from 40 calls ago. | The software does the bookkeeping and hands back what's needed next. |
| **It can't hear.** It can read numbers and look at images. | Give it senses: symbolic views, measurements and pictures of the audio. |
| **Every call is a round trip.** Each one costs time and tokens. | One call should do a whole job. |
| **It has no memory between sessions.** | Anything it needs to get oriented must be one cheap call away. |

## Principles

### 1. Don't make it think

*From Krug's "Don't make me think".* A tool should be self-evident from its name and description alone.

- Name tools with domain verbs: `write_notes`, `set_tempo`, `render`. Avoid names like `apply_patch` or `exec`.
- Every description says what it does, the units and ranges, and what it returns. If there's a way to get it wrong, the description says so.
- Say whether a call **replaces** or **adds**. That's the most common source of confident wrong guesses.

> ❌ `add_notes`: Adds notes.
>
> ✅ `write_notes`: Replace all notes in a clip. Positions are 1-based bars and beats (beat 2.5 is the "and" of beat 2). Pitch is a note name like "C#4" or a MIDI number 0–127. Returns a one-line summary of the clip.

### 2. Speak its language

*From Nielsen's "Match between the system and the real world".* Use musical units and conventions the model already knows.

- Bars, beats, BPM, note names, dB and pan from -1 to 1. Not seconds, Hz, sample frames or ticks, unless the task really is about those.
- Accept human names (`"Bass"`) wherever an ID is accepted. IDs are for the software's convenience, not the agent's.

### 3. Spend its attention carefully

*From Krug's "Omit needless words", Nielsen's minimalist design, and progressive disclosure.*

- **Results are short by default**, with a way to ask for detail. A project overview lists tracks and clips. The notes come from a separate, scoped call.
- **After a change, return what changed**, not the whole project.
- **Keep tool descriptions tight.** They're loaded into context on every turn, whether or not the tool gets used.
- Prefer compact text summaries to indented JSON when the agent only needs to read the result.

### 4. Always show where things stand

*From Nielsen's "Visibility of system status" and Norman's feedback.*

- Every change confirms the result in terms of the goal:
  `Wrote 16 notes to Bass › Verse (bars 1–4, E1–B1).`
- Say when something the agent can't observe gets in the way: "No browser tab is connected, so rendering is unavailable. Ask the user to open http://localhost:4747."
- Orientation is one cheap call: *what's in this project, and what's going on right now?* That's Krug's "trunk test" for an agent arriving cold.

### 5. Recognition over recall

*From Nielsen.* Don't make the agent remember or reconstruct things.

- Results include the IDs and names the obvious next call will need.
- List the valid options where they're needed: instrument names in the description, valid choices in the error.
- The software does the maths. For example, "bars 9–16" rather than a start and length the agent has to add up.

### 6. Prevent errors with constraints

*From Nielsen's "Error prevention" and Norman's constraints.*

- Use schemas with enums and min/max values, so bad input is rejected before anything runs.
- Forgive harmless variation (`"c#4"`, `"C#4"` and `"C♯4"` all mean the same note). Reject genuinely ambiguous input rather than guessing.
- Use **set, not toggle**: `set_mute(track, true)`, never `toggle_mute`. The same call gives the same result, so retrying is always safe.

### 7. Errors that teach

*From Nielsen's "Help users recognise, diagnose and recover from errors".* An error message is the agent's only help page. It should say what was wrong and how to fix it.

> ❌ `Invalid input`
>
> ✅ `Bar 0 is out of range: bars start at 1. Clip "Verse" covers bars 1–8.`
>
> ✅ `No track named "Drums". Tracks: Lead, Bass, Pads.`

### 8. Make it safe to experiment

*From Nielsen's "User control and freedom".* Agents make mistakes, and cheap recovery turns mistakes into iteration.

- Every change can be undone. Undo steps are labelled so the agent can see what it's undoing.
- A batch of changes succeeds or fails as a whole, never half-applied.

### 9. Be consistent

*From Nielsen's "Consistency and standards".* Once learned, a pattern should work everywhere.

- Parameter names mean the same thing in every tool (`track`, `clip`, `bar`, `beat`).
- A small, predictable set of verbs: `get_`, `add_`, `set_`, `write_`, `remove_`.
- The same kinds of results and errors look the same everywhere.

### 10. One call, one whole job

*From Nielsen's "Flexibility and efficiency of use".*

- Operations take batches: many notes, many tracks, many parameters in one call.
- Keep the number of tools small, but don't cram unrelated jobs into one tool behind a `mode` flag. That just hides several tools inside one confusing one.

### 11. Close the gulf of evaluation

*From Norman.* The agent needs to be able to check whether its change had the intended effect. For a DAW, that's the hardest part, because the agent can't hear.

- **Symbolic view:** what's in the project, readable in a few lines.
- **Rendered view:** measurements and images of the actual audio, reported in musical terms ("bars 17–20 are silent", "the kick and bass clash around 60 Hz").

## How we test it

*From Krug's "Rocket Surgery Made Easy": test early and often, and a handful of real tasks reveals most problems.*

- **Every spike demo is a usability test.** The agent does a real task with the new tools, and we note every stumble: a wrong argument, a retry, an unnecessary call, a misread result.
- **Test with a fresh session.** A new agent session with no chat history, given only the task, tells us whether the tools explain themselves.
- **Test with a smaller model.** If a small, fast model can use a tool correctly, the tool is clear. If only the largest model can, the tool is the problem.
- **Read the transcript.** It's the equivalent of watching over a user's shoulder, and it shows exactly where the agent got confused.
- **Things worth counting:** calls per task, errors per task, tokens per result, and whether the task was done right the first time.

When the agent stumbles, the fix goes in the software (a clearer name, a better error, a new batch operation), not in a longer prompt.

## Checklist for a new or changed tool

- [ ] Can the name and description alone tell a fresh agent how to use it correctly?
- [ ] Are units, ranges, and replace-vs-add stated?
- [ ] Does it use musical units and names the model already knows?
- [ ] Is the result short, showing what changed and the IDs for the next call?
- [ ] Is it safe to retry?
- [ ] Does every error say what went wrong, what's valid, and how to fix it?
- [ ] Can it be undone?
- [ ] Does it do a whole job in one call?
- [ ] Is it consistent with the names and patterns of the other tools?
- [ ] Has an agent actually used it for a real task, and did we read the transcript?
