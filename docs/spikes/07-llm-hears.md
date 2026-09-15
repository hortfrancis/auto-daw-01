# Spike 7: The LLM "hears"

**Question:** Can the LLM tell useful things about the music from numbers and a spectrogram?

**Answer: yes.**
- **The test:** the agent wrote an 8-bar song, called `render`, and described the result *before* comparing it with what it had written. Every observation matched:
  - a quieter first half and a louder second half
  - a change of bass rhythm at bar 5
  - no clipping, with headroom
  - no brightness above about 4 kHz
  - nothing below about 60 Hz
- **What it couldn't do:** tell which part was which in a busy mix, or judge the balance *between* tracks. It only gets the whole mix.

## What `render` now returns

As well as saving the WAV, `render` returns a short text summary and a picture in the same call.

```
Peak: -4.8 dBFS (no clipping)
Loudness: -17.4 LUFS integrated
Loudness by bar (LUFS): 1: -19.2 | 2: -19.9 | 3: -18.9 | 4: -19.3 | 5: -16.5 | 6: -15.8 | 7: -16.3 | 8: -16.0
Frequency balance: low (below 250 Hz) 37%, mid (250 Hz–4 kHz) 63%, high (above 4 kHz) 0%
```

- **Peak and clipping:** when there's clipping, the summary says how many samples clip *and which bars they're in*, so the agent knows where to fix.
- **Loudness in LUFS** (ITU-R BS.1770), overall and bar by bar. That's the measure behind streaming loudness targets.
  - Bars whose samples never go above −80 dBFS are reported as `silent`.
  - Songs longer than 32 bars group bars, e.g. `1–4`, so the line stays short.
- **Frequency balance:** the share of energy below 250 Hz, between 250 Hz and 4 kHz, and above 4 kHz.
- **A picture,** also saved as a PNG next to the WAV:
  - the waveform above a spectrogram, 1200 × 404 pixels
  - a line and a number at the start of each bar
  - a log frequency scale from 30 Hz to 16 kHz, with guide lines labelled 100 Hz, 1 kHz and 10 kHz
  - a sentence of text explaining how to read it

Analysis runs on the server, with no new dependencies: a WAV decoder, BS.1770 loudness, an FFT, and a small PNG encoder with a 5×7 pixel font for the labels. Each is unit-tested, including against the EBU Tech 3341 reference (a 1 kHz stereo sine at −23 dBFS measures −23.0 LUFS) and BS.1770's published filter coefficients.

## The test song

8 bars at 100 BPM:

| Bars | Melody | Bass | Chords |
|---|---|---|---|
| 1–4 | A moving line, E4–E5 | A syncopated riff (A2, F2, C2, G2) with octave jumps | Soft triads (velocity 0.4) |
| 5–8 | None | Straight quarter notes at full velocity | Louder four-note chords (velocity 0.9) |

**What the agent read from the render,** before checking against the table above:
- A quieter first half (about −19 LUFS) and a louder second half (about −16 LUFS), with the waveform visibly fuller from bar 5.
- In bars 1–4, gaps in the low band where the bass rests or jumps up an octave. In bars 5–8, a steady low band with four even pulses per bar.
- No clipping; peak −4.8 dBFS.
- 0% of the energy above 4 kHz: a dark mix. It's the basic synth's 2.4 kHz low-pass filter.
- Nothing below about 60 Hz, which fits the lowest note, C2 at 65 Hz.
- More movement between 300 Hz and 1 kHz in bars 1–4, which fits a melody, but that one was an inference rather than something clearly visible.

## Friction and gaps, most important first

| # | What happened | Candidate fix |
|---|---|---|
| 1 | **Parts can't be told apart** in a busy mix: the sawtooth harmonics of chords and melody overlap in the spectrogram. | Render chosen tracks on their own (solo or stems). |
| 2 | **No balance between tracks.** Loudness is for the whole mix, so "is the bass too loud?" can't be answered. | Per-track loudness, from stems. |
| 3 | **Long songs get a coarse picture.** At 1200 pixels, a 64-bar song gets about 19 pixels per bar. | Render a range of bars (already on the list from spike 6). |
| 4 | **Editing any file under `server/` restarts the dev server** and wipes the in-memory project. That includes test files, which is how the test song got wiped once mid-composition. | Saving to disk (spike 8). |
| 5 | Measured from the filtered signal, a silent bar reads as quiet but not silent (−47 LUFS), because the loudness filters ring on briefly after sound stops. | **Fixed in this spike:** "silent" is decided from the bar's samples. |
| 6 | The test chord for clipping didn't clip: 12 different notes at full velocity peaked at −5.2 dBFS. The synth and master bus have more headroom than estimated. | None needed. The test uses 16 copies of one note, which do add up. |

## Left for later

- **Per-track renders and stems,** to answer "which part is that?" and "is the bass too loud?".
- **Rendering a range of bars,** with pre-roll so notes already sounding at the start of the range are heard.
- **Stereo information** (width, balance). It isn't needed while every instrument is mono.
