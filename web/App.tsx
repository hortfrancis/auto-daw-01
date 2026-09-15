import { useSyncExternalStore } from 'react';
import { ConnectionIndicator } from './components/ConnectionIndicator.tsx';
import { ProjectView } from './components/ProjectView.tsx';
import * as projectClient from './projectClient.ts';

export function App() {
  const { status, project, previous } = useSyncExternalStore(
    projectClient.subscribe,
    projectClient.getSnapshot,
  );

  return (
    <>
      <header className="topbar">
        <span className="brand">Auto DAW</span>
        <ConnectionIndicator status={status} />
      </header>
      {project && <ProjectView project={project} previous={previous} />}
    </>
  );
}
