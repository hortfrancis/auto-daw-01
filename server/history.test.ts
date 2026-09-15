import { describe, expect, it } from 'vitest';
import { createHistory } from './history.ts';

describe('createHistory', () => {
  it('undoes and redoes changes in order, with their labels', () => {
    const history = createHistory<number>(10);
    history.record('add 1', 0);
    history.record('add 2', 1);
    history.record('add 3', 3);

    const undone = history.undo(6, 2);
    expect(undone).toEqual({ state: 1, labels: ['add 3', 'add 2'] });
    expect(history.summary()).toEqual({ undoCount: 1, redoCount: 2, nextUndo: 'add 1', nextRedo: 'add 2' });

    const redone = history.redo(undone.state, 1);
    expect(redone).toEqual({ state: 3, labels: ['add 2'] });
    expect(history.summary()).toEqual({ undoCount: 2, redoCount: 1, nextUndo: 'add 2', nextRedo: 'add 3' });
  });

  it('clears redo when a new change is recorded', () => {
    const history = createHistory<string>(10);
    history.record('first', 'a');
    history.undo('b', 1);

    history.record('different', 'a');

    expect(history.summary().redoCount).toBe(0);
    expect(history.redo('c', 1)).toEqual({ state: 'c', labels: [] });
  });

  it('undoes only what there is, and forgets the oldest changes past its limit', () => {
    const history = createHistory<number>(2);
    history.record('one', 0);
    history.record('two', 1);
    history.record('three', 2);

    expect(history.undo(3, 5)).toEqual({ state: 1, labels: ['three', 'two'] });
  });
});
