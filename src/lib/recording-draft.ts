/**
 * The unsubmitted Sprechen recording, kept on disk so that opening
 * Einstellungen, a reload, or a failed submission cannot cost a three-minute
 * recording.
 *
 * draft.ts does this job for Schreiben, but a WAV will not fit in localStorage,
 * so this uses IndexedDB. It opens its own database rather than the one
 * journal.ts uses: adding a store there would mean bumping that database's
 * version, and whichever module opened it first at the old version would fail.
 * The journal holds the learner's history and is not worth that risk.
 *
 * Only the current recording is kept. Recording again overwrites it, and it is
 * cleared once the Attempt has been graded, or when the learner discards it.
 *
 * Every export swallows its errors. IndexedDB is unavailable in some private
 * browsing modes, and losing persistence is bad but crashing mid-recording is
 * worse. Same bargain as settings.ts and draft.ts.
 */

import type { Recording } from './audio';
import type { SpeakingTask } from './speaking';

const DB = 'deutschziel-recording';
const STORE = 'recordings';
const KEY = 'current';

export type RecordingDraft = {
  /** WAV, 16 kHz mono, exactly as audio.ts produced it. */
  wav: Blob;
  seconds: number;
  task: SpeakingTask;
  savedAt: string;
};

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // Without this a blocked open never settles, and the caller waits forever
    // instead of falling back to no persistence.
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

function write(apply: (store: IDBObjectStore) => void): Promise<void> {
  return idb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        apply(tx.objectStore(STORE));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export async function saveRecordingDraft(
  recording: Recording,
  task: SpeakingTask,
): Promise<void> {
  try {
    const draft: RecordingDraft = {
      wav: recording.wav,
      seconds: recording.seconds,
      task,
      savedAt: new Date().toISOString(),
    };
    await write((store) => store.put(draft, KEY));
  } catch {
    // Keep going without persistence.
  }
}

export async function loadRecordingDraft(): Promise<RecordingDraft | null> {
  try {
    const db = await idb();
    const draft = await new Promise<RecordingDraft | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as RecordingDraft | undefined);
      req.onerror = () => reject(req.error);
    });
    // An entry whose blob did not survive is worse than none: it would restore
    // an empty review screen with nothing to submit.
    if (!draft?.wav || !draft.task) return null;
    return draft;
  } catch {
    return null;
  }
}

export async function clearRecordingDraft(): Promise<void> {
  try {
    await write((store) => store.delete(KEY));
  } catch {
    // Nothing to do. A stale draft is overwritten by the next recording.
  }
}
