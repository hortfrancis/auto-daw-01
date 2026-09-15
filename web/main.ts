import type { Project } from '../shared/project.ts';
import type { ServerMessage } from '../shared/protocol.ts';

const connectionEl = document.querySelector<HTMLElement>('#connection')!;
const projectEl = document.querySelector<HTMLElement>('#project')!;

let previous: Project | undefined;
let retries = 0;

function connect() {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${scheme}://${location.host}/ws`);

  socket.addEventListener('open', () => {
    retries = 0;
    setConnection('ok', 'Live');
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data) as ServerMessage;
    if (message.type === 'project') render(message.project);
  });

  // Also fires when the server restarts: keep retrying, backing off to 5s.
  socket.addEventListener('close', () => {
    setConnection('error', 'Disconnected, retrying…');
    setTimeout(connect, Math.min(5000, 250 * 2 ** retries++));
  });
}

function setConnection(state: 'ok' | 'error', label: string) {
  connectionEl.dataset.state = state;
  connectionEl.textContent = label;
}

function render(project: Project) {
  const before = previous;
  previous = project;

  const tempo = el('dd', '', `${project.tempo} BPM`);
  if (before && before.tempo !== project.tempo) flash(tempo);

  const header = el(
    'section',
    'project-header',
    el('h1', '', project.name),
    el(
      'dl',
      'meta',
      el('div', '', el('dt', '', 'Tempo'), tempo),
      el('div', '', el('dt', '', 'Time'), el('dd', '', project.timeSignature.join('/'))),
    ),
  );

  const knownTrackIds = new Set(before?.tracks.map((t) => t.id));
  const trackRows = project.tracks.map((track) => {
    const noteCount = track.clips.reduce((sum, clip) => sum + clip.notes.length, 0);
    const row = el(
      'li',
      'track',
      el('span', 'track-name', track.name),
      el('span', 'track-instrument', track.instrument),
      el('span', 'track-contents', `${plural(track.clips.length, 'clip')} · ${plural(noteCount, 'note')}`),
    );
    if (before && !knownTrackIds.has(track.id)) flash(row);
    return row;
  });

  const tracks = el(
    'section',
    'tracks',
    el('h2', '', 'Tracks'),
    trackRows.length > 0 ? el('ol', 'track-list', ...trackRows) : el('p', 'empty', 'No tracks yet'),
  );

  projectEl.replaceChildren(header, tracks);
  projectEl.hidden = false;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, ...children: (Node | string)[]) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.append(...children);
  return element;
}

/** Highlights something that just changed. The CSS animation runs once. */
function flash(element: HTMLElement) {
  element.classList.add('flash');
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

connect();
