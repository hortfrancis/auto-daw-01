type Health = {
  ok: boolean;
  node: string;
  uptimeSeconds: number;
};

const statusEl = document.querySelector<HTMLParagraphElement>('#server-status')!;

async function checkServer() {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const health = (await res.json()) as Health;
    statusEl.textContent = `Server connected · Node ${health.node} · up ${health.uptimeSeconds}s`;
    statusEl.dataset.state = 'ok';
  } catch (err) {
    statusEl.textContent = `Server not reachable (${(err as Error).message})`;
    statusEl.dataset.state = 'error';
  }
}

checkServer();
