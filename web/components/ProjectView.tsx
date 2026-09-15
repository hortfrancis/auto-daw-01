import type { Project } from '../../shared/project.ts';
import { beatsPerBar, songLengthBars } from '../../shared/timing.ts';
import { TrackList } from './TrackList.tsx';

/** The piano rolls always show at least this many bars, so a short song isn't stretched. */
const MIN_BARS_SHOWN = 4;

type Props = {
  project: Project;
  /** The project before the latest update; changes from it get highlighted. */
  previous?: Project;
};

export function ProjectView({ project, previous }: Props) {
  const tempoChanged = previous !== undefined && previous.tempo !== project.tempo;

  return (
    <main className="project">
      <section className="project-header">
        <h1>{project.name}</h1>
        <dl className="meta">
          <div>
            <dt>Tempo</dt>
            {/* Keyed on the value so the highlight animation replays on each change. */}
            <dd key={project.tempo} className={tempoChanged ? 'flash' : undefined}>
              {project.tempo} BPM
            </dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{project.timeSignature.join('/')}</dd>
          </div>
        </dl>
      </section>
      <TrackList
        tracks={project.tracks}
        previousTracks={previous?.tracks}
        totalBars={Math.max(MIN_BARS_SHOWN, songLengthBars(project))}
        beatsInBar={beatsPerBar(project)}
      />
    </main>
  );
}
