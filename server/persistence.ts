import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Project } from '../shared/project.ts';

/**
 * Reads a saved project, or returns undefined if there isn't one. A file that
 * can't be read is moved aside rather than overwritten, so nothing is lost.
 */
export function loadProject(file: string): Project | undefined {
  if (!existsSync(file)) return undefined;
  try {
    const project: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!looksLikeProject(project)) throw new Error("it doesn't look like a project");
    return project;
  } catch (err) {
    const aside = `${file}.unreadable-${new Date().toISOString().replaceAll(':', '-')}`;
    renameSync(file, aside);
    console.warn(`[projects] Couldn't read ${file} (${(err as Error).message}). Moved it to ${aside} and started a new project.`);
    return undefined;
  }
}

/**
 * Saves a project as readable JSON. Writes a temporary file and renames it
 * over the old one, so a crash mid-save can't leave a half-written project.
 */
export function saveProject(file: string, project: Project) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.saving`;
  writeFileSync(temporary, `${JSON.stringify(project, null, 2)}\n`);
  renameSync(temporary, file);
}

function looksLikeProject(value: unknown): value is Project {
  const candidate = value as Partial<Project> | null;
  return (
    typeof candidate?.name === 'string' &&
    typeof candidate.tempo === 'number' &&
    Array.isArray(candidate.timeSignature) &&
    Array.isArray(candidate.tracks)
  );
}
