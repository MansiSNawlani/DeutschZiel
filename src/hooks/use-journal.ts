import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { type FolderAccess, folderAccess, reconnectFolder } from '@/lib/journal';

export type JournalPhase = 'loading' | FolderAccess | 'error';

/**
 * The folder states every journal-reading screen has to handle, in one place.
 * `read` returns null when the grant is gone, which shows the reconnect state
 * rather than an empty journal.
 */
export function useJournal<T>(read: () => Promise<T | null>) {
  const [phase, setPhase] = useState<JournalPhase>('loading');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    // A refresh on refocus keeps what is on screen, so returning from an
    // Attempt does not blank the list and lose the scroll position.
    setPhase((p) => (p === 'ready' ? p : 'loading'));
    setError(null);
    try {
      const access = await folderAccess();
      if (access !== 'ready') {
        setPhase(access);
        return;
      }
      const result = await read();
      if (result === null) {
        setPhase('needs-permission');
        return;
      }
      setData(result);
      setPhase('ready');
    } catch (e) {
      setError(String(e));
      setPhase('error');
    }
  }, [read]);

  // Focus, not mount: coming back from a new Attempt should show fresh files.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const reconnect = useCallback(async () => {
    try {
      if (await reconnectFolder()) await reload();
    } catch (e) {
      setError(String(e));
      setPhase('error');
    }
  }, [reload]);

  return { phase, data, error, reconnect };
}
