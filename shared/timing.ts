// Musical time. Positions are 1-based bars and beats, as a musician would say
// them. A beat is one unit of the time signature's lower number: a quarter
// note in 4/4.

import type { Clip, Note, Project } from './project.ts';

export function beatsPerBar(project: Pick<Project, 'timeSignature'>) {
  return project.timeSignature[0];
}

export function secondsPerBeat(project: Pick<Project, 'tempo'>) {
  return 60 / project.tempo;
}

/** The song runs from bar 1 to the end of its last clip. */
export function songLengthBars(project: Project) {
  const clipEnds = project.tracks.flatMap((track) =>
    track.clips.map((clip) => clip.startBar - 1 + clip.lengthBars),
  );
  return Math.max(0, ...clipEnds);
}

/** Where a note starts, in beats from the start of the song (beat 0 is bar 1, beat 1). */
export function noteStartBeat(clip: Clip, note: Note, beatsInBar: number) {
  return (clip.startBar - 1 + note.bar - 1) * beatsInBar + (note.beat - 1);
}

export function noteCount(project: Project) {
  return project.tracks.reduce(
    (sum, track) => sum + track.clips.reduce((clipSum, clip) => clipSum + clip.notes.length, 0),
    0,
  );
}
