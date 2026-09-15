# Auto DAW — Roadmap

We build this in small **spikes**, not all at once. Each spike answers one open question and ends with something both the user and the LLM can try. They're ordered riskiest first, so a fundamental problem shows up before much is built on top of it.

See [architecture.md](architecture.md) for the system design these spikes build towards.

## How each spike runs

- Small enough to finish and review in one sitting.
- Ends with a quick demo: the user clicks around in the browser, the LLM tests over MCP.
- Gets committed, with anything surprising written up in `docs/` (e.g. "Tone.js's offline mode drifts").
- Throwaway code is fine, but anything that survives should be simple enough to build on.

## Spikes

| # | Spike | Question it answers | Done when | Status |
|---|---|---|---|---|
| 1 | **Skeleton** | Can one `npm run dev` start both the server and the web UI? | The user opens `localhost:PORT` and sees a page served by the Node server | Done |
| 2 | **MCP hello** | Can Claude Code connect to our server over HTTP? | After `claude mcp add`, the LLM calls a `get_project` tool and gets back a hard-coded project | Not started |
| 3 | **Live bridge** | Does server state push to the browser in real time? | The LLM calls `set_tempo` or `add_track` and the open tab updates without a refresh | Not started |
| 4 | **First sound** | Can we schedule notes accurately with Web Audio, and do we use Tone.js or plain Web Audio? | The user clicks "Enable audio", then `play` (from the LLM or a button) plays a hard-coded synth melody in time | Not started |
| 5 | **Notes via MCP** | Is a bars-and-beats note format comfortable for an LLM to write? | The LLM calls `write_notes`, a simple piano roll shows the notes, and the user hears them | Not started |
| 6 | **Offline render** | Does rendering offline give exactly the same audio as live playback? This is the biggest unknown. | The LLM calls `render`, the tab renders a WAV and sends it back, and two renders of the same project come out identical | Not started |
| 7 | **LLM "hears"** | Can the LLM tell useful things about the music from numbers and a spectrogram? | `render` returns loudness and clipping figures plus a spectrogram image, and the LLM can describe what it sees | Not started |
| 8 | **Saving + undo** | Does the work survive a closed tab or a server restart? | After a server restart the project is still there, and `undo`/`redo` work | Not started |
| 9 | **Hand edits** | Do the user's edits and the LLM's go through the same path? | The user drags a note in the UI and the LLM's next `get_project` shows the change | Not started |
| 10 | **Mixer + effects** | How should the audio graph look once tracks have volume and effects? | Each track has volume, pan and a couple of effects, all adjustable from the UI or over MCP | Not started |
| 11 | **Export** | Does the final bounce match what we heard? | `export` saves a full-song WAV to disk | Not started |
| 12 | **Sample clips** | Can tracks play audio files, not just synths? | Tracks can hold audio clips, and they render and export too | Not started |
| 13 | **External generation** | Does the API-key setup work with ElevenLabs? | `generate_sample` calls ElevenLabs with the key from `.env`, and the sample lands on a track | Not started |

## Notes on the order

- **Spikes 1–3** set up the connections before any audio, so later audio bugs aren't tangled up with connection bugs.
- **Spike 6 comes early on purpose.** The "one engine" rule depends on offline renders matching live playback. If they don't, we want to know before building saving, undo and effects on top.
- **Spike 8 (saving + undo)** could move earlier if losing work while testing gets annoying. It doesn't block anything else.
