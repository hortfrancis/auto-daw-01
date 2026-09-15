import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../shared/project.ts';
import { loadProject, saveProject } from './persistence.ts';

const project: Project = { name: 'Test', tempo: 97, timeSignature: [4, 4], tracks: [] };

let folder: string;
beforeEach(() => {
  folder = mkdtempSync(path.join(os.tmpdir(), 'auto-daw-persistence-'));
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('saveProject and loadProject', () => {
  it('round-trips a project through readable JSON, creating folders as needed', () => {
    const file = path.join(folder, 'default', 'project.json');

    saveProject(file, project);

    expect(loadProject(file)).toEqual(project);
    expect(readFileSync(file, 'utf8')).toContain('"tempo": 97');
    expect(existsSync(`${file}.saving`)).toBe(false);
  });

  it('returns undefined when nothing has been saved yet', () => {
    expect(loadProject(path.join(folder, 'missing.json'))).toBeUndefined();
  });

  it('moves an unreadable file aside instead of losing it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const file = path.join(folder, 'project.json');
    writeFileSync(file, '{ not json');

    expect(loadProject(file)).toBeUndefined();

    expect(existsSync(file)).toBe(false);
    expect(readdirSync(folder)).toEqual([expect.stringMatching(/^project\.json\.unreadable-/)]);
    expect(warn).toHaveBeenCalledOnce();
  });
});
