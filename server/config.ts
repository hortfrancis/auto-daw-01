import path from 'node:path';

export const PORT = Number(process.env.PORT ?? 4747);
export const UI_URL = `http://localhost:${PORT}`;

/** Where projects are saved. */
export const PROJECTS_DIR = process.env.PROJECTS_DIR ?? path.resolve(import.meta.dirname, '../projects');
/** The project the server works on. One at a time, for now. */
export const PROJECT_FILE = path.join(PROJECTS_DIR, 'default', 'project.json');

/** Where rendered WAV files are saved. */
export const RENDERS_DIR = process.env.RENDERS_DIR ?? path.resolve(import.meta.dirname, '../renders');
export const RENDER_SAMPLE_RATE = 48_000;
