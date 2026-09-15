// Turns project state into the short text MCP tools return. Kept compact on
// purpose: every line costs the agent context (docs/agentic-usability.md, principle 3).

import { barRange, plural } from '../shared/format.ts';
import { midiFromPitch } from '../shared/pitch.ts';
import type { Clip, Note, Project } from '../shared/project.ts';
import { UI_URL } from './config.ts';
import { tabStatuses } from './live.ts';
import * as store from './store.ts';

export function describeProject(project: Readonly<Project>) {
  const [beats, unit] = project.timeSignature;
  const lines = [
    `Project "${project.name}": ${project.tempo} BPM, ${beats}/${unit}`,
    describeBrowser(),
    `${describeHistory()} Every change is saved automatically.`,
    '',
    `Tracks (${project.tracks.length}):`,
  ];
  if (project.tracks.length === 0) lines.push('(none)');
  project.tracks.forEach((track, i) => {
    const clips = track.clips.length === 0 ? 'no clips' : plural(track.clips.length, 'clip');
    lines.push(`${i + 1}. ${track.name} [${track.id}]: ${track.instrument}, ${clips}`);
    for (const clip of track.clips) lines.push(`   - "${clip.name}" [${clip.id}]: ${clipSummary(clip)}`);
  });
  return lines.join('\n');
}

export function describeBrowser() {
  const tabs = tabStatuses();
  if (tabs.length === 0) {
    return `Browser UI: not open, so the user can't see or hear anything. They can open ${UI_URL}`;
  }
  const open = `Browser UI: open in ${plural(tabs.length, 'tab')}`;
  if (!tabs.some((tab) => tab.audio === 'ready')) {
    return `${open}, audio not enabled yet (the user must click "Enable audio" before anything can play)`;
  }
  const playing = tabs.some((tab) => tab.transport === 'playing');
  return `${open}, audio enabled, ${playing ? 'playing' : 'stopped'}`;
}

/** "History: 3 changes can be undone (latest: …); nothing to redo." */
export function describeHistory() {
  const { undoCount, redoCount, nextUndo, nextRedo } = store.historySummary();
  const undo = undoCount === 0 ? 'nothing to undo' : `${plural(undoCount, 'change')} can be undone (latest: ${nextUndo})`;
  const redo = redoCount === 0 ? 'nothing to redo' : `${plural(redoCount, 'change')} can be redone (next: ${nextRedo})`;
  return `History: ${undo}; ${redo}.`;
}

/** "bars 1–4, 16 notes, E1–B2". Pass the previous note count to add "(was 12)". */
export function clipSummary(clip: Clip, previousNoteCount?: number) {
  const was = previousNoteCount === undefined ? '' : ` (was ${previousNoteCount})`;
  const range = pitchRange(clip.notes);
  return `${barRange(clip.startBar, clip.lengthBars)}, ${plural(clip.notes.length, 'note')}${was}${range ? `, ${range}` : ''}`;
}

/** Lowest to highest pitch, e.g. "E1–B2", or "" when there are no notes. */
export function pitchRange(notes: Note[]) {
  if (notes.length === 0) return '';
  const sorted = notes.map((n) => n.pitch).sort((a, b) => (midiFromPitch(a) ?? 0) - (midiFromPitch(b) ?? 0));
  const [lowest, highest] = [sorted[0], sorted.at(-1)];
  return lowest === highest ? lowest : `${lowest}–${highest}`;
}

/** One note per line, with the same field names write_clip takes. */
export function noteTable(notes: Note[]) {
  const header = ['bar', 'beat', 'pitch', 'lengthBeats', 'velocity'];
  const rows = notes.map((n) => [String(n.bar), formatNumber(n.beat), n.pitch, formatNumber(n.lengthBeats), formatNumber(n.velocity)]);
  const widths = header.map((title, col) => Math.max(title.length, ...rows.map((row) => row[col].length)));
  return [header, ...rows]
    .map((cells) => cells.map((cell, col) => cell.padEnd(widths[col])).join('  ').trimEnd())
    .join('\n');
}

function formatNumber(value: number) {
  return String(Math.round(value * 1000) / 1000);
}
