import type { ConnectionStatus } from '../projectClient.ts';

const LABELS: Record<ConnectionStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  disconnected: 'Disconnected, retrying…',
};

export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  return (
    <span id="connection" className="connection" data-state={status}>
      {LABELS[status]}
    </span>
  );
}
