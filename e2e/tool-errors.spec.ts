import { expect, test } from '@playwright/test';
import { callTool } from './mcp.ts';

// Errors are the agent's only help page (docs/agentic-usability.md, principle 7),
// so each one must say what was wrong and point at the fix.
const cases: { tool: string; args: Record<string, unknown>; says: string }[] = [
  { tool: 'set_tempo', args: { bpm: 1000 }, says: 'Use 20–400 BPM' },
  { tool: 'set_tempo', args: { bpm: 'fast' }, says: 'bpm: Invalid input: expected number' },
  { tool: 'add_tracks', args: { tracks: [] }, says: 'expected array to have >=1 items' },
  { tool: 'add_tracks', args: { tracks: [{ name: 'Keys' }, { name: 'keys' }] }, says: '"keys" appears more than once' },
  { tool: 'add_tracks', args: { tracks: [{ name: 'Organ', instrument: 'piano' }] }, says: 'expected "basic-synth"' },
];

for (const { tool, args, says } of cases) {
  test(`${tool} ${JSON.stringify(args)} explains the problem`, async () => {
    const result = await callTool(tool, args);

    expect(result.isError).toBe(true);
    expect(result.text).toContain(says);
  });
}
