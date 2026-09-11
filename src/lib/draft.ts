/**
 * The in-progress submission, persisted on every keystroke.
 *
 * A reload used to lose the whole Aufgabe. Under exam conditions you have one
 * shot at a text and losing it is worse than annoying — it costs the practice.
 *
 * The whole Task is stored rather than its id, because generated tasks do not
 * exist in tasks.ts and could not be looked up again.
 */

import type { Task } from './types';

const KEY = 'deutschziel.draft.v1';

export type Draft = {
  task: Task;
  text: string;
  /** Seconds already spent. Time with the tab closed does not count. */
  elapsed: number;
  savedAt: string;
};

export function saveDraft(draft: Omit<Draft, 'savedAt'>): void {
  try {
    globalThis.localStorage?.setItem(
      KEY,
      JSON.stringify({ ...draft, savedAt: new Date().toISOString() }),
    );
  } catch {
    // Storage unavailable. The draft still survives in memory for this session.
  }
}

export function loadDraft(): Draft | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    return draft.task && typeof draft.text === 'string' ? draft : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // Nothing to clean up.
  }
}
