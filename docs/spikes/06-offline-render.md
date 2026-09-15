# Spike 6: Offline render

**Question:** Does rendering offline give exactly the same audio as live playback?

**Answer:**
- **Rendering works, using the same code as live playback:** the same scheduler, instruments and master bus.
- **Renders aren't bit-for-bit repeatable in Chrome once three or more sounds overlap.** The difference between runs is about one step of 32-bit float precision (roughly −160 dB). That's inaudible, but just enough that two 16-bit WAVs occasionally differ by one sample value. The cause is confirmed below: Chrome adds up a node's inputs in an order that varies between renders.
- **Live and offline don't produce identical samples, and aren't meant to.** See the table at the end; the differences are in how the audio is delivered, not in the music.
- **We accept the tiny differences.** Two renders of the same project count as matching when no 16-bit sample differs by more than 1 (see Options).

## How it works

1. The `render` MCP tool asks one browser tab to render. The request carries a full copy of the project, so edits made during the render can't leak in.
2. The tab confirms straight away that it received the request. If it doesn't within 3 seconds, the tool tells the agent the tab may be showing an old version of the page or be suspended, and to ask the user to refresh it.
3. The tab builds an `OfflineAudioContext` and uses the same code as live playback:
   - `notesInRange` from `web/audio/scheduler.ts`
   - `createMasterBus` and `playNote` from `web/audio/graph.ts`
4. It renders the whole song faster than real time, encodes a 16-bit, 48 kHz stereo WAV, and uploads it with `POST /api/renders/:id`.
5. The server saves the file to `renders/` and tells the agent where it is.

Rendering needs a tab open, but it doesn't need "Enable audio": browsers allow offline rendering without a click.

## Why renders differ

### How we found it

1. **The first comparison** of two renders of the same song: 2 samples out of 960,000 differed, each by one step on the 16-bit scale.
2. **Two guesses turned out to be wrong,** and the test runs misled us about both:
   - *Disconnecting notes in an `ended` event handler.* Removed; no change.
   - *Garbage collection partway through a render.* Tried keeping every node alive until the render finished; no change.
   - The render test passed when run on its own but failed in the full suite, which made both guesses look plausible. The real difference was that the full suite builds a busier song first.
3. **Measuring inside the page** settled it. Each project was rendered 20 times, hashing the raw 32-bit float output:

   | Project | Most notes sounding at once | Different outputs in 20 renders |
   |---|---|---|
   | 4-note arpeggio | 2 | 1 |
   | Back-to-back notes (release tails overlap) | 3 | 20 |
   | One 3-note chord | 3 | 3, differing from the 2nd sample |
   | Busier song (3 tracks) | 3+ | 19 |

4. **Raw Web Audio oscillators confirmed the cause:**

   | Setup | Different outputs in 20 renders |
   |---|---|
   | 2 oscillators into one node | 1 |
   | 3 oscillators into one node | 3 |
   | 8 oscillators into one node | 20 |
   | 3 oscillators mixed in pairs | 1 |
   | 8 oscillators mixed in pairs | 1 |
   | basic-synth, 3-note chord into one bus | 3 |
   | basic-synth, 3-note chord mixed in pairs | 1 |

### Cause

- Floating-point addition gives the same result for *two* numbers whichever order they're added in, but not for three or more: (a + b) + c can differ from a + (b + c) in the last bit.
- Chrome adds up the signals arriving at a node in an order that isn't fixed from one render to the next. So any node receiving three or more sounding signals can produce last-bit differences.
- Mixing in pairs, so that no node ever has more than two inputs, is exact.

Two changes from the investigation were kept because they're harmless tidy-ups:
- Each note's envelope now fades to exactly 0 at a scheduled time.
- Notes no longer disconnect themselves when they end; the browser cleans up finished nodes on its own.

## Options

1. **Accept the tiny differences.**
   - How: compare renders within a tolerance, e.g. no 16-bit sample differs by more than 1.
   - For: simple, and holds across browser versions.
   - Against: an exact hash can't tell us whether the audio changed.
2. **Make renders bit-exact.**
   - How: route every mix through pairs.
     - Assign each note to a "voice slot", so no slot ever has two notes sounding at once.
     - Mix the slots, and later tracks and effect sends, through a tree of two-input nodes.
   - For: exact in today's Chrome.
   - Against: every future bus and effect must follow the rule, and it depends on how Chrome happens to work internally, which could change.

**Decision: option 1.** Renders count as matching when no 16-bit sample differs by more than 1, and the end-to-end test checks exactly that. Option 2 stays available if exact hashes ever become important.

## Known differences between live playback and a render

These are accepted: the music is the same, but the samples aren't.

| | Live playback | Render |
|---|---|---|
| Sample rate | The audio device's own rate (often 44.1 or 48 kHz) | Always 48 kHz |
| Start | 50 ms after pressing play, so the first note isn't late | Exactly at sample 0 |
| Length | Loops until stopped | The song once, bar 1 to the end of the last clip |
| Ending | Notes release naturally | Cut at the end of the last bar; nothing rings past it |
| Extra nodes | A level-meter analyser, which doesn't change the sound | None |

## Other findings

- **Renders match across Chrome builds too.** The user's Windows Chrome and Playwright's headless Chromium 153 each rendered the demo song. The files were the same length with identical headers, and only 18 of 192,000 samples differed, none by more than 1. That's within the tolerance chosen above, which suggests the tolerance holds up better than exact hashes would.
- **`node --watch` missed edits.** It restarted after the first edit to `server/index.ts` but not later ones, so the running server was missing the upload route (HTTP 404). The likely cause is that the edit tool replaces files rather than modifying them in place, and a watch on a single file loses track. `npm run dev` now watches the `server/` and `shared/` folders instead. Replacing a file twice now triggers two restarts.
- **The first real-tab render timed out after 32 seconds** with a misleading message ("check whether the tab is still open"; it was). That's what led to the 3-second "did the tab receive it?" confirmation in step 2 above.

## Left for later

- **Spike 7:** turn renders into numbers and pictures the agent can use (levels, clipping, spectrograms).
- **Rendering part of a song:** a range of bars, or just some tracks. Notes that start before the range but are still sounding when it begins will need handling.
- **A "tail" option,** so a final render includes notes ringing past the last bar.
