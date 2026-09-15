import { midiFromPitch } from '../../shared/pitch.ts';
import type { Clip, Track } from '../../shared/project.ts';
import { noteStartBeat } from '../../shared/timing.ts';

type Props = {
  track: Track;
  /** The track before the latest update; new or changed clips get highlighted. */
  previousTrack?: Track;
  totalBars: number;
  beatsInBar: number;
};

/** Visual gap between back-to-back notes, in beats. */
const NOTE_GAP = 0.05;

/**
 * A mini piano roll for one track: beats run left to right and pitch bottom to
 * top, zoomed to the range of notes on the track. SVG coordinates are beats
 * (x) and semitones (y), stretched to fit the lane.
 */
export function TrackLane({ track, previousTrack, totalBars, beatsInBar }: Props) {
  const pitches = track.clips.flatMap((clip) => clip.notes.map((note) => midiFromPitch(note.pitch) ?? 60));
  const top = (pitches.length > 0 ? Math.max(...pitches) : 60) + 1;
  const bottom = (pitches.length > 0 ? Math.min(...pitches) : 60) - 1;
  const rows = top - bottom + 1;

  return (
    <svg
      className="lane"
      viewBox={`0 0 ${totalBars * beatsInBar} ${rows}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${track.name} notes`}
    >
      {track.clips.map((clip) => {
        const before = previousTrack?.clips.find((c) => c.id === clip.id);
        const changed = previousTrack !== undefined && !sameClip(before, clip);
        return (
          // Keyed on the content so the highlight animation replays on each change.
          <g key={`${clip.id}:${hash(JSON.stringify(clip))}`} data-clip={clip.name}>
            <rect
              className={changed ? 'clip flash' : 'clip'}
              x={(clip.startBar - 1) * beatsInBar}
              y={0}
              width={clip.lengthBars * beatsInBar}
              height={rows}
            />
            {clip.notes.map((note, i) => (
              <rect
                key={i}
                className="note"
                data-pitch={note.pitch}
                x={noteStartBeat(clip, note, beatsInBar)}
                y={top - (midiFromPitch(note.pitch) ?? 60)}
                width={Math.max(NOTE_GAP, note.lengthBeats - NOTE_GAP)}
                height={1}
              />
            ))}
          </g>
        );
      })}
      {Array.from({ length: totalBars + 1 }, (_, bar) => (
        <line
          key={bar}
          className="bar-line"
          x1={bar * beatsInBar}
          x2={bar * beatsInBar}
          y1={0}
          y2={rows}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function sameClip(a: Clip | undefined, b: Clip) {
  return a !== undefined && JSON.stringify(a) === JSON.stringify(b);
}

/** A short, fast string hash (djb2), for React keys. */
function hash(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}
