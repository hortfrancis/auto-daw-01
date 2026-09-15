import type { Track } from '../../shared/project.ts';
import { plural } from '../format.ts';

type Props = {
  tracks: Track[];
  /** Tracks before the latest update; tracks not in it get highlighted. */
  previousTracks?: Track[];
};

export function TrackList({ tracks, previousTracks }: Props) {
  const knownIds = new Set(previousTracks?.map((t) => t.id));

  return (
    <section className="tracks">
      <h2>Tracks</h2>
      {tracks.length === 0 ? (
        <p className="empty">No tracks yet</p>
      ) : (
        <ol className="track-list">
          {tracks.map((track) => {
            const isNew = previousTracks !== undefined && !knownIds.has(track.id);
            const noteCount = track.clips.reduce((sum, clip) => sum + clip.notes.length, 0);
            return (
              <li key={track.id} className={isNew ? 'track flash' : 'track'}>
                <span className="track-name">{track.name}</span>
                <span className="track-instrument">{track.instrument}</span>
                <span className="track-contents">
                  {plural(track.clips.length, 'clip')} · {plural(noteCount, 'note')}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
