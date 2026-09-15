type Entry<T> = { label: string; state: T };

/**
 * A labelled undo/redo history of whole-state snapshots. Recording a new
 * change clears anything that could have been redone.
 */
export function createHistory<T>(limit: number) {
  const undoStack: Entry<T>[] = [];
  const redoStack: Entry<T>[] = [];

  return {
    /** Records a change. `before` is the state the change replaced. */
    record(label: string, before: T) {
      undoStack.push({ label, state: before });
      if (undoStack.length > limit) undoStack.shift();
      redoStack.length = 0;
    },

    /** Steps back up to `steps` changes from `current`. Returns the state to switch to and what was undone, newest first. */
    undo(current: T, steps: number) {
      return step(undoStack, redoStack, current, steps);
    },

    /** Steps forward up to `steps` undone changes from `current`. */
    redo(current: T, steps: number) {
      return step(redoStack, undoStack, current, steps);
    },

    summary() {
      return {
        undoCount: undoStack.length,
        redoCount: redoStack.length,
        nextUndo: undoStack.at(-1)?.label,
        nextRedo: redoStack.at(-1)?.label,
      };
    },
  };
}

function step<T>(from: Entry<T>[], to: Entry<T>[], current: T, steps: number) {
  let state = current;
  const labels: string[] = [];
  while (labels.length < steps && from.length > 0) {
    const entry = from.pop()!;
    to.push({ label: entry.label, state });
    state = entry.state;
    labels.push(entry.label);
  }
  return { state, labels };
}
