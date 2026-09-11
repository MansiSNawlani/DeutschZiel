/**
 * v0 settings. Bring-your-own-key: each learner supplies their own Gemini API
 * key, held in this browser only. Nothing is sent anywhere except Google.
 *
 * See docs/adr/0001-v0-v1-split.md. There is deliberately no server holding a
 * secret, which is also why this app must never be deployed with a key baked in.
 */

const KEY = 'deutschziel.settings.v1';

export type Settings = {
  apiKey: string;
  /** Discovered at runtime from the key rather than hardcoded. See gemini.ts. */
  model: string;
  /**
   * Send the full Goethe B1 Wortliste as the vocabulary ceiling. It is the
   * largest part of each prompt, so it is switchable for when the free tier's
   * per-minute token limits bite.
   */
  useWortliste: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: '',
  useWortliste: true,
};

export function loadSettings(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private browsing, or storage disabled. The app still works for this session.
  }
}
