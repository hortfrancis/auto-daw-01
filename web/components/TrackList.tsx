import { plural } from '../../shared/format.ts';
import type { Track } from '../../shared/project.ts';
import { TrackLane } from './TrackLane.tsx';

type Props = {
  tracks: Track[];
  /** Tracks before the latest update; anything new or changed gets highlighted. */
  previousTracks?: Track[];
  totalBars: number;
  beatsInBar: number;
};

export function TrackList({ tracks, previousTracks, totalBars, beatsInBar }: Props) {
  const previousById = new Map(previousTracks?.map((t) => [t.id, t]));
  const bars = Array.from({ length: totalBars }, (_, i) => i + 1);

  return (
    <section className="tracks">
      <h2>Tracks</h2>
      {tracks.length === 0 ? (
        <p className="empty">No tracks yet</p>
      ) : (
        <>
          <ol className="ruler" style={{ gridTemplateColumns: `repeat(${totalBars}, 1fr)` }} aria-hidden="true">
            {bars.map((bar) => (
              <li key={bar}>{bar}</li>
            ))}
          </ol>
          <ol className="track-list">
            {tracks.map((track) => {
              const before = previousById.get(track.id);
              const isNew = previousTracks !== undefined && before === undefined;
              const noteCount = track.clips.reduce((sum, clip) => sum + clip.notes.length, 0);
              return (
                <li key={track.id} className={isNew ? 'track flash' : 'track'}>
                  <div className="track-header">
                    <span className="track-name">{track.name}</span>
                    <span className="track-instrument">{track.instrument}</span>
                    <span className="track-contents">
                      {plural(track.clips.length, 'clip')} · {plural(noteCount, 'note')}
                    </span>
                  </div>
                  <TrackLane track={track} previousTrack={before} totalBars={totalBars} beatsInBar={beatsInBar} />
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
