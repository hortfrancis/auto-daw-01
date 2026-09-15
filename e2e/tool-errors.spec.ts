import { expect, test } from '@playwright/test';
import { callTool } from './mcp.ts';

// Errors are the agent's only help page (docs/agentic-usability.md, principle 7),
// so each one must say what was wrong and point at the fix. The demo project's
// "Lead" track has one clip, "Arpeggio", in bar 1.
const cases: { tool: string; args: Record<string, unknown>; says: string | string[] }[] = [
  { tool: 'set_tempo', args: { bpm: 1000 }, says: 'Use 20–400 BPM' },
  { tool: 'set_tempo', args: { bpm: 'fast' }, says: 'bpm: Invalid input: expected number' },
  { tool: 'add_tracks', args: { tracks: [] }, says: 'expected array to have >=1 items' },
  { tool: 'add_tracks', args: { tracks: [{ name: 'Keys' }, { name: 'keys' }] }, says: '"keys" appears more than once' },
  { tool: 'add_tracks', args: { tracks: [{ name: 'Organ', instrument: 'piano' }] }, says: 'expected "basic-synth"' },
  {
    tool: 'write_clip',
    args: { track: 'Nope', clip: 'Verse', notes: [] },
    says: 'No track named "Nope". Tracks: Lead',
  },
  {
    tool: 'write_clip',
    args: { track: 'Lead', clip: 'Bad pitch', startBar: 9, notes: [{ pitch: 'H4', bar: 1, beat: 1 }] },
    says: '"H4" isn\'t a pitch. Use a note name like "C4"',
  },
  {
    tool: 'write_clip',
    args: { track: 'Lead', clip: 'Bad beat', startBar: 9, notes: [{ pitch: 'C4', bar: 1, beat: 5 }] },
    says: 'beat 5 is past the end of the bar',
  },
  {
    tool: 'write_clip',
    args: { track: 'Lead', clip: 'Too short', startBar: 9, lengthBars: 1, notes: [{ pitch: 'C4', bar: 2, beat: 1 }] },
    says: 'Use lengthBars: 2 or more',
  },
  {
    tool: 'write_clip',
    args: { track: 'Lead', clip: 'Clash', startBar: 1, notes: [{ pitch: 'C4', bar: 1, beat: 1 }] },
    says: 'would overlap clip "Arpeggio" (bar 1) on Lead',
  },
  {
    tool: 'write_clip',
    args: { track: 'Lead', clip: 'No octave', startBar: 9, notes: [{ pitch: 'Bb', bar: 1, beat: 1 }] },
    says: '"Bb" is missing an octave number, e.g. "Bb3" or "Bb4"',
  },
  {
    // Every kind of problem comes back in one response, not one per retry.
    tool: 'write_clip',
    args: {
      track: 'Lead',
      clip: 'Many problems',
      startBar: 1,
      lengthBars: 1,
      notes: [
        { pitch: 'C4', bar: 1, beat: 5 },
        { pitch: 'D4', bar: 2, beat: 1 },
      ],
    },
    says: ['beat 5 is past the end of the bar', 'Use lengthBars: 2 or more', 'would overlap clip "Arpeggio" (bar 1) on Lead'],
  },
  { tool: 'undo', args: { steps: 0 }, says: 'steps: Too small' },
  {
    tool: 'get_clip',
    args: { track: 'Lead', clip: 'Chorus' },
    says: 'No clip named "Chorus" on Lead. Clips on Lead: "Arpeggio" (bar 1)',
  },
];

for (const { tool, args, says } of cases) {
  test(`${tool} ${JSON.stringify(args)} explains the problem`, async () => {
    const result = await callTool(tool, args);

    expect(result.isError).toBe(true);
    for (const expected of [says].flat()) expect(result.text).toContain(expected);
  });
}
