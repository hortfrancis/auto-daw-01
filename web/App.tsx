import { useSyncExternalStore } from 'react';
import { ConnectionIndicator } from './components/ConnectionIndicator.tsx';
import { ProjectView } from './components/ProjectView.tsx';
import { Transport } from './components/Transport.tsx';
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
        <div className="topbar-controls">
          <Transport />
          <ConnectionIndicator status={status} />
        </div>
      </header>
      {project && <ProjectView project={project} previous={previous} />}
    </>
  );
}
